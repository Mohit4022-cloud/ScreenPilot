import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';
import { FallbackScreenshotManager } from './FallbackScreenshotManager';

export interface ScreenshotData {
  timestamp: number;
  width: number;
  height: number;
  buffer: Buffer;
  displayId: number;
  changePercent: number;
  hash?: string;
}

export interface ScreenshotManagerOptions {
  interval?: number;
  quality?: number;
  diffThreshold?: number;
  gpuAccelerated?: boolean;
  outputFormat?: 'buffer' | 'shared-memory' | 'file';
  maxWidth?: number;
  maxHeight?: number;
}

export class NativeScreenshotManager extends EventEmitter {
  private screenshotterPath: string;
  private process: ChildProcess | null = null;
  private options: ScreenshotManagerOptions;
  private isRunning = false;
  private frameCount = 0;
  private startTime = 0;
  private fallbackManager: FallbackScreenshotManager | null = null;
  private useFallback = false;
  
  constructor(options: ScreenshotManagerOptions = {}) {
    super();
    
    this.options = {
      interval: 200,           // 5 FPS default
      quality: 85,
      diffThreshold: 1,        // 1% change detection
      gpuAccelerated: true,
      outputFormat: 'buffer',
      maxWidth: 1920,
      maxHeight: 1080,
      ...options
    };
    
    // Path to compiled auto-screenshooter
    this.screenshotterPath = this.getNativeBinaryPath();
  }

  private getNativeBinaryPath(): string {
    // Check if we're in development or production
    if (app.isPackaged) {
      // Production: binary is in resources
      return path.join(
        process.resourcesPath,
        'native',
        'screenshooter',
        process.platform === 'darwin' ? 'screenshooter' : 'screenshooter.exe'
      );
    } else {
      // Development: binary is in native directory
      return path.join(
        __dirname, 
        '../../../native/screenshooter/build/Release/screenshooter'
      );
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Screenshot manager already running');
      return;
    }

    // Check if native binary exists
    let binaryExists = await fs.pathExists(this.screenshotterPath);
    
    if (!binaryExists) {
      // Try to find auto-screenshooter binary
      const fallbackPath = await this.findAutoScreenshooterBinary();
      if (fallbackPath) {
        this.screenshotterPath = fallbackPath;
        binaryExists = true;
      }
    }
    
    // If still no binary, use fallback
    if (!binaryExists) {
      console.warn('Native screenshooter binary not found. Using fallback implementation.');
      this.useFallback = true;
      this.fallbackManager = new FallbackScreenshotManager({
        interval: this.options.interval
      });
      
      // Forward events from fallback
      this.fallbackManager.on('screenshot', (data) => this.emit('screenshot', data));
      this.fallbackManager.on('stats', (stats) => this.emit('stats', stats));
      this.fallbackManager.on('error', (error) => this.emit('error', error));
      this.fallbackManager.on('started', () => {
        this.isRunning = true;
        this.emit('started');
      });
      this.fallbackManager.on('stopped', (info) => {
        this.isRunning = false;
        this.emit('stopped', info);
      });
      
      await this.fallbackManager.start();
      return;
    }

    // Launch with optimized settings
    const args = [
      '--interval', this.options.interval!.toString(),
      '--quality', this.options.quality!.toString(),
      '--diff-threshold', this.options.diffThreshold!.toString(),
      '--max-width', this.options.maxWidth!.toString(),
      '--max-height', this.options.maxHeight!.toString(),
      '--output-format', this.options.outputFormat!
    ];

    if (this.options.gpuAccelerated) {
      args.push('--gpu-accelerated');
    }

    if (process.platform === 'darwin') {
      args.push('--use-metal'); // Use Metal API on macOS
    }

    this.process = spawn(this.screenshotterPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
      }
    });

    this.setupHandlers();
    this.isRunning = true;
    this.startTime = Date.now();
    this.frameCount = 0;
    
    this.emit('started');
    console.log('Native screenshot manager started');
  }

  private setupHandlers(): void {
    if (!this.process) return;

    // Handle stdout for screenshot data
    this.process.stdout!.on('data', (data: Buffer) => {
      try {
        const messages = data.toString().trim().split('\n');
        
        for (const message of messages) {
          if (message.startsWith('SCREENSHOT:')) {
            this.handleScreenshotMessage(message);
          } else if (message.startsWith('STATS:')) {
            this.handleStatsMessage(message);
          } else if (message.startsWith('ERROR:')) {
            this.handleErrorMessage(message);
          }
        }
      } catch (error) {
        console.error('Error processing screenshot data:', error);
        this.emit('error', error);
      }
    });

    // Handle stderr for errors
    this.process.stderr!.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      console.error('Screenshot process error:', error);
      this.emit('error', new Error(error));
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.isRunning = false;
      this.process = null;
      
      if (code !== 0) {
        this.emit('error', new Error(`Screenshot process exited with code ${code}`));
      }
      
      this.emit('stopped', { code, signal });
    });

    // Handle process errors
    this.process.on('error', (error) => {
      console.error('Failed to start screenshot process:', error);
      this.isRunning = false;
      this.process = null;
      this.emit('error', error);
    });
  }

  private handleScreenshotMessage(message: string): void {
    try {
      // Parse the screenshot data
      // Format: SCREENSHOT:timestamp,width,height,displayId,changePercent,dataLength:base64data
      const parts = message.substring(11).split(':');
      const metadata = parts[0].split(',');
      const base64Data = parts[1];
      
      const screenshotData: ScreenshotData = {
        timestamp: parseInt(metadata[0]),
        width: parseInt(metadata[1]),
        height: parseInt(metadata[2]),
        displayId: parseInt(metadata[3]),
        changePercent: parseFloat(metadata[4]),
        buffer: Buffer.from(base64Data, 'base64')
      };
      
      // Add hash if provided
      if (metadata[5]) {
        screenshotData.hash = metadata[5];
      }
      
      this.frameCount++;
      this.emit('screenshot', screenshotData);
      
      // Emit frame event for compatibility
      this.emit('frame', {
        buffer: screenshotData.buffer,
        timestamp: screenshotData.timestamp,
        width: screenshotData.width,
        height: screenshotData.height,
        changePercent: screenshotData.changePercent,
        hash: screenshotData.hash,
        regions: []
      });
    } catch (error) {
      console.error('Error parsing screenshot data:', error);
      this.emit('error', error);
    }
  }

  private handleStatsMessage(message: string): void {
    try {
      // Parse stats data
      // Format: STATS:fps,avgCaptureTime,memoryUsage,cpuUsage
      const stats = message.substring(6).split(',');
      
      this.emit('stats', {
        fps: parseFloat(stats[0]),
        avgCaptureTime: parseFloat(stats[1]),
        memoryUsage: parseFloat(stats[2]),
        cpuUsage: parseFloat(stats[3]),
        frameCount: this.frameCount,
        uptime: Date.now() - this.startTime
      });
    } catch (error) {
      console.error('Error parsing stats data:', error);
    }
  }

  private handleErrorMessage(message: string): void {
    const error = message.substring(6);
    console.error('Screenshot error:', error);
    this.emit('error', new Error(error));
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // If using fallback, stop it
    if (this.useFallback && this.fallbackManager) {
      await this.fallbackManager.stop();
      this.fallbackManager = null;
      this.useFallback = false;
      this.isRunning = false;
      return;
    }

    // Otherwise stop native process
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      if (this.process) {
        this.process.once('exit', () => {
          this.isRunning = false;
          this.process = null;
          resolve();
        });
        
        // Send graceful shutdown signal
        this.process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
      } else {
        resolve();
      }
    });
  }

  async updateConfig(config: Partial<ScreenshotManagerOptions>): Promise<void> {
    this.options = { ...this.options, ...config };
    
    // If running, restart with new config
    if (this.isRunning) {
      await this.stop();
      await this.start();
    }
  }

  getStats(): any {
    // If using fallback, return its stats
    if (this.useFallback && this.fallbackManager) {
      return this.fallbackManager.getStats();
    }

    return {
      isRunning: this.isRunning,
      frameCount: this.frameCount,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      fps: this.frameCount / ((Date.now() - this.startTime) / 1000),
      options: this.options,
      usingFallback: this.useFallback
    };
  }

  private async findAutoScreenshooterBinary(): Promise<string | null> {
    // Try to find the auto-screenshooter binary in common locations
    const possiblePaths = [
      path.join(app.getPath('home'), '.auto-screenshooter', 'bin', 'screenshooter'),
      path.join('/usr/local/bin', 'auto-screenshooter'),
      path.join('/opt/auto-screenshooter', 'bin', 'screenshooter')
    ];
    
    for (const binPath of possiblePaths) {
      if (await fs.pathExists(binPath)) {
        console.log(`Found auto-screenshooter binary at: ${binPath}`);
        return binPath;
      }
    }
    
    return null;
  }

  private async buildNativeBinary(): Promise<void> {
    console.log('Building native screenshooter...');
    
    const projectPath = path.join(__dirname, '../../../native/screenshooter');
    
    // Check if we're on macOS and use xcodebuild
    if (process.platform === 'darwin') {
      const buildProcess = spawn('xcodebuild', [
        '-project', path.join(projectPath, 'screenshooter.xcodeproj'),
        '-scheme', 'screenshooter',
        '-configuration', 'Release',
        '-derivedDataPath', './build'
      ], {
        cwd: projectPath
      });

      return new Promise((resolve, reject) => {
        buildProcess.on('exit', (code) => {
          if (code === 0) {
            console.log('Native binary built successfully');
            resolve();
          } else {
            reject(new Error(`Build failed with code ${code}`));
          }
        });
      });
    } else {
      // For other platforms, use cmake or make
      throw new Error('Building on non-macOS platforms not yet implemented');
    }
  }
}

// Export for use in other modules
export default NativeScreenshotManager;
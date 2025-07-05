import { EventEmitter } from 'events';
import { NativeScreenshotManager, ScreenshotData } from '../native/ScreenshotManager';
import sharp from 'sharp';
import * as crypto from 'crypto';

export interface OptimizedNativeFrame {
  buffer: Buffer;
  timestamp: number;
  width: number;
  height: number;
  displayId: number;
  changePercent: number;
  hash: string;
  regions: FrameRegion[];
}

export interface FrameRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'active_window' | 'cursor_region' | 'change_area';
  priority: number;
}

export interface NativeScreenshooterConfig {
  captureRate?: number;
  jpegQuality?: number;
  maxWidth?: number;
  maxHeight?: number;
  enableDiffDetection?: boolean;
  changeThreshold?: number;
  focusAreas?: string[];
}

export class GPT4ONativeScreenshooter extends EventEmitter {
  private nativeManager: NativeScreenshotManager;
  private config: Required<NativeScreenshooterConfig>;
  private lastFrame: OptimizedNativeFrame | null = null;
  private frameCount = 0;
  private isRunning = false;
  
  constructor(config: NativeScreenshooterConfig = {}) {
    super();
    
    this.config = {
      captureRate: config.captureRate || 5,
      jpegQuality: config.jpegQuality || 85,
      maxWidth: config.maxWidth || 1024,
      maxHeight: config.maxHeight || 1024,
      enableDiffDetection: config.enableDiffDetection !== false,
      changeThreshold: config.changeThreshold || 0.5,
      focusAreas: config.focusAreas || ['active_window', 'cursor_region', 'change_areas']
    };
    
    // Initialize native manager with optimized settings
    this.nativeManager = new NativeScreenshotManager({
      interval: Math.floor(1000 / this.config.captureRate),
      quality: this.config.jpegQuality,
      diffThreshold: this.config.changeThreshold,
      gpuAccelerated: true,
      outputFormat: 'buffer',
      maxWidth: this.config.maxWidth,
      maxHeight: this.config.maxHeight
    });
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.nativeManager.on('screenshot', async (data: ScreenshotData) => {
      try {
        const frame = await this.processScreenshot(data);
        
        // Skip if no significant change detected
        if (this.config.enableDiffDetection && frame.changePercent < this.config.changeThreshold) {
          return;
        }
        
        this.lastFrame = frame;
        this.frameCount++;
        this.emit('frame', frame);
      } catch (error) {
        console.error('Error processing screenshot:', error);
        this.emit('error', error);
      }
    });
    
    this.nativeManager.on('error', (error) => {
      this.emit('error', error);
    });
    
    this.nativeManager.on('stats', (stats) => {
      this.emit('stats', {
        ...stats,
        processedFrames: this.frameCount
      });
    });
  }

  private async processScreenshot(data: ScreenshotData): Promise<OptimizedNativeFrame> {
    // Resize if needed
    let buffer = data.buffer;
    let { width, height } = data;
    
    if (width > this.config.maxWidth || height > this.config.maxHeight) {
      const resized = await sharp(data.buffer)
        .resize(this.config.maxWidth, this.config.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: this.config.jpegQuality })
        .toBuffer();
      
      const metadata = await sharp(resized).metadata();
      buffer = resized;
      width = metadata.width!;
      height = metadata.height!;
    }
    
    // Generate perceptual hash
    const hash = await this.generatePerceptualHash(buffer);
    
    // Detect regions of interest
    const regions = await this.detectRegions(buffer, width, height);
    
    return {
      buffer,
      timestamp: data.timestamp,
      width,
      height,
      displayId: data.displayId,
      changePercent: data.changePercent,
      hash,
      regions
    };
  }

  private async generatePerceptualHash(buffer: Buffer): Promise<string> {
    // Simple perceptual hash using downscaled grayscale
    const thumbnail = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();
    
    // Convert to binary hash
    const avg = thumbnail.reduce((sum: number, val: number) => sum + val, 0) / thumbnail.length;
    const bits = Array.from(thumbnail).map((val: number) => val > avg ? '1' : '0').join('');
    
    // Convert to hex
    return parseInt(bits, 2).toString(16).padStart(16, '0');
  }

  private async detectRegions(buffer: Buffer, width: number, height: number): Promise<FrameRegion[]> {
    const regions: FrameRegion[] = [];
    
    // For now, return basic regions
    // In a real implementation, this would detect active windows, cursor position, etc.
    
    // Add center region as high priority
    regions.push({
      x: Math.floor(width * 0.25),
      y: Math.floor(height * 0.25),
      width: Math.floor(width * 0.5),
      height: Math.floor(height * 0.5),
      type: 'active_window',
      priority: 10
    });
    
    // Add cursor region (mock - would need actual cursor position)
    regions.push({
      x: Math.floor(width * 0.4),
      y: Math.floor(height * 0.4),
      width: 200,
      height: 200,
      type: 'cursor_region',
      priority: 8
    });
    
    return regions;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    await this.nativeManager.start();
    this.isRunning = true;
    this.frameCount = 0;
    
    console.log('GPT-4o Native Screenshooter: Started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    await this.nativeManager.stop();
    this.isRunning = false;
    
    console.log('GPT-4o Native Screenshooter: Stopped');
  }

  updateConfig(config: Partial<NativeScreenshooterConfig>): void {
    this.config = { ...this.config, ...config as any };
    
    // Update native manager config
    this.nativeManager.updateConfig({
      interval: Math.floor(1000 / this.config.captureRate),
      quality: this.config.jpegQuality,
      diffThreshold: this.config.changeThreshold,
      maxWidth: this.config.maxWidth,
      maxHeight: this.config.maxHeight
    });
  }

  getStats(): any {
    const nativeStats = this.nativeManager.getStats();
    
    return {
      ...nativeStats,
      processedFrames: this.frameCount,
      config: this.config
    };
  }

  // Calculate Hamming distance between two hashes
  getHashDistance(hash1: string, hash2: string): number {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) {
      return Infinity;
    }
    
    let distance = 0;
    const h1 = BigInt('0x' + hash1);
    const h2 = BigInt('0x' + hash2);
    let xor = h1 ^ h2;
    
    while (xor > 0n) {
      distance += Number(xor & 1n);
      xor >>= 1n;
    }
    
    return distance;
  }
}
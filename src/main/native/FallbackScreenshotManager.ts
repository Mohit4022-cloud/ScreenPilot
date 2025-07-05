import { EventEmitter } from 'events';
const screenshot = require('screenshot-desktop');
import { ScreenshotData } from './ScreenshotManager';
import * as crypto from 'crypto';

/**
 * Fallback screenshot manager using screenshot-desktop
 * Used when native binary is not available
 */
export class FallbackScreenshotManager extends EventEmitter {
  private interval: NodeJS.Timeout | null = null;
  private lastHash: string | null = null;
  private frameCount = 0;
  private startTime = 0;
  private captureInterval: number;
  
  constructor(options: { interval?: number } = {}) {
    super();
    this.captureInterval = options.interval || 200; // Default 5 FPS
  }

  async start(): Promise<void> {
    if (this.interval) {
      console.log('Fallback screenshot manager already running');
      return;
    }

    this.startTime = Date.now();
    this.frameCount = 0;
    
    console.log('Starting fallback screenshot manager (using screenshot-desktop)');
    
    // Start capturing at specified interval
    this.interval = setInterval(async () => {
      try {
        await this.captureFrame();
      } catch (error) {
        console.error('Screenshot capture error:', error);
        this.emit('error', error);
      }
    }, this.captureInterval);
    
    this.emit('started');
  }

  private async captureFrame(): Promise<void> {
    try {
      // Capture screenshot
      const buffer = await screenshot({ format: 'jpg' });
      
      // Calculate hash for change detection
      const hash = crypto
        .createHash('md5')
        .update(buffer)
        .digest('hex');
      
      // Simple change detection
      let changePercent = 0;
      if (this.lastHash) {
        changePercent = hash === this.lastHash ? 0 : 10; // Simple binary change
      }
      this.lastHash = hash;
      
      // Emit screenshot data
      const data: ScreenshotData = {
        timestamp: Date.now(),
        width: 1920, // Default, actual size would need to be detected
        height: 1080,
        buffer,
        displayId: 0,
        changePercent,
        hash
      };
      
      this.frameCount++;
      this.emit('screenshot', data);
      
      // Emit stats periodically
      if (this.frameCount % 30 === 0) {
        this.emitStats();
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      this.emit('error', error);
    }
  }

  private emitStats(): void {
    const uptime = (Date.now() - this.startTime) / 1000;
    const fps = this.frameCount / uptime;
    
    this.emit('stats', {
      fps,
      avgCaptureTime: this.captureInterval,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: process.cpuUsage().user / 1000000,
      frameCount: this.frameCount,
      uptime: uptime * 1000
    });
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.emit('stopped', { code: 0, signal: null });
      console.log('Fallback screenshot manager stopped');
    }
  }

  getStats(): any {
    const uptime = this.interval ? (Date.now() - this.startTime) / 1000 : 0;
    
    return {
      isRunning: !!this.interval,
      frameCount: this.frameCount,
      uptime: uptime * 1000,
      fps: uptime > 0 ? this.frameCount / uptime : 0,
      options: {
        interval: this.captureInterval
      }
    };
  }
}
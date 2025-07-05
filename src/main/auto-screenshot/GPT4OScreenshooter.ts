import { EventEmitter } from 'events';
import { screen, desktopCapturer, Rectangle } from 'electron';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';

export interface CaptureRegion {
  type: 'active_window' | 'cursor_region' | 'change_area' | 'full_screen';
  bounds: Rectangle;
  priority: number;
}

export interface OptimizedFrame {
  buffer: Buffer;
  regions: CaptureRegion[];
  hash: string;
  timestamp: number;
  changePercent: number;
}

export interface ScreenshooterConfig {
  captureRate?: number; // FPS
  maxWidth?: number;
  maxHeight?: number;
  focusAreas?: string[];
  changeThreshold?: number;
  jpegQuality?: number;
  enableDiffDetection?: boolean;
}

export class GPT4OScreenshooter extends EventEmitter {
  private config: Required<ScreenshooterConfig>;
  private isRunning = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private lastFrame: Buffer | null = null;
  private lastFrameHash: string | null = null;
  private frameCount = 0;
  private outputPath: string;

  constructor(config?: ScreenshooterConfig) {
    super();
    
    this.config = {
      captureRate: config?.captureRate || 5, // 5 FPS for GPT-4o
      maxWidth: config?.maxWidth || 1024,
      maxHeight: config?.maxHeight || 1024,
      focusAreas: config?.focusAreas || ['active_window', 'cursor_region', 'change_areas'],
      changeThreshold: config?.changeThreshold || 0.5, // 0.5% change threshold
      jpegQuality: config?.jpegQuality || 85,
      enableDiffDetection: config?.enableDiffDetection !== false
    };
    
    this.outputPath = path.join(app.getPath('userData'), 'gpt4o-captures');
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    // Ensure output directory exists
    await fs.mkdir(this.outputPath, { recursive: true });
    
    this.isRunning = true;
    this.emit('started');
    
    // Start capture loop
    const intervalMs = 1000 / this.config.captureRate;
    this.captureLoop(intervalMs);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.captureInterval) {
      clearTimeout(this.captureInterval);
      this.captureInterval = null;
    }
    
    this.emit('stopped');
  }

  private async captureLoop(intervalMs: number): Promise<void> {
    if (!this.isRunning) return;
    
    const startTime = Date.now();
    
    try {
      const frame = await this.captureOptimizedFrame();
      
      if (frame) {
        this.emit('frame', frame);
        this.frameCount++;
        
        // Performance metrics
        const captureTime = Date.now() - startTime;
        if (this.frameCount % 30 === 0) { // Every 30 frames
          this.emit('metrics', {
            fps: this.config.captureRate,
            avgCaptureTime: captureTime,
            framesProcessed: this.frameCount
          });
        }
      }
    } catch (error) {
      console.error('Capture error:', error);
      this.emit('error', error);
    }
    
    // Schedule next capture
    const elapsed = Date.now() - startTime;
    const nextDelay = Math.max(0, intervalMs - elapsed);
    this.captureInterval = setTimeout(() => this.captureLoop(intervalMs), nextDelay);
  }

  private async captureOptimizedFrame(): Promise<OptimizedFrame | null> {
    // Detect active regions based on config
    const regions = await this.detectActiveRegions();
    
    // Capture the primary region (highest priority)
    const primaryRegion = regions[0];
    if (!primaryRegion) return null;
    
    // Capture screenshot
    const screenshot = await this.captureRegion(primaryRegion.bounds);
    if (!screenshot) return null;
    
    // Optimize for GPT-4o
    const optimized = await this.optimizeForGPT4O(screenshot);
    
    // Calculate hash for diff detection
    const hash = await this.calculatePerceptualHash(optimized);
    
    // Check if frame changed enough
    let changePercent = 100; // Default to full change
    if (this.config.enableDiffDetection && this.lastFrameHash) {
      changePercent = this.calculateChangePercent(hash, this.lastFrameHash);
      
      if (changePercent < this.config.changeThreshold) {
        return null; // Not enough change
      }
    }
    
    // Update last frame
    this.lastFrame = optimized;
    this.lastFrameHash = hash;
    
    return {
      buffer: optimized,
      regions,
      hash,
      timestamp: Date.now(),
      changePercent
    };
  }

  private async detectActiveRegions(): Promise<CaptureRegion[]> {
    const regions: CaptureRegion[] = [];
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const cursorPoint = screen.getCursorScreenPoint();
    
    // Active window detection (highest priority)
    if (this.config.focusAreas.includes('active_window')) {
      // In production, this would use native APIs to get active window bounds
      // For now, we'll use the primary display
      regions.push({
        type: 'active_window',
        bounds: primaryDisplay.bounds,
        priority: 10
      });
    }
    
    // Cursor region (medium priority)
    if (this.config.focusAreas.includes('cursor_region')) {
      const cursorRegionSize = 400;
      const halfSize = cursorRegionSize / 2;
      
      regions.push({
        type: 'cursor_region',
        bounds: {
          x: Math.max(0, cursorPoint.x - halfSize),
          y: Math.max(0, cursorPoint.y - halfSize),
          width: cursorRegionSize,
          height: cursorRegionSize
        },
        priority: 5
      });
    }
    
    // Full screen fallback (lowest priority)
    regions.push({
      type: 'full_screen',
      bounds: primaryDisplay.bounds,
      priority: 1
    });
    
    // Sort by priority
    return regions.sort((a, b) => b.priority - a.priority);
  }

  private async captureRegion(bounds: Rectangle): Promise<Buffer | null> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: bounds.width * 2, // 2x for retina
          height: bounds.height * 2
        }
      });
      
      if (sources.length === 0) return null;
      
      // Get the primary display source
      const source = sources[0];
      const image = source.thumbnail;
      
      // Convert to buffer
      return image.toPNG();
    } catch (error) {
      console.error('Region capture error:', error);
      return null;
    }
  }

  private async optimizeForGPT4O(buffer: Buffer): Promise<Buffer> {
    // GPT-4o works best with specific resolutions and formats
    const optimized = await sharp(buffer)
      .resize(this.config.maxWidth, this.config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: this.config.jpegQuality,
        progressive: true,
        mozjpeg: true // Better compression
      })
      .toBuffer();
    
    return optimized;
  }

  private async calculatePerceptualHash(buffer: Buffer): Promise<string> {
    // Simple perceptual hash for diff detection
    const thumbnail = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();
    
    // Convert to binary hash
    const avg = thumbnail.reduce((sum, val) => sum + val, 0) / thumbnail.length;
    let hash = '';
    
    for (const pixel of thumbnail) {
      hash += pixel > avg ? '1' : '0';
    }
    
    return hash;
  }

  private calculateChangePercent(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 100;
    
    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) differences++;
    }
    
    return (differences / hash1.length) * 100;
  }

  // Get current configuration
  getConfig(): ScreenshooterConfig {
    return { ...this.config };
  }

  // Update configuration on the fly
  updateConfig(newConfig: Partial<ScreenshooterConfig>): void {
    Object.assign(this.config, newConfig);
    
    // Restart if running to apply new config
    if (this.isRunning) {
      this.stop().then(() => this.start());
    }
  }

  // Get performance stats
  getStats(): {
    framesProcessed: number;
    isRunning: boolean;
    currentFPS: number;
  } {
    return {
      framesProcessed: this.frameCount,
      isRunning: this.isRunning,
      currentFPS: this.config.captureRate
    };
  }
}
import { spawn, ChildProcess, exec } from 'child_process';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as chokidar from 'chokidar';
import sharp from 'sharp';
import OpenAI from 'openai';
import { app } from 'electron';

const execAsync = promisify(exec);

export interface AutoScreenshotConfig {
  screenshotInterval?: number;
  outputPath?: string;
  apiKey: string;
  repoUrl?: string;
  installPath?: string;
  imageFormat?: 'png' | 'jpg';
  compressionQuality?: number;
}

export interface ScreenAnalysis {
  summary: string;
  application: string;
  suggestions: string[];
  errors: string[];
  shortcuts: string[];
  confidence: number;
  timestamp: number;
}

export interface ScreenInsight {
  timestamp: number;
  filepath: string;
  analysis: ScreenAnalysis;
  suggestions: string[];
}

export class AutoScreenshotIntegration extends EventEmitter {
  private screenshotProcess: ChildProcess | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private openai: OpenAI;
  private screenshotPath: string;
  private processingQueue: Set<string> = new Set();
  private isRunning = false;
  
  // Performance optimizations
  private readonly DEBOUNCE_MS = 100;
  private readonly MAX_CONCURRENT = 3;
  private lastProcessTime = 0;
  private processedHashes = new Map<string, ScreenAnalysis>();
  
  private config: Required<AutoScreenshotConfig>;

  constructor(config: AutoScreenshotConfig) {
    super();
    
    this.config = {
      screenshotInterval: config.screenshotInterval || 1000,
      outputPath: config.outputPath || path.join(app.getPath('userData'), 'auto-screenshots'),
      apiKey: config.apiKey,
      repoUrl: config.repoUrl || 'https://github.com/underhubber/macos-auto-screenshooter.git',
      installPath: config.installPath || path.join(app.getPath('userData'), 'screenshooter'),
      imageFormat: config.imageFormat || 'png',
      compressionQuality: config.compressionQuality || 80
    };
    
    this.screenshotPath = this.config.outputPath;
    this.openai = new OpenAI({ apiKey: this.config.apiKey });
  }

  // 🚀 Start the auto-screenshot engine
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Auto-screenshot already running');
      return;
    }

    try {
      // Ensure output directory exists
      await fs.mkdir(this.screenshotPath, { recursive: true });
      
      // Install screenshooter if needed
      await this.ensureScreenshooterInstalled();
      
      // Start screenshot daemon
      await this.startScreenshotDaemon();
      
      // Setup file watcher
      this.setupFileWatcher();
      
      // Start AI processing pipeline
      this.startProcessingPipeline();
      
      this.isRunning = true;
      this.emit('started');
      console.log('🎯 ScreenPilot Auto-Capture: ACTIVATED');
    } catch (error) {
      console.error('Failed to start auto-screenshot:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // 🛑 Stop the auto-screenshot engine
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('Stopping auto-screenshot...');
    
    // Stop screenshot process
    if (this.screenshotProcess) {
      this.screenshotProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.screenshotProcess.killed) {
        this.screenshotProcess.kill('SIGKILL');
      }
      this.screenshotProcess = null;
    }

    // Stop file watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Clear processing queue
    this.processingQueue.clear();
    
    this.isRunning = false;
    this.emit('stopped');
    console.log('✅ Auto-screenshot stopped');
  }

  // 📦 Ensure screenshooter is installed
  private async ensureScreenshooterInstalled(): Promise<string> {
    const screenshotterPath = path.join(this.config.installPath, 'screenshooter');
    
    try {
      // Check if already exists
      await fs.access(screenshotterPath);
      return screenshotterPath;
    } catch {
      // Need to install
      console.log('Installing macos-auto-screenshooter...');
      
      // Clone repository
      await execAsync(`git clone ${this.config.repoUrl} ${this.config.installPath}`);
      
      // Build based on project type
      await this.buildScreenshooter();
      
      return screenshotterPath;
    }
  }

  // 🏗️ Build the screenshooter
  private async buildScreenshooter(): Promise<void> {
    const files = await fs.readdir(this.config.installPath);
    
    if (files.includes('requirements.txt')) {
      // Python project
      console.log('🐍 Building Python project...');
      await execAsync(`cd ${this.config.installPath} && pip3 install -r requirements.txt`);
    } else if (files.includes('Package.swift')) {
      // Swift project
      console.log('🦉 Building Swift project...');
      await execAsync(`cd ${this.config.installPath} && swift build -c release`);
    } else if (files.includes('Makefile')) {
      // C/C++ project
      console.log('⚙️ Building with Makefile...');
      await execAsync(`cd ${this.config.installPath} && make`);
    }
  }

  // 🎬 Start screenshot daemon
  private async startScreenshotDaemon(): Promise<void> {
    const screenshotterPath = await this.ensureScreenshooterInstalled();
    
    // Build arguments
    const args = [
      '--interval', String(this.config.screenshotInterval / 1000),
      '--output', this.screenshotPath,
      '--format', this.config.imageFormat,
      '--quality', String(this.config.compressionQuality),
      '--diff-threshold', '0.01', // Only save if 1% pixels changed
      '--max-files', '100', // Rotating buffer
      '--timestamp', 'true'
    ];

    // For now, simulate with screenshot-desktop periodic captures
    // In production, this would launch the actual macos-auto-screenshooter
    this.simulateScreenshotDaemon();
  }

  // 📸 Simulate screenshot daemon (temporary until actual integration)
  private simulateScreenshotDaemon(): void {
    const captureScreenshot = async () => {
      if (!this.isRunning) return;

      try {
        const screenshot = await import('screenshot-desktop');
        const buffer = await screenshot.default();
        
        const filename = `screenshot_${Date.now()}.${this.config.imageFormat}`;
        const filepath = path.join(this.screenshotPath, filename);
        
        await fs.writeFile(filepath, buffer);
        
        // Trigger next capture
        setTimeout(captureScreenshot, this.config.screenshotInterval);
      } catch (error) {
        console.error('Screenshot capture error:', error);
        setTimeout(captureScreenshot, this.config.screenshotInterval);
      }
    };

    captureScreenshot();
  }

  // 🔍 Setup file watcher
  private setupFileWatcher(): void {
    const pattern = path.join(this.screenshotPath, `*.${this.config.imageFormat}`);
    
    this.watcher = chokidar.watch(pattern, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10
      }
    });

    this.watcher.on('add', async (filepath: string) => {
      // Debounce to prevent overwhelming
      const now = Date.now();
      if (now - this.lastProcessTime < this.DEBOUNCE_MS) return;
      this.lastProcessTime = now;

      // Add to processing queue
      this.processingQueue.add(filepath);
    });

    this.watcher.on('error', error => {
      console.error('File watcher error:', error);
      this.emit('error', error);
    });
  }

  // 🧠 AI Processing Pipeline
  private startProcessingPipeline(): void {
    setInterval(async () => {
      if (this.processingQueue.size === 0) return;

      // Process in batches
      const batch = Array.from(this.processingQueue).slice(0, this.MAX_CONCURRENT);
      batch.forEach(f => this.processingQueue.delete(f));

      // Parallel processing
      await Promise.all(batch.map(filepath => this.processScreenshot(filepath)));
    }, 100);
  }

  // 🎨 Process Individual Screenshot
  private async processScreenshot(filepath: string): Promise<void> {
    try {
      // 1. Calculate image hash for deduplication
      const hash = await this.calculateImageHash(filepath);
      
      // Check cache
      if (this.processedHashes.has(hash)) {
        const cachedAnalysis = this.processedHashes.get(hash)!;
        this.emit('insight', {
          timestamp: Date.now(),
          filepath,
          analysis: cachedAnalysis,
          suggestions: cachedAnalysis.suggestions
        });
        return;
      }

      // 2. Optimize image for AI
      const optimized = await this.optimizeForAI(filepath);
      
      // 3. Detect what's happening
      const analysis = await this.analyzeScreen(optimized);
      
      // Cache result
      this.processedHashes.set(hash, analysis);
      
      // LRU cache eviction
      if (this.processedHashes.size > 50) {
        const firstKey = this.processedHashes.keys().next().value;
        if (firstKey !== undefined) {
          this.processedHashes.delete(firstKey);
        }
      }
      
      // 4. Emit insights
      this.emit('insight', {
        timestamp: Date.now(),
        filepath,
        analysis,
        suggestions: analysis.suggestions
      });

      // 5. Cleanup old screenshots
      await this.cleanupOldScreenshots();
    } catch (error) {
      console.error('Processing error:', error);
      this.emit('error', error);
    }
  }

  // 🔧 Calculate image hash
  private async calculateImageHash(filepath: string): Promise<string> {
    const buffer = await sharp(filepath)
      .resize(64, 64, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();
    
    // Simple hash calculation
    let hash = 0;
    for (let i = 0; i < buffer.length; i++) {
      hash = ((hash << 5) - hash) + buffer[i];
      hash = hash & hash;
    }
    
    return hash.toString(36);
  }

  // 🔧 Image Optimization for AI
  private async optimizeForAI(filepath: string): Promise<Buffer> {
    return sharp(filepath)
      .resize(1280, 720, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .removeAlpha()
      .normalize() // Enhance contrast
      .jpeg({ quality: 85 }) // Convert to JPEG for smaller size
      .toBuffer();
  }

  // 🤖 GPT-4o Vision Analysis
  private async analyzeScreen(imageBuffer: Buffer): Promise<ScreenAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // GPT-4 with vision capabilities
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.getContextAwarePrompt()
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
                detail: 'low' // Use 'low' for faster processing
              }
            }
          ]
        }],
        max_tokens: 500,
        temperature: 0.3
      });

      return this.parseAnalysis(response);
    } catch (error) {
      console.error('AI analysis error:', error);
      throw error;
    }
  }

  // 🧩 Context-Aware Prompting for GPT-4o
  private getContextAwarePrompt(): string {
    return `You are an AI assistant analyzing a screenshot to provide real-time guidance.

ANALYZE THE SCREENSHOT AND PROVIDE:

1. What application/website is shown
2. What the user appears to be doing
3. Any visible errors or issues
4. Helpful suggestions for their current task

FORMAT YOUR RESPONSE EXACTLY AS:
SUMMARY: [One sentence describing what's happening]
APP: [Application or website name]
SUGGESTIONS:
- [First actionable suggestion]
- [Second actionable suggestion]
- [Third actionable suggestion]
ERRORS: [Any visible errors, or "None"]
SHORTCUTS: [Relevant keyboard shortcuts separated by commas, or "None"]

IMPORTANT: Be extremely concise. Each suggestion should be under 10 words.`;
  }

  // 📊 Parse AI Response
  private parseAnalysis(response: OpenAI.Chat.ChatCompletion): ScreenAnalysis {
    const content = response.choices[0]?.message?.content || '';
    
    // Parse structured response
    const lines = content.split('\n');
    const analysis: ScreenAnalysis = {
      summary: '',
      application: 'Unknown',
      suggestions: [],
      errors: [],
      shortcuts: [],
      confidence: 0.8,
      timestamp: Date.now()
    };

    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) {
        analysis.summary = line.substring(8).trim();
      } else if (line.startsWith('APP:')) {
        analysis.application = line.substring(4).trim();
      } else if (line.startsWith('SUGGESTIONS:')) {
        // Parse following bullet points
        continue;
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        analysis.suggestions.push(line.substring(2).trim());
      } else if (line.startsWith('ERRORS:')) {
        const errors = line.substring(7).trim();
        if (errors && errors !== 'None') {
          analysis.errors.push(errors);
        }
      } else if (line.startsWith('SHORTCUTS:')) {
        const shortcuts = line.substring(10).trim();
        if (shortcuts && shortcuts !== 'None') {
          analysis.shortcuts = shortcuts.split(',').map((s: string) => s.trim());
        }
      }
    }

    return analysis;
  }

  // 🧹 Cleanup old screenshots
  private async cleanupOldScreenshots(): Promise<void> {
    try {
      const files = await fs.readdir(this.screenshotPath);
      const screenshots = files
        .filter(f => f.endsWith(`.${this.config.imageFormat}`))
        .map(f => ({
          name: f,
          path: path.join(this.screenshotPath, f)
        }));

      // Sort by modification time
      const stats = await Promise.all(
        screenshots.map(async s => ({
          ...s,
          mtime: (await fs.stat(s.path)).mtime.getTime()
        }))
      );

      stats.sort((a, b) => b.mtime - a.mtime);

      // Keep only last 20 screenshots
      const toDelete = stats.slice(20);
      await Promise.all(toDelete.map(s => fs.unlink(s.path)));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // 📊 Get statistics
  async getStats(): Promise<{
    isRunning: boolean;
    queueSize: number;
    processedCount: number;
    cacheSize: number;
  }> {
    return {
      isRunning: this.isRunning,
      queueSize: this.processingQueue.size,
      processedCount: this.processedHashes.size,
      cacheSize: this.processedHashes.size
    };
  }
}
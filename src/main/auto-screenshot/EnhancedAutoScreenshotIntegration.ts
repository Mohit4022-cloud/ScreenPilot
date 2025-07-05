import { EventEmitter } from 'events';
import OpenAI from 'openai';
import { GPT4OScreenshooter, OptimizedFrame } from './GPT4OScreenshooter';
import { GPT4ONativeScreenshooter, OptimizedNativeFrame } from './GPT4ONativeScreenshooter';
import { GPT4OStreamHandler, FinalAnalysis } from './GPT4OStreamHandler';
import { GPT4OCache } from './GPT4OCache';
import { CostOptimizer, Priority } from './CostOptimizer';
import { ErrorDetectionEngine, DetectedError } from './ErrorDetectionPatterns';
import { SmartAutocomplete, UserAction } from './SmartAutocomplete';
import { WorkflowAutomationDetector, WorkflowStep } from './WorkflowAutomationDetector';
import { MultiMonitorAnalyzer } from './MultiMonitorAnalyzer';

export interface EnhancedConfig {
  apiKey: string;
  captureRate?: number;
  dailyBudget?: number;
  enableStreaming?: boolean;
  enableCaching?: boolean;
  enableErrorDetection?: boolean;
  enableAutocomplete?: boolean;
  enableAutomationDetection?: boolean;
  enableMultiMonitor?: boolean;
  useNativeScreenshooter?: boolean;
}

export interface EnhancedInsight {
  timestamp: number;
  analysis: FinalAnalysis;
  errors: DetectedError[];
  predictions: any[];
  automationSuggestions: any[];
  cost: number;
  processingTime: number;
  cached: boolean;
}

export class EnhancedAutoScreenshotIntegration extends EventEmitter {
  private openai: OpenAI;
  private screenshooter: GPT4OScreenshooter | GPT4ONativeScreenshooter;
  private streamHandler: GPT4OStreamHandler;
  private cache: GPT4OCache;
  private costOptimizer: CostOptimizer;
  private errorDetector: ErrorDetectionEngine;
  private autocomplete: SmartAutocomplete;
  private automationDetector: WorkflowAutomationDetector;
  private multiMonitorAnalyzer: MultiMonitorAnalyzer;
  
  private isRunning = false;
  private totalInsights = 0;
  private totalCost = 0;

  constructor(private config: EnhancedConfig) {
    super();
    
    // Initialize OpenAI
    this.openai = new OpenAI({ apiKey: config.apiKey });
    
    // Initialize components
    // Use native screenshooter if available and enabled
    if (config.useNativeScreenshooter && process.platform === 'darwin') {
      console.log('Using native screenshooter for better performance');
      this.screenshooter = new GPT4ONativeScreenshooter({
        captureRate: config.captureRate || 5,
        jpegQuality: 85,
        maxWidth: 1024,
        maxHeight: 1024,
        enableDiffDetection: true,
        changeThreshold: 0.5
      });
    } else {
      this.screenshooter = new GPT4OScreenshooter({
        captureRate: config.captureRate || 5,
        jpegQuality: 85
      });
    }
    
    this.streamHandler = new GPT4OStreamHandler();
    this.cache = new GPT4OCache();
    this.costOptimizer = new CostOptimizer({
      dailyBudget: config.dailyBudget || 10
    });
    
    this.errorDetector = new ErrorDetectionEngine();
    this.autocomplete = new SmartAutocomplete(this.openai);
    this.automationDetector = new WorkflowAutomationDetector(this.openai);
    this.multiMonitorAnalyzer = new MultiMonitorAnalyzer(this.openai);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle frames from screenshooter
    this.screenshooter.on('frame', async (frame: OptimizedFrame | OptimizedNativeFrame) => {
      await this.processFrame(frame as OptimizedFrame);
    });
    
    // Handle streaming insights
    this.streamHandler.on('instantAction', (action) => {
      this.emit('instantAction', action);
    });
    
    this.streamHandler.on('instantError', (error) => {
      this.emit('instantError', error);
    });
    
    // Handle cost alerts
    this.costOptimizer.on('budgetWarning', (warning) => {
      this.emit('budgetWarning', warning);
    });
    
    this.costOptimizer.on('budgetCritical', (alert) => {
      this.emit('budgetCritical', alert);
      // Reduce capture rate when budget is critical
      this.screenshooter.updateConfig({ captureRate: 1 });
    });
    
    // Handle automation detection
    this.automationDetector.on('automationDetected', (suggestion) => {
      this.emit('automationDetected', suggestion);
    });
    
    this.automationDetector.on('repetitivePattern', (pattern) => {
      this.emit('repetitivePattern', pattern);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Apply adaptive quality settings
    const qualitySettings = this.costOptimizer.getAdaptiveQualitySettings();
    this.screenshooter.updateConfig({
      captureRate: qualitySettings.captureRate,
      jpegQuality: qualitySettings.imageQuality,
      maxWidth: qualitySettings.resolution.width,
      maxHeight: qualitySettings.resolution.height,
      enableDiffDetection: qualitySettings.enableDiffDetection,
      changeThreshold: qualitySettings.diffThreshold
    });
    
    // Start screenshooter
    await this.screenshooter.start();
    
    this.emit('started');
    console.log('🚀 Enhanced GPT-4o Auto-Screenshot Integration: ACTIVE');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    await this.screenshooter.stop();
    
    // Save cache
    const cacheData = this.cache.export();
    // In production, save this to disk
    
    this.emit('stopped', {
      totalInsights: this.totalInsights,
      totalCost: this.totalCost,
      cacheHitRate: this.cache.getHitRate()
    });
  }

  private async processFrame(frame: OptimizedFrame): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Determine priority based on frame content
      const priority = await this.determinePriority(frame);
      
      // Check if we should process based on budget
      const shouldProcess = await this.costOptimizer.shouldProcess(priority);
      if (!shouldProcess) {
        this.emit('skipped', { reason: 'budget', priority });
        return;
      }
      
      // Check cache
      const cached = this.config.enableCaching !== false 
        ? await this.cache.get(frame.buffer, frame.hash)
        : null;
      
      let analysis: FinalAnalysis;
      let cached_result = false;
      
      if (cached) {
        analysis = cached.analysis;
        cached_result = true;
      } else {
        // Process with GPT-4o
        if (this.config.enableStreaming !== false) {
          analysis = await this.streamHandler.streamAnalysis(
            this.openai,
            frame.buffer,
            this.getOptimizedPrompt(priority)
          );
        } else {
          analysis = await this.analyzeFrame(frame.buffer, priority);
        }
        
        // Cache result
        if (this.config.enableCaching !== false) {
          this.cache.set(frame.buffer, frame.hash, analysis);
        }
      }
      
      // Record cost
      this.costOptimizer.recordAnalysis(priority, cached_result);
      
      // Error detection
      const errors = this.config.enableErrorDetection !== false
        ? this.errorDetector.detectErrors(analysis.fullResponse)
        : [];
      
      // Record user action for autocomplete
      if (analysis.actions.length > 0 && this.config.enableAutocomplete !== false) {
        const action: UserAction = {
          type: 'click', // Simplified - would be parsed from analysis
          target: analysis.actions[0],
          timestamp: Date.now()
        };
        this.autocomplete.recordAction(action);
      }
      
      // Record workflow step
      if (this.config.enableAutomationDetection !== false) {
        const step: WorkflowStep = {
          action: analysis.actions[0] || 'view',
          target: analysis.application,
          timestamp: Date.now(),
          screenshot: frame.buffer
        };
        this.automationDetector.recordStep(step);
      }
      
      // Generate predictions
      const predictions = this.config.enableAutocomplete !== false
        ? await this.autocomplete.predict(frame.buffer, {
            application: analysis.application,
            currentScreen: analysis.summary,
            recentActions: this.autocomplete.getHistory().slice(-5),
            timeOnScreen: Date.now() - frame.timestamp
          })
        : [];
      
      // Build enhanced insight
      const insight: EnhancedInsight = {
        timestamp: frame.timestamp,
        analysis,
        errors,
        predictions,
        automationSuggestions: this.automationDetector.getAutomationSuggestions(),
        cost: cached_result ? 0 : 0.001,
        processingTime: Date.now() - startTime,
        cached: cached_result
      };
      
      this.totalInsights++;
      this.totalCost += insight.cost;
      
      this.emit('insight', insight);
      
      // Emit specific events for high-priority findings
      if (errors.length > 0 && errors.some(e => e.pattern.priority === 'high')) {
        this.emit('criticalError', errors[0]);
      }
      
      if (predictions.length > 0 && predictions[0].confidence > 0.8) {
        this.emit('highConfidencePrediction', predictions[0]);
      }
      
    } catch (error) {
      console.error('Frame processing error:', error);
      this.emit('error', error);
    }
  }

  private async determinePriority(frame: OptimizedFrame): Promise<Priority> {
    // High priority for significant changes
    if (frame.changePercent > 20) return 'high';
    
    // High priority for specific regions
    const primaryRegion = frame.regions.find(r => r.type === 'cursor_region');
    if (primaryRegion && primaryRegion.priority > 8) return 'high';
    
    // Medium priority for moderate changes
    if (frame.changePercent > 5) return 'medium';
    
    return 'low';
  }

  private getOptimizedPrompt(priority: Priority): string {
    const prompts = {
      high: `[HIGH PRIORITY - DETAILED ANALYSIS]
Analyze the screenshot and provide:
1. What critical action or error is happening
2. Immediate steps to resolve
3. Relevant shortcuts

FORMAT:
SUMMARY: [critical finding]
APP: [application]
SUGGESTIONS:
- [urgent action 1]
- [urgent action 2]
ERRORS: [any errors]
SHORTCUTS: [relevant shortcuts]`,
      
      medium: `[QUICK ANALYSIS]
What's happening on screen and next best action.

FORMAT:
SUMMARY: [one line]
APP: [app name]
SUGGESTIONS:
- [main suggestion]
ERRORS: [if any]
SHORTCUTS: [if relevant]`,
      
      low: `[MINIMAL CHECK]
Any errors or issues visible?
SUMMARY: [status]
ERRORS: [list or None]`
    };
    
    return prompts[priority];
  }

  private async analyzeFrame(buffer: Buffer, priority: Priority): Promise<FinalAnalysis> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: this.getOptimizedPrompt(priority)
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
              detail: 'low'
            }
          }
        ]
      }],
      max_tokens: priority === 'high' ? 300 : 150,
      temperature: 0.3
    });
    
    // Parse the response content
    const content = response.choices[0]?.message?.content || '';
    const lines = content.split('\n').filter(line => line.trim());
    
    const analysis: FinalAnalysis = {
      summary: '',
      application: 'Unknown',
      actions: [],
      errors: [],
      shortcuts: [],
      fullResponse: content,
      processingTime: 0
    };
    
    // Extract structured data
    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) {
        analysis.summary = line.substring(8).trim();
      } else if (line.startsWith('APP:')) {
        analysis.application = line.substring(4).trim();
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        analysis.actions.push(line.substring(2).trim());
      } else if (line.startsWith('ERRORS:')) {
        const errorText = line.substring(7).trim();
        if (errorText && errorText !== 'None') {
          analysis.errors.push(errorText);
        }
      } else if (line.startsWith('SHORTCUTS:')) {
        const shortcuts = line.substring(10).trim();
        if (shortcuts && shortcuts !== 'None') {
          analysis.shortcuts = shortcuts.split(',').map(s => s.trim());
        }
      }
    }
    
    return analysis;
  }

  // Multi-monitor workspace analysis
  async analyzeWorkspace(): Promise<any> {
    if (!this.config.enableMultiMonitor) {
      throw new Error('Multi-monitor support not enabled');
    }
    
    return this.multiMonitorAnalyzer.analyzeWorkspace();
  }

  // Get current statistics
  getStats(): any {
    return {
      isRunning: this.isRunning,
      totalInsights: this.totalInsights,
      totalCost: this.totalCost,
      screenshooterStats: this.screenshooter.getStats(),
      cacheStats: this.cache.getStats(),
      costStats: this.costOptimizer.getTodayUsage(),
      automationSuggestions: this.automationDetector.getAutomationSuggestions().length
    };
  }

  // Export cost report
  exportCostReport(): string {
    return this.costOptimizer.exportReport();
  }

  // Update configuration
  updateConfig(newConfig: Partial<EnhancedConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (newConfig.captureRate) {
      this.screenshooter.updateConfig({ captureRate: newConfig.captureRate });
    }
    
    if (newConfig.dailyBudget) {
      this.costOptimizer.updateConfig({ dailyBudget: newConfig.dailyBudget });
    }
  }
}
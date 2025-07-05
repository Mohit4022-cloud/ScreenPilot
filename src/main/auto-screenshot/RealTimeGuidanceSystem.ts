import { EventEmitter } from 'events';
import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import { AutoScreenshotIntegration, ScreenInsight, ScreenAnalysis } from './AutoScreenshotIntegration';
import { EnhancedAutoScreenshotIntegration, EnhancedInsight } from './EnhancedAutoScreenshotIntegration';
import { GuidanceEngine, Guidance, Priority, GuidanceCategory } from './GuidanceEngine';
import { UIOverlay } from './UIOverlay';
import { PermissionManager, PermissionType } from '../managers/PermissionManager';
import { PrivacyManager, PrivacyState } from '../managers/PrivacyManager';

export interface GuidanceConfig {
  apiKey: string;
  screenshotInterval?: number;
  outputPath?: string;
  enableOverlay?: boolean;
  enableLogging?: boolean;
  maxHistorySize?: number;
}

export interface GuidanceMetrics {
  totalInsights: number;
  highPriorityGuidance: number;
  errorDetections: number;
  userInteractions: number;
  averageResponseTime: number;
}

export class RealTimeGuidanceSystem extends EventEmitter {
  private autoCapture: AutoScreenshotIntegration | EnhancedAutoScreenshotIntegration;
  private guidanceEngine: GuidanceEngine;
  private uiOverlay: UIOverlay;
  private permissionManager: PermissionManager;
  private privacyManager: PrivacyManager;
  private useEnhanced: boolean;
  
  private isActive = false;
  private metrics: GuidanceMetrics = {
    totalInsights: 0,
    highPriorityGuidance: 0,
    errorDetections: 0,
    userInteractions: 0,
    averageResponseTime: 0
  };
  
  private responseTimeBuffer: number[] = [];
  private interactionLog: Array<{
    timestamp: number;
    guidance: Guidance;
    userAction?: string;
  }> = [];

  constructor(
    private config: GuidanceConfig,
    permissionManager: PermissionManager,
    privacyManager: PrivacyManager
  ) {
    super();
    
    this.permissionManager = permissionManager;
    this.privacyManager = privacyManager;
    
    // Check if we should use enhanced version
    this.useEnhanced = Boolean(config.apiKey && process.env.USE_ENHANCED_GPT4O === 'true');
    
    // Initialize components
    if (this.useEnhanced) {
      this.autoCapture = new EnhancedAutoScreenshotIntegration({
        apiKey: config.apiKey,
        captureRate: 5, // 5 FPS for GPT-4o
        dailyBudget: 10,
        enableStreaming: true,
        enableCaching: true,
        enableErrorDetection: true,
        enableAutocomplete: true,
        enableAutomationDetection: true,
        enableMultiMonitor: false // Can be enabled separately
      });
    } else {
      this.autoCapture = new AutoScreenshotIntegration(config);
    }
    this.guidanceEngine = new GuidanceEngine();
    this.uiOverlay = new UIOverlay();
    
    this.setupEventHandlers();
  }

  // 🚀 Start the guidance system
  async start(): Promise<void> {
    if (this.isActive) {
      console.log('Guidance system already active');
      return;
    }

    try {
      // Check permissions first
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        this.emit('permission-denied');
        return;
      }

      // Check privacy consent
      const hasConsent = await this.checkPrivacyConsent();
      if (!hasConsent) {
        this.emit('consent-denied');
        return;
      }

      // Start privacy monitoring
      this.privacyManager.startCapture();

      // Start auto-capture
      await this.autoCapture.start();
      
      // Initialize UI overlay if enabled
      if (this.config.enableOverlay !== false) {
        await this.uiOverlay.initialize();
      }
      
      this.isActive = true;
      this.emit('started');
      console.log('🎯 Real-Time Guidance System: ACTIVE');
    } catch (error) {
      console.error('Failed to start guidance system:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // 🛑 Stop the guidance system
  async stop(): Promise<void> {
    if (!this.isActive) return;

    console.log('Stopping guidance system...');
    
    // Stop components
    await this.autoCapture.stop();
    await this.uiOverlay.hide();
    
    // Stop privacy monitoring
    this.privacyManager.stopRecording();
    
    this.isActive = false;
    this.emit('stopped');
    
    // Save metrics
    await this.saveMetrics();
    
    console.log('✅ Guidance system stopped');
  }

  // 🔒 Check permissions
  private async checkPermissions(): Promise<boolean> {
    const screenPermission = await this.permissionManager.checkPermission(
      PermissionType.SCREEN_RECORDING
    );
    
    if (screenPermission !== 'granted') {
      console.log('Screen recording permission not granted');
      const granted = await this.permissionManager.requestPermission(
        PermissionType.SCREEN_RECORDING
      );
      return granted;
    }
    
    return true;
  }

  // 🔐 Check privacy consent
  private async checkPrivacyConsent(): Promise<boolean> {
    const consent = await this.privacyManager.requestConsent(
      'AI-Powered Screen Guidance',
      ['screen-content', 'application-state', 'user-actions']
    );
    
    return consent;
  }

  // 📡 Setup event handlers
  private setupEventHandlers(): void {
    // Setup enhanced event handlers if using enhanced version
    if (this.useEnhanced) {
      this.setupEnhancedEventHandlers();
    }
    
    // Handle insights from auto-capture
    this.autoCapture.on('insight', async (insight: ScreenInsight | EnhancedInsight) => {
      const startTime = Date.now();
      
      try {
        // Convert EnhancedInsight to ScreenInsight format if needed
        let screenInsight: ScreenInsight;
        if ('analysis' in insight) {
          // This is an EnhancedInsight
          const enhanced = insight as EnhancedInsight;
          screenInsight = {
            timestamp: enhanced.timestamp,
            filepath: '', // Enhanced version doesn't use file paths
            analysis: {
              summary: enhanced.analysis.summary,
              application: enhanced.analysis.application,
              suggestions: enhanced.analysis.actions,
              errors: enhanced.analysis.errors,
              shortcuts: enhanced.analysis.shortcuts,
              confidence: 0.9,
              timestamp: enhanced.timestamp
            },
            suggestions: enhanced.analysis.actions
          };
        } else {
          screenInsight = insight as ScreenInsight;
        }
        
        // Process through guidance engine
        const guidance = await this.guidanceEngine.process(screenInsight);
        
        // Update metrics
        this.updateMetrics(screenInsight, guidance, Date.now() - startTime);
        
        // Emit processed guidance
        this.emit('guidance', guidance);
        
        // Display overlay if high priority
        if (guidance.priority === 'high' && this.config.enableOverlay !== false) {
          await this.uiOverlay.show(guidance);
        }
        
        // Log interaction
        await this.logInteraction(guidance);
        
        // Check for specific patterns
        this.checkPatterns(screenInsight, guidance);
      } catch (error) {
        console.error('Error processing insight:', error);
        this.emit('error', error);
      }
    });

    // Handle overlay interactions
    this.uiOverlay.on('user-action', (action: string) => {
      this.metrics.userInteractions++;
      this.emit('user-interaction', action);
    });

    // Handle privacy state changes
    this.privacyManager.on('state-changed', ({ newState }) => {
      if (newState === PrivacyState.PAUSED) {
        this.autoCapture.stop();
      } else if (newState === PrivacyState.ACTIVE_CAPTURE && this.isActive) {
        this.autoCapture.start();
      }
    });

    // Handle permission changes
    this.permissionManager.on('permission-changed', ({ permission, newStatus }) => {
      if (permission === PermissionType.SCREEN_RECORDING && newStatus !== 'granted') {
        this.stop();
        this.emit('permission-revoked');
      }
    });
  }

  // 🚀 Setup enhanced GPT-4o event handlers
  private setupEnhancedEventHandlers(): void {
    const enhancedCapture = this.autoCapture as EnhancedAutoScreenshotIntegration;
    
    // Instant action detection
    enhancedCapture.on('instantAction', (action) => {
      this.emit('instantAction', action);
      // Show immediate UI feedback
      if (this.config.enableOverlay !== false) {
        this.uiOverlay.show({
          id: `instant-${Date.now()}`,
          timestamp: Date.now(),
          title: '⚡ Quick Action',
          summary: action.content,
          priority: 'high' as Priority,
          suggestions: [{
            text: action.content,
            confidence: action.confidence
          }],
          context: {
            application: 'Unknown',
            screenState: '',
            userActivity: {
              isStuck: false,
              hasErrors: false,
              isRepetitive: false,
              lastActionTime: Date.now()
            },
            timestamp: Date.now()
          },
          category: GuidanceCategory.ERROR_HELP
        });
      }
    });
    
    // Critical error detection
    enhancedCapture.on('criticalError', (error) => {
      this.emit('criticalError', error);
      // Immediate help overlay
      if (this.config.enableOverlay !== false) {
        this.uiOverlay.show({
          id: `error-${Date.now()}`,
          timestamp: Date.now(),
          title: '🚨 Error Detected',
          summary: error.matchedText,
          priority: 'high' as Priority,
          suggestions: error.suggestedFixes.map((fix: string) => ({
            text: fix,
            confidence: error.confidence
          })).slice(0, 3),
          context: {
            application: error.pattern.context,
            screenState: 'error',
            userActivity: {
              isStuck: false,
              hasErrors: true,
              isRepetitive: false,
              lastActionTime: Date.now()
            },
            timestamp: Date.now()
          },
          category: GuidanceCategory.ERROR_HELP
        });
      }
    });
    
    // Automation suggestions
    enhancedCapture.on('automationDetected', (suggestion) => {
      this.emit('automationDetected', suggestion);
    });
    
    // Budget warnings
    enhancedCapture.on('budgetWarning', (warning) => {
      this.emit('budgetWarning', warning);
    });
    
    // High confidence predictions
    enhancedCapture.on('highConfidencePrediction', (prediction) => {
      this.emit('prediction', prediction);
    });
  }

  // 📊 Update metrics
  private updateMetrics(
    insight: ScreenInsight,
    guidance: Guidance,
    responseTime: number
  ): void {
    this.metrics.totalInsights++;
    
    if (guidance.priority === 'high') {
      this.metrics.highPriorityGuidance++;
    }
    
    if (insight.analysis.errors.length > 0) {
      this.metrics.errorDetections++;
    }
    
    // Update average response time
    this.responseTimeBuffer.push(responseTime);
    if (this.responseTimeBuffer.length > 100) {
      this.responseTimeBuffer.shift();
    }
    
    this.metrics.averageResponseTime = 
      this.responseTimeBuffer.reduce((a, b) => a + b, 0) / this.responseTimeBuffer.length;
  }

  // 📝 Log interaction
  private async logInteraction(guidance: Guidance): Promise<void> {
    if (!this.config.enableLogging) return;
    
    this.interactionLog.push({
      timestamp: Date.now(),
      guidance
    });
    
    // Limit log size
    const maxSize = this.config.maxHistorySize || 1000;
    if (this.interactionLog.length > maxSize) {
      this.interactionLog = this.interactionLog.slice(-maxSize);
    }
  }

  // 🔍 Check for specific patterns
  private checkPatterns(insight: ScreenInsight, guidance: Guidance): void {
    // Check if user needs help (stuck on same screen)
    const recentInsights = this.guidanceEngine.getRecentInsights(5);
    const sameScreenCount = recentInsights.filter(
      i => i.analysis.application === insight.analysis.application &&
           i.analysis.summary === insight.analysis.summary
    ).length;
    
    if (sameScreenCount >= 5) {
      this.emit('userNeedsHelp', {
        application: insight.analysis.application,
        duration: Date.now() - recentInsights[0].timestamp,
        context: insight.analysis.summary
      });
    }
    
    // Check for errors
    if (insight.analysis.errors.length > 0) {
      this.emit('errorDetected', {
        errors: insight.analysis.errors,
        application: insight.analysis.application,
        suggestions: guidance.suggestions
      });
    }
    
    // Check for repetitive actions
    const recentSuggestions = recentInsights
      .flatMap(i => i.suggestions)
      .slice(-10);
    
    const suggestionCounts = recentSuggestions.reduce((acc, s) => {
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const repetitiveSuggestions = Object.entries(suggestionCounts)
      .filter(([_, count]) => count >= 3)
      .map(([suggestion]) => suggestion);
    
    if (repetitiveSuggestions.length > 0) {
      this.emit('repetitivePattern', {
        suggestions: repetitiveSuggestions,
        application: insight.analysis.application
      });
    }
  }

  // 💾 Save metrics
  private async saveMetrics(): Promise<void> {
    const metricsPath = path.join(app.getPath('userData'), 'guidance-metrics.json');
    
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(
        metricsPath,
        JSON.stringify({
          metrics: this.metrics,
          timestamp: Date.now(),
          sessionDuration: this.interactionLog.length > 0
            ? this.interactionLog[this.interactionLog.length - 1].timestamp - this.interactionLog[0].timestamp
            : 0
        }, null, 2)
      );
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  // 📊 Get current metrics
  getMetrics(): GuidanceMetrics {
    return { ...this.metrics };
  }

  // 📜 Get interaction history
  getInteractionHistory(limit?: number): Array<any> {
    const history = [...this.interactionLog];
    return limit ? history.slice(-limit) : history;
  }

  // 🔧 Update configuration
  updateConfig(newConfig: Partial<GuidanceConfig>): void {
    Object.assign(this.config, newConfig);
    
    // Update overlay visibility
    if (newConfig.enableOverlay !== undefined) {
      if (newConfig.enableOverlay && this.isActive) {
        this.uiOverlay.initialize();
      } else if (!newConfig.enableOverlay) {
        this.uiOverlay.hide();
      }
    }
  }

  // 🌐 Get system status
  async getStatus(): Promise<{
    isActive: boolean;
    metrics: GuidanceMetrics;
    captureStats: any;
    privacyState: PrivacyState;
  }> {
    const captureStats = await this.autoCapture.getStats();
    const privacyState = this.privacyManager.getCurrentState();
    
    return {
      isActive: this.isActive,
      metrics: this.getMetrics(),
      captureStats,
      privacyState
    };
  }
}
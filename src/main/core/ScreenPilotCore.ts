import { EventEmitter } from 'events';
import ElectronStore from '../utils/store';
import { RealTimeGuidanceSystem } from '../auto-screenshot/RealTimeGuidanceSystem';
import { PermissionManager } from '../managers/PermissionManager';
import { PrivacyManager } from '../managers/PrivacyManager';

export interface CoreSettings {
  apiKey: string;
  captureRate: number;
  dailyBudget: number;
  enableStreaming: boolean;
  enableCaching: boolean;
  enableErrorDetection: boolean;
  enableAutocomplete: boolean;
  enableAutomationDetection: boolean;
  enableMultiMonitor: boolean;
  autoStart: boolean;
  useNativeScreenshooter: boolean;
}

export interface CoreStatus {
  isActive: boolean;
  isPaused: boolean;
  metrics: {
    totalInsights: number;
    dailyCost: number;
    cacheHitRate: number;
    averageResponseTime: number;
  };
  lastError?: string;
}

export class ScreenPilotCore extends EventEmitter {
  private store: ElectronStore;
  private guidanceSystem: RealTimeGuidanceSystem | null = null;
  private permissionManager: PermissionManager;
  private privacyManager: PrivacyManager;
  private isActive = false;
  private isPaused = false;
  private settings: CoreSettings;

  constructor() {
    super();
    
    this.store = new ElectronStore({
      name: 'screenpilot-settings',
      defaults: {
        settings: {
          apiKey: '',
          captureRate: 5,
          dailyBudget: 10,
          enableStreaming: true,
          enableCaching: true,
          enableErrorDetection: true,
          enableAutocomplete: true,
          enableAutomationDetection: true,
          enableMultiMonitor: false,
          autoStart: true,
          useNativeScreenshooter: true
        }
      }
    });

    this.settings = this.store.get('settings', {}) as CoreSettings;
    this.permissionManager = new PermissionManager();
    this.privacyManager = new PrivacyManager();
    
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Permission changes
    this.permissionManager.on('permission-changed', ({ permission, newStatus }) => {
      if (permission === 'screen-recording' && newStatus !== 'granted') {
        this.stop();
        this.emit('error', {
          type: 'permission',
          message: 'Screen recording permission was revoked'
        });
      }
    });

    // Privacy state changes
    this.privacyManager.on('state-changed', ({ newState }) => {
      if (newState === 'paused') {
        this.setPaused(true);
      } else if (newState === 'active-capture') {
        this.setPaused(false);
      }
    });
  }

  async start(): Promise<void> {
    if (this.isActive) {
      console.log('ScreenPilot Core already active');
      return;
    }

    try {
      // Check API key
      if (!this.settings.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Check permissions
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        throw new Error('Required permissions not granted');
      }

      // Initialize guidance system
      this.guidanceSystem = new RealTimeGuidanceSystem(
        {
          apiKey: this.settings.apiKey,
          screenshotInterval: 1000 / this.settings.captureRate, // Convert FPS to interval
          enableOverlay: true,
          enableLogging: true,
        },
        this.permissionManager,
        this.privacyManager
      );

      // Set up guidance system event handlers
      this.setupGuidanceHandlers();

      // Start the guidance system
      await this.guidanceSystem.start();
      
      this.isActive = true;
      this.isPaused = false;
      
      this.emit('status-change', this.getStatus());
      console.log('ScreenPilot Core started successfully');
    } catch (error) {
      console.error('Failed to start ScreenPilot Core:', error);
      this.emit('error', {
        type: 'startup',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isActive) return;

    try {
      await this.guidanceSystem?.stop();
      this.guidanceSystem = null;
      this.isActive = false;
      this.isPaused = false;
      
      this.emit('status-change', this.getStatus());
      console.log('ScreenPilot Core stopped');
    } catch (error) {
      console.error('Error stopping ScreenPilot Core:', error);
      this.emit('error', {
        type: 'shutdown',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  setPaused(paused: boolean): void {
    if (!this.isActive) return;
    
    this.isPaused = paused;
    
    if (paused) {
      this.privacyManager.pauseCapture();
    } else {
      this.privacyManager.resumeCapture();
    }
    
    this.emit('status-change', this.getStatus());
  }

  private async checkPermissions(): Promise<boolean> {
    const screenPermission = await this.permissionManager.checkPermission('screen-recording' as any);
    return screenPermission === 'granted';
  }

  private setupGuidanceHandlers() {
    if (!this.guidanceSystem) return;

    // Forward guidance insights
    this.guidanceSystem.on('guidance', (guidance) => {
      this.emit('insight', {
        type: 'guidance',
        data: guidance,
        timestamp: Date.now()
      });
    });

    // Forward instant actions
    this.guidanceSystem.on('instantAction', (action) => {
      this.emit('insight', {
        type: 'instant-action',
        data: action,
        timestamp: Date.now()
      });
    });

    // Forward critical errors
    this.guidanceSystem.on('criticalError', (error) => {
      this.emit('insight', {
        type: 'critical-error',
        data: error,
        timestamp: Date.now()
      });
    });

    // Forward automation detections
    this.guidanceSystem.on('automationDetected', (suggestion) => {
      this.emit('insight', {
        type: 'automation',
        data: suggestion,
        timestamp: Date.now()
      });
    });

    // Handle budget warnings
    this.guidanceSystem.on('budgetWarning', (warning) => {
      this.emit('warning', {
        type: 'budget',
        data: warning
      });
    });

    // Handle errors
    this.guidanceSystem.on('error', (error) => {
      this.emit('error', {
        type: 'runtime',
        message: error.message || 'Unknown error',
        details: error
      });
    });
  }

  getStatus(): CoreStatus {
    const metrics = this.guidanceSystem?.getMetrics() || {
      totalInsights: 0,
      highPriorityGuidance: 0,
      errorDetections: 0,
      userInteractions: 0,
      averageResponseTime: 0
    };

    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      metrics: {
        totalInsights: metrics.totalInsights,
        dailyCost: 0, // TODO: Get from cost optimizer
        cacheHitRate: 0, // TODO: Get from cache
        averageResponseTime: metrics.averageResponseTime
      }
    };
  }

  getSettings(): CoreSettings {
    return { ...this.settings };
  }

  saveSettings(newSettings: Partial<CoreSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.store.set('settings', this.settings);
    
    // If API key changed and system is active, restart
    if (newSettings.apiKey && this.isActive) {
      this.stop().then(() => this.start());
    }
    
    // Update guidance system config if active
    if (this.guidanceSystem && this.isActive) {
      this.guidanceSystem.updateConfig({
        screenshotInterval: newSettings.captureRate ? 1000 / newSettings.captureRate : undefined,
        enableOverlay: true,
        enableLogging: true
      });
    }
    
    this.emit('settings-changed', this.settings);
  }

  // Utility methods for external use
  async getMetrics() {
    if (!this.guidanceSystem) return null;
    return this.guidanceSystem.getMetrics();
  }

  async getInteractionHistory(limit?: number) {
    if (!this.guidanceSystem) return [];
    return this.guidanceSystem.getInteractionHistory(limit);
  }

  async exportCostReport() {
    // TODO: Implement when cost optimizer is available
    return {
      period: '30 days',
      totalCost: 0,
      dailyAverage: 0,
      insights: 0
    };
  }
}
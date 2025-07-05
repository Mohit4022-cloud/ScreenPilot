import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import ElectronStore from "../utils/store";
import * as path from 'path';

export enum PrivacyState {
  IDLE = 'idle',
  PENDING_CONSENT = 'pending-consent',
  CONSENT_GRANTED = 'consent-granted',
  ACTIVE_CAPTURE = 'active-capture',
  PAUSED = 'paused',
  ERROR = 'error'
}

export interface ConsentData {
  timestamp: number;
  purpose: string;
  dataTypes: string[];
  duration?: number;
  sessionId: string;
}

export interface PrivacyConfig {
  autoDeleteAfter: number; // hours
  pauseOnSensitive: boolean;
  showIndicator: boolean;
  requireReConsent: boolean;
  reconsentInterval: number; // days
}

export class PrivacyManager extends EventEmitter {
  private state: PrivacyState = PrivacyState.IDLE;
  private store: ElectronStore<Record<string, any>>;
  private tray: Tray | null = null;
  private consentHistory: ConsentData[] = [];
  private currentSession: string | null = null;
  private captureStartTime: number | null = null;
  private pausedContexts: Set<string> = new Set();
  private config: PrivacyConfig;
  private blinkInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.store = new ElectronStore<Record<string, any>>({
      name: 'privacy',
      defaults: {
        consentHistory: [],
        config: {
          autoDeleteAfter: 24,
          pauseOnSensitive: true,
          showIndicator: true,
          requireReConsent: true,
          reconsentInterval: 30
        }
      }
    });

    this.config = this.store.get('config') as PrivacyConfig;
    this.consentHistory = this.store.get('consentHistory', []) as ConsentData[];
    this.cleanOldConsents();
  }

  public initialize(): void {
    if (this.config.showIndicator) {
      this.createTrayIcon();
    }
  }

  private createTrayIcon(): void {
    const icon = this.createIcon('idle');
    this.tray = new Tray(icon);
    this.updateTrayMenu();
    this.tray.setToolTip('ScreenPilot - Privacy Monitor');
  }

  private createIcon(state: 'idle' | 'recording' | 'paused'): Electron.NativeImage {
    // In production, these would be actual icon files
    // For now, we'll create them dynamically
    const size = process.platform === 'darwin' ? 16 : 32;
    
    // Create an empty image and resize it
    // In a real app, you would load actual icon files based on state
    const icon = nativeImage.createEmpty();
    return icon.resize({ width: size, height: size });
  }

  private updateTrayMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Status: ${this.getStateLabel()}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Pause Recording',
        click: () => this.pauseRecording(),
        enabled: this.state === PrivacyState.ACTIVE_CAPTURE
      },
      {
        label: 'Resume Recording',
        click: () => this.resumeRecording(),
        enabled: this.state === PrivacyState.PAUSED
      },
      {
        label: 'Stop Recording',
        click: () => this.stopRecording(),
        enabled: [PrivacyState.ACTIVE_CAPTURE, PrivacyState.PAUSED].includes(this.state)
      },
      { type: 'separator' },
      {
        label: 'Privacy Settings',
        click: () => this.openPrivacySettings()
      },
      {
        label: 'View Consent History',
        click: () => this.showConsentHistory()
      },
      { type: 'separator' },
      {
        label: 'Quit ScreenPilot',
        click: () => app.quit()
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private getStateLabel(): string {
    switch (this.state) {
      case PrivacyState.IDLE:
        return 'Idle';
      case PrivacyState.PENDING_CONSENT:
        return 'Waiting for consent';
      case PrivacyState.CONSENT_GRANTED:
        return 'Consent granted';
      case PrivacyState.ACTIVE_CAPTURE:
        return 'Recording';
      case PrivacyState.PAUSED:
        return 'Paused';
      case PrivacyState.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  public setState(newState: PrivacyState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('state-changed', { oldState, newState });
    this.updateTrayIcon();
    this.updateTrayMenu();
  }

  private updateTrayIcon(): void {
    if (!this.tray) return;

    switch (this.state) {
      case PrivacyState.ACTIVE_CAPTURE:
        this.startBlinking();
        break;
      case PrivacyState.PAUSED:
        this.stopBlinking();
        this.tray.setImage(this.createIcon('paused'));
        break;
      default:
        this.stopBlinking();
        this.tray.setImage(this.createIcon('idle'));
    }
  }

  private startBlinking(): void {
    if (this.blinkInterval) return;

    let visible = true;
    this.blinkInterval = setInterval(() => {
      if (this.tray) {
        if (visible) {
          this.tray.setImage(this.createIcon('recording'));
        } else {
          this.tray.setImage(this.createIcon('idle'));
        }
        visible = !visible;
      }
    }, 500);
  }

  private stopBlinking(): void {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
  }

  public async requestConsent(purpose: string, dataTypes: string[]): Promise<boolean> {
    // Check if we need re-consent
    if (this.needsReConsent()) {
      this.setState(PrivacyState.PENDING_CONSENT);
      
      // Emit event to show consent dialog
      this.emit('consent-required', { purpose, dataTypes });
      
      // Wait for consent response
      return new Promise((resolve) => {
        this.once('consent-response', (granted: boolean) => {
          if (granted) {
            this.recordConsent(purpose, dataTypes);
            this.setState(PrivacyState.CONSENT_GRANTED);
          } else {
            this.setState(PrivacyState.IDLE);
          }
          resolve(granted);
        });
      });
    }

    return true;
  }

  private needsReConsent(): boolean {
    if (!this.config.requireReConsent) return false;
    
    const lastConsent = this.consentHistory[this.consentHistory.length - 1];
    if (!lastConsent) return true;

    const daysSinceConsent = (Date.now() - lastConsent.timestamp) / (1000 * 60 * 60 * 24);
    return daysSinceConsent > this.config.reconsentInterval;
  }

  private recordConsent(purpose: string, dataTypes: string[]): void {
    const consent: ConsentData = {
      timestamp: Date.now(),
      purpose,
      dataTypes,
      sessionId: this.generateSessionId()
    };

    this.consentHistory.push(consent);
    this.currentSession = consent.sessionId;
    this.store.set('consentHistory', this.consentHistory);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public startCapture(): void {
    if (this.state === PrivacyState.CONSENT_GRANTED || this.state === PrivacyState.PAUSED) {
      this.setState(PrivacyState.ACTIVE_CAPTURE);
      this.captureStartTime = Date.now();
      this.emit('capture-started');
    }
  }

  public pauseRecording(): void {
    if (this.state === PrivacyState.ACTIVE_CAPTURE) {
      this.setState(PrivacyState.PAUSED);
      this.emit('capture-paused');
    }
  }

  public pauseCapture(): void {
    this.pauseRecording();
  }

  public resumeRecording(): void {
    if (this.state === PrivacyState.PAUSED) {
      this.setState(PrivacyState.ACTIVE_CAPTURE);
      this.emit('capture-resumed');
    }
  }

  public resumeCapture(): void {
    this.resumeRecording();
  }

  public stopRecording(): void {
    if ([PrivacyState.ACTIVE_CAPTURE, PrivacyState.PAUSED].includes(this.state)) {
      const duration = this.captureStartTime ? Date.now() - this.captureStartTime : 0;
      
      // Update consent history with duration
      if (this.currentSession) {
        const consent = this.consentHistory.find(c => c.sessionId === this.currentSession);
        if (consent) {
          consent.duration = duration;
          this.store.set('consentHistory', this.consentHistory);
        }
      }

      this.setState(PrivacyState.IDLE);
      this.captureStartTime = null;
      this.currentSession = null;
      this.emit('capture-stopped', { duration });
    }
  }

  public addSensitiveContext(context: string): void {
    this.pausedContexts.add(context);
    if (this.config.pauseOnSensitive && this.state === PrivacyState.ACTIVE_CAPTURE) {
      this.pauseRecording();
      this.emit('auto-paused', { reason: 'sensitive-context', context });
    }
  }

  public removeSensitiveContext(context: string): void {
    this.pausedContexts.delete(context);
    if (this.pausedContexts.size === 0 && this.state === PrivacyState.PAUSED) {
      this.emit('can-resume', { reason: 'no-sensitive-contexts' });
    }
  }

  private cleanOldConsents(): void {
    const cutoffTime = Date.now() - (this.config.autoDeleteAfter * 60 * 60 * 1000);
    this.consentHistory = this.consentHistory.filter(c => c.timestamp > cutoffTime);
    this.store.set('consentHistory', this.consentHistory);
  }

  private openPrivacySettings(): void {
    this.emit('open-privacy-settings');
  }

  private showConsentHistory(): void {
    this.emit('show-consent-history');
  }

  public updateConfig(newConfig: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.store.set('config', this.config);
    
    if (!this.config.showIndicator && this.tray) {
      this.tray.destroy();
      this.tray = null;
    } else if (this.config.showIndicator && !this.tray) {
      this.createTrayIcon();
    }
  }

  public getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  public getConsentHistory(): ConsentData[] {
    return [...this.consentHistory];
  }

  public getCurrentState(): PrivacyState {
    return this.state;
  }

  public destroy(): void {
    this.stopBlinking();
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
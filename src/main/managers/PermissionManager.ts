import { app, systemPreferences, dialog } from 'electron';
import ElectronStore from '../utils/store';
import { EventEmitter } from 'events';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export enum PermissionType {
  SCREEN_RECORDING = 'screen-recording',
  ACCESSIBILITY = 'accessibility',
  MICROPHONE = 'microphone',
  CAMERA = 'camera'
}

export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  NOT_DETERMINED = 'not-determined',
  RESTRICTED = 'restricted'
}

interface PermissionState {
  status: PermissionStatus;
  lastChecked: number;
  userConsent: boolean;
}

interface PermissionCache {
  [key: string]: PermissionState;
}

export class PermissionManager extends EventEmitter {
  private store: ElectronStore<Record<string, any>>;
  private cache: PermissionCache = {};
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.store = new ElectronStore<Record<string, any>>({
      name: 'permissions',
      defaults: {
        permissions: {},
        firstRun: true
      }
    });
    this.loadCache();
    this.startPermissionMonitoring();
  }

  private loadCache(): void {
    this.cache = this.store.get('permissions', {}) as PermissionCache;
  }

  private saveCache(): void {
    this.store.set('permissions', this.cache);
  }

  private startPermissionMonitoring(): void {
    // Check permissions every 5 seconds
    this.checkInterval = setInterval(() => {
      this.checkAllPermissions();
    }, 5000);
  }

  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkAllPermissions(): Promise<void> {
    const permissions = [
      PermissionType.SCREEN_RECORDING,
      PermissionType.ACCESSIBILITY
    ];

    for (const permission of permissions) {
      const oldStatus = this.cache[permission]?.status;
      const newStatus = await this.checkSystemPermission(permission);
      
      if (oldStatus !== newStatus) {
        this.emit('permission-changed', { permission, oldStatus, newStatus });
      }
    }
  }

  public async checkPermission(type: PermissionType): Promise<PermissionStatus> {
    const systemStatus = await this.checkSystemPermission(type);
    const appStatus = this.checkAppPermission(type);

    // Update cache
    this.cache[type] = {
      status: systemStatus,
      lastChecked: Date.now(),
      userConsent: appStatus
    };
    this.saveCache();

    return systemStatus;
  }

  private async checkSystemPermission(type: PermissionType): Promise<PermissionStatus> {
    if (process.platform === 'darwin') {
      return this.checkMacOSPermission(type);
    } else if (process.platform === 'win32') {
      return this.checkWindowsPermission(type);
    } else {
      return this.checkLinuxPermission(type);
    }
  }

  private async checkMacOSPermission(type: PermissionType): Promise<PermissionStatus> {
    switch (type) {
      case PermissionType.SCREEN_RECORDING:
        // macOS specific check for screen recording
        try {
          const { stdout } = await execAsync(
            `osascript -e 'tell application "System Events" to get properties of desktop 1'`
          );
          return stdout ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
        } catch (error) {
          // If the command fails, it usually means permission is not granted
          return PermissionStatus.DENIED;
        }

      case PermissionType.ACCESSIBILITY:
        const trusted = systemPreferences.isTrustedAccessibilityClient(false);
        return trusted ? PermissionStatus.GRANTED : PermissionStatus.DENIED;

      case PermissionType.MICROPHONE:
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        return this.convertMacOSStatus(micStatus);

      case PermissionType.CAMERA:
        const camStatus = systemPreferences.getMediaAccessStatus('camera');
        return this.convertMacOSStatus(camStatus);

      default:
        return PermissionStatus.NOT_DETERMINED;
    }
  }

  private async checkWindowsPermission(type: PermissionType): Promise<PermissionStatus> {
    // Windows generally doesn't require explicit permissions for screen recording
    // But we can check for admin rights if needed
    switch (type) {
      case PermissionType.SCREEN_RECORDING:
      case PermissionType.ACCESSIBILITY:
        return PermissionStatus.GRANTED;
      
      case PermissionType.MICROPHONE:
      case PermissionType.CAMERA:
        // Windows 10+ has privacy settings for these
        // For now, we'll assume granted if not explicitly blocked
        return PermissionStatus.GRANTED;
      
      default:
        return PermissionStatus.NOT_DETERMINED;
    }
  }

  private async checkLinuxPermission(type: PermissionType): Promise<PermissionStatus> {
    // Linux permissions vary by distribution
    // Generally more permissive than macOS
    switch (type) {
      case PermissionType.SCREEN_RECORDING:
      case PermissionType.ACCESSIBILITY:
        return PermissionStatus.GRANTED;
      
      case PermissionType.MICROPHONE:
      case PermissionType.CAMERA:
        // Could check for /dev/video* or PulseAudio permissions
        return PermissionStatus.GRANTED;
      
      default:
        return PermissionStatus.NOT_DETERMINED;
    }
  }

  private convertMacOSStatus(status: string): PermissionStatus {
    switch (status) {
      case 'granted':
        return PermissionStatus.GRANTED;
      case 'denied':
        return PermissionStatus.DENIED;
      case 'restricted':
        return PermissionStatus.RESTRICTED;
      default:
        return PermissionStatus.NOT_DETERMINED;
    }
  }

  private checkAppPermission(type: PermissionType): boolean {
    return this.cache[type]?.userConsent || false;
  }

  public async requestPermission(type: PermissionType): Promise<boolean> {
    const currentStatus = await this.checkPermission(type);
    
    if (currentStatus === PermissionStatus.GRANTED) {
      return true;
    }

    if (process.platform === 'darwin') {
      return this.requestMacOSPermission(type);
    } else {
      // For Windows/Linux, we just need user consent
      return true;
    }
  }

  private async requestMacOSPermission(type: PermissionType): Promise<boolean> {
    switch (type) {
      case PermissionType.SCREEN_RECORDING:
        const { response } = await dialog.showMessageBox({
          type: 'info',
          title: 'Screen Recording Permission Required',
          message: 'ScreenPilot needs permission to record your screen.',
          detail: 'You will be redirected to System Preferences. Please grant Screen Recording permission to ScreenPilot.',
          buttons: ['Open System Preferences', 'Cancel'],
          defaultId: 0
        });

        if (response === 0) {
          // Open System Preferences
          await execAsync('open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"');
          
          // Show instruction dialog
          await dialog.showMessageBox({
            type: 'info',
            title: 'Grant Permission',
            message: 'Please grant Screen Recording permission to ScreenPilot',
            detail: '1. Find ScreenPilot in the list\n2. Check the checkbox next to it\n3. You may need to restart ScreenPilot',
            buttons: ['OK']
          });
        }
        return false;

      case PermissionType.ACCESSIBILITY:
        const options = {
          prompt: true
        };
        return systemPreferences.isTrustedAccessibilityClient(true);

      case PermissionType.MICROPHONE:
        return systemPreferences.askForMediaAccess('microphone');

      case PermissionType.CAMERA:
        return systemPreferences.askForMediaAccess('camera');

      default:
        return false;
    }
  }

  public getPermissionState(type: PermissionType): PermissionState | null {
    return this.cache[type] || null;
  }

  public async getAllPermissions(): Promise<{ [key: string]: PermissionState }> {
    const permissions: { [key: string]: PermissionState } = {};
    
    for (const type of Object.values(PermissionType)) {
      await this.checkPermission(type);
      permissions[type] = this.cache[type];
    }

    return permissions;
  }

  public getAllPermissionsStatus(): Record<string, PermissionStatus> {
    const status: Record<string, PermissionStatus> = {};
    
    for (const type of Object.values(PermissionType)) {
      status[type] = this.cache[type]?.status || PermissionStatus.NOT_DETERMINED;
    }

    return status;
  }

  public setUserConsent(type: PermissionType, consent: boolean): void {
    if (this.cache[type]) {
      this.cache[type].userConsent = consent;
    } else {
      this.cache[type] = {
        status: PermissionStatus.NOT_DETERMINED,
        lastChecked: Date.now(),
        userConsent: consent
      };
    }
    this.saveCache();
    this.emit('consent-changed', { permission: type, consent });
  }

  public isFirstRun(): boolean {
    return this.store.get('firstRun', true) as boolean;
  }

  public setFirstRunComplete(): void {
    this.store.set('firstRun', false);
  }
}
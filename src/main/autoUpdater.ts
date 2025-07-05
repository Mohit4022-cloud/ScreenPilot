import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow, app } from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string | null;
}

export class AutoUpdateManager extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;
  private updateAvailable = false;
  private updateDownloaded = false;
  private mainWindow: BrowserWindow | null;

  constructor(mainWindow: BrowserWindow | null = null) {
    super();
    this.mainWindow = mainWindow;
    
    // Configure auto-updater
    this.configure();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Start checking for updates
    this.startUpdateCheck();
  }

  private configure() {
    // Configure update feed URL
    if (process.env.UPDATE_FEED_URL) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: process.env.UPDATE_FEED_URL
      });
    } else {
      // Default to GitHub releases
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'screenpilot',
        repo: 'screenpilot-macos'
      });
    }

    // Configure auto-updater settings
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Disable auto-updater in development
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = false;
    }
  }

  private setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
      this.isChecking = true;
      this.emit('checking-for-update');
    });

    autoUpdater.on('update-available', (info: any) => {
      console.log('Update available:', info.version);
      this.updateAvailable = true;
      this.isChecking = false;
      
      // Notify renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-available', info);
      }
      
      // Show notification
      this.showUpdateAvailableDialog(info);
      
      this.emit('update-available', info);
    });

    autoUpdater.on('update-not-available', (info: any) => {
      console.log('No updates available');
      this.isChecking = false;
      this.emit('update-not-available', info);
    });

    autoUpdater.on('error', (error: Error) => {
      console.error('Update error:', error);
      this.isChecking = false;
      this.emit('error', error);
      
      // Don't show error dialogs for network errors
      if (!error.message.includes('net::') && !error.message.includes('ENOTFOUND')) {
        dialog.showErrorBox('Update Error', 
          'Failed to check for updates. Please try again later.');
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      console.log(logMessage);
      
      // Send progress to renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-progress', progressObj);
      }
      
      this.emit('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info: any) => {
      console.log('Update downloaded:', info.version);
      this.updateDownloaded = true;
      
      // Notify renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-downloaded', info);
      }
      
      // Show restart dialog
      this.showUpdateReadyDialog(info);
      
      this.emit('update-downloaded', info);
    });
  }

  private showUpdateAvailableDialog(info: UpdateInfo) {
    const releaseNotes = info.releaseNotes 
      ? `\n\nRelease Notes:\n${info.releaseNotes}` 
      : '';
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version of ScreenPilot (${info.version}) is available.`,
      detail: `The update will be downloaded in the background. You'll be notified when it's ready to install.${releaseNotes}`,
      buttons: ['OK'],
      defaultId: 0,
      icon: path.join(__dirname, '../../assets/icon.png')
    });
  }

  private showUpdateReadyDialog(info: UpdateInfo) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready to Install',
      message: `ScreenPilot ${info.version} has been downloaded and is ready to install.`,
      detail: 'The application will restart to apply the update. Make sure to save any work before proceeding.',
      buttons: ['Restart Now', 'Install on Next Launch'],
      defaultId: 0,
      cancelId: 1,
      icon: path.join(__dirname, '../../assets/icon.png')
    }).then((result) => {
      if (result.response === 0) {
        // User chose to restart now
        this.quitAndInstall();
      }
      // Otherwise, update will be installed on next app quit
    });
  }

  private startUpdateCheck() {
    // Initial check after 5 seconds
    setTimeout(() => {
      this.checkForUpdates();
    }, 5000);
    
    // Check every 4 hours
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  }

  public async checkForUpdates(): Promise<void> {
    if (this.isChecking) {
      console.log('Already checking for updates');
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Failed to check for updates:', error);
      this.emit('error', error);
    }
  }

  public async checkForUpdatesManual(): Promise<void> {
    if (this.isChecking) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Check in Progress',
        message: 'Already checking for updates. Please wait...',
        buttons: ['OK']
      });
      return;
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      
      if (!this.updateAvailable && result) {
        // No update available, inform user (only for manual checks)
        dialog.showMessageBox({
          type: 'info',
          title: 'No Updates Available',
          message: 'You are running the latest version of ScreenPilot.',
          detail: `Current version: ${app.getVersion()}`,
          buttons: ['OK'],
          icon: path.join(__dirname, '../../assets/icon.png')
        });
      }
    } catch (error) {
      console.error('Manual update check failed:', error);
      dialog.showErrorBox('Update Check Failed', 
        'Unable to check for updates. Please check your internet connection and try again.');
    }
  }

  public quitAndInstall() {
    // Set flag to prevent window close prevention
    (global as any).isQuitting = true;
    
    // Force quit and install
    autoUpdater.quitAndInstall(false, true);
  }

  public setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  public getUpdateStatus() {
    return {
      isChecking: this.isChecking,
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      autoDownload: autoUpdater.autoDownload,
      autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit,
      currentVersion: app.getVersion()
    };
  }

  public setAutoDownload(enabled: boolean) {
    autoUpdater.autoDownload = enabled;
  }

  public setAutoInstallOnAppQuit(enabled: boolean) {
    autoUpdater.autoInstallOnAppQuit = enabled;
  }

  public downloadUpdate() {
    if (this.updateAvailable && !this.updateDownloaded) {
      autoUpdater.downloadUpdate();
    }
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.removeAllListeners();
  }
}
import { app, BrowserWindow, Tray, Menu, systemPreferences, dialog, shell, screen, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import { ScreenPilotCore } from './core/ScreenPilotCore';
import { AutoUpdateManager } from './autoUpdater';
import { TrayManager } from './tray-manager';
import { FloatingUIManager } from './floating-ui-manager';

// Global declarations for Vite-injected variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

class ScreenPilotApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private trayManager: TrayManager | null = null;
  private floatingUIManager: FloatingUIManager | null = null;
  private isMacOSBeta = false;
  private core: ScreenPilotCore;
  private isQuitting = false;
  private updateManager: AutoUpdateManager | null = null;

  constructor() {
    console.log('ScreenPilot: Starting app...');
    this.core = new ScreenPilotCore();
    this.setupApp();
  }

  private setupApp() {
    // Single instance lock
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      app.quit();
      return;
    }

    // Handle second instance
    app.on('second-instance', () => {
      // If user tries to open another instance, show the window
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    // Mac-specific settings
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide(); // Hide from dock (menu bar app)
    }
    
    app.whenReady().then(async () => {
      console.log('ScreenPilot: App ready, initializing...');
      
      // Detect macOS beta
      this.detectMacOSBeta();
      
      try {
        // Skip permissions for now to test tray
        // await this.checkPermissions();
        // console.log('ScreenPilot: Permissions checked');
        
        // Create window first
        this.createWindow();
        console.log('ScreenPilot: Window created');
        
        // Use floating UI for macOS beta, tray for others
        if (this.isMacOSBeta) {
          console.log('ScreenPilot: macOS beta detected - using floating UI');
          this.createFloatingUI();
        } else {
          console.log('ScreenPilot: Using system tray');
          this.createTray();
        }
        
        this.setupAutoUpdater();
        console.log('ScreenPilot: Auto-updater setup');
        
        // Skip core start for now
        // await this.core.start();
        // console.log('ScreenPilot: Core started');
      } catch (error) {
        console.error('ScreenPilot: Error during initialization:', error);
      }
    });

    app.on('window-all-closed', () => {
      // Don't quit when all windows are closed (menu bar app)
      if (process.platform !== 'darwin' && this.isQuitting) {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      this.isQuitting = true;
      this.updateManager?.destroy();
      this.trayManager?.destroy();
      this.floatingUIManager?.destroy();
    });
  }

  private async checkPermissions() {
    // Check screen recording permission (macOS only)
    if (process.platform === 'darwin') {
      const screenAccess = systemPreferences.getMediaAccessStatus('screen');
      
      if (screenAccess !== 'granted') {
        // Show permission dialog
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          title: 'Screen Recording Permission Required',
          message: 'ScreenPilot needs screen recording permission to analyze your screen and provide AI assistance.',
          detail: 'You\'ll need to grant permission in System Preferences and restart the app.',
          buttons: ['Open System Preferences', 'Quit'],
          defaultId: 0
        });

        if (response === 0) {
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
        } else {
          app.quit();
        }
      }
    }
  }

  private detectMacOSBeta() {
    if (process.platform === 'darwin') {
      // Force use floating UI for your macOS 26.0
      this.isMacOSBeta = true;
      
      console.log(`⚠️  macOS Beta detected`);
      console.log('🔧 Using floating UI as workaround for tray icon bug');
      
      // Show notification after window is ready
      setTimeout(() => {
        if (this.mainWindow) {
          dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'macOS Beta Detected',
            message: 'Using Floating UI Instead of Tray',
            detail: `You're running macOS beta. Due to a known bug in macOS beta versions, tray icons don't appear. We'll use a floating control panel instead.`,
            buttons: ['OK']
          });
        }
      }, 1000);
    }
  }

  private createTray() {
    // Use the TrayManager
    this.trayManager = new TrayManager(this.mainWindow);
    this.tray = this.trayManager.createTray();
    console.log('Tray created using TrayManager');
    return;
  }

  private createFloatingUI() {
    // Use the FloatingUIManager for macOS beta
    this.floatingUIManager = new FloatingUIManager(this.mainWindow!);
    this.floatingUIManager.createFloatingUI();
    console.log('Floating UI created as alternative to tray');
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 600,
      show: false,
      frame: false,
      resizable: false,
      transparent: true,
      alwaysOnTop: true,
      hasShadow: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../renderer/preload.js')
      }
    });

    // Load the app
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      this.mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
    
    // Position near menu bar
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    this.mainWindow.setPosition(width - 420, 40);

    // Hide window when clicking outside
    this.mainWindow.on('blur', () => {
      if (!this.mainWindow?.webContents.isDevToolsOpened()) {
        this.mainWindow?.hide();
      }
    });

    // Prevent window from being destroyed
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    // Handle IPC events from renderer
    this.setupIPC();
  }

  private setupIPC() {
    
    // Core functionality
    ipcMain.handle('screenpilot:start', () => this.core.start());
    ipcMain.handle('screenpilot:stop', () => this.core.stop());
    ipcMain.handle('screenpilot:pause', (_, paused: boolean) => {
      this.core.setPaused(paused);
      this.mainWindow?.webContents.send('screenpilot:pause-state', paused);
    });
    ipcMain.handle('screenpilot:getStatus', () => this.core.getStatus());
    
    // Actions
    ipcMain.handle('screenpilot:executeAction', async (_, action: any) => {
      // Handle different action types
      if (action.type === 'keyboard') {
        // Simulate keyboard shortcut
        console.log('Execute keyboard action:', action.payload);
      } else if (action.type === 'command') {
        // Execute command
        console.log('Execute command:', action.payload);
      }
      return { success: true };
    });
    
    // Settings
    ipcMain.handle('screenpilot:getSettings', () => this.core.getSettings());
    ipcMain.handle('screenpilot:saveSettings', (_, settings: any) => this.core.saveSettings(settings));
    
    // Update-related IPC handlers
    ipcMain.handle('screenpilot:check-updates', () => {
      return this.updateManager?.checkForUpdatesManual();
    });
    
    ipcMain.handle('screenpilot:get-update-status', () => {
      return this.updateManager?.getUpdateStatus();
    });
    
    ipcMain.handle('screenpilot:download-update', () => {
      return this.updateManager?.downloadUpdate();
    });
    
    ipcMain.handle('screenpilot:install-update', () => {
      return this.updateManager?.quitAndInstall();
    });
    
    // Listen for core events
    this.core.on('insight', (data) => {
      this.mainWindow?.webContents.send('screenpilot:insight', data);
      
      // Check if it's guidance that should be shown in floating assistant
      if (data.type === 'guidance' && data.data) {
        this.mainWindow?.webContents.send('screenpilot:show-guidance', data.data);
      }
    });
    
    this.core.on('error', (error) => {
      this.mainWindow?.webContents.send('screenpilot:error', error);
    });
    
    this.core.on('status-change', (status) => {
      this.mainWindow?.webContents.send('screenpilot:status', status);
      // Update tray status
      if (this.trayManager) {
        this.trayManager.updateStatusIndicator(status.isActive ? 'active' : 'inactive');
      }
    });
  }

  private showWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // Update the update manager's window reference
      if (this.updateManager) {
        this.updateManager.setMainWindow(this.mainWindow);
      }
    }
  }

  private showSettings() {
    this.mainWindow?.webContents.send('navigate', '/settings');
    this.showWindow();
  }

  private showAbout() {
    if (this.trayManager) {
      this.trayManager.showAbout();
    } else {
      dialog.showMessageBox({
        type: 'info',
        title: 'About ScreenPilot',
        message: 'ScreenPilot',
        detail: `AI-powered desktop assistant using GPT-4o\nVersion: ${app.getVersion()}\n\nBuilt with Electron, React, and TypeScript`,
        buttons: ['OK']
      });
    }
  }

  private setupAutoUpdater() {
    // Initialize auto-update manager with main window
    this.updateManager = new AutoUpdateManager(this.mainWindow);
    
    // Listen for update events
    this.updateManager.on('checking-for-update', () => {
      console.log('Checking for updates...');
    });
    
    this.updateManager.on('update-available', (info) => {
      console.log('Update available:', info.version);
    });
    
    this.updateManager.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info.version);
    });
    
    this.updateManager.on('error', (error) => {
      console.error('Update error:', error);
    });
  }
}

// Handle Squirrel events on Windows
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Start the app
new ScreenPilotApp();
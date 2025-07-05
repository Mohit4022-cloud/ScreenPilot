import { app, BrowserWindow, Tray, Menu, systemPreferences, dialog, shell, screen, ipcMain } from 'electron';
import * as path from 'path';
import { ScreenPilotCore } from './core/ScreenPilotCore';
import { AutoUpdateManager } from './autoUpdater';

// Global declarations for Vite-injected variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

class ScreenPilotApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
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
      try {
        // Skip permissions for now to test tray
        // await this.checkPermissions();
        // console.log('ScreenPilot: Permissions checked');
        
        this.createTray();
        console.log('ScreenPilot: Tray created');
        
        this.createWindow();
        console.log('ScreenPilot: Window created');
        
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

  private createTray() {
    // Use nativeImage to create a placeholder icon
    const { nativeImage } = require('electron');
    
    // Try to load icon, fall back to empty image if not found
    let trayIcon;
    const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
    
    try {
      if (require('fs').existsSync(iconPath) && require('fs').statSync(iconPath).size > 0) {
        trayIcon = nativeImage.createFromPath(iconPath);
      } else {
        // Create a simple 16x16 black square as placeholder
        const buffer = Buffer.alloc(16 * 16 * 4);
        for (let i = 0; i < buffer.length; i += 4) {
          buffer[i] = 0;     // R
          buffer[i + 1] = 0; // G
          buffer[i + 2] = 0; // B
          buffer[i + 3] = 255; // A
        }
        trayIcon = nativeImage.createFromBuffer(buffer, { width: 16, height: 16 });
      }
    } catch (error) {
      console.error('Error loading tray icon:', error);
      // Create empty image as fallback
      trayIcon = nativeImage.createEmpty();
    }
    
    this.tray = new Tray(trayIcon);
    
    const updateTrayMenu = (isPaused: boolean = false) => {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Assistant',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => this.showWindow()
        },
        {
          label: 'Settings',
          click: () => this.showSettings()
        },
        { type: 'separator' },
        {
          label: isPaused ? 'Resume' : 'Pause',
          type: 'checkbox',
          checked: isPaused,
          click: (item) => {
            this.core.setPaused(item.checked);
            updateTrayMenu(item.checked);
          }
        },
        {
          label: 'Status',
          enabled: false,
          sublabel: isPaused ? 'Paused' : 'Active'
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => this.updateManager?.checkForUpdatesManual()
        },
        {
          label: 'About',
          click: () => this.showAbout()
        },
        { type: 'separator' },
        {
          label: 'Quit ScreenPilot',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            this.isQuitting = true;
            app.quit();
          }
        }
      ]);

      this.tray?.setContextMenu(contextMenu);
    };

    this.tray.setToolTip('ScreenPilot - AI Desktop Assistant');
    updateTrayMenu(false);

    // Click on tray icon to show/hide window
    this.tray.on('click', () => {
      if (this.mainWindow?.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.showWindow();
      }
    });
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
      // Update tray icon
      if (this.tray) {
        const iconName = status.isActive ? 'tray-icon-active.png' : 'tray-icon.png';
        this.tray.setImage(path.join(__dirname, '../../assets', iconName));
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
    dialog.showMessageBox({
      type: 'info',
      title: 'About ScreenPilot',
      message: 'ScreenPilot',
      detail: `AI-powered desktop assistant using GPT-4o\nVersion: ${app.getVersion()}\n\nBuilt with Electron, React, and TypeScript`,
      buttons: ['OK'],
      icon: path.join(__dirname, '../../assets/icon.png')
    });
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
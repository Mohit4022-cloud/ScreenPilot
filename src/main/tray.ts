// src/main/tray.ts - Complete System Tray Implementation
import { app, Tray, Menu, nativeImage, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null;
  private isQuitting = false;
  private isActive = false;
  private privacyMode = false;
  private currentStatus = 'inactive';
  private animationInterval: NodeJS.Timeout | null = null;
  private iconSizes: Record<string, { width: number; height: number }>;

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
    
    // Platform-specific icon sizes
    this.iconSizes = {
      darwin: { width: 22, height: 22 },  // macOS
      win32: { width: 16, height: 16 },   // Windows
      linux: { width: 24, height: 24 }    // Linux
    };
  }

  createTray() {
    // Create tray icon with proper path and format
    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);
    
    // Set tooltip
    this.tray.setToolTip('ScreenPilot - AI Screen Assistant');
    
    // Platform-specific setup
    if (process.platform === 'darwin') {
      // macOS specific
      this.tray.setIgnoreDoubleClickEvents(true);
    }
    
    // Create context menu
    this.updateContextMenu();
    
    // Handle tray click events
    this.setupEventHandlers();
    
    // Start status indicator
    this.updateStatusIndicator('inactive');
    
    return this.tray;
  }

  createTrayIcon() {
    const platformSize = this.iconSizes[process.platform] || this.iconSizes.linux;
    
    // Multiple icon paths for fallback
    const iconPaths = [
      path.join(__dirname, '../../assets/icons/tray/icon.png'),
      path.join(__dirname, '../../assets/tray-icon.png'),
      path.join(__dirname, '../../assets/icon.png'),
      path.join(app.getAppPath(), 'assets/icons/tray/icon.png'),
      path.join(app.getAppPath(), 'assets/tray-icon.png')
    ];
    
    // Try to find a valid icon
    let iconPath = null;
    
    for (const testPath of iconPaths) {
      if (fs.existsSync(testPath)) {
        iconPath = testPath;
        console.log('Found tray icon at:', iconPath);
        break;
      }
    }
    
    // If no icon found, create a default one
    if (!iconPath) {
      console.warn('No tray icon found, creating default icon');
      return this.createDefaultIcon();
    }
    
    // Create native image with proper size
    const icon = nativeImage.createFromPath(iconPath);
    
    // Resize for platform
    return icon.resize(platformSize);
  }

  createDefaultIcon() {
    // Create a simple colored square as fallback
    const size = this.iconSizes[process.platform] || { width: 24, height: 24 };
    
    // Create programmatic icon
    const buffer = Buffer.alloc(size.width * size.height * 4);
    
    // Fill with purple color
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 88;      // R (purple)
      buffer[i + 1] = 101;  // G
      buffer[i + 2] = 242;  // B
      buffer[i + 3] = 255;  // A (opaque)
    }
    
    const icon = nativeImage.createEmpty();
    icon.addRepresentation({
      width: size.width,
      height: size.height,
      buffer: buffer,
      scaleFactor: 1.0
    });
    
    // For macOS retina
    if (process.platform === 'darwin') {
      const retinaBuffer = Buffer.alloc(44 * 44 * 4);
      for (let i = 0; i < retinaBuffer.length; i += 4) {
        retinaBuffer[i] = 88;
        retinaBuffer[i + 1] = 101;
        retinaBuffer[i + 2] = 242;
        retinaBuffer[i + 3] = 255;
      }
      
      icon.addRepresentation({
        width: 44,
        height: 44,
        buffer: retinaBuffer,
        scaleFactor: 2.0
      });
    }
    
    return icon;
  }

  updateContextMenu() {
    const menu = Menu.buildFromTemplate([
      {
        label: 'ScreenPilot',
        enabled: false
      },
      { type: 'separator' },
      {
        label: this.isActive ? '🟢 Active' : '⚪ Inactive',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Toggle Capture',
        click: () => this.toggleCapture(),
        accelerator: 'CommandOrControl+Shift+S'
      },
      {
        label: 'Privacy Mode',
        type: 'checkbox',
        checked: this.privacyMode || false,
        click: () => this.togglePrivacyMode()
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => this.showWindow()
      },
      {
        label: 'Settings',
        click: () => this.openSettings()
      },
      { type: 'separator' },
      {
        label: 'About',
        click: () => this.showAbout()
      },
      {
        label: 'Quit',
        click: () => this.quitApp(),
        accelerator: 'CommandOrControl+Q'
      }
    ]);
    
    this.tray.setContextMenu(menu);
  }

  setupEventHandlers() {
    // Single click handler
    this.tray.on('click', (event, bounds) => {
      if (process.platform === 'darwin') {
        // macOS: show menu on left click
        this.tray.popUpContextMenu();
      } else {
        // Windows/Linux: toggle window
        this.toggleWindow();
      }
    });
    
    // Right click handler (Windows/Linux)
    if (process.platform !== 'darwin') {
      this.tray.on('right-click', () => {
        this.tray.popUpContextMenu();
      });
    }
    
    // Double click handler
    this.tray.on('double-click', () => {
      this.showWindow();
    });
  }

  updateStatusIndicator(status) {
    this.currentStatus = status;
    
    // Update icon based on status
    const statusIcons = {
      inactive: 'tray-inactive',
      active: 'tray-active',
      recording: 'tray-recording',
      privacy: 'tray-privacy',
      error: 'tray-error'
    };
    
    // Try to load status-specific icon
    const iconName = statusIcons[status] || 'tray-inactive';
    const statusIconPath = path.join(__dirname, `../../assets/icons/tray/${iconName}.png`);
    
    if (fs.existsSync(statusIconPath)) {
      const icon = nativeImage.createFromPath(statusIconPath);
      const resized = icon.resize(this.iconSizes[process.platform] || { width: 24, height: 24 });
      this.tray.setImage(resized);
    } else {
      // Use colored overlays on default icon
      this.applyStatusOverlay(status);
    }
    
    // Update menu
    this.updateContextMenu();
    
    // Animate for recording status
    if (status === 'recording') {
      this.startRecordingAnimation();
    } else {
      this.stopRecordingAnimation();
    }
  }

  applyStatusOverlay(status) {
    // Get base icon
    const baseIcon = this.createTrayIcon();
    
    // Apply color overlay based on status
    const colors = {
      inactive: '#6B7280',
      active: '#10B981',
      recording: '#EF4444',
      privacy: '#8B5CF6',
      error: '#F59E0B'
    };
    
    // For now, just update tooltip to indicate status
    const statusText = {
      inactive: 'Inactive',
      active: 'Active - Ready to help',
      recording: 'Recording screen',
      privacy: 'Privacy mode enabled',
      error: 'Error - Check settings'
    };
    
    this.tray.setToolTip(`ScreenPilot - ${statusText[status] || 'Ready'}`);
  }

  startRecordingAnimation() {
    let visible = true;
    this.animationInterval = setInterval(() => {
      if (visible) {
        this.tray.setImage(nativeImage.createEmpty());
      } else {
        this.tray.setImage(this.createTrayIcon());
      }
      visible = !visible;
    }, 500);
  }

  stopRecordingAnimation() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
      this.tray.setImage(this.createTrayIcon());
    }
  }

  // Action handlers
  toggleCapture() {
    this.isActive = !this.isActive;
    this.updateStatusIndicator(this.isActive ? 'active' : 'inactive');
    
    // Notify renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('toggle-capture', this.isActive);
    }
  }

  togglePrivacyMode() {
    this.privacyMode = !this.privacyMode;
    if (this.privacyMode) {
      this.updateStatusIndicator('privacy');
    } else {
      this.updateStatusIndicator(this.isActive ? 'active' : 'inactive');
    }
    
    // Notify renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('toggle-privacy', this.privacyMode);
    }
  }

  showWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  toggleWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.showWindow();
      }
    }
  }

  openSettings() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('open-settings');
      this.showWindow();
    }
  }

  showAbout() {
    dialog.showMessageBox({
      type: 'info',
      title: 'About ScreenPilot',
      message: 'ScreenPilot',
      detail: 'AI-powered screen assistant\nVersion 1.0.0\n\nYour privacy-first AI companion',
      buttons: ['OK'],
      icon: this.createTrayIcon()
    });
  }

  quitApp() {
    this.isQuitting = true;
    app.quit();
  }

  destroy() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy();
    }
  }

  getMenuIcon(name) {
    // Return small icons for menu items
    const iconPath = path.join(__dirname, `../../assets/icons/menu/${name}.png`);
    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    }
    return null;
  }
}

export default TrayManager;
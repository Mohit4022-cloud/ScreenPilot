// src/main/tray-manager.ts - Final working implementation with orange icon
import { Tray, Menu, nativeImage, app, BrowserWindow, dialog } from 'electron';

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow;
  private isActive: boolean = false;
  private isCapturing: boolean = false;
  private privacyMode: boolean = false;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  createTray(): void {
    // Create the orange icon that you can see!
    const icon = this.createOrangeIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('ScreenPilot - AI Screen Assistant');
    
    this.updateMenu();
    this.setupClickHandlers();
    
    console.log('✅ Tray created with orange icon');
  }

  private createOrangeIcon(): nativeImage {
    const size = process.platform === 'darwin' ? 22 : 16;
    const buffer = Buffer.alloc(size * size * 4);
    
    // Orange color (the one that works!)
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 255;     // R
      buffer[i + 1] = 140; // G
      buffer[i + 2] = 0;   // B
      buffer[i + 3] = 255; // A
    }
    
    const icon = nativeImage.createFromBuffer(buffer, {
      width: size,
      height: size
    });
    
    // Add retina support for macOS
    if (process.platform === 'darwin') {
      const retinaSize = 44;
      const retinaBuffer = Buffer.alloc(retinaSize * retinaSize * 4);
      
      for (let i = 0; i < retinaBuffer.length; i += 4) {
        retinaBuffer[i] = 255;
        retinaBuffer[i + 1] = 140;
        retinaBuffer[i + 2] = 0;
        retinaBuffer[i + 3] = 255;
      }
      
      icon.addRepresentation({
        width: retinaSize,
        height: retinaSize,
        buffer: retinaBuffer,
        scaleFactor: 2.0
      });
    }
    
    return icon;
  }

  private createStatusIcon(color: { r: number, g: number, b: number }): nativeImage {
    const size = process.platform === 'darwin' ? 22 : 16;
    const buffer = Buffer.alloc(size * size * 4);
    
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = color.r;
      buffer[i + 1] = color.g;
      buffer[i + 2] = color.b;
      buffer[i + 3] = 255;
    }
    
    return nativeImage.createFromBuffer(buffer, {
      width: size,
      height: size
    });
  }

  private updateMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🟠 ScreenPilot',
        enabled: false
      },
      { type: 'separator' },
      {
        label: this.getStatusLabel(),
        enabled: false
      },
      { type: 'separator' },
      {
        label: this.isActive ? 'Stop Capture' : 'Start Capture',
        click: () => this.toggleCapture(),
        accelerator: 'CommandOrControl+Shift+S'
      },
      {
        label: 'Privacy Mode',
        type: 'checkbox',
        checked: this.privacyMode,
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
        click: () => app.quit(),
        accelerator: 'CommandOrControl+Q'
      }
    ]);
    
    this.tray?.setContextMenu(contextMenu);
  }

  private getStatusLabel(): string {
    if (this.privacyMode) return '🟣 Privacy Mode';
    if (this.isCapturing) return '🔴 Recording';
    if (this.isActive) return '🟢 Active';
    return '⚪ Inactive';
  }

  private setupClickHandlers(): void {
    this.tray?.on('click', () => {
      if (process.platform === 'darwin') {
        // macOS: show menu on click
        this.tray?.popUpContextMenu();
      } else {
        // Windows/Linux: toggle window
        this.toggleWindow();
      }
    });
  }

  toggleCapture(): void {
    this.isActive = !this.isActive;
    this.updateMenu();
    this.updateIcon();
    
    // Notify renderer process
    this.mainWindow.webContents.send('capture-toggled', this.isActive);
  }

  togglePrivacyMode(): void {
    this.privacyMode = !this.privacyMode;
    this.updateMenu();
    this.updateIcon();
    
    // Notify renderer process
    this.mainWindow.webContents.send('privacy-toggled', this.privacyMode);
  }

  setCapturing(capturing: boolean): void {
    this.isCapturing = capturing;
    this.updateMenu();
    this.updateIcon();
  }

  private updateIcon(): void {
    let icon: nativeImage;
    
    if (this.privacyMode) {
      // Purple for privacy mode
      icon = this.createStatusIcon({ r: 138, g: 43, b: 226 });
    } else if (this.isCapturing) {
      // Red for recording
      icon = this.createStatusIcon({ r: 239, g: 68, b: 68 });
    } else if (this.isActive) {
      // Green for active
      icon = this.createStatusIcon({ r: 16, g: 185, b: 129 });
    } else {
      // Orange for default (the one you can see!)
      icon = this.createOrangeIcon();
    }
    
    this.tray?.setImage(icon);
  }

  private toggleWindow(): void {
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.showWindow();
    }
  }

  private showWindow(): void {
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  private openSettings(): void {
    this.mainWindow.webContents.send('open-settings');
    this.showWindow();
  }

  private showAbout(): void {
    dialog.showMessageBox({
      type: 'info',
      title: 'About ScreenPilot',
      message: 'ScreenPilot',
      detail: 'Your AI-powered screen assistant\nVersion 1.0.0\n\n🟠 The orange icon means it\'s working!',
      buttons: ['OK']
    });
  }

  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy();
    }
  }
}
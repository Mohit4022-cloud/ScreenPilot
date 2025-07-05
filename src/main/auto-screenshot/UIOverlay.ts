import { EventEmitter } from 'events';
import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export interface OverlayOptions {
  width?: number;
  height?: number;
  opacity?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export class UIOverlay extends EventEmitter {
  private overlayWindow: BrowserWindow | null = null;
  private options: OverlayOptions;
  private isVisible = false;

  constructor(options: OverlayOptions = {}) {
    super();
    this.options = {
      width: 300,
      height: 200,
      opacity: 0.9,
      position: 'top-right',
      ...options
    };
  }

  async initialize(): Promise<void> {
    if (this.overlayWindow) return;

    this.overlayWindow = new BrowserWindow({
      width: this.options.width,
      height: this.options.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      hasShadow: false,
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Set opacity
    this.overlayWindow.setOpacity(this.options.opacity || 0.9);
    
    // Position the overlay
    this.positionOverlay();

    // Prevent window from being closed
    this.overlayWindow.on('close', (e) => {
      e.preventDefault();
      this.hide();
    });

    // Load overlay HTML
    // TODO: Create overlay HTML file
    // this.overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  }

  private positionOverlay(): void {
    if (!this.overlayWindow) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const windowBounds = this.overlayWindow.getBounds();

    let x = 0, y = 0;

    switch (this.options.position) {
      case 'top-left':
        x = 20;
        y = 20;
        break;
      case 'top-right':
        x = width - windowBounds.width - 20;
        y = 20;
        break;
      case 'bottom-left':
        x = 20;
        y = height - windowBounds.height - 20;
        break;
      case 'bottom-right':
        x = width - windowBounds.width - 20;
        y = height - windowBounds.height - 20;
        break;
    }

    this.overlayWindow.setPosition(x, y);
  }

  async show(guidance: any): Promise<void> {
    if (!this.overlayWindow) {
      await this.initialize();
    }

    if (this.overlayWindow) {
      // Send guidance data to overlay
      this.overlayWindow.webContents.send('guidance', guidance);
      
      if (!this.isVisible) {
        this.overlayWindow.showInactive();
        this.isVisible = true;
      }
    }
  }

  async hide(): Promise<void> {
    if (this.overlayWindow && this.isVisible) {
      this.overlayWindow.hide();
      this.isVisible = false;
    }
  }

  destroy(): void {
    if (this.overlayWindow) {
      this.overlayWindow.destroy();
      this.overlayWindow = null;
      this.isVisible = false;
    }
  }

  on(event: 'user-action', listener: (action: string) => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
}
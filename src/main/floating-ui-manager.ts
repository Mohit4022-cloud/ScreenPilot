// src/main/floating-ui-manager.ts - Alternative to broken tray on macOS beta
import { BrowserWindow, screen, ipcMain, globalShortcut, app } from 'electron';
import * as path from 'path';

export class FloatingUIManager {
  private floatingWindow: BrowserWindow | null = null;
  private mainWindow: BrowserWindow;
  private isCapturing: boolean = false;
  private privacyMode: boolean = false;
  private isDragging: boolean = false;
  private isExpanded: boolean = false;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  createFloatingUI(): void {
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;
    
    // Create floating control panel - make it more visible initially
    this.floatingWindow = new BrowserWindow({
      width: 100,
      height: 100,
      x: Math.floor(screenWidth / 2 - 50), // Center of screen
      y: 100, // Near top but visible
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // Load the floating UI HTML
    this.floatingWindow.loadURL(this.getFloatingUIHTML());
    
    // Ensure window is visible
    this.floatingWindow.once('ready-to-show', () => {
      this.floatingWindow?.show();
      this.floatingWindow?.focus();
      console.log('🎯 Window shown and focused');
    });

    // Make window draggable
    this.setupDragging();

    // Setup IPC handlers
    this.setupIPCHandlers();

    // Register global shortcuts
    this.registerShortcuts();

    console.log('✅ Floating UI created as alternative to tray icon');
    console.log(`📍 Position: ${Math.floor(screenWidth / 2 - 50)}, 100`);
    console.log(`📐 Size: 100x100`);
    console.log(`🖥️ Screen size: ${screenWidth}x${screenHeight}`);
  }

  private getFloatingUIHTML(): string {
    return `data:text/html,
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            user-select: none;
            -webkit-user-select: none;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
            background: transparent;
          }
          
          /* Compact mode - just the button */
          .floating-button {
            width: 100px;
            height: 100px;
            background: linear-gradient(135deg, #FF8C00 0%, #FF6B00 100%);
            border-radius: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(255, 140, 0, 0.4);
            transition: all 0.3s ease;
            position: relative;
          }
          
          .floating-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(255, 140, 0, 0.6);
          }
          
          .floating-button.active {
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
          }
          
          .floating-button.recording {
            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
            box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
            animation: pulse 2s infinite;
          }
          
          .floating-button.privacy {
            background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          
          .icon {
            width: 30px;
            height: 30px;
            fill: white;
          }
          
          /* Status indicator dot */
          .status-dot {
            width: 12px;
            height: 12px;
            background: #fff;
            border-radius: 50%;
            position: absolute;
            top: 5px;
            right: 5px;
            opacity: 0;
            transition: opacity 0.3s;
          }
          
          .floating-button.active .status-dot,
          .floating-button.recording .status-dot {
            opacity: 1;
            animation: blink 1.5s infinite;
          }
          
          @keyframes blink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.3; }
          }
          
          /* Expanded panel */
          .expanded-panel {
            position: absolute;
            top: 70px;
            right: 0;
            width: 280px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            padding: 20px;
            opacity: 0;
            transform: translateY(-10px) scale(0.9);
            pointer-events: none;
            transition: all 0.3s ease;
          }
          
          .expanded-panel.show {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
          }
          
          .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 15px;
          }
          
          .panel-title {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .close-btn {
            width: 24px;
            height: 24px;
            border: none;
            background: none;
            cursor: pointer;
            color: #6b7280;
            font-size: 20px;
            line-height: 1;
            border-radius: 4px;
            transition: all 0.2s;
          }
          
          .close-btn:hover {
            background: rgba(0, 0, 0, 0.05);
            color: #1f2937;
          }
          
          .control-button {
            width: 100%;
            padding: 12px;
            margin: 8px 0;
            border: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .control-button.primary {
            background: #FF8C00;
            color: white;
          }
          
          .control-button.primary:hover {
            background: #FF7700;
            transform: translateY(-1px);
          }
          
          .control-button.primary.active {
            background: #10B981;
          }
          
          .control-button.secondary {
            background: rgba(0, 0, 0, 0.05);
            color: #1f2937;
          }
          
          .control-button.secondary:hover {
            background: rgba(0, 0, 0, 0.1);
          }
          
          .control-button.secondary.active {
            background: #8B5CF6;
            color: white;
          }
          
          .divider {
            height: 1px;
            background: rgba(0, 0, 0, 0.1);
            margin: 15px 0;
          }
          
          .status-info {
            padding: 10px;
            background: rgba(0, 0, 0, 0.03);
            border-radius: 8px;
            font-size: 13px;
            color: #6b7280;
            text-align: center;
          }
          
          .beta-notice {
            margin-top: 15px;
            padding: 10px;
            background: #FEF3C7;
            border: 1px solid #FCD34D;
            border-radius: 8px;
            font-size: 12px;
            color: #92400E;
          }
          
          /* Drag handle */
          .drag-handle {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            cursor: move;
          }
        </style>
      </head>
      <body>
        <div class="floating-button" id="floatingButton">
          <div class="drag-handle"></div>
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <div class="status-dot"></div>
        </div>
        
        <div class="expanded-panel" id="expandedPanel">
          <div class="panel-header">
            <div class="panel-title">
              <span>🚀</span>
              <span>ScreenPilot</span>
            </div>
            <button class="close-btn" onclick="togglePanel()">×</button>
          </div>
          
          <button class="control-button primary" id="captureBtn" onclick="toggleCapture()">
            <span>📸</span>
            <span>Start Capture</span>
          </button>
          
          <button class="control-button secondary" id="privacyBtn" onclick="togglePrivacy()">
            <span>🔒</span>
            <span>Privacy Mode</span>
          </button>
          
          <div class="divider"></div>
          
          <button class="control-button secondary" onclick="showSettings()">
            <span>⚙️</span>
            <span>Settings</span>
          </button>
          
          <button class="control-button secondary" onclick="showMainWindow()">
            <span>🪟</span>
            <span>Show Window</span>
          </button>
          
          <div class="divider"></div>
          
          <button class="control-button secondary" onclick="quitApp()">
            <span>🚪</span>
            <span>Quit</span>
          </button>
          
          <div class="status-info" id="statusInfo">
            Status: Inactive
          </div>
          
          <div class="beta-notice">
            ⚠️ Using floating UI due to macOS beta tray bug
          </div>
        </div>
        
        <script>
          let expanded = false;
          let capturing = false;
          let privacyMode = false;
          
          const button = document.getElementById('floatingButton');
          const panel = document.getElementById('expandedPanel');
          const captureBtn = document.getElementById('captureBtn');
          const privacyBtn = document.getElementById('privacyBtn');
          const statusInfo = document.getElementById('statusInfo');
          
          // Toggle panel on button click
          button.addEventListener('click', (e) => {
            if (!e.target.closest('.drag-handle')) {
              togglePanel();
            }
          });
          
          function togglePanel() {
            expanded = !expanded;
            panel.classList.toggle('show', expanded);
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('floating-ui:panel-toggled', expanded);
          }
          
          function toggleCapture() {
            capturing = !capturing;
            updateUI();
            // Use direct IPC for now
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('floating-ui:toggle-capture', capturing);
          }
          
          function togglePrivacy() {
            privacyMode = !privacyMode;
            updateUI();
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('floating-ui:toggle-privacy', privacyMode);
          }
          
          function showSettings() {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('floating-ui:show-settings');
            togglePanel();
          }
          
          function showMainWindow() {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('floating-ui:show-main-window');
            togglePanel();
          }
          
          function quitApp() {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('floating-ui:quit');
          }
          
          function updateUI() {
            // Update button state
            button.classList.toggle('active', capturing && !privacyMode);
            button.classList.toggle('recording', capturing && !privacyMode);
            button.classList.toggle('privacy', privacyMode);
            
            // Update capture button
            captureBtn.classList.toggle('active', capturing);
            captureBtn.querySelector('span:last-child').textContent = 
              capturing ? 'Stop Capture' : 'Start Capture';
            
            // Update privacy button
            privacyBtn.classList.toggle('active', privacyMode);
            
            // Update status
            let status = 'Inactive';
            if (privacyMode) status = '🟣 Privacy Mode';
            else if (capturing) status = '🔴 Capturing';
            else status = '⚪ Inactive';
            
            statusInfo.textContent = 'Status: ' + status;
          }
          
          // Listen for updates from main process
          const { ipcRenderer } = require('electron');
          ipcRenderer.on('floating-ui:update-status', (event, data) => {
            capturing = data.capturing;
            privacyMode = data.privacyMode;
            updateUI();
          });
          
          // Keyboard shortcuts
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && expanded) {
              togglePanel();
            }
          });
        </script>
      </body>
    </html>`;
  }

  private setupDragging(): void {
    // The window is draggable by default with the drag-handle
    this.floatingWindow?.webContents.on('will-navigate', (e) => {
      e.preventDefault();
    });
  }

  private setupIPCHandlers(): void {
    ipcMain.on('floating-ui:toggle-capture', (event, isCapturing) => {
      this.isCapturing = isCapturing;
      this.mainWindow.webContents.send('capture-toggled', isCapturing);
    });

    ipcMain.on('floating-ui:toggle-privacy', (event, isPrivacy) => {
      this.privacyMode = isPrivacy;
      this.mainWindow.webContents.send('privacy-toggled', isPrivacy);
    });

    ipcMain.on('floating-ui:show-settings', () => {
      this.mainWindow.webContents.send('open-settings');
      this.mainWindow.show();
    });

    ipcMain.on('floating-ui:show-main-window', () => {
      this.mainWindow.show();
      this.mainWindow.focus();
    });

    ipcMain.on('floating-ui:quit', () => {
      app.quit();
    });

    ipcMain.on('floating-ui:panel-toggled', (event, isExpanded) => {
      this.isExpanded = isExpanded;
      if (this.floatingWindow && isExpanded) {
        this.floatingWindow.setSize(280, 500);
      } else if (this.floatingWindow) {
        this.floatingWindow.setSize(60, 60);
      }
    });
  }

  private registerShortcuts(): void {
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      this.isCapturing = !this.isCapturing;
      this.updateStatus();
    });

    globalShortcut.register('CommandOrControl+Shift+P', () => {
      this.privacyMode = !this.privacyMode;
      this.updateStatus();
    });
  }

  updateStatus(): void {
    if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
      this.floatingWindow.webContents.send('floating-ui:update-status', {
        capturing: this.isCapturing,
        privacyMode: this.privacyMode
      });
    }
  }

  destroy(): void {
    if (this.floatingWindow && !this.floatingWindow.isDestroyed()) {
      this.floatingWindow.close();
    }
    globalShortcut.unregisterAll();
  }
}
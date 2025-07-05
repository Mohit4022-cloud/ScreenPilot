import { contextBridge, ipcRenderer } from 'electron';
import type { Settings, Status, Insight, ErrorInfo } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('screenpilot', {
  // Core functionality
  start: () => ipcRenderer.invoke('screenpilot:start'),
  stop: () => ipcRenderer.invoke('screenpilot:stop'),
  pause: (paused: boolean) => ipcRenderer.invoke('screenpilot:pause', paused),
  getStatus: () => ipcRenderer.invoke('screenpilot:getStatus'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('screenpilot:getSettings'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('screenpilot:saveSettings', settings),
  
  // Event listeners
  onInsight: (callback: (insight: Insight) => void) => {
    ipcRenderer.on('screenpilot:insight', (_, insight) => callback(insight));
  },
  onError: (callback: (error: ErrorInfo) => void) => {
    ipcRenderer.on('screenpilot:error', (_, error) => callback(error));
  },
  onStatus: (callback: (status: Status) => void) => {
    ipcRenderer.on('screenpilot:status', (_, status) => callback(status));
  },
  onNavigate: (callback: (route: string) => void) => {
    ipcRenderer.on('navigate', (_, route) => callback(route));
  },
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update-available', callback);
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', callback);
  },
  
  // Actions
  executeAction: (action: any) => ipcRenderer.invoke('screenpilot:executeAction', action),
  
  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('screenpilot:check-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('screenpilot:get-update-status'),
  downloadUpdate: () => ipcRenderer.invoke('screenpilot:download-update'),
  installUpdate: () => ipcRenderer.invoke('screenpilot:install-update'),
  
  // Event handling
  on: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(`screenpilot:${channel}`, (_, data) => callback(data));
  },
  removeListener: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.removeListener(`screenpilot:${channel}`, callback);
  }
});

// Type declarations are now in shared/types.ts
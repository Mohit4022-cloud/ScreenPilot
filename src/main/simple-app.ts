import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import * as path from 'path';

// Simple test app to verify tray functionality
app.whenReady().then(() => {
  console.log('Creating simple tray app...');
  
  // Create tray with a data URL icon (visible black circle)
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAC5SURBVDiNpdOxDYMwEAXQZ2wgI2QENjAb0GUEQ2QERqBjA86FG0QaV3dCSLlPuuL83X/2GVhrTQMAIYRzJqrZWnuOiBfTH0AW8acaY7yllJKttU9r7YPn8AFACA9jzJ3dwxhzI6JLAGiPZdnF3VX1pKpzRLxFxC/VWhMAvCPiseu6VXsfVXWOiF8AEL0JrbXXvu+Hruv8UT9sAbx2VZ18cbyXUkqutfphbduWZ7fb7dzzGI7K1lr3B/4Bf7VPthLq1mYAAAAASUVORK5CYII=');
  
  const tray = new Tray(icon);
  tray.setToolTip('ScreenPilot');
  
  // Create simple menu
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show Window', 
      click: () => {
        const win = new BrowserWindow({
          width: 400,
          height: 300,
          title: 'ScreenPilot'
        });
        win.loadURL('data:text/html,<h1>ScreenPilot is running!</h1><p>Tray icon is working.</p>');
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setContextMenu(contextMenu);
  console.log('Tray created! Look for the icon in your menu bar.');
});

// Prevent app from quitting when all windows are closed
app.on('window-all-closed', () => {
  // Don't quit on macOS
});
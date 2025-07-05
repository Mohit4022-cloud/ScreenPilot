"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
// Simple test app to verify tray functionality
electron_1.app.whenReady().then(function () {
    console.log('Creating simple tray app...');
    // Create tray with a data URL icon (visible black circle)
    var icon = electron_1.nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAC5SURBVDiNpdOxDYMwEAXQZ2wgI2QENjAb0GUEQ2QERqBjA86FG0QaV3dCSLlPuuL83X/2GVhrTQMAIYRzJqrZWnuOiBfTH0AW8acaY7yllJKttU9r7YPn8AFACA9jzJ3dwxhzI6JLAGiPZdnF3VX1pKpzRLxFxC/VWhMAvCPiseu6VXsfVXWOiF8AEL0JrbXXvu+Hruv8UT9sAbx2VZ18cbyXUkqutfphbduWZ7fb7dzzGI7K1lr3B/4Bf7VPthLq1mYAAAAASUVORK5CYII=');
    var tray = new electron_1.Tray(icon);
    tray.setToolTip('ScreenPilot');
    // Create simple menu
    var contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Show Window',
            click: function () {
                var win = new electron_1.BrowserWindow({
                    width: 400,
                    height: 300,
                    title: 'ScreenPilot'
                });
                win.loadURL('data:text/html,<h1>ScreenPilot is running!</h1><p>Tray icon is working.</p>');
            }
        },
        { type: 'separator' },
        { label: 'Quit', click: function () { return electron_1.app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
    console.log('Tray created! Look for the icon in your menu bar.');
});
// Prevent app from quitting when all windows are closed
electron_1.app.on('window-all-closed', function (e) {
    if (process.platform !== 'darwin') {
        e.preventDefault();
    }
});

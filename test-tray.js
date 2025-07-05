const { app, Tray, Menu, nativeImage } = require('electron');

app.whenReady().then(() => {
  console.log('App ready, creating tray...');
  
  // Create a simple tray icon
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
  const tray = new Tray(icon);
  
  tray.setToolTip('ScreenPilot Test');
  
  const menu = Menu.buildFromTemplate([
    { label: 'Test Item', click: () => console.log('Clicked!') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setContextMenu(menu);
  
  console.log('Tray created successfully!');
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Don't quit
});
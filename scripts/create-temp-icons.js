const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Create a simple tray icon
function createTrayIcon() {
  const size = 22; // macOS tray icon size
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Clear background
  ctx.clearRect(0, 0, size, size);
  
  // Draw a simple circle icon
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(size/2, size/2, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Add a small dot in the center
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(size/2, size/2, 3, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

// Create active icon (with a different color)
function createActiveIcon() {
  const size = 22;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, size, size);
  
  // Draw a blue circle for active state
  ctx.fillStyle = '#007AFF';
  ctx.beginPath();
  ctx.arc(size/2, size/2, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Add a white dot
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(size/2, size/2, 3, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

// Create main app icon
function createAppIcon() {
  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#1E40AF';
  ctx.fillRect(0, 0, size, size);
  
  // Center circle
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(size/2, size/2, 150, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner circle
  ctx.fillStyle = '#1E40AF';
  ctx.beginPath();
  ctx.arc(size/2, size/2, 100, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

// Save the icons
const assetsDir = path.join(__dirname, '../assets');

fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), createTrayIcon());
fs.writeFileSync(path.join(assetsDir, 'tray-icon-active.png'), createActiveIcon());
fs.writeFileSync(path.join(assetsDir, 'icon.png'), createAppIcon());

console.log('✅ Temporary icons created!');
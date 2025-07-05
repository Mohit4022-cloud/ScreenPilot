// scripts/generate-icons.js - Generate all required icon assets
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Install required dependency first:
// npm install canvas

class IconGenerator {
  constructor() {
    this.sizes = {
      tray: {
        darwin: { width: 22, height: 22 },    // macOS (Template image)
        win32: { width: 16, height: 16 },     // Windows
        linux: { width: 24, height: 24 }      // Linux
      },
      app: {
        small: { width: 16, height: 16 },
        medium: { width: 32, height: 32 },
        large: { width: 256, height: 256 },
        huge: { width: 512, height: 512 }
      }
    };
    
    this.colors = {
      primary: '#5865F2',
      active: '#10B981',
      recording: '#EF4444',
      privacy: '#8B5CF6',
      inactive: '#6B7280',
      white: '#FFFFFF',
      black: '#000000'
    };
  }

  ensureDirectories() {
    const dirs = [
      'assets',
      'assets/icons',
      'assets/icons/tray',
      'assets/icons/menu',
      'assets/icons/app'
    ];
    
    dirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${fullPath}`);
      }
    });
  }

  generateTrayIcons() {
    console.log('Generating tray icons...');
    
    // Generate for each platform
    Object.entries(this.sizes.tray).forEach(([platform, size]) => {
      // Default tray icon
      this.createCircleIcon(
        size,
        this.colors.primary,
        path.join('assets/icons/tray', `icon-${platform}.png`)
      );
      
      // Status icons
      const statuses = ['inactive', 'active', 'recording', 'privacy'];
      statuses.forEach(status => {
        this.createStatusIcon(
          size,
          this.colors[status],
          path.join('assets/icons/tray', `tray-${status}-${platform}.png`)
        );
      });
    });
    
    // Create generic icons without platform suffix
    this.createCircleIcon(
      { width: 22, height: 22 },
      this.colors.primary,
      path.join('assets/icons/tray', 'icon.png')
    );
    
    // macOS Template images (black and white)
    if (process.platform === 'darwin') {
      this.createTemplateIcon(
        { width: 22, height: 22 },
        path.join('assets/icons/tray', 'iconTemplate.png')
      );
      this.createTemplateIcon(
        { width: 44, height: 44 },
        path.join('assets/icons/tray', 'iconTemplate@2x.png')
      );
    }
  }

  createCircleIcon(size, color, outputPath) {
    const canvas = createCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    
    // Clear background
    ctx.clearRect(0, 0, size.width, size.height);
    
    // Draw circle
    const radius = Math.min(size.width, size.height) / 2 - 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size.width / 2, size.height / 2, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add inner detail
    ctx.fillStyle = this.colors.white;
    ctx.beginPath();
    ctx.arc(size.width / 2, size.height / 2, radius * 0.3, 0, 2 * Math.PI);
    ctx.fill();
    
    // Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${outputPath}`);
  }

  createStatusIcon(size, color, outputPath) {
    const canvas = createCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    
    // Clear background
    ctx.clearRect(0, 0, size.width, size.height);
    
    // Draw rounded square
    const padding = 2;
    const cornerRadius = 4;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(padding + cornerRadius, padding);
    ctx.lineTo(size.width - padding - cornerRadius, padding);
    ctx.quadraticCurveTo(size.width - padding, padding, size.width - padding, padding + cornerRadius);
    ctx.lineTo(size.width - padding, size.height - padding - cornerRadius);
    ctx.quadraticCurveTo(size.width - padding, size.height - padding, size.width - padding - cornerRadius, size.height - padding);
    ctx.lineTo(padding + cornerRadius, size.height - padding);
    ctx.quadraticCurveTo(padding, size.height - padding, padding, size.height - padding - cornerRadius);
    ctx.lineTo(padding, padding + cornerRadius);
    ctx.quadraticCurveTo(padding, padding, padding + cornerRadius, padding);
    ctx.closePath();
    ctx.fill();
    
    // Add status indicator dot
    if (color === this.colors.recording) {
      // Blinking effect for recording
      ctx.fillStyle = this.colors.white;
      ctx.beginPath();
      ctx.arc(size.width / 2, size.height / 2, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${outputPath}`);
  }

  createTemplateIcon(size, outputPath) {
    const canvas = createCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    
    // Clear background (transparent)
    ctx.clearRect(0, 0, size.width, size.height);
    
    // Draw black icon for macOS template
    ctx.fillStyle = this.colors.black;
    const radius = Math.min(size.width, size.height) / 2 - 2;
    
    // Outer ring
    ctx.beginPath();
    ctx.arc(size.width / 2, size.height / 2, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Inner cutout (transparent)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(size.width / 2, size.height / 2, radius * 0.6, 0, 2 * Math.PI);
    ctx.fill();
    
    // Center dot
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(size.width / 2, size.height / 2, radius * 0.3, 0, 2 * Math.PI);
    ctx.fill();
    
    // Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${outputPath}`);
  }

  generateAppIcons() {
    console.log('Generating app icons...');
    
    Object.entries(this.sizes.app).forEach(([sizeName, size]) => {
      this.createAppIcon(
        size,
        path.join('assets/icons/app', `icon-${sizeName}.png`)
      );
    });
    
    // Main app icon
    this.createAppIcon(
      { width: 512, height: 512 },
      path.join('assets', 'icon.png')
    );
  }

  createAppIcon(size, outputPath) {
    const canvas = createCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, size.width, size.height);
    gradient.addColorStop(0, this.colors.primary);
    gradient.addColorStop(1, '#4752C4');
    
    // Rounded square background
    const cornerRadius = size.width * 0.2;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(cornerRadius, 0);
    ctx.lineTo(size.width - cornerRadius, 0);
    ctx.quadraticCurveTo(size.width, 0, size.width, cornerRadius);
    ctx.lineTo(size.width, size.height - cornerRadius);
    ctx.quadraticCurveTo(size.width, size.height, size.width - cornerRadius, size.height);
    ctx.lineTo(cornerRadius, size.height);
    ctx.quadraticCurveTo(0, size.height, 0, size.height - cornerRadius);
    ctx.lineTo(0, cornerRadius);
    ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
    ctx.closePath();
    ctx.fill();
    
    // Icon symbol (eye/camera shape)
    ctx.fillStyle = this.colors.white;
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const eyeWidth = size.width * 0.6;
    const eyeHeight = size.height * 0.3;
    
    // Eye shape
    ctx.beginPath();
    ctx.moveTo(centerX - eyeWidth / 2, centerY);
    ctx.quadraticCurveTo(centerX, centerY - eyeHeight / 2, centerX + eyeWidth / 2, centerY);
    ctx.quadraticCurveTo(centerX, centerY + eyeHeight / 2, centerX - eyeWidth / 2, centerY);
    ctx.closePath();
    ctx.fill();
    
    // Pupil
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size.width * 0.15, 0, 2 * Math.PI);
    ctx.fill();
    
    // Inner pupil
    ctx.fillStyle = this.colors.white;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size.width * 0.05, 0, 2 * Math.PI);
    ctx.fill();
    
    // Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${outputPath}`);
  }

  generateAll() {
    this.ensureDirectories();
    this.generateTrayIcons();
    this.generateAppIcons();
    console.log('✅ All icons generated successfully!');
  }
}

// Run the generator
const generator = new IconGenerator();
generator.generateAll();
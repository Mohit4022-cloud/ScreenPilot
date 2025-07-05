# 🚀 ScreenPilot Build & Distribution Guide

## 📋 Table of Contents
- [Development](#development)
- [Production Build](#production-build)
- [Code Signing & Notarization](#code-signing--notarization)
- [Distribution Options](#distribution-options)
- [Launch Checklist](#launch-checklist)
- [Pro Tips](#pro-tips)

## 🛠 Development

### Run in Development Mode
```bash
# Start the app with hot reload
npm run start

# Run type checking in watch mode
npm run typecheck -- --watch

# Run linting
npm run lint
```

### Development Features
- Hot module replacement for renderer process
- DevTools auto-open in development
- Mock update server for testing auto-updates
- Verbose logging enabled

## 📦 Production Build

### Build Commands
```bash
# Build for current platform
npm run make

# Build for macOS (Intel + Apple Silicon)
npm run build:mac-universal

# Build without making distributables
npm run package

# Full production build with signing
npm run release
```

### Build Output
After running `npm run make`, you'll find:
```
out/
├── ScreenPilot-darwin-universal/
│   └── ScreenPilot.app
├── make/
│   ├── ScreenPilot-1.0.0.dmg
│   ├── ScreenPilot-1.0.0-universal.zip
│   └── RELEASES.json
```

## 🔐 Code Signing & Notarization

### Prerequisites
1. Apple Developer Account ($99/year)
2. Developer ID Application Certificate
3. App-specific password for notarization

### Setup Environment
```bash
# Create .env file
cp .env.example .env

# Edit .env with your credentials
APPLE_ID="your-apple-id@example.com"
APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
APPLE_TEAM_ID="XXXXXXXXXX"
APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
```

### Generate App-Specific Password
1. Go to https://appleid.apple.com
2. Sign in → Security → App-Specific Passwords
3. Generate password for "ScreenPilot"
4. Save in `.env` as `APPLE_ID_PASSWORD`

### Build and Sign
```bash
# Full build with signing and notarization
npm run release

# Verify signature
codesign -vvv --deep --strict out/ScreenPilot-darwin-*/ScreenPilot.app

# Verify notarization
spctl -a -vvv -t install out/ScreenPilot-darwin-*/ScreenPilot.app
```

## 📦 Distribution Options

### 1. Direct Download

#### GitHub Releases (Recommended)
```bash
# Publish to GitHub Releases
npm run publish

# Or manually create release and upload artifacts
gh release create v1.0.0 ./out/make/*.dmg ./out/make/*.zip \
  --title "ScreenPilot v1.0.0" \
  --notes "Release notes here"
```

#### Self-Hosted
Host files on your server with proper MIME types:
```nginx
location ~ \.dmg$ {
    add_header Content-Type application/x-apple-diskimage;
}
```

### 2. Mac App Store

#### Required Changes
1. Enable App Sandbox in `entitlements.mas.plist`
2. Remove screen recording permission (not allowed)
3. Implement receipt validation
4. Add in-app purchase for API keys

#### Build for App Store
```bash
# Use electron-builder for MAS
npm install electron-builder --save-dev

# Build for Mac App Store
electron-builder --mac mas
```

### 3. Homebrew

Create a Formula:
```ruby
# Formula/screenpilot.rb
cask "screenpilot" do
  version "1.0.0"
  sha256 "YOUR_SHA256_HERE"
  
  url "https://github.com/YOUR_USERNAME/screenpilot/releases/download/v#{version}/ScreenPilot-#{version}-universal.dmg"
  name "ScreenPilot"
  desc "AI-powered desktop assistant using GPT-4o vision"
  homepage "https://screenpilot.app"
  
  auto_updates true
  depends_on macos: ">= :monterey"
  
  app "ScreenPilot.app"
  
  uninstall quit: "com.yourcompany.screenpilot"
  
  zap trash: [
    "~/Library/Application Support/ScreenPilot",
    "~/Library/Caches/com.yourcompany.screenpilot",
    "~/Library/Preferences/com.yourcompany.screenpilot.plist",
    "~/Library/Saved Application State/com.yourcompany.screenpilot.savedState",
  ]
end
```

Submit to Homebrew:
```bash
# Test locally
brew install --cask ./Formula/screenpilot.rb

# Submit to homebrew-cask
brew bump-cask-pr screenpilot --version 1.0.0
```

## 🎯 Launch Checklist

### Pre-Launch Requirements
- [ ] Apple Developer Account active
- [ ] Code signing certificate installed
- [ ] Notarization credentials tested
- [ ] Auto-update server configured
- [ ] Privacy policy written and hosted
- [ ] Terms of service prepared
- [ ] Support email/system ready

### Marketing Materials
- [ ] Landing page created
- [ ] Demo video recorded (2-3 minutes)
- [ ] Screenshots prepared (5-8 screenshots)
- [ ] Product description written
- [ ] Press kit assembled

### Technical Validation
- [ ] Beta testing completed (10+ testers)
- [ ] Crash reporting configured (Sentry)
- [ ] Analytics implemented
- [ ] Performance benchmarked
- [ ] Security audit completed

### Launch Platforms
- [ ] GitHub Releases configured
- [ ] Product Hunt post prepared
- [ ] Hacker News Show HN drafted
- [ ] Twitter/X announcement ready
- [ ] Reddit r/macapps post written

## 🔥 Pro Tips

### 1. Bundle Optimization

```javascript
// forge.config.ts - Add webpack optimizations
{
  name: '@electron-forge/plugin-webpack',
  config: {
    mainConfig: './webpack.main.config.js',
    renderer: {
      config: './webpack.renderer.config.js',
      entryPoints: [{
        html: './src/renderer/index.html',
        js: './src/renderer/index.tsx',
        name: 'main_window',
        preload: {
          js: './src/renderer/preload.ts'
        }
      }]
    },
    // Optimization
    devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:",
    // Production optimizations
    packagerConfig: {
      asar: {
        unpack: "*.{node,dll,dylib,so}"
      }
    }
  }
}
```

### 2. Add Native Permissions Helper

```bash
npm install --save node-mac-permissions
```

```typescript
// src/main/permissions.ts
import * as permissions from 'node-mac-permissions';

export async function checkAllPermissions() {
  const status = {
    screenRecording: permissions.getAuthStatus('screen'),
    accessibility: permissions.getAuthStatus('accessibility'),
    camera: permissions.getAuthStatus('camera')
  };
  
  return status;
}
```

### 3. Implement Analytics

```bash
npm install --save @sentry/electron
npm install --save electron-log
```

```typescript
// src/main/analytics.ts
import * as Sentry from '@sentry/electron/main';
import log from 'electron-log';

export function initAnalytics() {
  // Sentry for crash reporting
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });

  // Electron-log for file logging
  log.transports.file.level = 'info';
  log.transports.console.level = 'debug';
  
  return { Sentry, log };
}
```

### 4. Performance Monitoring

```typescript
// src/main/performance.ts
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  
  measure(name: string, fn: () => any) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    return result;
  }
  
  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;
    
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }
}
```

### 5. Add Automation Capabilities

```bash
npm install --save @nut-tree/nut-js
```

```typescript
// src/main/automation.ts
import { mouse, keyboard, screen } from '@nut-tree/nut-js';

export class AutomationHelper {
  async executeShortcut(keys: string[]) {
    // Example: ['cmd', 'shift', 'a']
    const keyCombo = keys.map(k => keyboard.Key[k.toUpperCase()]);
    await keyboard.type(...keyCombo);
  }
  
  async clickAt(x: number, y: number) {
    await mouse.setPosition({ x, y });
    await mouse.click();
  }
}
```

## 🚢 Release Process

### 1. Version Bump
```bash
# Bump version
npm version patch # or minor, major

# This updates package.json and creates git tag
```

### 2. Build Release
```bash
# Clean build
rm -rf out dist

# Production build
npm run release
```

### 3. Test Release
```bash
# Test the app thoroughly
open out/ScreenPilot-darwin-universal/ScreenPilot.app

# Verify auto-updater
# Check permissions
# Test all features
```

### 4. Publish
```bash
# Push tags
git push && git push --tags

# Publish to GitHub
npm run publish
```

### 5. Announce
- Update website/documentation
- Post on social media
- Email beta testers
- Submit to directories

## 📊 Success Metrics

Track these KPIs post-launch:
- Daily/Monthly Active Users
- Crash-free rate (target: >99.5%)
- Average session duration
- Feature adoption rates
- User retention (Day 1, 7, 30)
- Support ticket volume
- App Store ratings

## 🆘 Support Resources

- **Documentation**: https://screenpilot.app/docs
- **Discord**: https://discord.gg/screenpilot
- **Email**: support@screenpilot.app
- **GitHub Issues**: https://github.com/YOUR_USERNAME/screenpilot/issues

---

Remember: Ship early, iterate often, and listen to your users! 🚀
# ScreenPilot Deployment Guide

## Prerequisites

1. **Apple Developer Account** (for macOS code signing and notarization)
2. **Developer ID Application Certificate** installed in Keychain
3. **App-specific password** for notarization
4. **Node.js 18+** and npm

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Apple Developer credentials:
```env
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=your-app-specific-password  # NOT your Apple ID password!
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
```

### 2. Create App-Specific Password

1. Go to https://appleid.apple.com
2. Sign in and go to "App-Specific Passwords"
3. Generate a new password for "ScreenPilot"
4. Use this password for `APPLE_ID_PASSWORD`

### 3. Install Developer Certificate

1. Download your Developer ID certificate from Apple Developer Portal
2. Double-click to install in Keychain Access
3. Verify with: `security find-identity -p codesigning`

## Building for Production

### Quick Build (Development)
```bash
npm run build
```

### Production Build (Signed & Notarized)
```bash
npm run release
```

### Platform-Specific Builds
```bash
# macOS only
npm run build:mac

# macOS Universal (Intel + Apple Silicon)
npm run build:mac-universal
```

## Build Outputs

After building, you'll find:

- **DMG installer**: `out/make/ScreenPilot-*.dmg`
- **ZIP archive**: `out/make/zip/darwin/*/ScreenPilot-*.zip`
- **Packaged app**: `out/ScreenPilot-darwin-*/ScreenPilot.app`

## Distribution

### GitHub Releases (Recommended)

1. Create a new release on GitHub
2. Run: `npm run publish`
3. This will automatically upload artifacts to the release

### Manual Distribution

1. Upload the DMG file to your distribution server
2. Ensure the DMG is properly notarized (check with `spctl`)
3. Users can download and install by dragging to Applications

## Troubleshooting

### Code Signing Issues

```bash
# Verify code signing
codesign -dv --verbose=4 out/ScreenPilot-darwin-*/ScreenPilot.app

# Verify notarization
spctl -a -vvv -t install out/ScreenPilot-darwin-*/ScreenPilot.app
```

### Common Problems

1. **"Developer cannot be verified"**
   - Ensure app is properly notarized
   - Check APPLE_TEAM_ID is correct

2. **Build fails with "identity not found"**
   - Verify certificate is installed: `security find-identity -p codesigning`
   - Check APPLE_IDENTITY matches exactly

3. **Notarization fails**
   - Ensure all entitlements are properly declared
   - Check that hardened runtime is enabled
   - Verify app-specific password is correct

## Auto-Updates

ScreenPilot includes auto-update functionality:

1. Set up a release server (GitHub Releases works)
2. Configure update URL in `electron-updater` settings
3. New versions will be automatically downloaded and installed

## Security Considerations

1. **Never commit** `.env` file or credentials
2. **Always notarize** production builds for macOS
3. **Use hardened runtime** for enhanced security
4. **Sign all native binaries** included in the app

## Performance Optimization

For production builds:

1. Enable ASAR packaging (already configured)
2. Minimize included files (see electron-builder.yml)
3. Use production React build (handled by Vite)
4. Consider native binary stripping for size reduction
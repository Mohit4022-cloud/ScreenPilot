# ScreenPilot Assets

This directory contains the visual assets for ScreenPilot.

## Required Files:

### Icons
- `icon.icns` - macOS app icon (1024x1024)
- `icon.png` - PNG version for other uses (1024x1024)
- `icon.ico` - Windows icon (if building for Windows)

### Tray Icons
- `tray-icon.png` - Default tray icon (22x22 @2x = 44x44)
- `tray-icon-active.png` - Active state tray icon (22x22 @2x = 44x44)
- `tray-icon@2x.png` - Retina version (44x44)
- `tray-icon-active@2x.png` - Active retina version (44x44)

### DMG Background
- `dmg-background.png` - Background for DMG installer (600x400)

## Creating Icons

### macOS Icon (.icns)
```bash
# Create icon.icns from a 1024x1024 PNG
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
cp icon.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -R icon.iconset
```

### Tray Icons
Tray icons should be:
- Black and white only
- Template images (will be colored by macOS)
- 22x22 points (44x44 pixels for @2x)
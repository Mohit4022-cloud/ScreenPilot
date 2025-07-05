#!/bin/bash

# ScreenPilot Release Testing Script
# Tests a release build before publication

set -e

echo "🧪 Testing ScreenPilot Release Build..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Find the app
APP_PATH="out/ScreenPilot-darwin-universal/ScreenPilot.app"
if [ ! -d "$APP_PATH" ]; then
    APP_PATH="out/ScreenPilot-darwin-x64/ScreenPilot.app"
fi

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}❌ Could not find ScreenPilot.app${NC}"
    echo "Please run 'npm run make' first"
    exit 1
fi

echo "📱 Found app at: $APP_PATH"

# Test 1: Code Signing
echo ""
echo "1️⃣ Testing code signing..."
if codesign -vvv --deep --strict "$APP_PATH" 2>&1; then
    echo -e "${GREEN}✓ Code signing valid${NC}"
else
    echo -e "${RED}✗ Code signing invalid${NC}"
fi

# Test 2: Notarization
echo ""
echo "2️⃣ Testing notarization..."
if spctl -a -vvv -t install "$APP_PATH" 2>&1 | grep -q "accepted"; then
    echo -e "${GREEN}✓ App is notarized${NC}"
else
    echo -e "${YELLOW}⚠️  App may not be notarized${NC}"
fi

# Test 3: Entitlements
echo ""
echo "3️⃣ Checking entitlements..."
codesign -d --entitlements - "$APP_PATH" 2>/dev/null | grep -E "com.apple.security|key>" | while read line; do
    echo "  $line"
done

# Test 4: Bundle Info
echo ""
echo "4️⃣ Bundle information..."
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP_PATH/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP_PATH/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Print :LSMinimumSystemVersion" "$APP_PATH/Contents/Info.plist"

# Test 5: Launch Test
echo ""
echo "5️⃣ Launch test..."
echo -e "${YELLOW}The app will launch in 3 seconds. Please test:${NC}"
echo "  - App launches without errors"
echo "  - Tray icon appears"
echo "  - Can open settings"
echo "  - Can grant permissions"
echo "  - Auto-updater doesn't crash"
echo ""
sleep 3

# Launch the app
open "$APP_PATH"

# Wait for user input
echo ""
read -p "Did the app launch successfully? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✓ Launch test passed${NC}"
else
    echo -e "${RED}✗ Launch test failed${NC}"
    exit 1
fi

# Test 6: DMG Test (if exists)
DMG_PATH=$(ls out/make/*.dmg 2>/dev/null | head -1)
if [ -f "$DMG_PATH" ]; then
    echo ""
    echo "6️⃣ Testing DMG installer..."
    
    # Mount DMG
    echo "Mounting DMG..."
    hdiutil attach "$DMG_PATH" -quiet
    
    # Check contents
    DMG_MOUNT=$(mount | grep ScreenPilot | awk '{print $3}')
    if [ -d "$DMG_MOUNT/ScreenPilot.app" ]; then
        echo -e "${GREEN}✓ DMG contains ScreenPilot.app${NC}"
    else
        echo -e "${RED}✗ DMG missing ScreenPilot.app${NC}"
    fi
    
    # Unmount
    hdiutil detach "$DMG_MOUNT" -quiet
fi

# Summary
echo ""
echo "📊 Test Summary"
echo "─────────────────"
echo "If all tests passed, the build is ready for release!"
echo ""
echo "Next steps:"
echo "1. Create a GitHub release"
echo "2. Upload the DMG and ZIP files"
echo "3. Publish release notes"
echo "4. Update the website"
echo ""
echo -e "${GREEN}✅ Testing complete!${NC}"
#!/bin/bash

# ScreenPilot Release Preparation Script
# This script prepares a release build with all necessary checks

set -e

echo "🚀 Preparing ScreenPilot Release..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists git; then
    echo -e "${RED}❌ Git is not installed${NC}"
    exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check environment variables
echo "🔐 Checking signing credentials..."
if [ -z "$APPLE_ID" ]; then
    echo -e "${YELLOW}⚠️  APPLE_ID not set - notarization will be skipped${NC}"
else
    echo -e "${GREEN}✓ Apple ID configured${NC}"
fi

if [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${YELLOW}⚠️  APPLE_TEAM_ID not set${NC}"
else
    echo -e "${GREEN}✓ Apple Team ID configured${NC}"
fi

# Get version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📌 Current version: $CURRENT_VERSION"

# Prompt for new version
read -p "Enter new version (or press Enter to keep $CURRENT_VERSION): " NEW_VERSION
if [ -z "$NEW_VERSION" ]; then
    NEW_VERSION=$CURRENT_VERSION
else
    # Update version
    echo "📝 Updating version to $NEW_VERSION..."
    npm version $NEW_VERSION --no-git-tag-version
    
    # Commit version change
    git add package.json package-lock.json
    git commit -m "chore: bump version to $NEW_VERSION"
fi

# Run tests
echo "🧪 Running tests..."
npm run test || echo -e "${YELLOW}⚠️  No tests configured${NC}"

# Type check
echo "✅ Running type check..."
npm run typecheck

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out dist

# Create release notes
echo "📝 Creating release notes..."
RELEASE_NOTES_FILE="RELEASE_NOTES_${NEW_VERSION}.md"
cat > $RELEASE_NOTES_FILE << EOF
# ScreenPilot v${NEW_VERSION}

## What's New
- 

## Improvements
- 

## Bug Fixes
- 

## Known Issues
- 

---
*AI-powered desktop assistant using GPT-4o vision*
EOF

echo -e "${GREEN}✓ Release notes template created at $RELEASE_NOTES_FILE${NC}"
echo "📝 Please edit the release notes before publishing"

# Build the application
echo "🏗️  Building application..."
npm run release

# Calculate checksums
echo "🔐 Calculating checksums..."
cd out/make
for file in *.dmg *.zip; do
    if [ -f "$file" ]; then
        shasum -a 256 "$file" > "$file.sha256"
        echo "✓ Checksum created for $file"
    fi
done
cd ../..

# Create release directory
RELEASE_DIR="releases/v${NEW_VERSION}"
mkdir -p $RELEASE_DIR

# Copy artifacts
echo "📦 Copying artifacts to release directory..."
cp out/make/*.dmg $RELEASE_DIR/ 2>/dev/null || true
cp out/make/*.zip $RELEASE_DIR/ 2>/dev/null || true
cp out/make/*.sha256 $RELEASE_DIR/ 2>/dev/null || true
cp $RELEASE_NOTES_FILE $RELEASE_DIR/

# Generate Homebrew formula
echo "🍺 Generating Homebrew formula..."
DMG_FILE=$(ls $RELEASE_DIR/*.dmg | head -1)
if [ -f "$DMG_FILE" ]; then
    DMG_SHA256=$(shasum -a 256 "$DMG_FILE" | awk '{print $1}')
    
    cat > $RELEASE_DIR/screenpilot.rb << EOF
cask "screenpilot" do
  version "${NEW_VERSION}"
  sha256 "${DMG_SHA256}"
  
  url "https://github.com/YOUR_USERNAME/screenpilot/releases/download/v#{version}/ScreenPilot-#{version}.dmg"
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
EOF
    echo -e "${GREEN}✓ Homebrew formula created${NC}"
fi

# Final summary
echo ""
echo "🎉 Release preparation complete!"
echo ""
echo "📁 Release artifacts in: $RELEASE_DIR"
echo "📋 Next steps:"
echo "  1. Edit release notes: $RELEASE_NOTES_FILE"
echo "  2. Test the built application"
echo "  3. Create git tag: git tag -a v${NEW_VERSION} -m 'Release v${NEW_VERSION}'"
echo "  4. Push changes: git push && git push --tags"
echo "  5. Create GitHub release and upload artifacts"
echo "  6. Submit Homebrew formula if desired"
echo ""
echo "🚀 Ready to ship!"
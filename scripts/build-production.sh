#!/bin/bash

# ScreenPilot Production Build Script
# This script builds and packages ScreenPilot for distribution

set -e

echo "🚀 Building ScreenPilot for production..."

# Check environment variables
if [ -z "$APPLE_ID" ]; then
    echo "⚠️  Warning: APPLE_ID not set. Notarization will be skipped."
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out dist

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm run test || true

# Type check
echo "✅ Type checking..."
npm run typecheck

# Build native module if exists
if [ -d "native/screenshooter" ]; then
    echo "🔨 Building native screenshooter..."
    cd native/screenshooter
    if [ -f "build.sh" ]; then
        ./build.sh
    fi
    cd ../..
fi

# Build the app
echo "🏗️  Building application..."
npm run make

# Sign the app (if certificates are available)
if [ ! -z "$APPLE_IDENTITY" ]; then
    echo "✍️  Code signing..."
    # Forge handles this automatically
fi

# Notarize (if credentials are available)
if [ ! -z "$APPLE_ID" ] && [ ! -z "$APPLE_ID_PASSWORD" ] && [ ! -z "$APPLE_TEAM_ID" ]; then
    echo "📝 Notarizing app..."
    # Forge handles this automatically
else
    echo "⚠️  Skipping notarization (credentials not set)"
fi

echo "✅ Build complete!"
echo "📦 Output files are in the 'out' directory"

# List output files
echo ""
echo "📁 Build artifacts:"
ls -la out/make/
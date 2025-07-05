#!/bin/bash
# 🚀 ScreenPilot Quick Start Script
# Run this to set up your development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎯 ScreenPilot macOS App Setup${NC}"
echo "=============================="

# Check if we're in the right directory
check_directory() {
    if [ -f "package.json" ] && grep -q "screenpilot-macos" package.json; then
        echo -e "${GREEN}✅ Found existing ScreenPilot project${NC}"
        read -p "Reinstall dependencies and reset setup? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup cancelled."
            exit 0
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    echo -e "\n${BLUE}📋 Checking prerequisites...${NC}"
    
    local missing_deps=0
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        echo "   Please install from https://nodejs.org (v18+ recommended)"
        missing_deps=1
    else
        echo -e "${GREEN}✅ Node.js $(node --version)${NC}"
        # Check Node version
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            echo -e "${YELLOW}⚠️  Node.js v18+ recommended (you have v$NODE_VERSION)${NC}"
        fi
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm not found${NC}"
        missing_deps=1
    else
        echo -e "${GREEN}✅ npm $(npm --version)${NC}"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git not found${NC}"
        echo "   Please install Git from https://git-scm.com"
        missing_deps=1
    else
        echo -e "${GREEN}✅ Git $(git --version | cut -d' ' -f3)${NC}"
    fi
    
    # Check Xcode Command Line Tools
    if ! command -v xcodebuild &> /dev/null; then
        echo -e "${YELLOW}⚠️  Xcode Command Line Tools not found${NC}"
        echo "   Installing... (this may take a few minutes)"
        xcode-select --install 2>/dev/null || true
        echo "   Please complete the installation and run this script again."
        exit 1
    else
        echo -e "${GREEN}✅ Xcode Command Line Tools installed${NC}"
    fi
    
    # Check Python (for screenshooter)
    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}⚠️  Python 3 not found (optional, for screenshooter)${NC}"
    else
        echo -e "${GREEN}✅ Python $(python3 --version)${NC}"
    fi
    
    if [ $missing_deps -eq 1 ]; then
        echo -e "\n${RED}Please install missing dependencies and run again.${NC}"
        exit 1
    fi
}

# Create or setup project
setup_project() {
    echo -e "\n${BLUE}📁 Setting up ScreenPilot project...${NC}"
    
    if [ ! -f "package.json" ]; then
        # Create new project
        echo "Creating new Electron + React + TypeScript project..."
        npx create-electron-app@latest . --template=vite-typescript
        
        # Clean up default files
        rm -f src/main.ts src/preload.ts src/renderer.ts index.html
    fi
    
    echo -e "${GREEN}✅ Project structure ready${NC}"
}

# Install dependencies
install_dependencies() {
    echo -e "\n${BLUE}📦 Installing dependencies...${NC}"
    
    # Check if package-lock.json exists
    if [ -f "package-lock.json" ]; then
        echo "Using npm ci for faster installation..."
        npm ci
    else
        echo "Installing all dependencies..."
        
        # Core dependencies
        npm install --save \
            openai \
            sharp \
            electron-store \
            electron-updater \
            auto-launch \
            screenshot-desktop \
            chokidar \
            fs-extra \
            @sentry/electron
        
        # React & UI dependencies
        npm install --save \
            react \
            react-dom \
            framer-motion \
            lucide-react \
            tailwindcss \
            @headlessui/react \
            clsx
        
        # Development dependencies
        npm install --save-dev \
            @types/react \
            @types/react-dom \
            @types/node \
            @types/fs-extra \
            @electron-forge/cli \
            @electron-forge/maker-dmg \
            @electron-forge/maker-zip \
            @electron-forge/plugin-vite \
            typescript \
            vite \
            eslint \
            prettier \
            concurrently
    fi
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Create project structure
create_structure() {
    echo -e "\n${BLUE}🏗️  Creating project structure...${NC}"
    
    # Create directories
    mkdir -p src/{main,renderer,shared}
    mkdir -p src/main/{core,native,managers,utils,ai,auto-screenshot}
    mkdir -p src/renderer/{components,hooks,styles,types}
    mkdir -p assets
    mkdir -p build
    mkdir -p scripts
    mkdir -p native/screenshooter
    
    echo -e "${GREEN}✅ Directory structure created${NC}"
}

# Copy core files
copy_core_files() {
    echo -e "\n${BLUE}📄 Setting up core files...${NC}"
    
    # Create TypeScript configs
    if [ ! -f "tsconfig.json" ]; then
        cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "out"]
}
EOF
    fi
    
    # Create Vite configs
    if [ ! -f "vite.main.config.ts" ]; then
        cat > vite.main.config.ts << 'EOF'
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '.vite/build',
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: () => '[name].js'
    },
    rollupOptions: {
      external: ['electron', 'path', 'fs', 'crypto', 'child_process']
    }
  }
});
EOF
    fi
    
    if [ ! -f "vite.renderer.config.ts" ]; then
        cat > vite.renderer.config.ts << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '.vite/renderer'
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
EOF
    fi
    
    # Create main entry file
    if [ ! -f "src/main/index.ts" ]; then
        cat > src/main/index.ts << 'EOF'
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../renderer/preload.js')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
EOF
    fi
    
    # Create renderer entry
    if [ ! -f "src/renderer/index.tsx" ]; then
        cat > src/renderer/index.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';

const App = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">ScreenPilot</h1>
      <p className="text-gray-600">AI Desktop Assistant</p>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
EOF
    fi
    
    # Create index.html
    if [ ! -f "src/renderer/index.html" ]; then
        cat > src/renderer/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ScreenPilot</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/index.tsx"></script>
</body>
</html>
EOF
    fi
    
    # Create basic styles
    if [ ! -f "src/renderer/styles/index.css" ]; then
        cat > src/renderer/styles/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
EOF
    fi
    
    echo -e "${GREEN}✅ Core files created${NC}"
}

# Setup environment
setup_environment() {
    echo -e "\n${BLUE}🔐 Setting up environment...${NC}"
    
    if [ ! -f ".env.example" ]; then
        cat > .env.example << 'EOF'
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# App Configuration
NODE_ENV=development
DEBUG=true

# Apple Developer (for production builds)
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

# Optional Services
SENTRY_DSN=
UPDATE_FEED_URL=
EOF
    fi
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo -e "${YELLOW}📝 Created .env file - please add your API keys${NC}"
    fi
    
    # Create .gitignore
    if [ ! -f ".gitignore" ]; then
        cat > .gitignore << 'EOF'
# Dependencies
node_modules/

# Build outputs
dist/
out/
.vite/
*.log

# Environment
.env
.env.local

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Certificates
*.p12
*.cer
*.pem

# Native binaries
native/screenshooter/build/
EOF
    fi
    
    echo -e "${GREEN}✅ Environment setup complete${NC}"
}

# Setup build configuration
setup_build() {
    echo -e "\n${BLUE}🔨 Setting up build configuration...${NC}"
    
    # Create forge config if it doesn't exist
    if [ ! -f "forge.config.ts" ]; then
        cat > forge.config.ts << 'EOF'
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'ScreenPilot',
    appBundleId: 'com.yourcompany.screenpilot',
    icon: './assets/icon',
    appCategoryType: 'public.app-category.productivity',
  },
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      format: 'UDZO'
    })
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts'
        },
        {
          entry: 'src/renderer/preload.ts',
          config: 'vite.preload.config.ts'
        }
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts'
        }
      ]
    })
  ]
};

export default config;
EOF
    fi
    
    # Create entitlements
    mkdir -p build
    if [ ! -f "build/entitlements.mac.plist" ]; then
        cat > build/entitlements.mac.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
EOF
    fi
    
    echo -e "${GREEN}✅ Build configuration ready${NC}"
}

# Setup development scripts
setup_scripts() {
    echo -e "\n${BLUE}📝 Setting up development scripts...${NC}"
    
    # Update package.json scripts using Node.js
    node << 'EOF'
const fs = require('fs');
const pkg = require('./package.json');

pkg.scripts = {
  ...pkg.scripts,
  "start": "electron-forge start",
  "dev": "electron-forge start",
  "package": "electron-forge package",
  "make": "electron-forge make",
  "publish": "electron-forge publish",
  "lint": "eslint src --ext .ts,.tsx",
  "typecheck": "tsc --noEmit",
  "build": "npm run typecheck && electron-forge package",
  "dist": "npm run typecheck && electron-forge make",
  "test": "echo \"No tests specified\" && exit 0"
};

pkg.main = ".vite/build/main.js";
pkg.author = pkg.author || "Your Name";
pkg.description = pkg.description || "AI-powered desktop assistant for macOS";

fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
console.log('✅ package.json updated');
EOF
    
    echo -e "${GREEN}✅ Scripts configured${NC}"
}

# Create README
create_readme() {
    if [ ! -f "README.md" ]; then
        cat > README.md << 'EOF'
# ScreenPilot

AI-powered desktop assistant for macOS using GPT-4o vision capabilities.

## Features

- 🤖 Real-time screen analysis with GPT-4o
- 🖥️ Native macOS screenshot integration
- ⚡ Ultra-fast response times (<100ms)
- 💾 Smart caching for cost optimization
- 🔒 Privacy-first design
- 🔄 Auto-updates

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Add your OpenAI API key to .env
   ```

3. **Run in development**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run make
   ```

## Requirements

- macOS 12.0 (Monterey) or later
- Node.js 18+
- OpenAI API key with GPT-4o access

## License

MIT
EOF
        echo -e "${GREEN}✅ README.md created${NC}"
    fi
}

# Provide API key setup instructions
setup_api_key() {
    echo -e "\n${BLUE}🔑 API Key Setup${NC}"
    
    # Check for existing API key
    if [ -f ".env" ]; then
        if grep -q "sk-" .env; then
            echo -e "${GREEN}✅ OpenAI API key already configured${NC}"
            return
        fi
    fi
    
    echo -e "${YELLOW}To use ScreenPilot, you need an OpenAI API key with GPT-4o access.${NC}"
    echo ""
    echo "1. Get your API key from: https://platform.openai.com/api-keys"
    echo "2. Make sure you have access to GPT-4o model"
    echo "3. Add the key to your .env file:"
    echo "   OPENAI_API_KEY=sk-your-key-here"
    echo ""
    
    read -p "Do you have an API key to add now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your OpenAI API key: " api_key
        if [[ $api_key == sk-* ]]; then
            sed -i '' "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$api_key/" .env
            echo -e "${GREEN}✅ API key saved to .env${NC}"
        else
            echo -e "${RED}❌ Invalid API key format${NC}"
        fi
    fi
}

# Final summary
show_summary() {
    echo -e "\n${GREEN}✨ ScreenPilot setup complete!${NC}"
    echo ""
    echo -e "${BLUE}📚 Next steps:${NC}"
    echo "1. Add your OpenAI API key to .env file"
    echo "2. Run 'npm run dev' to start development"
    echo "3. Open another terminal and make changes to see hot reload"
    echo ""
    echo -e "${BLUE}🛠️  Useful commands:${NC}"
    echo "• npm run dev          - Start development server"
    echo "• npm run build        - Build for testing"
    echo "• npm run make         - Build for distribution"
    echo "• npm run typecheck    - Check TypeScript"
    echo "• npm run lint         - Run linter"
    echo ""
    echo -e "${BLUE}📖 Documentation:${NC}"
    echo "• README.md           - Project overview"
    echo "• DEPLOYMENT.md       - Build & distribution guide"
    echo "• LAUNCH_CHECKLIST.md - Pre-launch checklist"
    echo ""
    echo -e "${GREEN}🚀 Happy coding!${NC}"
}

# Main execution
main() {
    echo ""
    
    # Check if we should run in the current directory
    if [ "$1" == "--here" ] || [ -f "package.json" ]; then
        check_directory
    else
        # Check if screenpilot directory already exists
        if [ -d "screenpilot-macos" ]; then
            echo -e "${YELLOW}Directory 'screenpilot-macos' already exists.${NC}"
            read -p "Use existing directory? (Y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Nn]$ ]]; then
                exit 1
            fi
            cd screenpilot-macos
        else
            echo "Creating new project in 'screenpilot-macos' directory..."
            mkdir -p screenpilot-macos
            cd screenpilot-macos
        fi
    fi
    
    check_prerequisites
    setup_project
    install_dependencies
    create_structure
    copy_core_files
    setup_environment
    setup_build
    setup_scripts
    create_readme
    setup_api_key
    show_summary
}

# Handle arguments
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "ScreenPilot Quick Start Script"
    echo ""
    echo "Usage:"
    echo "  ./quickstart.sh          - Create new project in 'screenpilot-macos' directory"
    echo "  ./quickstart.sh --here   - Set up in current directory"
    echo "  ./quickstart.sh --help   - Show this help message"
    exit 0
fi

# Run main function
main "$@"
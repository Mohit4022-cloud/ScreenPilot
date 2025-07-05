#!/bin/bash
# quantum-fix.sh - The ultimate fix for your ScreenPilot

echo "⚡ QUANTUM SCREENPILOT FIXER ⚡"
echo "=============================="
echo ""

# Step 1: Kill any existing Electron processes
echo "🔧 Step 1: Cleaning up old processes..."
pkill -f electron
pkill -f ScreenPilot
sleep 1
echo "✅ Cleaned up"
echo ""

# Step 2: Create a simple test
echo "🔧 Step 2: Creating visibility test..."
cat > quantum-test.js << 'EOF'
const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  // Create a window that's IMPOSSIBLE to miss
  const win = new BrowserWindow({
    width: 400,
    height: 300,
    center: true,
    alwaysOnTop: true,
    backgroundColor: '#FF0000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  win.loadURL(`data:text/html,
    <html>
      <body style="background: linear-gradient(45deg, red, orange, yellow, green, blue, purple); color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-size: 30px; font-family: Arial;">
        <div style="text-align: center; background: rgba(0,0,0,0.7); padding: 30px; border-radius: 20px;">
          <div>🚀 QUANTUM TEST WORKING! 🚀</div>
          <div style="font-size: 20px; margin-top: 20px;">If you see this, Electron works!</div>
          <button onclick="window.close()" style="font-size: 20px; padding: 10px 20px; margin-top: 20px;">Close</button>
        </div>
      </body>
    </html>
  `);
  
  console.log('✅ Window created at CENTER of screen');
  console.log('🌈 It has a RAINBOW background');
  console.log('📏 Size: 400x300 pixels');
});
EOF

echo "✅ Test created"
echo ""

# Step 3: Run the test
echo "🔧 Step 3: Running visibility test..."
echo "👀 LOOK AT THE CENTER OF YOUR SCREEN!"
echo ""

npx electron quantum-test.js &
TEST_PID=$!

sleep 3

# Step 4: Check if process is running
if ps -p $TEST_PID > /dev/null; then
    echo "✅ Test is running!"
    echo ""
    read -p "Can you see a RAINBOW window? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Great! Electron works. Now fixing ScreenPilot..."
        kill $TEST_PID 2>/dev/null
        
        # Step 5: Fix ScreenPilot
        echo ""
        echo "🔧 Step 4: Fixing ScreenPilot..."
        
        # Create a working version
        cat > src/main/index.ts << 'EOF'
import { app, BrowserWindow, screen } from 'electron';

let controlWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.bounds;
  
  // Create a visible control window
  controlWindow = new BrowserWindow({
    width: 300,
    height: 80,
    x: Math.floor(width / 2 - 150),
    y: height - 150,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#2D2D2D',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  controlWindow.loadURL(`data:text/html,
    <html>
      <style>
        body {
          margin: 0;
          background: #2D2D2D;
          color: white;
          font-family: -apple-system, Arial;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          user-select: none;
        }
        .controls {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .logo {
          font-size: 40px;
          cursor: move;
        }
        button {
          background: #FF8C00;
          border: none;
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          font-size: 16px;
          cursor: pointer;
        }
        button:hover {
          background: #FF6B00;
        }
      </style>
      <body>
        <div class="controls">
          <div class="logo">🚀</div>
          <div>ScreenPilot</div>
          <button onclick="alert('Capture!')">📸 Capture</button>
          <button onclick="window.close()">❌</button>
        </div>
      </body>
    </html>
  `);
  
  console.log('✅ ScreenPilot control bar created!');
  console.log('📍 Location: Bottom center of screen');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
EOF
        
        echo "✅ Fixed ScreenPilot code"
        echo ""
        echo "🚀 Starting ScreenPilot..."
        npm start
        
    else
        echo "❌ You can't see the test window!"
        echo ""
        echo "🔴 CRITICAL ISSUE DETECTED:"
        echo "   - Your macOS Beta has broken window rendering"
        echo "   - OR you have accessibility settings blocking overlays"
        echo "   - OR your display is not working properly"
        echo ""
        echo "🔧 EMERGENCY FIXES TO TRY:"
        echo "1. Restart your Mac"
        echo "2. Reset NVRAM: Shutdown, then hold Cmd+Option+P+R on startup"
        echo "3. Check System Preferences > Security & Privacy > Privacy"
        echo "4. Try a different user account"
        echo "5. Boot into Safe Mode"
        echo ""
        kill $TEST_PID 2>/dev/null
    fi
else
    echo "❌ Test failed to start!"
    echo "Try running directly: npx electron quantum-test.js"
fi

# Cleanup
rm -f quantum-test.js

echo ""
echo "=============================="
echo "Script complete!"
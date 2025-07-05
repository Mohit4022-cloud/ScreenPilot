#!/bin/bash
# ultimate-tray-fix.sh - The master script to fix everything

echo "🚀 ULTIMATE TRAY FIX SCRIPT"
echo "=========================="
echo ""

# Function to run Electron tests
run_electron_test() {
    local test_file=$1
    local test_name=$2
    
    echo "🧪 Running $test_name..."
    
    if command -v electron &> /dev/null; then
        electron "$test_file" &
        local pid=$!
        echo "   ✅ Started (PID: $pid)"
        echo "   👀 CHECK YOUR SYSTEM TRAY NOW!"
        sleep 15
        kill $pid 2>/dev/null
    else
        echo "   ❌ Electron not found in PATH"
        echo "   Try: npx electron $test_file"
    fi
    echo ""
}

# Create test files
echo "📝 Creating test files..."

# Test 1: Minimal red square
cat > test1-red.js << 'EOF'
const { app, Tray, nativeImage } = require('electron');
app.whenReady().then(() => {
  const buffer = Buffer.alloc(16 * 16 * 4);
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255; buffer[i + 1] = 0; buffer[i + 2] = 0; buffer[i + 3] = 255;
  }
  const tray = new Tray(nativeImage.createFromBuffer(buffer, { width: 16, height: 16 }));
  tray.setToolTip('RED TEST');
  console.log('🔴 Red square created!');
});
app.on('window-all-closed', e => e.preventDefault());
EOF

# Test 2: Flashing rainbow
cat > test2-rainbow.js << 'EOF'
const { app, Tray, nativeImage } = require('electron');
app.whenReady().then(() => {
  let hue = 0;
  const size = 22;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < buffer.length; i += 4) {
    buffer[i] = 255; buffer[i + 1] = 0; buffer[i + 2] = 0; buffer[i + 3] = 255;
  }
  const tray = new Tray(nativeImage.createFromBuffer(buffer, { width: size, height: size }));
  
  setInterval(() => {
    const r = Math.sin(hue) * 127 + 128;
    const g = Math.sin(hue + 2) * 127 + 128;
    const b = Math.sin(hue + 4) * 127 + 128;
    
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = r; buffer[i + 1] = g; buffer[i + 2] = b; buffer[i + 3] = 255;
    }
    tray.setImage(nativeImage.createFromBuffer(buffer, { width: size, height: size }));
    hue += 0.1;
  }, 50);
  
  tray.setToolTip('🌈 RAINBOW TRAY 🌈');
  console.log('🌈 Rainbow tray created and animating!');
});
app.on('window-all-closed', e => e.preventDefault());
EOF

# Test 3: Multi-tray attack
cat > test3-multi.js << 'EOF'
const { app, Tray, nativeImage } = require('electron');
app.whenReady().then(() => {
  const colors = [[255,0,0], [0,255,0], [0,0,255], [255,255,0], [255,0,255]];
  colors.forEach((color, i) => {
    setTimeout(() => {
      const buffer = Buffer.alloc(16 * 16 * 4);
      for (let j = 0; j < buffer.length; j += 4) {
        buffer[j] = color[0]; buffer[j + 1] = color[1]; buffer[j + 2] = color[2]; buffer[j + 3] = 255;
      }
      const tray = new Tray(nativeImage.createFromBuffer(buffer, { width: 16, height: 16 }));
      tray.setToolTip(`TRAY ${i + 1}`);
      console.log(`✅ Created tray ${i + 1} with color ${color}`);
    }, i * 1000);
  });
});
app.on('window-all-closed', e => e.preventDefault());
EOF

echo "✅ Test files created!"
echo ""

# Platform-specific fixes
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 APPLYING macOS FIXES..."
    echo "   - Restarting SystemUIServer..."
    killall SystemUIServer 2>/dev/null
    sleep 2
    echo "   ✅ SystemUIServer restarted"
    echo ""
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 CHECKING LINUX REQUIREMENTS..."
    
    # Check for required packages
    if ! dpkg -l | grep -q libappindicator; then
        echo "   ❌ libappindicator not installed!"
        echo "   📦 Installing..."
        sudo apt-get update
        sudo apt-get install -y libappindicator3-1
    else
        echo "   ✅ libappindicator is installed"
    fi
    echo ""
fi

# Run tests
echo "🧪 STARTING TESTS..."
echo "==================="
echo ""

echo "TEST 1: Simple Red Square"
echo "-------------------------"
run_electron_test "test1-red.js" "Red Square Test"

echo "TEST 2: Rainbow Animation"
echo "-------------------------"
run_electron_test "test2-rainbow.js" "Rainbow Test"

echo "TEST 3: Multiple Trays"
echo "----------------------"
run_electron_test "test3-multi.js" "Multi-Tray Test"

# Final check
echo "📋 FINAL CHECKLIST"
echo "=================="
echo ""
echo "Did you see any of these?"
echo "  □ Red square"
echo "  □ Rainbow flashing icon"
echo "  □ Multiple colored squares"
echo ""
echo "Where to look:"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  → macOS: Top menu bar (right side)"
    echo "  → Hold CMD and drag icons to make space"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "  → Windows: Bottom-right corner"
    echo "  → Click the ^ arrow to show hidden icons"
else
    echo "  → Linux: Depends on your desktop environment"
    echo "  → GNOME: Top bar (needs extension)"
    echo "  → KDE/XFCE: System tray area"
fi
echo ""

echo "🔧 STILL NOT WORKING?"
echo "===================="
echo "1. Run with sudo/admin: sudo electron test1-red.js"
echo "2. Try in safe mode"
echo "3. Check antivirus isn't blocking"
echo "4. Update Electron: npm install electron@latest"
echo "5. Try a different user account"
echo "6. Post this output for help!"
echo ""

echo "📁 Test files saved as:"
echo "  - test1-red.js"
echo "  - test2-rainbow.js" 
echo "  - test3-multi.js"
echo ""
echo "Run manually: electron test1-red.js"

# Clean up option
echo ""
read -p "Clean up test files? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f test1-red.js test2-rainbow.js test3-multi.js
    echo "✅ Cleaned up!"
fi
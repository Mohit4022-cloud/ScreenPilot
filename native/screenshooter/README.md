# Native Screenshooter for macOS

This directory contains the native screenshot capture module for optimal performance.

## Building

The native screenshooter should be built using the [auto-screenshooter](https://github.com/mohit/auto-screenshooter) project.

1. Clone auto-screenshooter:
```bash
git clone https://github.com/mohit/auto-screenshooter.git
cd auto-screenshooter
```

2. Build the binary:
```bash
# For macOS
swift build -c release

# Or using xcodebuild
xcodebuild -scheme screenshooter -configuration Release
```

3. Copy the binary to this project:
```bash
cp .build/release/screenshooter /path/to/screenpilot/native/screenshooter/build/Release/
```

## Integration

The `NativeScreenshotManager` will automatically look for the binary in:
1. `native/screenshooter/build/Release/screenshooter` (development)
2. `~/.auto-screenshooter/bin/screenshooter` (user installation)
3. `/usr/local/bin/auto-screenshooter` (system installation)

## Performance

Using the native screenshooter provides:
- 5 FPS capture with minimal CPU usage
- GPU acceleration via Metal
- Smart diff detection
- Shared memory IPC for zero-copy transfers
- ~10ms capture latency
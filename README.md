# VirtualCam Pro

A professional virtual camera application with real-time voice changing, AI-powered background replacement, and OBS integration.

## Features

- **Virtual Camera Output** - Works with Zoom, Teams, Meet, Discord, OBS, and any video app
- **Mask/Overlay System** - Replace your camera feed with any image or video
- **Real-time Voice Changer** - Pitch shifting, formant shifting, robot effects, reverb, noise gate, compression, 3-band EQ
- **AI Background Replacement** - MediaPipe Selfie Segmentation for green-screen-free background removal
- **Quality Presets** - Ultra (4K), High (1080p), Medium (720p), Low (480p), Custom
- **OBS WebSocket Control** - Control scenes, sources, and virtual camera from the app
- **System Tray Integration** - Minimize to tray, quick controls

## Prerequisites

1. **OBS Studio** with **OBS WebSocket 5.x** plugin installed
   - Enable WebSocket: Tools → WebSocket Server Settings → Enable
   - Default port: 4455
   - Set a password (optional)

2. **VB-Cable** (Virtual Audio Cable) for voice changer audio routing
   - Install VB-Cable Driver
   - Set VB-Cable as your microphone in video call apps
   - Set VB-Cable as output monitor in VirtualCam Pro

3. **Node.js 18+** and npm

## Installation

```bash
# Clone and install
cd virtual-cam-app
npm install

# Development
npm run dev

# Build for production
npm run build
```

## Usage

1. **Start OBS** with WebSocket enabled
2. **Launch VirtualCam Pro**
3. **Connect to OBS** - Enter host/port/password and click Connect
4. **Select Camera** - Choose your video input device
5. **Configure Features**:
   - **Mask**: Load an image/video to replace your camera feed
   - **Voice**: Enable voice changer, select preset or customize
   - **Background**: Enable AI background replacement (blur, image, color)
   - **Quality**: Choose preset or custom resolution/FPS/bitrate
6. **Start Virtual Camera** - Click "Start Camera" in the app
7. **In OBS**: The virtual camera will be available as "OBS Virtual Camera"
8. **In Video Apps**: Select "OBS Virtual Camera" as your camera

### Voice Changer Audio Routing

For the voice changer to work in calls:
1. Install **VB-Cable** (free virtual audio driver)
2. In VirtualCam Pro Voice panel:
   - Microphone Input: Your physical microphone
   - Monitor Output: VB-Cable Input (your headphones)
3. In your video call app (Zoom, Teams, etc.):
   - Microphone: VB-Cable Output
4. You'll hear your processed voice in your headphones, and the call receives the processed audio

## Architecture

```
src/
├── main/                 # Electron main process
│   ├── main.js          # Main entry, window, IPC, OBS WebSocket
│   └── preload.js       # Secure IPC bridge
├── renderer/            # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── App.jsx      # Main app component
│   │   ├── main.jsx     # Entry point
│   │   └── index.css    # Global styles
│   └── index.html
└── assets/              # Icons, images
```

## Key Technologies

- **Electron 28** - Desktop app framework
- **React 18** - UI library
- **Vite** - Build tool
- **OBS WebSocket JS** - OBS control
- **MediaPipe Selfie Segmentation** - AI background removal
- **Web Audio API** - Real-time voice processing
- **Zustand** - State management
- **Canvas API** - Video frame processing

## Voice Effects Details

| Effect | Range | Description |
|--------|-------|-------------|
| Pitch | 0.5x - 2.0x | Fundamental frequency shift |
| Formant | 0.5x - 1.5x | Vocal tract resonance shift |
| Robot | 0% - 100% | Ring modulation (metallic) |
| Reverb | 0% - 100% | Algorithmic room simulation |
| Noise Gate | -60dB - 0dB | Silence below threshold |
| Compression | 0% - 100% | Dynamic range reduction |
| EQ Low/Mid/High | -20dB - +20dB | 3-band equalizer |

## Background Modes

- **Blur** - Gaussian blur of your actual background
- **Image** - Custom background image
- **Color** - Solid color background
- **None** - No background processing

## Troubleshooting

**OBS Connection Failed**
- Verify OBS is running
- Check WebSocket Server Settings in OBS (Tools → WebSocket Server Settings)
- Ensure port 4455 is not blocked by firewall
- Try with/without password

**No Virtual Camera in Apps**
- In OBS: Tools → Virtual Camera → Start
- Restart video call app after starting virtual camera
- On Windows: Run OBS as Administrator if needed

**Voice Changer Not Working**
- Install VB-Cable and restart system
- Check audio device selections in app
- Ensure sample rate matches (48kHz recommended)

**High CPU Usage**
- Lower quality preset (Medium/Low)
- Disable background segmentation
- Reduce voice effects complexity
- Close other heavy applications

## License

MIT
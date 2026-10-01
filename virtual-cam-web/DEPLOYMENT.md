# VirtualCam Web - Deployment Guide

## Architecture Overview

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     WebSocket      ┌──────────────────┐
│   Web Browser   │◄──────────────────►│   Relay Server  │◄──────────────────►│  Desktop Agent   │
│   (Web UI)      │   (Socket.io)      │   (Node.js)     │   (Socket.io)      │  (Electron App)  │
└─────────────────┘                    └─────────────────┘                    └──────────────────┘
                                              │
                                              │ OBS WebSocket
                                              ▼
                                      ┌─────────────────┐
                                      │   OBS Studio    │
                                      │  (Virtual Cam)  │
                                      └─────────────────┘
```

**Flow:**
1. User opens Web UI in browser → connects to Relay Server
2. User runs Desktop Agent on their machine → connects to Relay Server
3. Relay Server pairs Web UI ↔ Desktop Agent automatically
4. Web UI sends commands → Relay Server → Desktop Agent → OBS Virtual Camera
5. OBS Virtual Camera appears as webcam in Zoom/Teams/Meet/Discord/etc.

---

## Quick Deploy (Docker Compose)

### Prerequisites
- Docker & Docker Compose
- Domain name with SSL certificates (Let's Encrypt recommended)
- OBS Studio installed on user machines (for Desktop Agent)

### 1. Configure Environment

```bash
cd virtual-cam-web
cp .env.production.example .env.production
# Edit .env.production with your domain
```

### 2. SSL Certificates

Place your SSL certificates in `web-ui/ssl/`:
```
web-ui/ssl/
├── fullchain.pem
└── privkey.pem
```

Or use Let's Encrypt with certbot:
```bash
sudo certbot certonly --standalone -d your-domain.com
# Copy certs to web-ui/ssl/
```

### 3. Deploy

```bash
docker-compose up -d --build
```

Services:
- **Web UI**: https://your-domain.com (ports 80/443)
- **Relay Server**: Internal (port 3001), health at `/health`

### 4. Verify

```bash
# Check health
curl https://your-domain.com/health

# Check logs
docker-compose logs -f
```

---

## Desktop Agent Distribution

Users need to run the Desktop Agent on their machine. Build distributables:

```bash
cd virtual-cam-web/desktop-agent
npm install
npm run build
```

Output: `release/win-unpacked/VirtualCam Agent.exe` (Windows)
- Also builds for macOS/Linux with `electron-builder`

**User Instructions:**
1. Download and run `VirtualCam Agent.exe`
2. Click "Connect to Server" (enter your relay server URL if not default)
3. Install OBS Studio + OBS WebSocket plugin (port 4455)
4. In Web UI: Configure OBS connection → Start Camera
5. Select "OBS Virtual Camera" in Zoom/Teams/Meet

---

## Production Checklist

### Security
- [ ] Set `ALLOWED_ORIGINS` to your domain only
- [ ] Use HTTPS/WSS only in production
- [ ] Configure firewall: only 80/443 public, 3001 internal
- [ ] Rate limiting enabled (nginx config included)
- [ ] CSP headers configured

### Reliability
- [ ] Health checks configured
- [ ] Auto-restart on failure (`restart: unless-stopped`)
- [ ] Stale agent cleanup (30s timeout)
- [ ] Reconnection logic in clients (10 attempts)

### Scaling
- Relay Server is stateless (can run multiple behind load balancer)
- Use Redis for agent/client state if scaling horizontally
- WebSocket sticky sessions required for horizontal scaling

---

## Manual Deployment (Without Docker)

### Relay Server
```bash
cd server
npm ci
npm run build
PORT=3001 ALLOWED_ORIGINS="https://your-domain.com" node dist/index.js
```

### Web UI
```bash
cd web-ui
npm ci
VITE_SERVER_URL=https://your-domain.com npm run build
# Serve dist/ with nginx/Apache + SSL
```

### nginx Config (Manual)
See `web-ui/nginx.conf` - key points:
- Proxy `/socket.io/` with WebSocket upgrade
- Proxy `/api/` and `/health` to relay server
- SPA fallback for React Router
- SSL termination

---

## API Reference

### REST Endpoints
- `GET /health` - Server health
- `GET /api/agents` - List connected agents

### Socket Events (Client → Server)
- `client:register` - Register web client
- `client:command` - Send command to paired agent

### Socket Events (Server → Client)
- `client:registered` - Registration confirmed
- `client:paired` - Paired with agent
- `client:unpaired` - Unpaired from agent
- `client:response` - Command response
- `agents:list` - Updated agent list
- `agent:status` - Agent status update

### Commands (Web UI → Agent)
- `obs-connect` - Connect to OBS WebSocket
- `obs-disconnect` - Disconnect from OBS
- `obs-set-scene` - Change OBS scene
- `set-video-input` - Change camera device
- `set-audio-input` - Change microphone
- `set-voice-settings` - Update voice changer
- `set-background` - Update background replacement
- `set-quality` - Update video quality
- `start-camera` - Start virtual camera
- `stop-camera` - Stop virtual camera

---

## Troubleshooting

### "No agents available"
- Desktop Agent not running or not connected
- Check Relay Server logs: `docker-compose logs relay-server`
- Verify Desktop Agent can reach server URL

### "OBS Connection Failed"
- OBS Studio not running
- OBS WebSocket plugin not installed/enabled
- Wrong host/port/password (default: localhost:4455, no password)

### "Virtual Camera not showing in Zoom"
- OBS Virtual Camera not started (click "Start Virtual Camera" in Web UI)
- Restart Zoom after starting virtual camera
- On Windows: Install OBS Virtual Camera driver (Tools → VirtualCam → Start)

### WebSocket Connection Issues
- Check firewall/proxy allows WebSocket upgrade
- Verify nginx config has `proxy_http_version 1.1` and upgrade headers
- Check browser console for connection errors

---

## File Structure

```
virtual-cam-web/
├── docker-compose.yml          # Production deployment
├── .env.production.example     # Environment template
├── server/
│   ├── Dockerfile              # Relay server container
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts            # Socket.io + Express server
├── web-ui/
│   ├── Dockerfile              # Web UI container (nginx)
│   ├── nginx.conf              # Nginx with WebSocket proxy
│   ├── package.json
│   ├── vite.config.ts
│   └── src/                    # React + TypeScript app
└── desktop-agent/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main/               # Electron main process
        │   ├── main.js         # Agent logic + OBS + Audio
        │   └── preload.js
        └── renderer/           # Agent UI (React)
            ├── AgentUI.jsx
            ├── index.html
            └── main.jsx
```

---

## Support

For issues, check:
1. Server logs: `docker-compose logs relay-server`
2. Web UI browser console (F12)
3. Desktop Agent DevTools (Ctrl+Shift+I in agent window)
4. OBS WebSocket connection test in Web UI → OBS Panel
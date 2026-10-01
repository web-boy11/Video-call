# VirtualCam Web - Cloud Deployment Configurations

## Railway (railway.toml)
# Place this file in virtual-cam-web/railway.toml

[build]
builder = "nixpacks"

[deploy]
startCommand = "cd server && npm ci && npm run build && node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

## Render (render.yaml)
# Place this file in virtual-cam-web/render.yaml

services:
  - type: web
    name: virtualcam-relay
    runtime: node
    buildCommand: "cd server && npm ci && npm run build"
    startCommand: "cd server && node dist/index.js"
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: ALLOWED_ORIGINS
        value: "https://your-app.onrender.com"
    healthCheckPath: /health
    autoDeploy: true

  - type: web
    name: virtualcam-web
    runtime: static
    buildCommand: "cd web-ui && npm ci && npm run build"
    staticPublishPath: ./web-ui/dist
    envVars:
      - key: VITE_SERVER_URL
        value: "https://virtualcam-relay.onrender.com"
    routes:
      - type: rewrite
        source: /view/*
        destination: /index.html
      - type: header
        source: /view/*
        headers:
          - key: Service-Worker-Allowed
            value: /

## Fly.io (fly.toml)
# Place this file in virtual-cam-web/fly.toml

app = "virtualcam-web"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile.fly"

[http_service]
  internal_port = 80
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[vm]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1

## Dockerfile.fly (for Fly.io)
# Place this file in virtual-cam-web/Dockerfile.fly

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci

# Build server
COPY server/ ./server/
RUN cd server && npm run build

# Install web-ui dependencies
COPY web-ui/package*.json ./web-ui/
RUN cd web-ui && npm ci

# Build web-ui
COPY web-ui/ ./web-ui/
RUN cd web-ui && npm run build

# Production stage
FROM nginx:alpine AS production

# Copy nginx config
COPY web-ui/nginx.conf /etc/nginx/nginx.conf

# Copy built web-ui
COPY --from=builder /app/web-ui/dist /usr/share/nginx/html

# Copy server binary
COPY --from=builder /app/server/dist /app/server/dist
COPY --from=builder /app/server/node_modules /app/server/node_modules
COPY --from=builder /app/server/package.json /app/server/package.json

# Install node for running server
RUN apk add --no-cache nodejs npm

# Create startup script
RUN echo '#!/bin/sh\nnode /app/server/dist/index.js &\nnginx -g "daemon off;"' > /start.sh && chmod +x /start.sh

EXPOSE 80 3001
CMD ["/start.sh"]

## Railway Procfile (for simpler Railway deploy)
# Place this file in virtual-cam-web/Procfile

web: cd server && node dist/index.js
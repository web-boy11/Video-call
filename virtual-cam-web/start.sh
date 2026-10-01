#!/bin/bash
# VirtualCam Web - Production Startup Script
# Usage: ./start.sh [dev|prod]

set -e

MODE="${1:-prod}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting VirtualCam Web in $MODE mode..."

if [ "$MODE" = "dev" ]; then
    echo "📦 Development mode - starting all services with hot reload"
    
    # Start relay server
    echo "Starting relay server..."
    cd server
    npm run dev &
    SERVER_PID=$!
    cd ..
    
    # Start web UI
    echo "Starting web UI..."
    cd web-ui
    npm run dev &
    WEB_PID=$!
    cd ..
    
    # Trap cleanup
    trap "echo 'Shutting down...'; kill $SERVER_PID $WEB_PID 2>/dev/null; exit 0" INT TERM
    
    echo "✅ Development servers running:"
    echo "   Relay Server: http://localhost:3001"
    echo "   Web UI: http://localhost:5173"
    echo "   Press Ctrl+C to stop"
    
    wait $SERVER_PID $WEB_PID
    
else
    echo "🏭 Production mode - using Docker Compose"
    
    # Check for .env.production
    if [ ! -f .env.production ]; then
        echo "❌ .env.production not found!"
        echo "   Copy .env.production.example and configure:"
        echo "   cp .env.production.example .env.production"
        exit 1
    fi
    
    # Check SSL certificates
    if [ ! -f web-ui/ssl/fullchain.pem ] || [ ! -f web-ui/ssl/privkey.pem ]; then
        echo "⚠️  SSL certificates not found in web-ui/ssl/"
        echo "   Place fullchain.pem and privkey.pem there, or use Let's Encrypt"
        echo "   Continuing anyway (HTTP only)..."
    fi
    
    # Build and start
    echo "Building and starting containers..."
    docker-compose up -d --build
    
    echo "✅ Production deployment started!"
    echo "   Web UI: https://your-domain.com"
    echo "   Health: https://your-domain.com/health"
    echo ""
    echo "📋 Useful commands:"
    echo "   View logs:    docker-compose logs -f"
    echo "   Stop:         docker-compose down"
    echo "   Restart:      docker-compose restart"
    echo "   Update:       docker-compose pull && docker-compose up -d"
fi
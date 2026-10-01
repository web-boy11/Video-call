# Multi-stage build for Web UI
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./

# Build
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS runner

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
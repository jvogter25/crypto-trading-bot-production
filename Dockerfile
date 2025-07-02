# Multi-stage build for production deployment
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY crypto-trading-web-frontend/package*.json ./frontend/
COPY crypto-trading-backend/package*.json ./backend/

# Install dependencies
RUN npm install
RUN cd frontend && npm install --production
RUN cd backend && npm install --production

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S trading -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=trading:nodejs /app/simple-backend-server.js ./
COPY --from=builder --chown=trading:nodejs /app/kraken-client.js ./
COPY --from=builder --chown=trading:nodejs /app/node_modules ./node_modules/
COPY --from=builder --chown=trading:nodejs /app/frontend/build ./frontend/build/

# Copy environment template
COPY --chown=trading:nodejs .env.example .env

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Create logs directory
RUN mkdir -p /app/logs && chown trading:nodejs /app/logs

# Switch to non-root user
USER trading

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "simple-backend-server.js"]

# Production Dockerfile for Crypto Trading Bot - AWS App Runner
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY . .

# Create logs directory and set permissions
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the production backend server
CMD ["node", "production-backend-server.js"] 
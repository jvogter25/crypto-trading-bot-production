#!/bin/bash

# Crypto Trading Bot - Development Hot Reload Script
# This script ensures the dashboard stays live during development

echo "🚀 Starting Crypto Trading Bot with Hot Reload..."
echo "📍 Dashboard will be available at: http://localhost:3007"
echo "🔄 Hot reloading enabled - changes will update automatically"
echo ""

# Kill any existing processes on port 3007
echo "🔍 Checking for existing processes on port 3007..."
lsof -ti:3007 | xargs kill -9 2>/dev/null || true

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    echo "📋 Loading environment variables..."
    export $(cat .env | grep -v '#' | xargs)
fi

# Set development environment
export NODE_ENV=development
export PORT=3007

echo "✅ Environment configured for development"
echo "🔧 Starting NestJS with watch mode..."
echo ""

# Start with hot reload using NestJS watch mode
npm run start:dev

echo ""
echo "🛑 Dashboard stopped"
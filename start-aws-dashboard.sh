#!/bin/bash

echo "🚀 Starting Crypto Trading Dashboard connected to AWS Backend"
echo "📡 AWS Backend URL: https://nhdtn3uygf.us-east-1.awsapprunner.com"
echo "🖥️  Dashboard URL: http://localhost:3001"
echo ""

# Stop any local backend that might interfere
echo "🛑 Stopping local backend servers..."
pkill -f "production-backend-server" 2>/dev/null || true
sleep 2

# Check if AWS backend is healthy
echo "🔍 Checking AWS backend health..."
if curl -s https://nhdtn3uygf.us-east-1.awsapprunner.com/health > /dev/null; then
    echo "✅ AWS backend is healthy and running"
    
    # Show real AWS data
    echo "📊 Current AWS Backend Data:"
    curl -s https://nhdtn3uygf.us-east-1.awsapprunner.com/api/trading/core-bot-status | jq '.core_bot | {capital, trades, pnl, positions, status}'
else
    echo "❌ AWS backend is not responding"
    exit 1
fi

# Check if frontend is already running
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Dashboard is already running on http://localhost:3001"
    echo "🌐 Opening dashboard in browser..."
    open http://localhost:3001
else
    echo "🚀 Starting dashboard on port 3001..."
    cd crypto-trading-web-frontend
    npm start
fi 
#!/bin/bash

# Crypto Trading Bot Dashboard Startup Script
# This starts your local dashboard that connects to the AWS AI bot

echo "🚀 Starting Crypto Trading Bot Dashboard..."
echo "📍 AWS AI Bot: https://2vffazaqsw.us-west-2.awsapprunner.com/"
echo "📊 Dashboard will be available at: http://localhost:3005"
echo ""

# Kill any existing processes on port 3005
echo "🧹 Cleaning up existing processes..."
lsof -ti:3005 | xargs kill -9 2>/dev/null || true

# Navigate to frontend directory and start
cd "crypto-trading-web-frontend"

echo "📦 Installing dependencies..."
npm install --silent

echo "🎯 Starting dashboard..."
echo "✅ Dashboard connecting to AWS AI Bot"
echo "💡 You can close this terminal - the AWS bot will keep running!"
echo ""

# Start the dashboard
PORT=3005 npm start 
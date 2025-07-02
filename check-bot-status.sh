#!/bin/bash

# Quick AWS AI Bot Status Checker
# Run this anytime to check if your bot is running

echo "🤖 Checking AWS AI Bot Status..."
echo "📍 URL: https://2vffazaqsw.us-west-2.awsapprunner.com/"
echo ""

# Check bot status
response=$(curl -s https://2vffazaqsw.us-west-2.awsapprunner.com/api/status)

if [ $? -eq 0 ]; then
    echo "✅ AWS Bot is ONLINE"
    echo "📊 Status: $(echo $response | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
    echo "🎯 Mode: $(echo $response | grep -o '"mode":"[^"]*"' | cut -d'"' -f4)"
    echo "⏱️  Uptime: $(echo $response | grep -o '"uptime":[^,]*' | cut -d':' -f2) seconds"
    echo ""
    
    # Check trading activity
    echo "🔍 Checking trading activity..."
    core_status=$(curl -s https://2vffazaqsw.us-west-2.awsapprunner.com/api/trading/core-bot-status)
    meme_status=$(curl -s https://2vffazaqsw.us-west-2.awsapprunner.com/api/trading/meme-bot-status)
    
    echo "💰 Core Bot: $(echo $core_status | grep -o '"totalTrades":[^,]*' | cut -d':' -f2) trades"
    echo "🚀 Meme Bot: $(echo $meme_status | grep -o '"totalTrades":[^,]*' | cut -d':' -f2) trades"
    echo "🧠 AI Confidence: $(echo $meme_status | grep -o '"confidence":[^,]*' | cut -d':' -f2)%"
    
else
    echo "❌ AWS Bot is OFFLINE or unreachable"
    echo "🔧 Check your internet connection"
fi

echo ""
echo "💡 To start dashboard: ./start-dashboard.sh" 
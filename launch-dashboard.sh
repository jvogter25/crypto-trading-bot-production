#!/bin/bash

echo "🚀 Launching Advanced Crypto Trading Dashboard..."

# Check if backend is running
if curl -s http://localhost:3009/health > /dev/null; then
    echo "✅ Backend is running on port 3009"
else
    echo "❌ Backend not found on port 3009"
    echo "Please start the backend first with: PORT=3009 node production-backend-server.js"
    exit 1
fi

# Launch dashboard
echo "🌐 Opening Advanced Dashboard in browser..."
if command -v open > /dev/null; then
    # macOS
    open advanced-dashboard.html
elif command -v xdg-open > /dev/null; then
    # Linux
    xdg-open advanced-dashboard.html
elif command -v start > /dev/null; then
    # Windows
    start advanced-dashboard.html
else
    echo "Please open advanced-dashboard.html in your browser manually"
fi

echo "📊 Dashboard should now be open and connecting to the backend"
echo "🔄 Data updates every 5 seconds"
echo "📈 Real-time trading activity and moonshot candidates visible" 
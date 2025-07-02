# 🔥 Hot Reload Setup - Crypto Trading Bot

## Quick Start for Hot Reloading

### 1. Use the Development Script
```bash
# From the crypto-trading-backend directory
./start-dev.sh
```

**OR use npm directly:**
```bash
npm run dev
```

### 2. Dashboard Access
- **URL**: http://localhost:3007
- **Status**: Should show "Connected (Hot Reload)" with green blinking dot
- **Auto-refresh**: Dashboard updates every 3 seconds via WebSocket

### 3. Making Changes
- Edit any file in `src/`
- NestJS will automatically detect changes and restart
- Dashboard will auto-reconnect within 3-30 seconds
- No manual restart needed!

### 4. Troubleshooting

**If dashboard doesn't load:**
```bash
# Kill any processes on port 3007
lsof -ti:3007 | xargs kill -9

# Restart development server
npm run dev
```

**If hot reload isn't working:**
- Check terminal for TypeScript errors
- Ensure you're using `npm run dev` not `npm start`
- Clear browser cache and reload

**Connection Status Indicators:**
- 🟢 Green dot: "Connected (Hot Reload)" - Working perfectly
- 🟡 Orange dot: "Reconnecting..." - Temporary disconnection
- 🔴 Red dot: "Connection Failed" - Manual restart needed

### 5. Development Workflow
1. Start server: `./start-dev.sh`
2. Open dashboard: http://localhost:3007
3. Edit code files
4. Watch for automatic reload (3-30 seconds)
5. Dashboard reconnects automatically

### 6. Production Mode
For 24/7 AWS deployment:
```bash
npm run start:prod
```

---
**✅ Hot reloading is now permanently configured!**
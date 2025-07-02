# 🤖 Crypto Trading Bot - Dashboard Setup Guide

## ✅ Your Bot is Running 24/7 on AWS!
**AWS URL**: https://2vffazaqsw.us-west-2.awsapprunner.com/
- Your AI bot runs independently on AWS servers
- It will continue trading and learning even when your computer is off
- All data is stored on AWS (trades, AI learning progress, etc.)

## 🖥️ Dashboard Access (Local Monitoring)

### Quick Start
```bash
# Start the dashboard (connects to AWS bot)
./start-dashboard.sh
```
Then open: **http://localhost:3005**

### Quick Status Check
```bash
# Check if AWS bot is running
./check-bot-status.sh
```

## 🔄 What Happens When You Sleep/Close Browser

### ✅ Will Continue Running:
- **AWS AI Bot**: Keeps trading and learning 24/7
- **Data Collection**: All trades logged to AWS
- **AI Learning**: Neural network continues adapting

### 🖥️ Local Dashboard:
- **Browser Tab**: Can be closed - AWS bot keeps running
- **Computer Sleep**: AWS bot unaffected
- **Restart Dashboard**: Just run `./start-dashboard.sh` again

## 📊 Monitoring Your Bot

### Real-time Dashboard Features:
- Live trading activity from AWS
- AI learning progress (confidence, win rate)
- Neural network weight changes
- Trade history and P&L
- Connection status to AWS

### Manual Status Checks:
```bash
# Quick status
./check-bot-status.sh

# Direct API calls
curl https://2vffazaqsw.us-west-2.awsapprunner.com/api/status
curl https://2vffazaqsw.us-west-2.awsapprunner.com/api/trading/meme-bot-status
```

## 🛠️ Troubleshooting

### Dashboard Won't Start:
```bash
# Kill any stuck processes
pkill -f "craco\|npm start"
lsof -ti:3005 | xargs kill -9

# Restart dashboard
./start-dashboard.sh
```

### AWS Bot Status:
- **If offline**: Check internet connection
- **If slow**: AWS servers may be under load
- **If errors**: Bot will auto-restart (AWS App Runner feature)

## 📈 Current Bot Status
- **Mode**: Paper trading (safe - no real money)
- **Capital**: $600 total ($300 per bot)
- **AI Status**: Learning from every trade
- **Uptime**: Running since deployment

## 🎯 Key Points
1. **AWS bot runs 24/7** - independent of your computer
2. **Dashboard is optional** - just for monitoring
3. **Data persists** - all stored on AWS servers
4. **Easy restart** - use the provided scripts
5. **Paper trading** - no real money at risk during testing 
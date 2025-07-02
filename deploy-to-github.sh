#!/bin/bash

echo "🚀 Setting up GitHub repository for 24/7 crypto trading bot deployment"

# Create a temporary directory for the GitHub repo
REPO_DIR="crypto-trading-bot-production"

echo "📁 Creating repository directory..."
mkdir -p $REPO_DIR

echo "📋 Copying essential files..."

# Copy the main production server
cp production-backend-server.js $REPO_DIR/

# Copy package.json and apprunner.yaml
cp package.json $REPO_DIR/
cp apprunner.yaml $REPO_DIR/

# Create .gitignore
echo "📝 Creating .gitignore..."
cat > $REPO_DIR/.gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
*.log
logs/

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# AWS
.aws/

# macOS
.DS_Store

# Windows
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
EOF

# Create README.md
echo "📖 Creating README.md..."
cat > $REPO_DIR/README.md << 'EOF'
# 🚀 Crypto Trading Bot - 24/7 Production

A sophisticated crypto trading bot that runs 24/7 with AI-powered strategies for both stable coins and meme coins.

## 🎯 Features

- **Dual Strategy System**: Core bot for stable trading + Meme bot for moonshot opportunities
- **Real Market Data**: Live prices from Kraken, Binance.US, and Coinbase
- **Paper Trading**: Safe simulation with $300 virtual capital per bot
- **AI-Powered Signals**: Advanced sentiment analysis and technical indicators
- **24/7 Operation**: Continuous trading in the cloud via AWS App Runner

## 🏗️ Architecture

- **Backend**: Node.js Express server with real-time market data
- **Exchanges**: Kraken (core trading), Binance.US + Coinbase (meme coins)
- **Deployment**: AWS App Runner with GitHub integration
- **Monitoring**: Built-in health checks and performance analytics

## 🚀 Deployment

This bot is configured for AWS App Runner deployment with:
- Automatic scaling (1-5 instances)
- Health monitoring on `/health` endpoint
- Environment variable configuration
- CloudWatch logging integration

## 📊 Trading Status

The bot operates in paper trading mode by default, making simulated trades with real market data to validate strategies before live deployment.

## 🔧 Configuration

Key environment variables:
- `TRADING_MODE=paper` (safe simulation mode)
- `CORE_BOT_CAPITAL=300` (virtual capital for stable coin trading)
- `MEME_BOT_CAPITAL=300` (virtual capital for meme coin trading)

## 📈 Performance

Real-time tracking of:
- Trade execution and P&L
- Market data accuracy
- Bot performance metrics
- Risk management compliance

---

**⚠️ Important**: This bot handles real market data and trading logic. Always test thoroughly in paper trading mode before enabling live trading.
EOF

# Create a simple deployment status file
cat > $REPO_DIR/DEPLOYMENT.md << 'EOF'
# Deployment Status

## Latest Deployment
- **Date**: Ready for deployment
- **Status**: Configured for AWS App Runner
- **Mode**: Paper trading (safe simulation)
- **Capital**: $300 virtual per bot

## Next Steps
1. Push to GitHub repository
2. Connect AWS App Runner to this repository
3. Configure environment variables
4. Monitor deployment logs
5. Verify 24/7 operation

## Health Check
- Endpoint: `/health`
- Expected: 200 OK with trading status
EOF

echo ""
echo "✅ Repository setup complete!"
echo ""
echo "📂 Files created in '$REPO_DIR/':"
ls -la $REPO_DIR/
echo ""
echo "🎯 Next steps:"
echo "1. Create GitHub repository at: https://github.com/new"
echo "2. Name it: crypto-trading-bot-production"
echo "3. Set to Private (recommended for trading bots)"
echo "4. Run these commands:"
echo ""
echo "   cd $REPO_DIR"
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Initial crypto trading bot for 24/7 deployment'"
echo "   git branch -M main"
echo "   git remote add origin https://github.com/YOUR_USERNAME/crypto-trading-bot-production.git"
echo "   git push -u origin main"
echo ""
echo "5. Then deploy via AWS App Runner console!"
echo ""
echo "🌟 Your bot will be running 24/7 with real market data!" 
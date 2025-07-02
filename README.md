# 🚀 Crypto Trading Bot - Production Backend

**AI-Powered Layer 1 Cryptocurrency Trading Bot with Real-Time Market Analysis**

## 🎯 Overview

This is a sophisticated crypto trading bot that analyzes 24 Layer 1 blockchain assets using advanced AI learning engines, technical analysis, and sentiment analysis to make intelligent trading decisions.

### ✅ Features

- **24 Layer 1 Assets**: BTC, ETH, SOL, ADA, AVAX, DOT, ATOM, NEAR, ALGO, OP, ARB, UNI, AAVE, MKR, XRP, XLM, ICP, XMR, ZEC, FIL, STORJ, MANA, SAND, ENJ
- **Real-Time Kraken Integration**: Live market data every 30 seconds
- **AI Learning Engines**: CoreBotAI & MemeCoinAI with neural networks
- **Advanced Analysis**: RSI, MACD, sentiment analysis, market regime detection
- **Risk Management**: Dynamic stop-loss (-3%), take-profit (6%), position sizing
- **Paper Trading**: Safe mode by default (no real money at risk)

## 🏗️ Architecture

- **Runtime**: Node.js 18+
- **Exchange**: Kraken API
- **AI Framework**: Custom neural networks with adaptive learning
- **Trading Logic**: Phase 5 multi-factor scoring system
- **Deployment**: AWS App Runner for 24/7 operation

## 📊 API Endpoints

- `GET /health` - Health check
- `GET /api/status` - Trading engine status
- `GET /api/prices` - Current market prices
- `GET /api/trading/core-bot-status` - Core bot trading status

## 🔧 Environment Variables

- `PAPER_TRADING=true` - Safe mode (default)
- `CORE_BOT_CAPITAL=300` - Starting capital for Core Bot
- `PORT=3005` - Server port
- `NODE_ENV=production` - Environment

## 🚀 Deployment

This bot is configured for AWS App Runner deployment via GitHub Actions. The `apprunner.yaml` file contains all deployment configuration.

## 📈 Trading Logic

The bot uses a sophisticated multi-factor analysis system:

- **Technical Analysis (30%)**: RSI, MACD, price patterns
- **Sentiment Analysis (25%)**: Market sentiment indicators  
- **AI Analysis (35%)**: Neural network predictions
- **Asset-Specific (10%)**: Blockchain-specific factors

## ⚠️ Safety

- **Paper Trading**: All trades are simulated by default
- **No Real Money**: Safe for testing and validation
- **Risk Limits**: Built-in position sizing and stop-losses
- **Monitoring**: Comprehensive logging and health checks

## 📝 License

Private - For authorized use only.

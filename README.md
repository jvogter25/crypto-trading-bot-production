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

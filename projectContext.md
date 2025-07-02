# Crypto Trading Bot Project Context - UPDATED

## Project Overview
**Name**: 24/7 AI-Powered Crypto Trading Bot  
**Purpose**: Advanced cryptocurrency trading system with sophisticated AI learning engines  
**Status**: Production-ready backend running locally, AWS deployment in progress  
**Current Phase**: Phase 5 AI Learning Implementation Complete  
**Last Updated**: June 30, 2025

## Current Architecture - PHASE 5 AI SYSTEM

### Single Advanced Strategy (Meme Bot Deprecated)
**Core Bot** - Sophisticated AI-Powered Strategy
- **Capital**: $300 initial (paper trading)
- **Assets**: 24 Layer 1 cryptocurrencies (Kraken-validated)
- **Exchange**: Kraken (real-time API integration)
- **Strategy**: Phase 5 Multi-Factor AI Learning System
- **Risk Level**: Conservative with AI optimization
- **Execution**: 10-second analysis intervals

### Phase 5 AI Learning Components

#### 1. CoreBotAI Learning Engine
- **Asset-specific learning weights** for each cryptocurrency
- **Real-time adaptation** based on trade outcomes
- **Performance tracking** with win rate optimization
- **Confidence scoring** with dynamic adjustment
- **Pattern recognition** adapted for Layer 1 assets

#### 2. Market Regime Detector
- **Real-time market condition analysis**
- **Position sizing adjustments** based on market volatility
- **Strategy parameter optimization** per market regime
- **Risk management scaling**

#### 3. Sentiment Analysis Engine
- **Multi-source sentiment aggregation** (news, social, technical)
- **Real-time sentiment scoring** with confidence metrics
- **Position and risk adjustments** based on sentiment
- **NaN handling fixes** implemented for robust operation

#### 4. Enhanced Multi-Factor Scoring System
- **Technical Analysis (30%)**: RSI, MACD, volume analysis
- **Sentiment Analysis (25%)**: Multi-source sentiment scoring
- **AI Recommendation (35%)**: Neural network-based confidence scoring
- **Asset-Specific Insights (10%)**: Learned optimal entry/exit points
- **Signal Alignment Bonus**: Additional scoring for aligned signals

## Current Trading Performance

### Real Market Integration ✅
- **Live Kraken API**: Real-time price data for 24 Layer 1 assets
- **Asset Coverage**: BTC, ETH, SOL, ADA, AVAX, DOT, ATOM, NEAR, ALGO, OP, ARB, UNI, AAVE, MKR, XRP, XLM, ICP, XMR, ZEC, FIL, STORJ, MANA, SAND, ENJ
- **Price Updates**: Every 30 seconds with real Kraken prices
- **Current Prices**: BTC ~$107,500, ETH ~$2,510, SOL ~$157

### AI Learning Status
- **AI Confidence Threshold**: Lowered to 25% for active trading
- **Entry Score Threshold**: Reduced to 40/100 for increased activity
- **Current AI Behavior**: Analyzing all 24 assets every 10 seconds
- **Learning State**: AI engines initialized and actively learning
- **Trade Execution**: Paper trading mode (safe testing)

### Trading Engine Metrics
- **Positions**: 0 active positions
- **Total Value**: $300.00 (paper trading capital)
- **Unrealized P&L**: $0.00
- **Analysis Frequency**: Every 10 seconds
- **Market Data Updates**: Every 30 seconds

## Technical Implementation

### Production Backend Server (1,393 lines)
**File**: `production-backend-server.js`

#### Core Classes:
1. **MemeCoinAI** - Legacy AI engine (maintained for reference)
2. **CoreBotAI** - Main Phase 5 AI learning engine
3. **MarketRegimeDetector** - Market condition analysis
4. **SentimentAnalysisEngine** - Multi-source sentiment analysis

#### Key Functions:
- `executeCoreBotTradePhase5()` - Main trading execution loop
- `shouldEnterPhase5()` - AI-powered entry decision logic
- `shouldExitPhase5()` - AI-enhanced exit strategy
- `updateMarketData()` - Real-time Kraken data fetching

### Exchange Integration Status

#### ✅ Fully Operational
- **Kraken**: Complete real-time integration
  - 24/24 Layer 1 assets successfully mapped
  - Real account authentication working
  - Live price feeds operational
  - Symbol mapping resolved (XXBTZUSD→BTC/USD, etc.)

#### 📊 Available but Unused
- **Binance.US**: 206 currencies available, authentication successful
- **Coinbase Advanced**: 743 trading pairs, needs additional permissions

### API Endpoints (All Functional)
```
GET  /api/status                    # Trading engine status
GET  /api/prices                    # Real-time Kraken prices
GET  /api/trading/core-bot-status   # Core bot performance metrics
GET  /api/trading/analytics         # AI learning analytics
GET  /api/trading/risk              # Risk management data
GET  /health                        # AWS health check endpoint
```

## AWS Deployment Configuration

### Current Status: DEPLOYMENT IN PROGRESS
- **Service**: AWS App Runner
- **Repository**: GitHub source deployment
- **Configuration**: `apprunner.yaml` optimized
- **Runtime**: Node.js 18
- **Port**: 3005

### App Runner Configuration
```yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm ci --only=production
run:
  runtime-version: 18
  command: node production-backend-server.js
  network:
    port: 3005
    env: PORT
  env:
    - PAPER_TRADING: "true"
    - CORE_BOT_CAPITAL: "300"
    - NODE_ENV: "production"
```

### Environment Variables Configured
- `PAPER_TRADING=true` (safe mode)
- `CORE_BOT_CAPITAL=300` (starting capital)
- `NODE_ENV=production`
- `PORT=3005`
- `HEALTH_CHECK_ENABLED=true`

## Current Issues Resolved

### ✅ Fixed Issues
1. **Kraken Symbol Mapping**: Invalid asset pairs resolved
2. **AI Confidence Thresholds**: Lowered for active trading (25%)
3. **Sentiment Analysis NaN**: Robust handling implemented
4. **Entry Score Thresholds**: Reduced to 40/100 for testing
5. **Real-time Data**: 24/24 Layer 1 assets successfully updating

### 🔄 Current Optimizations
1. **AI Learning**: Engines actively adapting to market conditions
2. **Multi-factor Scoring**: Balanced scoring system operational
3. **Risk Management**: Dynamic stop-loss (-3%) and take-profit (6%)
4. **Position Sizing**: AI-optimized with sentiment adjustments

## Development Environment

### Local Setup ✅
```bash
cd /Users/jvogter25/Desktop/Crypto\ Bot\ v2
npm start
# Server runs on http://localhost:3005
```

### Dependencies (Minimal & Secure)
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "axios": "^1.6.0"
}
```

### Node.js Version
- **Required**: Node.js 18+
- **Current**: Node.js 22.16.0 ✅
- **Claude Code**: Successfully installed and configured

## Dashboard & Frontend Goals

### Target Dashboard Features
1. **Real-time Trading Data**: Live positions, P&L, metrics
2. **AI Learning Visualization**: Confidence scores, learning progress
3. **Market Data Display**: Real-time prices, technical indicators
4. **Performance Analytics**: Win rates, trade history, profitability
5. **Risk Management**: Current exposure, stop-losses, position sizing

### Frontend Access Requirements
- **Local Dashboard**: http://localhost:3005 (when bot running)
- **AWS Dashboard**: Public URL after successful deployment
- **Real-time Updates**: WebSocket or polling for live data
- **Mobile Responsive**: Accessible from any device

## Immediate Next Steps (Priority Order)

### 1. AWS Deployment Completion 🔄
- **Status**: Currently deploying updated code
- **Action**: Monitor deployment logs and verify success
- **Expected**: Public URL with all endpoints functional

### 2. Dashboard Development 📋
- **Frontend**: Create modern, responsive trading dashboard
- **Integration**: Connect to backend API endpoints
- **Features**: Real-time data, AI metrics, performance tracking
- **Deployment**: Host dashboard for 24/7 access

### 3. Production Optimization ⚡
- **API Keys**: Add real exchange API keys (when ready)
- **Live Trading**: Switch from paper to real trading (when validated)
- **Monitoring**: Enhanced logging and alerting
- **Scaling**: Optimize for 24/7 operation

## Technical Achievements

### AI Learning System
- **Phase 5 Implementation**: Complete multi-factor AI system
- **Real-time Learning**: AI adapts weights based on trade outcomes
- **Asset-specific Optimization**: Individual learning for each cryptocurrency
- **Confidence Scoring**: Dynamic AI confidence with performance feedback

### Market Data Integration
- **Real Kraken Prices**: Live data for 24 Layer 1 assets
- **30-second Updates**: Consistent real-time market data
- **Robust Error Handling**: Fallback mechanisms for API failures
- **Symbol Mapping**: Proper Kraken symbol conversion

### Risk Management
- **Paper Trading**: Safe testing environment
- **Dynamic Stop-losses**: AI and sentiment-adjusted risk levels
- **Position Sizing**: Optimized based on AI confidence and market regime
- **Multi-factor Analysis**: Comprehensive decision-making system

## Security & Best Practices

### Production Security
- **Paper Trading Mode**: No real money at risk during testing
- **Environment Variables**: Secure configuration management
- **API Rate Limiting**: Proper exchange API usage
- **Error Boundaries**: Graceful failure handling

### Code Quality
- **Modular Architecture**: Clear separation of concerns
- **Comprehensive Logging**: Detailed execution tracking
- **Health Monitoring**: AWS-compatible health checks
- **Memory Management**: Efficient resource usage

## Project Structure
```
/Users/jvogter25/Desktop/Crypto Bot v2/
├── production-backend-server.js    # Main AI trading engine (1,393 lines)
├── package.json                    # Project configuration
├── apprunner.yaml                  # AWS deployment config
├── kraken-client.js               # Kraken API integration
├── coinbase-client.js             # Coinbase API client
├── binance-us-client.js           # Binance US API client
├── projectContext.md              # This comprehensive context file
└── crypto-trading-bot-production/ # GitHub deployment repository
```

## Success Metrics

### Current Status
- **Local Backend**: ✅ Fully operational with Phase 5 AI
- **Real Market Data**: ✅ 24 Layer 1 assets live from Kraken
- **AI Learning**: ✅ Active learning with confidence adaptation
- **AWS Config**: ✅ Deployment configuration optimized
- **Paper Trading**: ✅ Safe testing environment operational

### Completion Goals
1. **AWS Deployment**: Public URL with all endpoints working
2. **Dashboard Creation**: Modern, real-time trading interface
3. **24/7 Operation**: Stable, continuous bot operation
4. **Performance Validation**: Profitable trading performance
5. **Live Trading Ready**: Transition to real money when validated

---

**ULTIMATE GOAL**: Deploy a sophisticated AI-powered crypto trading bot running 24/7 on AWS App Runner with a beautiful, real-time dashboard accessible via public URL, showcasing live trading data, AI learning progress, and performance metrics.

*This document provides complete context for Claude Code to understand the current project state and assist with completion of the dashboard and AWS deployment goals.* 
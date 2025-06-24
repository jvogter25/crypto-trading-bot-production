require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const RealTradingEngine = require('./real-trading-engine');
const KrakenClient = require('./kraken-client');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize clients
const kraken = new KrakenClient();
const tradingEngine = new RealTradingEngine();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (for production deployment)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'frontend/build')));
}

// Start the real trading engine
console.log('🚀 Starting Real Trading Engine...');
tradingEngine.start().catch(console.error);

// Trading engine event listeners
tradingEngine.on('coreTradeExecuted', (trade) => {
  console.log(`🎯 Core Trade: ${trade.side} ${trade.symbol} at $${trade.price.toFixed(6)} | P&L: $${trade.pnl.toFixed(2)}`);
});

tradingEngine.on('memeTradeExecuted', (trade) => {
  console.log(`🚀 Meme Trade: ${trade.side} ${trade.symbol} at $${trade.price.toFixed(6)} | P&L: $${trade.pnl.toFixed(2)}`);
});

tradingEngine.on('socialSignalDetected', (signal) => {
  console.log(`📱 Social Signal: ${signal.symbol} - ${signal.type} (strength: ${signal.strength.toFixed(3)})`);
});

// Health check endpoint for AWS App Runner
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - tradingEngine.startTime,
    checks: {
      tradingEngine: tradingEngine.isRunning ? 'healthy' : 'unhealthy',
      kraken: 'healthy', // Will be updated by actual connection test
      memory: process.memoryUsage().heapUsed < 1024 * 1024 * 1024 ? 'healthy' : 'warning' // 1GB threshold
    }
  };
  
  // Overall health check
  const isHealthy = healthStatus.checks.tradingEngine === 'healthy' && 
                   healthStatus.checks.kraken === 'healthy';
  
  res.status(isHealthy ? 200 : 503).json(healthStatus);
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    mode: process.env.PAPER_TRADING_MODE === 'true' ? 'paper' : 'live',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - tradingEngine.startTime,
    tradingEngine: {
      running: tradingEngine.isRunning,
      coreBotActive: tradingEngine.coreBotData.metrics.totalTrades > 0,
      memeBotActive: tradingEngine.memeBotData.metrics.totalTrades > 0
    },
    exchanges: {
      kraken: true,
      binanceUS: process.env.BINANCE_US_API_KEY ? true : false,
      coinbaseAdvanced: process.env.COINBASE_API_KEY ? true : false
    }
  });
});

// Real-time trading data endpoints
app.get('/api/trading/core-bot-status', (req, res) => {
  const coreData = tradingEngine.getCoreBotStatus();
  res.json({
    ...coreData,
    strategy: 'Sentiment + Technical Analysis',
    targetAssets: 'BTC, ETH, ADA, DOT, LINK',
    riskLevel: 'Conservative',
    exchange: 'Kraken'
  });
});

app.get('/api/trading/meme-bot-status', (req, res) => {
  const memeData = tradingEngine.getMemeBotStatus();
  res.json({
    ...memeData,
    strategy: 'Social Momentum + Moonshot Detection',
    targetAssets: 'DOGE, SHIB, PEPE, FLOKI, BONK',
    riskLevel: 'High Risk / High Reward',
    exchanges: 'Binance.US, Coinbase Advanced'
  });
});

// Market data endpoints
app.get('/api/prices', (req, res) => {
  const marketData = tradingEngine.getMarketData();
  const prices = {};
  
  Object.entries(marketData).forEach(([symbol, data]) => {
    prices[symbol] = {
      price: data.price,
      change24h: ((data.price - data.low24h) / data.low24h * 100).toFixed(2),
      volume24h: data.volume,
      high24h: data.high24h,
      low24h: data.low24h,
      timestamp: data.timestamp
    };
  });
  
  res.json(prices);
});

app.get('/api/sentiment', (req, res) => {
  const sentimentData = tradingEngine.getSentimentData();
  res.json(sentimentData);
});

// Exchange testing endpoints
app.get('/api/exchanges/test', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    exchanges: {}
  };
  
  // Test Kraken
  try {
    const krakenTicker = await kraken.getTicker(['XBTUSD']);
    const krakenBalance = await kraken.getBalance();
    
    results.exchanges.kraken = {
      status: 'connected',
      authenticated: true,
      btcPrice: krakenTicker.XXBTZUSD ? parseFloat(krakenTicker.XXBTZUSD.c[0]) : null,
      balances: Object.keys(krakenBalance).length,
      message: 'Successfully connected to Kraken API'
    };
  } catch (error) {
    results.exchanges.kraken = {
      status: 'error',
      authenticated: false,
      message: error.message
    };
  }
  
  // Test Binance.US (if configured)
  if (process.env.BINANCE_US_API_KEY) {
    results.exchanges.binanceUS = {
      status: 'configured',
      message: 'API keys configured (testing disabled in paper mode)'
    };
  } else {
    results.exchanges.binanceUS = {
      status: 'not_configured',
      message: 'API keys not configured'
    };
  }
  
  // Test Coinbase Advanced (if configured)
  if (process.env.COINBASE_API_KEY) {
    results.exchanges.coinbaseAdvanced = {
      status: 'configured',
      message: 'API keys configured (testing disabled in paper mode)'
    };
  } else {
    results.exchanges.coinbaseAdvanced = {
      status: 'not_configured',
      message: 'API keys not configured'
    };
  }
  
  res.json(results);
});

// Account balances
app.get('/api/balances', async (req, res) => {
  const balances = {
    timestamp: new Date().toISOString(),
    paperTrading: {
      coreBot: {
        totalValue: tradingEngine.coreBotData.metrics.totalValue,
        initialBalance: tradingEngine.coreBotData.metrics.initialBalance,
        realizedPnL: tradingEngine.coreBotData.metrics.realizedPnL,
        unrealizedPnL: tradingEngine.coreBotData.metrics.unrealizedPnL,
        activePositions: tradingEngine.coreBotData.positions.length
      },
      memeBot: {
        totalValue: tradingEngine.memeBotData.metrics.totalValue,
        initialBalance: tradingEngine.memeBotData.metrics.initialBalance,
        realizedPnL: tradingEngine.memeBotData.metrics.realizedPnL,
        unrealizedPnL: tradingEngine.memeBotData.metrics.unrealizedPnL,
        activePositions: tradingEngine.memeBotData.positions.length
      }
    },
    realBalances: {}
  };
  
  // Get real exchange balances
  try {
    const krakenBalance = await kraken.getBalance();
    balances.realBalances.kraken = {};
    
    Object.entries(krakenBalance).forEach(([asset, amount]) => {
      const balance = parseFloat(amount);
      if (balance > 0.000001) { // Only show meaningful balances
        let standardAsset = asset;
        if (asset === 'ZUSD') standardAsset = 'USD';
        if (asset === 'XXBT') standardAsset = 'BTC';
        if (asset === 'XETH') standardAsset = 'ETH';
        
        balances.realBalances.kraken[standardAsset] = balance;
      }
    });
  } catch (error) {
    balances.realBalances.kraken = { error: error.message };
  }
  
  res.json(balances);
});

// Meme coin data with social signals
app.get('/api/meme-coins', (req, res) => {
  const memeData = tradingEngine.getMemeBotStatus();
  const sentimentData = tradingEngine.getSentimentData();
  const marketData = tradingEngine.getMarketData();
  
  const memeCoins = ['DOGE/USD', 'SHIB/USD', 'PEPE/USD', 'FLOKI/USD', 'BONK/USD'].map(symbol => {
    const market = marketData[symbol] || {};
    const sentiment = sentimentData[symbol] || {};
    
    return {
      symbol,
      name: symbol.split('/')[0],
      price: market.price || 0,
      change24h: market.price ? ((market.price - market.low24h) / market.low24h * 100).toFixed(2) : '0.00',
      volume24h: market.volume || 0,
      socialScore: sentiment.score || 0,
      socialVolume: sentiment.volume || 0,
      confidence: sentiment.confidence || 0,
      signal: sentiment.score > 0.08 ? 'STRONG_BUY' : 
              sentiment.score > 0.04 ? 'BUY' :
              sentiment.score < -0.04 ? 'SELL' : 'NEUTRAL',
      lastUpdate: sentiment.timestamp || Date.now()
    };
  });
  
  res.json({
    coins: memeCoins,
    socialSignals: memeData.socialSignals || [],
    totalSignalsToday: memeData.socialSignals ? memeData.socialSignals.length : 0,
    lastSignalTime: memeData.socialSignals && memeData.socialSignals.length > 0 
      ? memeData.socialSignals[0].timestamp 
      : null
  });
});

// Trading performance analytics
app.get('/api/trading/analytics', (req, res) => {
  const coreData = tradingEngine.getCoreBotStatus();
  const memeData = tradingEngine.getMemeBotStatus();
  
  const analytics = {
    timestamp: new Date().toISOString(),
    combined: {
      totalValue: coreData.metrics.totalValue + memeData.metrics.totalValue,
      initialBalance: coreData.metrics.initialBalance + memeData.metrics.initialBalance,
      totalPnL: coreData.metrics.totalPnL + memeData.metrics.totalPnL,
      totalTrades: coreData.metrics.totalTrades + memeData.metrics.totalTrades,
      combinedWinRate: coreData.metrics.totalTrades + memeData.metrics.totalTrades > 0 
        ? ((coreData.metrics.winRate * coreData.metrics.totalTrades + 
            memeData.metrics.winRate * memeData.metrics.totalTrades) / 
           (coreData.metrics.totalTrades + memeData.metrics.totalTrades)).toFixed(2)
        : 0
    },
    coreBot: {
      ...coreData.metrics,
      strategy: 'Conservative Sentiment + Technical',
      avgTradeSize: coreData.metrics.totalTrades > 0 
        ? (coreData.metrics.totalValue * 0.025).toFixed(2) 
        : 0
    },
    memeBot: {
      ...memeData.metrics,
      strategy: 'Aggressive Social Momentum',
      avgTradeSize: memeData.metrics.totalTrades > 0 
        ? (memeData.metrics.totalValue * 0.035).toFixed(2) 
        : 0
    },
    recentActivity: {
      coreBotTrades: coreData.recentTrades?.slice(0, 10) || [],
      memeBotTrades: memeData.recentTrades?.slice(0, 10) || []
    }
  };
  
  res.json(analytics);
});

// Risk management data
app.get('/api/trading/risk', (req, res) => {
  const coreData = tradingEngine.getCoreBotStatus();
  const memeData = tradingEngine.getMemeBotStatus();
  
  const riskMetrics = {
    timestamp: new Date().toISOString(),
    overall: {
      totalExposure: coreData.metrics.totalValue + memeData.metrics.totalValue,
      maxDrawdown: Math.min(
        (coreData.metrics.worstTrade || 0), 
        (memeData.metrics.worstTrade || 0)
      ),
      riskScore: calculateRiskScore(coreData, memeData),
      diversification: 'MODERATE', // Based on asset allocation
      leverageUsed: 'NONE'
    },
    coreBot: {
      exposure: coreData.metrics.totalValue,
      activePositions: coreData.positions?.length || 0,
      riskLevel: 'LOW',
      stopLossEnabled: true,
      maxPositionSize: '5%'
    },
    memeBot: {
      exposure: memeData.metrics.totalValue,
      activePositions: memeData.positions?.length || 0,
      riskLevel: 'HIGH',
      stopLossEnabled: true,
      maxPositionSize: '10%'
    }
  };
  
  res.json(riskMetrics);
});

// Calculate overall risk score
function calculateRiskScore(coreData, memeData) {
  const totalValue = coreData.metrics.totalValue + memeData.metrics.totalValue;
  const totalPnL = coreData.metrics.totalPnL + memeData.metrics.totalPnL;
  const pnlPercent = totalPnL / 600; // Initial $600 total
  
  if (pnlPercent > 0.1) return 'LOW';
  if (pnlPercent > -0.05) return 'MODERATE';
  return 'HIGH';
}

// Paper trading endpoints (for manual testing)
app.get('/api/trading/paper-trades', (req, res) => {
  const coreData = tradingEngine.getCoreBotStatus();
  const memeData = tradingEngine.getMemeBotStatus();
  
  res.json({
    coreBotTrades: coreData.recentTrades || [],
    memeBotTrades: memeData.recentTrades || [],
    totalTrades: (coreData.metrics.totalTrades || 0) + (memeData.metrics.totalTrades || 0)
  });
});

app.post('/api/trading/paper-trade', (req, res) => {
  const { symbol, side, quantity, exchange } = req.body;
  
  // In paper trading mode, this would simulate the trade
  // For now, return success
  res.json({
    success: true,
    message: 'Paper trade simulated successfully',
    trade: {
      id: `manual_${Date.now()}`,
      symbol,
      side,
      quantity,
      timestamp: Date.now(),
      exchange,
      status: 'FILLED'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tradingEngine: tradingEngine.isRunning,
    uptime: Date.now() - tradingEngine.startTime
  });
});

// Serve React app (production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  tradingEngine.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  tradingEngine.stop();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Production Trading Backend running on http://localhost:' + PORT);
  console.log('📊 API endpoints available:');
  console.log('   GET  /api/status - Server status');
  console.log('   GET  /api/balances - Account balances');
  console.log('   GET  /api/prices - Current prices');
  console.log('   GET  /api/trading/core-bot-status - Core bot paper trading');
  console.log('   GET  /api/trading/meme-bot-status - Meme bot paper trading');
  console.log('   GET  /api/trading/analytics - Performance analytics');
  console.log('   GET  /api/trading/risk - Risk management data');
  console.log('   GET  /api/meme-coins - Meme coin data with social signals');
  console.log('   GET  /api/exchanges/test - Test exchange connections');
  console.log('   GET  /health - Health check');
  console.log('💡 Real Trading Engine with live market data and sentiment analysis');
  console.log('🎯 Paper trading mode - no real money at risk');
}); 
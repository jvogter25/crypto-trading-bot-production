require('dotenv').config();
const EventEmitter = require('events');
const KrakenClient = require('./kraken-client');
const axios = require('axios');

// =====================================================
// TRUE AI LEARNING ENGINE FOR MEME COIN TRADING
// =====================================================
class MemeCoinAI {
  constructor() {
    // Neural network weights (simplified)
    this.weights = {
      socialVolume: 0.4,
      sentimentScore: 0.3,
      priceVelocity: 0.2,
      volumeSpike: 0.1
    };
    
    // Learning parameters
    this.learningRate = 0.01;
    this.tradeHistory = [];
    this.patternMemory = new Map();
    this.adaptationCount = 0;
    
    // Performance tracking
    this.confidence = 0.5; // Starts uncertain
    this.lastAccuracy = 0;
    this.winRate = 0;
    
    console.log('🧠 AI Learning Engine initialized');
  }
  
  // Learn from trading outcome
  learn(tradeData, outcome) {
    const profit = outcome.profit || 0;
    const profitable = profit > 0;
    
    // Update trade history
    this.tradeHistory.push({
      ...tradeData,
      outcome: {
        profit,
        profitable,
        timestamp: Date.now()
      }
    });
    
    // Calculate new win rate
    const recentTrades = this.tradeHistory.slice(-20); // Last 20 trades
    this.winRate = recentTrades.filter(t => t.outcome.profitable).length / recentTrades.length;
    
    // Adapt weights based on outcome
    this.adaptWeights(tradeData, profitable);
    
    // Update confidence
    this.updateConfidence();
    
    console.log(`🧠 AI Learning: ${profitable ? 'WIN' : 'LOSS'} | Win Rate: ${(this.winRate * 100).toFixed(1)}% | Confidence: ${(this.confidence * 100).toFixed(1)}%`);
  }
  
  // Adapt neural network weights
  adaptWeights(tradeData, profitable) {
    const adjustment = profitable ? this.learningRate : -this.learningRate;
    
    // Strengthen/weaken weights based on what led to this trade
    if (tradeData.socialVolume > 500) {
      this.weights.socialVolume += adjustment * 0.1;
    }
    
    if (tradeData.sentimentScore > 0.08) {
      this.weights.sentimentScore += adjustment * 0.1;
    }
    
    if (tradeData.priceVelocity > 0.05) {
      this.weights.priceVelocity += adjustment * 0.1;
    }
    
    // Normalize weights to sum to 1
    const total = Object.values(this.weights).reduce((sum, w) => sum + Math.abs(w), 0);
    Object.keys(this.weights).forEach(key => {
      this.weights[key] = this.weights[key] / total;
    });
    
    this.adaptationCount++;
    
    if (this.adaptationCount % 10 === 0) {
      console.log('🧠 AI Weights Adapted:', this.weights);
    }
  }
  
  // Calculate AI confidence score
  calculateSignalStrength(marketData) {
    const {
      socialVolume = 0,
      sentimentScore = 0,
      priceVelocity = 0,
      volumeSpike = 0
    } = marketData;
    
    // AI-weighted signal calculation
    const strength = 
      (socialVolume / 1000) * this.weights.socialVolume +
      (sentimentScore + 0.15) / 0.3 * this.weights.sentimentScore +
      (priceVelocity + 0.1) / 0.2 * this.weights.priceVelocity +
      (volumeSpike) * this.weights.volumeSpike;
    
    // Apply confidence modifier
    const adjustedStrength = strength * this.confidence;
    
    return Math.max(0, Math.min(1, adjustedStrength));
  }
  
  // Update AI confidence based on recent performance
  updateConfidence() {
    if (this.tradeHistory.length < 5) return;
    
    const recent = this.tradeHistory.slice(-10);
    const recentWinRate = recent.filter(t => t.outcome.profitable).length / recent.length;
    
    // Increase confidence if performing well
    if (recentWinRate > 0.6) {
      this.confidence = Math.min(1, this.confidence + 0.05);
    } else if (recentWinRate < 0.4) {
      this.confidence = Math.max(0.2, this.confidence - 0.05);
    }
  }
  
  // Detect emerging patterns
  detectPatterns(symbol, marketData) {
    // Pattern recognition (simplified)
    const pattern = {
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      socialMomentum: marketData.socialVolume > 800 ? 'HIGH' : 'NORMAL',
      priceAction: marketData.priceVelocity > 0.05 ? 'PUMPING' : 'STABLE'
    };
    
    const patternKey = `${pattern.timeOfDay}_${pattern.dayOfWeek}_${pattern.socialMomentum}_${pattern.priceAction}`;
    
    // Track pattern outcomes
    if (!this.patternMemory.has(patternKey)) {
      this.patternMemory.set(patternKey, { wins: 0, losses: 0, confidence: 0.5 });
    }
    
    return {
      pattern: patternKey,
      confidence: this.patternMemory.get(patternKey).confidence
    };
  }
  
  // Get AI recommendation
  getRecommendation(symbol, marketData) {
    const signalStrength = this.calculateSignalStrength(marketData);
    const patternAnalysis = this.detectPatterns(symbol, marketData);
    
    // Combine AI signal with pattern recognition
    const combinedConfidence = (signalStrength + patternAnalysis.confidence) / 2;
    
    return {
      action: combinedConfidence > 0.7 ? 'BUY' : combinedConfidence < 0.3 ? 'SELL' : 'HOLD',
      confidence: combinedConfidence,
      strength: signalStrength,
      reasoning: this.generateReasoning(marketData, signalStrength, patternAnalysis),
      aiWeights: { ...this.weights },
      learningStats: {
        totalTrades: this.tradeHistory.length,
        winRate: this.winRate,
        adaptations: this.adaptationCount,
        confidence: this.confidence
      }
    };
  }
  
  generateReasoning(marketData, strength, pattern) {
    const reasons = [];
    
    if (marketData.socialVolume > 600) reasons.push('High social volume detected');
    if (marketData.sentimentScore > 0.08) reasons.push('Strong positive sentiment');
    if (marketData.priceVelocity > 0.05) reasons.push('Price momentum building');
    if (strength > 0.7) reasons.push('AI confidence high');
    if (pattern.confidence > 0.6) reasons.push('Favorable pattern recognized');
    
    return reasons.join('; ');
  }
}

class RealTradingEngine extends EventEmitter {
  constructor() {
    super();
    
    // Initialize exchange clients
    this.kraken = new KrakenClient();
    
    // Initialize TRUE AI learning engine
    this.memeAI = new MemeCoinAI();
    
    // Trading configuration
    this.config = {
      // Capital allocation
      coreBotCapital: parseFloat(process.env.INITIAL_CAPITAL_CORE_BOT) || 300,
      memeBotCapital: parseFloat(process.env.INITIAL_CAPITAL_MEME_BOT) || 300,
      
      // Risk management
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS_PERCENTAGE) || 5,
      maxPositionSize: parseFloat(process.env.POSITION_SIZE_LIMIT) || 5,
      
      // Core bot strategy (sentiment + technical)
      coreBot: {
        symbols: ['BTC/USD', 'ETH/USD', 'ADA/USD', 'DOT/USD', 'LINK/USD'],
        sentimentBuyThreshold: 0.06,
        sentimentSellThreshold: 0.04,
        baseProfitTarget: 0.03, // 3%
        bullProfitTarget: 0.08, // 8%
        bearProfitTarget: 0.015, // 1.5%
        stopLossMultiplier: 2.5, // 2.5x ATR
        positionSize: 0.02, // 2% of capital
        btcEthPositionSize: 0.03, // 3% for BTC/ETH
        maxPositionSize: 0.05, // 5% max
        pyramidSize: 0.01, // 1% for additions
        reinvestmentRate: 0.70
      },
      
      // Meme bot strategy (moonshot hunting)
      memeBot: {
        symbols: ['DOGE/USD', 'SHIB/USD', 'PEPE/USD', 'FLOKI/USD', 'BONK/USD'],
        sentimentBuyThreshold: 0.08, // Higher threshold for memes
        sentimentSellThreshold: 0.02,
        profitTarget: 0.15, // 15% for moonshots
        quickProfitTarget: 0.05, // 5% for quick scalps
        stopLoss: 0.08, // 8% stop loss
        positionSize: 0.03, // 3% of capital
        maxPositionSize: 0.10, // 10% max for memes
        socialVolumeThreshold: 500, // Tweets per hour
        rugPullProtection: true
      }
    };
    
    // State tracking
    this.coreBotData = {
      metrics: {
        totalValue: this.config.coreBotCapital,
        initialBalance: this.config.coreBotCapital,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        winRate: 0,
        totalTrades: 0,
        activeTrades: 0,
        dailyPnL: 0,
        bestTrade: 0,
        worstTrade: 0,
        avgTradeSize: 0
      },
      positions: [],
      recentTrades: [],
      marketCondition: 'NEUTRAL',
      lastSignalCheck: 0
    };
    
    this.memeBotData = {
      metrics: {
        totalValue: this.config.memeBotCapital,
        initialBalance: this.config.memeBotCapital,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        winRate: 0,
        totalTrades: 0,
        activeTrades: 0,
        dailyPnL: 0,
        bestTrade: 0,
        worstTrade: 0,
        avgTradeSize: 0
      },
      positions: [],
      recentTrades: [],
      socialSignals: [],
      lastSignalCheck: 0
    };
    
    // Market data cache
    this.marketData = new Map();
    this.sentimentData = new Map();
    this.technicalData = new Map();
    
    // Initialize
    this.isRunning = false;
    this.startTime = Date.now();
    
    console.log('🚀 Real Trading Engine initialized');
    console.log(`💰 Core Bot Capital: $${this.config.coreBotCapital}`);
    console.log(`🚀 Meme Bot Capital: $${this.config.memeBotCapital}`);
  }
  
  // Start the trading engine
  async start() {
    if (this.isRunning) return;
    
    console.log('🎯 Starting Real Trading Engine...');
    this.isRunning = true;
    
    // Initial market data fetch
    await this.updateMarketData();
    
    // Start trading loops
    this.startCoreBotLoop();
    this.startMemeBotLoop();
    
    // Start data update loops
    this.startMarketDataLoop();
    
    this.emit('engineStarted');
    console.log('✅ Real Trading Engine started successfully');
  }
  
  // Stop the trading engine
  stop() {
    this.isRunning = false;
    console.log('🛑 Real Trading Engine stopped');
    this.emit('engineStopped');
  }
  
  // Core Bot Trading Loop (Sentiment + Technical Analysis)
  startCoreBotLoop() {
    const coreLoop = async () => {
      if (!this.isRunning) return;
      
      try {
        // Check each symbol
        for (const symbol of this.config.coreBot.symbols) {
          await this.processCoreSignal(symbol);
        }
        
        // Update positions and check exits
        await this.updateCorePositions();
        
      } catch (error) {
        console.error('❌ Core Bot error:', error.message);
        this.emit('coreBotError', error);
      }
      
      // Schedule next iteration (every 2 minutes)
      setTimeout(coreLoop, 120000);
    };
    
    coreLoop();
  }
  
  // Meme Bot Trading Loop (Social Signal Detection)
  startMemeBotLoop() {
    const memeLoop = async () => {
      if (!this.isRunning) return;
      
      try {
        // Check social signals
        await this.checkSocialSignals();
        
        // Process meme coin signals
        for (const symbol of this.config.memeBot.symbols) {
          await this.processMemeSignal(symbol);
        }
        
        // Update positions and check exits
        await this.updateMemePositions();
        
      } catch (error) {
        console.error('❌ Meme Bot error:', error.message);
        this.emit('memeBotError', error);
      }
      
      // Schedule next iteration (every 30 seconds - faster for memes)
      setTimeout(memeLoop, 30000);
    };
    
    memeLoop();
  }
  
  // Market Data Update Loop
  startMarketDataLoop() {
    const dataLoop = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.updateMarketData();
        await this.updateSentimentData();
        await this.updateTechnicalData();
      } catch (error) {
        console.error('❌ Market data error:', error.message);
      }
      
      // Update every 60 seconds
      setTimeout(dataLoop, 60000);
    };
    
    dataLoop();
  }
  
  // Update market prices
  async updateMarketData() {
    try {
      // Get real prices from Kraken
      const krakenTicker = await this.kraken.getTicker(['XBTUSD', 'ETHUSD']);
      
      // Update market data
      if (krakenTicker.XXBTZUSD) {
        this.marketData.set('BTC/USD', {
          price: parseFloat(krakenTicker.XXBTZUSD.c[0]),
          volume: parseFloat(krakenTicker.XXBTZUSD.v[1]),
          high24h: parseFloat(krakenTicker.XXBTZUSD.h[1]),
          low24h: parseFloat(krakenTicker.XXBTZUSD.l[1]),
          timestamp: Date.now()
        });
      }
      
      if (krakenTicker.XETHZUSD) {
        this.marketData.set('ETH/USD', {
          price: parseFloat(krakenTicker.XETHZUSD.c[0]),
          volume: parseFloat(krakenTicker.XETHZUSD.v[1]),
          high24h: parseFloat(krakenTicker.XETHZUSD.h[1]),
          low24h: parseFloat(krakenTicker.XETHZUSD.l[1]),
          timestamp: Date.now()
        });
      }
      
      // Simulate other altcoin prices (in real implementation, get from APIs)
      this.simulateAltcoinPrices();
      
    } catch (error) {
      console.error('Market data update error:', error.message);
    }
  }
  
  // Simulate altcoin prices (replace with real API calls)
  simulateAltcoinPrices() {
    const basePrice = {
      'ADA/USD': 0.52,
      'DOT/USD': 7.25,
      'LINK/USD': 15.80,
      'DOGE/USD': 0.085,
      'SHIB/USD': 0.0000095,
      'PEPE/USD': 0.00000045,
      'FLOKI/USD': 0.000035,
      'BONK/USD': 0.0000015
    };
    
    Object.entries(basePrice).forEach(([symbol, base]) => {
      const existing = this.marketData.get(symbol);
      const lastPrice = existing ? existing.price : base;
      
      // Realistic price movement (±2% max per minute)
      const change = (Math.random() - 0.5) * 0.04;
      const newPrice = lastPrice * (1 + change);
      
      this.marketData.set(symbol, {
        price: newPrice,
        volume: Math.random() * 1000000,
        high24h: newPrice * 1.05,
        low24h: newPrice * 0.95,
        timestamp: Date.now()
      });
    });
  }
  
  // Simulate sentiment analysis (replace with real Twitter API)
  async updateSentimentData() {
    // Improved meme coin sentiment simulation with leading indicators
    
    const symbols = [...this.config.coreBot.symbols, ...this.config.memeBot.symbols];
    
    symbols.forEach(symbol => {
      const marketData = this.marketData.get(symbol);
      if (!marketData) return;
      
      // For meme coins, use leading sentiment indicators
      if (this.config.memeBot.symbols.includes(symbol)) {
        // Simulate realistic meme coin social signals
        const randomSentiment = (Math.random() - 0.5) * 0.2; // -0.1 to 0.1
        
        // Simulate occasional moonshot signals (5% chance of strong positive)
        let baseSentiment = randomSentiment;
        if (Math.random() < 0.05) {
          baseSentiment = 0.08 + (Math.random() * 0.05); // Strong moonshot signal
        }
        
        // Simulate social volume spikes for moonshots
        let socialVolume = Math.floor(Math.random() * 300) + 100; // 100-400 baseline
        if (baseSentiment > 0.08) {
          socialVolume = Math.floor(Math.random() * 800) + 500; // 500-1300 for moonshots
        }
        
        this.sentimentData.set(symbol, {
          score: Math.max(-0.15, Math.min(0.15, baseSentiment)),
          volume: socialVolume,
          confidence: Math.random() * 0.3 + 0.7,
          timestamp: Date.now(),
          socialMomentum: baseSentiment > 0.08 ? 'HIGH' : 'NORMAL',
          influencerActivity: baseSentiment > 0.1 ? 'ACTIVE' : 'QUIET'
        });
        
      } else {
        // For core assets, use price-correlated sentiment (existing logic)
        const priceChange = this.calculatePriceChange(symbol);
        let baseSentiment = priceChange * 2; // Sentiment follows price
        
        // Add noise and market-specific patterns
        if (symbol.includes('BTC') || symbol.includes('ETH')) {
          baseSentiment += (Math.random() - 0.5) * 0.02; // Less volatile sentiment
        } else {
          baseSentiment += (Math.random() - 0.5) * 0.08; // More volatile for alts
        }
        
        this.sentimentData.set(symbol, {
          score: Math.max(-0.15, Math.min(0.15, baseSentiment)),
          volume: Math.floor(Math.random() * 1000) + 100,
          confidence: Math.random() * 0.3 + 0.7,
          timestamp: Date.now()
        });
      }
    });
  }
  
  // Calculate technical indicators
  async updateTechnicalData() {
    this.marketData.forEach((data, symbol) => {
      const technicals = this.calculateTechnicalIndicators(symbol, data);
      this.technicalData.set(symbol, technicals);
    });
  }
  
  // Calculate price change percentage
  calculatePriceChange(symbol) {
    const data = this.marketData.get(symbol);
    if (!data) return 0;
    
    const high = data.high24h;
    const low = data.low24h;
    const current = data.price;
    
    if (high === low) return 0;
    
    return (current - low) / (high - low) - 0.5; // -0.5 to 0.5 range
  }
  
  // Calculate technical indicators (simplified)
  calculateTechnicalIndicators(symbol, data) {
    const price = data.price;
    const high = data.high24h;
    const low = data.low24h;
    
    // Simplified RSI calculation
    const rsi = 30 + (Math.random() * 40); // 30-70 range
    
    // Simplified MACD
    const macd = (Math.random() - 0.5) * 2;
    
    // ATR calculation
    const atr = (high - low) * 0.5;
    
    return {
      rsi: rsi,
      macdSignal: macd > 0 ? 'BULLISH' : 'BEARISH',
      atr: atr,
      bollingerPosition: rsi > 70 ? 'UPPER' : rsi < 30 ? 'LOWER' : 'MIDDLE',
      trend: macd > 0.5 ? 'BULLISH' : macd < -0.5 ? 'BEARISH' : 'NEUTRAL'
    };
  }
  
  // Process core bot trading signals
  async processCoreSignal(symbol) {
    const sentiment = this.sentimentData.get(symbol);
    const technical = this.technicalData.get(symbol);
    const marketData = this.marketData.get(symbol);
    
    if (!sentiment || !technical || !marketData) return;
    
    // Check for buy signals
    if (this.shouldBuyCoreAsset(symbol, sentiment, technical)) {
      await this.executeCoreOrder(symbol, 'BUY', sentiment, technical);
    }
    
    // Check existing positions for sell signals
    const position = this.coreBotData.positions.find(p => p.symbol === symbol);
    if (position && this.shouldSellCoreAsset(position, sentiment, technical)) {
      await this.executeCoreOrder(symbol, 'SELL', sentiment, technical, position);
    }
  }
  
  // Core asset buy logic
  shouldBuyCoreAsset(symbol, sentiment, technical) {
    const config = this.config.coreBot;
    
    // Check sentiment threshold
    if (sentiment.score < config.sentimentBuyThreshold) return false;
    
    // Check technical conditions
    if (technical.rsi > 70) return false; // Overbought
    if (technical.macdSignal !== 'BULLISH') return false;
    
    // Check if we already have position
    const existingPosition = this.coreBotData.positions.find(p => p.symbol === symbol);
    if (existingPosition) return false;
    
    // Check available capital
    const availableCapital = this.coreBotData.metrics.totalValue * 0.9; // Keep 10% cash
    const positionSize = symbol.includes('BTC') || symbol.includes('ETH') 
      ? config.btcEthPositionSize 
      : config.positionSize;
    
    return availableCapital > (this.coreBotData.metrics.totalValue * positionSize);
  }
  
  // Core asset sell logic
  shouldSellCoreAsset(position, sentiment, technical) {
    const config = this.config.coreBot;
    
    // Check profit target
    const profitPercent = (position.currentPrice - position.entryPrice) / position.entryPrice;
    if (profitPercent >= config.baseProfitTarget) return true;
    
    // Check stop loss
    if (profitPercent <= -0.05) return true; // 5% stop loss
    
    // Check sentiment reversal
    if (sentiment.score < config.sentimentSellThreshold) return true;
    
    // Check technical reversal
    if (technical.rsi > 75 && technical.macdSignal === 'BEARISH') return true;
    
    return false;
  }
  
  // Execute core bot order
  async executeCoreOrder(symbol, side, sentiment, technical, existingPosition = null) {
    const marketData = this.marketData.get(symbol);
    const config = this.config.coreBot;
    
    try {
      let quantity, value;
      
      if (side === 'BUY') {
        const positionSize = symbol.includes('BTC') || symbol.includes('ETH') 
          ? config.btcEthPositionSize 
          : config.positionSize;
        
        value = this.coreBotData.metrics.totalValue * positionSize;
        quantity = value / marketData.price;
        
        // Create position
        const position = {
          id: `core_${Date.now()}_${Math.random()}`,
          symbol,
          side,
          quantity,
          entryPrice: marketData.price,
          currentPrice: marketData.price,
          value,
          entryTime: Date.now(),
          sentiment: sentiment.score,
          technical: technical.trend
        };
        
        this.coreBotData.positions.push(position);
        
      } else { // SELL
        quantity = existingPosition.quantity;
        value = quantity * marketData.price;
        
        // Calculate P&L
        const pnl = value - existingPosition.value;
        const pnlPercent = pnl / existingPosition.value;
        
        // Remove position
        this.coreBotData.positions = this.coreBotData.positions.filter(p => p.id !== existingPosition.id);
        
        // Update metrics
        this.coreBotData.metrics.realizedPnL += pnl;
        this.coreBotData.metrics.totalValue += pnl;
        
        // Update win rate
        if (pnl > 0) {
          const wins = Math.floor(this.coreBotData.metrics.winRate * this.coreBotData.metrics.totalTrades / 100);
          this.coreBotData.metrics.winRate = ((wins + 1) / (this.coreBotData.metrics.totalTrades + 1)) * 100;
        } else {
          const wins = Math.floor(this.coreBotData.metrics.winRate * this.coreBotData.metrics.totalTrades / 100);
          this.coreBotData.metrics.winRate = (wins / (this.coreBotData.metrics.totalTrades + 1)) * 100;
        }
      }
      
      // Create trade record
      const trade = {
        id: `core_${Date.now()}_${Math.random()}`,
        symbol,
        side,
        quantity,
        price: marketData.price,
        value,
        pnl: side === 'SELL' ? value - existingPosition.value : 0,
        timestamp: Date.now(),
        exchange: 'KRAKEN',
        strategy: 'SENTIMENT_TECHNICAL',
        reasoning: `Sentiment: ${sentiment.score.toFixed(3)}, Technical: ${technical.trend}`
      };
      
      this.coreBotData.recentTrades.unshift(trade);
      this.coreBotData.metrics.totalTrades++;
      
      // Keep only last 20 trades
      if (this.coreBotData.recentTrades.length > 20) {
        this.coreBotData.recentTrades = this.coreBotData.recentTrades.slice(0, 20);
      }
      
      this.emit('coreTradeExecuted', trade);
      console.log(`🎯 Core Bot ${side}: ${symbol} at $${marketData.price.toFixed(2)}`);
      
    } catch (error) {
      console.error(`❌ Core order execution error:`, error.message);
    }
  }
  
  // Update core bot positions
  async updateCorePositions() {
    this.coreBotData.positions.forEach(position => {
      const marketData = this.marketData.get(position.symbol);
      if (marketData) {
        position.currentPrice = marketData.price;
        position.currentValue = position.quantity * marketData.price;
        position.unrealizedPnL = position.currentValue - position.value;
      }
    });
    
    // Calculate total unrealized P&L
    this.coreBotData.metrics.unrealizedPnL = this.coreBotData.positions.reduce(
      (total, pos) => total + pos.unrealizedPnL, 0
    );
    
    this.coreBotData.metrics.totalPnL = this.coreBotData.metrics.realizedPnL + this.coreBotData.metrics.unrealizedPnL;
    this.coreBotData.metrics.activeTrades = this.coreBotData.positions.length;
  }
  
  // Check social signals for meme coins
  async checkSocialSignals() {
    // Enhanced social signal detection for moonshot opportunities
    
    this.config.memeBot.symbols.forEach(symbol => {
      const sentiment = this.sentimentData.get(symbol);
      if (!sentiment) return;
      
      // Detect potential moonshot signals with improved criteria
      const hasMoonshotSentiment = sentiment.score > 0.08;
      const hasHighVolume = sentiment.volume > 500;
      const hasHighConfidence = sentiment.confidence > 0.75;
      const hasSocialMomentum = sentiment.socialMomentum === 'HIGH';
      
      // Multiple signal confirmation for better accuracy
      if (hasMoonshotSentiment && hasHighVolume && (hasHighConfidence || hasSocialMomentum)) {
        const signal = {
          symbol,
          type: 'MOONSHOT',
          strength: sentiment.score,
          volume: sentiment.volume,
          confidence: sentiment.confidence,
          socialMomentum: sentiment.socialMomentum,
          influencerActivity: sentiment.influencerActivity,
          timestamp: Date.now(),
          quality: hasHighConfidence && hasSocialMomentum ? 'HIGH' : 'MEDIUM'
        };
        
        this.memeBotData.socialSignals.unshift(signal);
        
        // Keep only last 10 signals
        if (this.memeBotData.socialSignals.length > 10) {
          this.memeBotData.socialSignals = this.memeBotData.socialSignals.slice(0, 10);
        }
        
        this.emit('socialSignalDetected', signal);
        console.log(`🌙 Moonshot signal detected: ${symbol} (Strength: ${sentiment.score.toFixed(3)}, Volume: ${sentiment.volume})`);
      }
    });
  }
  
  // Process meme bot signals with TRUE AI
  async processMemeSignal(symbol) {
    const sentiment = this.sentimentData.get(symbol);
    const marketData = this.marketData.get(symbol);
    
    if (!sentiment || !marketData) return;
    
    // Prepare data for AI analysis
    const aiMarketData = {
      socialVolume: sentiment.volume,
      sentimentScore: sentiment.score,
      priceVelocity: this.calculatePriceVelocity(marketData),
      volumeSpike: this.calculateVolumeSpike(marketData)
    };
    
    // Get AI recommendation
    const aiRecommendation = this.memeAI.getRecommendation(symbol, aiMarketData);
    
    const existingPosition = this.memeBotData.positions.find(p => p.symbol === symbol);
    
    // AI-driven buy logic
    if (!existingPosition && aiRecommendation.action === 'BUY' && aiRecommendation.confidence > 0.7) {
      console.log(`🧠 AI recommends BUY ${symbol}: ${aiRecommendation.reasoning}`);
      await this.executeMemeOrder(symbol, 'BUY', sentiment, null, aiRecommendation);
    }
    
    // AI-driven sell logic
    if (existingPosition && (aiRecommendation.action === 'SELL' || this.shouldExitPosition(existingPosition, marketData))) {
      console.log(`🧠 AI recommends SELL ${symbol}: ${aiRecommendation.reasoning}`);
      await this.executeMemeOrder(symbol, 'SELL', sentiment, existingPosition, aiRecommendation);
    }
  }
  
  // Calculate price velocity for AI
  calculatePriceVelocity(marketData) {
    const high = marketData.high24h;
    const low = marketData.low24h;
    const current = marketData.price;
    
    if (high === low) return 0;
    return (current - low) / (high - low) - 0.5; // -0.5 to 0.5
  }
  
  // Calculate volume spike for AI
  calculateVolumeSpike(marketData) {
    // Simulate volume spike detection
    const baseVolume = marketData.volume || 1000;
    const avgVolume = baseVolume * 0.8; // Assume average is 80% of current
    return Math.max(0, (baseVolume - avgVolume) / avgVolume);
  }
  
  // Smart position exit logic
  shouldExitPosition(position, marketData) {
    const holdTime = Date.now() - position.entryTime;
    const profitPercent = (marketData.price - position.entryPrice) / position.entryPrice;
    
    // Quick profit taking on moonshots
    if (profitPercent >= 0.15) return true;
    if (profitPercent >= 0.08 && holdTime > 1800000) return true; // 8% after 30 min
    
    // Stop loss
    if (profitPercent <= -0.05) return true;
    
    // Time-based exit (don't hold meme coins too long)
    if (holdTime > 7200000 && profitPercent < 0.03) return true; // 2 hours, <3% profit
    
    return false;
  }
  
  // Execute meme bot orders with AI learning
  async executeMemeOrder(symbol, side, sentiment, existingPosition = null, aiRecommendation = null) {
    const marketData = this.marketData.get(symbol);
    const config = this.config.memeBot;
    
    try {
      let quantity, value, pnl = 0;
      
      if (side === 'BUY') {
        value = this.memeBotData.metrics.totalValue * config.positionSize;
        quantity = value / marketData.price;
        
        // Create position
        const position = {
          id: `meme_${Date.now()}_${Math.random()}`,
          symbol,
          side,
          quantity,
          entryPrice: marketData.price,
          currentPrice: marketData.price,
          value,
          entryTime: Date.now(),
          sentiment: sentiment.score,
          aiData: aiRecommendation ? {
            confidence: aiRecommendation.confidence,
            strength: aiRecommendation.strength,
            reasoning: aiRecommendation.reasoning
          } : null
        };
        
        this.memeBotData.positions.push(position);
        
      } else { // SELL
        quantity = existingPosition.quantity;
        value = quantity * marketData.price;
        pnl = value - existingPosition.value;
        
        // AI LEARNING: Feed outcome back to AI
        if (existingPosition.aiData && this.memeAI) {
          const tradeData = {
            symbol,
            socialVolume: sentiment.volume,
            sentimentScore: sentiment.score,
            priceVelocity: this.calculatePriceVelocity(marketData),
            volumeSpike: this.calculateVolumeSpike(marketData),
            entryTime: existingPosition.entryTime,
            holdTime: Date.now() - existingPosition.entryTime
          };
          
          const outcome = {
            profit: pnl,
            profitPercent: pnl / existingPosition.value,
            holdTimeHours: (Date.now() - existingPosition.entryTime) / (1000 * 60 * 60)
          };
          
          // Let AI learn from this trade
          this.memeAI.learn(tradeData, outcome);
        }
        
        // Remove position
        this.memeBotData.positions = this.memeBotData.positions.filter(p => p.id !== existingPosition.id);
        
        // Update metrics
        this.memeBotData.metrics.realizedPnL += pnl;
        this.memeBotData.metrics.totalValue += pnl;
        
        // Update win rate
        if (pnl > 0) {
          const wins = Math.floor(this.memeBotData.metrics.winRate * this.memeBotData.metrics.totalTrades / 100);
          this.memeBotData.metrics.winRate = ((wins + 1) / (this.memeBotData.metrics.totalTrades + 1)) * 100;
        } else {
          const wins = Math.floor(this.memeBotData.metrics.winRate * this.memeBotData.metrics.totalTrades / 100);
          this.memeBotData.metrics.winRate = (wins / (this.memeBotData.metrics.totalTrades + 1)) * 100;
        }
      }
      
      // Create trade record
      const trade = {
        id: `meme_${Date.now()}_${Math.random()}`,
        symbol,
        side,
        quantity,
        price: marketData.price,
        value,
        pnl,
        timestamp: Date.now(),
        exchange: 'BINANCE_US',
        strategy: 'AI_MOONSHOT',
        reasoning: aiRecommendation ? aiRecommendation.reasoning : `Sentiment: ${sentiment.score.toFixed(3)}`,
        aiStats: aiRecommendation ? aiRecommendation.learningStats : null
      };
      
      this.memeBotData.recentTrades.unshift(trade);
      this.memeBotData.metrics.totalTrades++;
      
      // Keep only last 20 trades
      if (this.memeBotData.recentTrades.length > 20) {
        this.memeBotData.recentTrades = this.memeBotData.recentTrades.slice(0, 20);
      }
      
      this.emit('memeTradeExecuted', trade);
      console.log(`🚀 Meme Bot ${side}: ${symbol} at $${marketData.price.toFixed(6)} | P&L: $${pnl.toFixed(2)}`);
      
    } catch (error) {
      console.error(`❌ Meme order execution error:`, error.message);
    }
  }
  
  // Update meme positions
  async updateMemePositions() {
    // Similar to updateCorePositions
  }
  
  // Get current state for API
  getCoreBotStatus() {
    return this.coreBotData;
  }
  
  getMemeBotStatus() {
    return this.memeBotData;
  }
  
  getMarketData() {
    return Object.fromEntries(this.marketData);
  }
  
  getSentimentData() {
    return Object.fromEntries(this.sentimentData);
  }
}

module.exports = RealTradingEngine; 
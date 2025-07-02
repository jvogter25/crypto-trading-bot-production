// =====================================================
// ENHANCED AI LEARNING ENGINE FOR CRYPTO TRADING
// =====================================================
// Advanced machine learning algorithms for meme coin trading

class EnhancedMemeCoinAI {
  constructor() {
    // Core AI parameters
    this.confidence = 0.5;
    this.learningRate = 0.01;
    this.adaptationCount = 0;
    this.tradeHistory = [];
    
    // Enhanced learning features
    this.patternMemory = new Map(); // Store successful patterns
    this.marketRegimes = ['bullish', 'bearish', 'sideways'];
    this.currentRegime = 'sideways';
    this.regimeConfidence = 0.5;
    
    // Advanced weights with momentum and adaptive learning
    this.weights = {
      socialVolume: 0.25,
      sentimentScore: 0.30,
      priceVelocity: 0.20,
      volumeSpike: 0.15,
      technicalMomentum: 0.10
    };
    
    // Momentum tracking for weights
    this.weightMomentum = {
      socialVolume: 0,
      sentimentScore: 0,
      priceVelocity: 0,
      volumeSpike: 0,
      technicalMomentum: 0
    };
    
    // Performance tracking
    this.performanceMetrics = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      avgWinSize: 0,
      avgLossSize: 0,
      profitFactor: 0
    };
    
    // Pattern recognition
    this.patterns = {
      breakoutPattern: { weight: 0.5, successRate: 0.5, trades: 0 },
      reversalPattern: { weight: 0.5, successRate: 0.5, trades: 0 },
      trendFollowing: { weight: 0.5, successRate: 0.5, trades: 0 },
      meanReversion: { weight: 0.5, successRate: 0.5, trades: 0 }
    };
    
    // Risk management parameters
    this.riskParams = {
      maxPositionSize: 0.05, // 5% max position
      stopLossMultiplier: 2.0,
      takeProfitMultiplier: 3.0,
      maxDailyLoss: 0.02, // 2% max daily loss
      volatilityAdjustment: true
    };
    
    console.log('🧠 Enhanced AI Learning Engine initialized');
    console.log('📊 Pattern recognition enabled');
    console.log('⚡ Adaptive learning algorithms active');
  }

  // Enhanced learning from trade outcomes
  learn(tradeData, outcome) {
    this.tradeHistory.push({
      ...tradeData,
      outcome,
      timestamp: Date.now(),
      regime: this.currentRegime,
      confidence: this.confidence
    });
    
    // Update performance metrics
    this.updatePerformanceMetrics(outcome);
    
    // Detect market regime
    this.detectMarketRegime(tradeData, outcome);
    
    // Pattern-based learning
    this.learnFromPatterns(tradeData, outcome);
    
    // Adaptive weight adjustment with momentum
    this.adaptWeightsWithMomentum(tradeData, outcome.profit > 0);
    
    // Update confidence based on recent performance
    this.updateConfidenceAdvanced();
    
    // Store successful patterns
    if (outcome.profit > 0) {
      this.storeSuccessfulPattern(tradeData);
    }
    
    this.adaptationCount++;
    
    console.log(`🧠 AI Enhanced Learning: ${outcome.profit > 0 ? 'WIN' : 'LOSS'} | Pattern: ${this.identifyPattern(tradeData)} | Regime: ${this.currentRegime}`);
  }

  // Update comprehensive performance metrics
  updatePerformanceMetrics(outcome) {
    this.performanceMetrics.totalTrades++;
    
    if (outcome.profit > 0) {
      this.performanceMetrics.winningTrades++;
      this.performanceMetrics.totalProfit += outcome.profit;
    } else {
      this.performanceMetrics.losingTrades++;
      this.performanceMetrics.totalLoss += Math.abs(outcome.profit);
    }
    
    // Calculate win rate
    this.performanceMetrics.winRate = this.performanceMetrics.winningTrades / this.performanceMetrics.totalTrades;
    
    // Calculate average win/loss sizes
    if (this.performanceMetrics.winningTrades > 0) {
      this.performanceMetrics.avgWinSize = this.performanceMetrics.totalProfit / this.performanceMetrics.winningTrades;
    }
    
    if (this.performanceMetrics.losingTrades > 0) {
      this.performanceMetrics.avgLossSize = this.performanceMetrics.totalLoss / this.performanceMetrics.losingTrades;
    }
    
    // Calculate profit factor
    if (this.performanceMetrics.totalLoss > 0) {
      this.performanceMetrics.profitFactor = this.performanceMetrics.totalProfit / this.performanceMetrics.totalLoss;
    }
    
    // Calculate Sharpe ratio (simplified)
    if (this.tradeHistory.length > 10) {
      const returns = this.tradeHistory.slice(-10).map(t => t.outcome.profitPercent);
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
      this.performanceMetrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    }
  }

  // Detect current market regime
  detectMarketRegime(tradeData, outcome) {
    // Analyze recent price velocity and volume patterns
    const recentTrades = this.tradeHistory.slice(-20);
    
    if (recentTrades.length < 5) return;
    
    const avgVelocity = recentTrades.reduce((sum, t) => sum + (t.priceVelocity || 0), 0) / recentTrades.length;
    const avgVolume = recentTrades.reduce((sum, t) => sum + (t.volumeSpike || 0), 0) / recentTrades.length;
    const winRate = recentTrades.filter(t => t.outcome.profit > 0).length / recentTrades.length;
    
    // Regime detection logic
    if (avgVelocity > 0.1 && avgVolume > 0.3 && winRate > 0.6) {
      this.currentRegime = 'bullish';
      this.regimeConfidence = Math.min(0.9, this.regimeConfidence + 0.1);
    } else if (avgVelocity < -0.1 && winRate < 0.4) {
      this.currentRegime = 'bearish';
      this.regimeConfidence = Math.min(0.9, this.regimeConfidence + 0.1);
    } else {
      this.currentRegime = 'sideways';
      this.regimeConfidence = Math.max(0.3, this.regimeConfidence - 0.05);
    }
  }

  // Learn from trading patterns
  learnFromPatterns(tradeData, outcome) {
    const pattern = this.identifyPattern(tradeData);
    
    if (this.patterns[pattern]) {
      this.patterns[pattern].trades++;
      
      // Update success rate
      const wasSuccessful = outcome.profit > 0;
      const currentSuccessRate = this.patterns[pattern].successRate;
      const trades = this.patterns[pattern].trades;
      
      this.patterns[pattern].successRate = 
        (currentSuccessRate * (trades - 1) + (wasSuccessful ? 1 : 0)) / trades;
      
      // Adjust pattern weight based on success rate
      if (this.patterns[pattern].successRate > 0.6) {
        this.patterns[pattern].weight = Math.min(1.0, this.patterns[pattern].weight + 0.05);
      } else if (this.patterns[pattern].successRate < 0.4) {
        this.patterns[pattern].weight = Math.max(0.1, this.patterns[pattern].weight - 0.05);
      }
    }
  }

  // Identify trading pattern
  identifyPattern(tradeData) {
    const { priceVelocity, volumeSpike, sentimentScore } = tradeData;
    
    if (priceVelocity > 0.15 && volumeSpike > 0.4) {
      return 'breakoutPattern';
    } else if (priceVelocity < -0.1 && sentimentScore > 0.7) {
      return 'reversalPattern';
    } else if (Math.abs(priceVelocity) > 0.1 && volumeSpike > 0.3) {
      return 'trendFollowing';
    } else {
      return 'meanReversion';
    }
  }

  // Advanced weight adaptation with momentum
  adaptWeightsWithMomentum(tradeData, profitable) {
    const momentumDecay = 0.9;
    const learningRate = this.learningRate * (this.confidence + 0.5); // Adaptive learning rate
    
    Object.keys(this.weights).forEach(factor => {
      if (tradeData[factor] !== undefined) {
        const signal = tradeData[factor];
        const adjustment = profitable ? signal * learningRate : -signal * learningRate * 0.5;
        
        // Apply momentum
        this.weightMomentum[factor] = momentumDecay * this.weightMomentum[factor] + (1 - momentumDecay) * adjustment;
        this.weights[factor] += this.weightMomentum[factor];
        
        // Ensure weights stay within bounds
        this.weights[factor] = Math.max(0.05, Math.min(0.5, this.weights[factor]));
      }
    });
    
    // Normalize weights
    const totalWeight = Object.values(this.weights).reduce((sum, w) => sum + w, 0);
    Object.keys(this.weights).forEach(factor => {
      this.weights[factor] /= totalWeight;
    });
  }

  // Store successful trading patterns
  storeSuccessfulPattern(tradeData) {
    const patternKey = `${tradeData.symbol}_${this.currentRegime}_${this.identifyPattern(tradeData)}`;
    
    if (!this.patternMemory.has(patternKey)) {
      this.patternMemory.set(patternKey, {
        count: 0,
        successRate: 0,
        avgProfit: 0,
        conditions: { ...tradeData }
      });
    }
    
    const pattern = this.patternMemory.get(patternKey);
    pattern.count++;
    pattern.successRate = (pattern.successRate * (pattern.count - 1) + 1) / pattern.count;
  }

  // Advanced confidence calculation
  updateConfidenceAdvanced() {
    if (this.tradeHistory.length < 5) return;
    
    const recentTrades = this.tradeHistory.slice(-10);
    const winRate = recentTrades.filter(t => t.outcome.profit > 0).length / recentTrades.length;
    const avgProfit = recentTrades.reduce((sum, t) => sum + t.outcome.profitPercent, 0) / recentTrades.length;
    
    // Factor in regime confidence and pattern success rates
    const patternConfidence = Object.values(this.patterns).reduce((sum, p) => sum + p.successRate * p.weight, 0);
    
    // Combine multiple confidence factors
    const baseConfidence = (winRate * 0.4) + (this.regimeConfidence * 0.3) + (patternConfidence * 0.3);
    
    // Smooth confidence changes
    this.confidence = this.confidence * 0.8 + baseConfidence * 0.2;
    this.confidence = Math.max(0.1, Math.min(0.95, this.confidence));
  }

  // Enhanced signal strength calculation
  calculateSignalStrength(marketData) {
    const { socialVolume, sentimentScore, priceVelocity, volumeSpike, technicalMomentum = 0.5 } = marketData;
    
    // Base signal calculation
    let signal = 
      (socialVolume || 0) * this.weights.socialVolume +
      (sentimentScore || 0) * this.weights.sentimentScore +
      Math.abs(priceVelocity || 0) * this.weights.priceVelocity +
      (volumeSpike || 0) * this.weights.volumeSpike +
      (technicalMomentum || 0) * this.weights.technicalMomentum;
    
    // Apply pattern-based adjustments
    const currentPattern = this.identifyPattern(marketData);
    if (this.patterns[currentPattern]) {
      signal *= this.patterns[currentPattern].weight;
    }
    
    // Apply regime-based adjustments
    if (this.currentRegime === 'bullish' && priceVelocity > 0) {
      signal *= (1 + this.regimeConfidence * 0.2);
    } else if (this.currentRegime === 'bearish' && priceVelocity < 0) {
      signal *= (1 + this.regimeConfidence * 0.1);
    }
    
    return Math.max(0, Math.min(1, signal));
  }

  // Get enhanced trading recommendation
  getRecommendation(symbol, marketData) {
    const signalStrength = this.calculateSignalStrength(marketData);
    const adjustedConfidence = this.confidence * this.regimeConfidence;
    
    // Risk-adjusted position sizing
    const volatility = Math.abs(marketData.priceVelocity || 0);
    const positionSizeMultiplier = this.riskParams.volatilityAdjustment ? 
      Math.max(0.5, 1 - volatility) : 1.0;
    
    // Enhanced decision logic
    let action = 'HOLD';
    let reasoning = '';
    
    const buyThreshold = 0.6 - (this.performanceMetrics.winRate > 0.7 ? 0.1 : 0);
    const sellThreshold = 0.3;
    
    if (signalStrength > buyThreshold && adjustedConfidence > 0.5) {
      action = 'BUY';
      reasoning = `Strong ${this.identifyPattern(marketData)} pattern in ${this.currentRegime} market`;
    } else if (signalStrength < sellThreshold || adjustedConfidence < 0.3) {
      action = 'SELL';
      reasoning = `Weak signals or low confidence in current market conditions`;
    } else {
      reasoning = `Neutral signals, waiting for better opportunity`;
    }
    
    return {
      action,
      confidence: adjustedConfidence,
      signalStrength,
      reasoning,
      positionSizeMultiplier,
      pattern: this.identifyPattern(marketData),
      regime: this.currentRegime,
      aiWeights: { ...this.weights },
      riskMetrics: {
        volatilityAdjustment: positionSizeMultiplier,
        maxPositionSize: this.riskParams.maxPositionSize,
        currentDrawdown: this.calculateCurrentDrawdown()
      }
    };
  }

  // Calculate current drawdown
  calculateCurrentDrawdown() {
    if (this.tradeHistory.length < 5) return 0;
    
    let peak = 0;
    let currentValue = 0;
    let maxDrawdown = 0;
    
    this.tradeHistory.forEach(trade => {
      currentValue += trade.outcome.profit;
      if (currentValue > peak) {
        peak = currentValue;
      }
      const drawdown = (peak - currentValue) / Math.max(peak, 1);
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });
    
    return maxDrawdown;
  }

  // Get comprehensive AI analytics
  getAnalytics() {
    return {
      performance: this.performanceMetrics,
      patterns: this.patterns,
      currentRegime: this.currentRegime,
      regimeConfidence: this.regimeConfidence,
      weights: this.weights,
      confidence: this.confidence,
      adaptationCount: this.adaptationCount,
      patternMemorySize: this.patternMemory.size,
      recentTrades: this.tradeHistory.slice(-10),
      riskMetrics: {
        currentDrawdown: this.calculateCurrentDrawdown(),
        sharpeRatio: this.performanceMetrics.sharpeRatio,
        profitFactor: this.performanceMetrics.profitFactor
      }
    };
  }

  // Export AI state for persistence
  exportState() {
    return {
      weights: this.weights,
      weightMomentum: this.weightMomentum,
      confidence: this.confidence,
      adaptationCount: this.adaptationCount,
      performanceMetrics: this.performanceMetrics,
      patterns: this.patterns,
      currentRegime: this.currentRegime,
      regimeConfidence: this.regimeConfidence,
      tradeHistory: this.tradeHistory.slice(-100), // Keep last 100 trades
      patternMemory: Array.from(this.patternMemory.entries())
    };
  }

  // Import AI state for persistence
  importState(state) {
    if (state) {
      this.weights = state.weights || this.weights;
      this.weightMomentum = state.weightMomentum || this.weightMomentum;
      this.confidence = state.confidence || this.confidence;
      this.adaptationCount = state.adaptationCount || this.adaptationCount;
      this.performanceMetrics = state.performanceMetrics || this.performanceMetrics;
      this.patterns = state.patterns || this.patterns;
      this.currentRegime = state.currentRegime || this.currentRegime;
      this.regimeConfidence = state.regimeConfidence || this.regimeConfidence;
      this.tradeHistory = state.tradeHistory || [];
      
      if (state.patternMemory) {
        this.patternMemory = new Map(state.patternMemory);
      }
      
      console.log('🧠 Enhanced AI state imported successfully');
    }
  }
}

module.exports = EnhancedMemeCoinAI; 
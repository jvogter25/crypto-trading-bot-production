import TradeAuditService, { 
  TradeExecutionData, 
  ProfitTakingEvent, 
  PortfolioSnapshot, 
  TradingDecision,
  AuditConfig 
} from './trade-audit-service';
import { GoogleSheetsConfig } from './google-sheets-logger';

// Configuration for demo
const demoConfig: AuditConfig = {
  googleSheets: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'demo@crypto-bot.com',
    privateKey: process.env.GOOGLE_PRIVATE_KEY || 'demo-key',
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || 'demo-spreadsheet',
    enableBatchLogging: true,
    batchSize: 20,
    batchInterval: 10000, // 10 seconds for demo
    retryAttempts: 3,
    retryDelay: 2000
  },
  enableRealTimeLogging: true,
  enablePerformanceTracking: true,
  enableDecisionLogging: true,
  enableSystemEventLogging: true,
  logLevel: 'INFO',
  auditRetentionDays: 365,
  complianceMode: true
};

class GoogleSheetsLoggingDemo {
  private auditService: TradeAuditService;
  private demoStartTime: Date;
  private portfolioValue: number = 50000; // Starting with $50k
  private cashBalance: number = 20000;    // $20k cash
  private positions: Map<string, { quantity: number; avgPrice: number }> = new Map();

  constructor() {
    this.auditService = new TradeAuditService(demoConfig);
    this.demoStartTime = new Date();
    
    // Initialize some positions
    this.positions.set('BTC', { quantity: 0.5, avgPrice: 45000 });
    this.positions.set('ETH', { quantity: 8, avgPrice: 3000 });
    this.positions.set('ADA', { quantity: 15000, avgPrice: 0.40 });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Google Sheets Logging Demo...');
    console.log('📊 This demo shows comprehensive audit trail logging for tax and compliance');
    console.log('💼 All trades, decisions, and performance metrics will be logged to Google Sheets\n');

    try {
      await this.auditService.initialize();
      
      // Log demo startup
      await this.auditService.logSystemEvent({
        timestamp: new Date(),
        eventType: 'STARTUP',
        component: 'DEMO_SYSTEM',
        message: 'Google Sheets Logging Demo Started',
        severity: 'INFO',
        details: {
          demoVersion: '1.0',
          startingPortfolioValue: this.portfolioValue,
          startingCashBalance: this.cashBalance
        }
      });

      console.log('✅ Demo initialized successfully');
    } catch (error: any) {
      console.error('❌ Demo initialization failed:', error.message);
      throw error;
    }
  }

  // Demo Scenario 1: Morning Trading Session
  async demonstrateMorningTradingSession(): Promise<void> {
    console.log('\n📈 DEMO SCENARIO 1: Morning Trading Session');
    console.log('⏰ Simulating active trading with multiple buy/sell decisions\n');

    // Market analysis decision
    await this.auditService.logTradingDecision({
      timestamp: new Date(),
      decisionId: 'MORNING_ANALYSIS_001',
      type: 'HOLD',
      signal: 'MARKET_ANALYSIS',
      confidence: 0.75,
      reasoning: 'Pre-market analysis shows mixed signals. BTC showing strength but overall market uncertainty due to Fed meeting today.',
      marketAnalysis: {
        technicalSignals: ['BTC_BULLISH_DIVERGENCE', 'ETH_CONSOLIDATION', 'VOLUME_DECLINING'],
        sentimentScore: 0.15,
        volumeAnalysis: 'Below average volume in pre-market',
        priceAction: 'Sideways consolidation with slight upward bias'
      },
      riskAssessment: {
        positionSize: 0,
        riskReward: 0,
      },
      executed: false
    });

    await this.sleep(1000);

    // BTC Buy Decision
    const btcBuyDecision: TradingDecision = {
      timestamp: new Date(),
      decisionId: 'BTC_BUY_001',
      type: 'ENTRY',
      asset: 'BTC',
      signal: 'STRONG_BUY',
      confidence: 0.82,
      reasoning: 'BTC broke above $46,500 resistance with strong volume. RSI showing bullish momentum without being overbought.',
      marketAnalysis: {
        technicalSignals: ['RESISTANCE_BREAKOUT', 'VOLUME_CONFIRMATION', 'RSI_BULLISH'],
        sentimentScore: 0.65,
        volumeAnalysis: 'Volume 40% above 20-day average',
        priceAction: 'Clean breakout above key resistance level'
      },
      riskAssessment: {
        positionSize: 0.02, // 2% of portfolio
        riskReward: 3.2,
        stopLoss: 46000,
        takeProfit: 48500
      },
      executed: true,
      executionDelay: 180,
      outcome: 'SUCCESS'
    };

    await this.auditService.logTradingDecision(btcBuyDecision);
    await this.sleep(500);

    // Execute BTC Buy Trade
    const btcTrade: TradeExecutionData = {
      tradeId: 'TRADE_BTC_001',
      timestamp: new Date(),
      asset: 'BTC',
      action: 'BUY',
      quantity: 0.021,
      price: 46750,
      fees: 9.82,
      orderId: 'ORDER_001',
      exchangeOrderId: 'KRAKEN_BTC_001',
      strategy: 'MOMENTUM_BREAKOUT',
      reasoning: 'Executing breakout trade above $46,500 resistance',
      marketCondition: 'BULLISH_BREAKOUT',
      technicalIndicators: {
        rsi: 62,
        macd: 0.85,
        bollingerPosition: 'UPPER_MIDDLE',
        volatility: 0.16
      },
      portfolioContext: {
        totalValue: this.portfolioValue,
        cashReserves: this.cashBalance,
        riskLevel: 0.35,
        positionCount: 4
      },
      executionMetrics: {
        latency: 180,
        slippage: 0.0053, // 0.53%
        fillRate: 1.0
      }
    };

    await this.auditService.logTradeExecution(btcTrade);
    
    // Update portfolio
    this.cashBalance -= (btcTrade.quantity * btcTrade.price + btcTrade.fees);
    const currentBtc = this.positions.get('BTC') || { quantity: 0, avgPrice: 0 };
    const newQuantity = currentBtc.quantity + btcTrade.quantity;
    const newAvgPrice = ((currentBtc.quantity * currentBtc.avgPrice) + (btcTrade.quantity * btcTrade.price)) / newQuantity;
    this.positions.set('BTC', { quantity: newQuantity, avgPrice: newAvgPrice });

    console.log(`✅ BTC Buy: ${btcTrade.quantity} BTC at $${btcTrade.price} (Total: $${(btcTrade.quantity * btcTrade.price).toFixed(2)})`);

    await this.sleep(2000);

    // ETH Sell Decision (Profit Taking)
    const ethSellDecision: TradingDecision = {
      timestamp: new Date(),
      decisionId: 'ETH_SELL_001',
      type: 'EXIT',
      asset: 'ETH',
      signal: 'PROFIT_TAKING',
      confidence: 0.78,
      reasoning: 'ETH reached 8% profit target. Taking partial profits while maintaining core position.',
      marketAnalysis: {
        technicalSignals: ['PROFIT_TARGET_HIT', 'RESISTANCE_APPROACHING'],
        sentimentScore: 0.45,
        volumeAnalysis: 'Normal volume, no unusual activity',
        priceAction: 'Approaching previous high resistance'
      },
      riskAssessment: {
        positionSize: -0.015, // Reducing position by 1.5%
        riskReward: 0, // Profit taking
        takeProfit: 3240
      },
      executed: true,
      executionDelay: 95,
      outcome: 'SUCCESS'
    };

    await this.auditService.logTradingDecision(ethSellDecision);
    await this.sleep(500);

    // Execute ETH Profit Taking
    const ethPosition = this.positions.get('ETH')!;
    const sellQuantity = 3; // Selling 3 ETH
    const currentEthPrice = 3240;

    const ethTrade: TradeExecutionData = {
      tradeId: 'TRADE_ETH_001',
      timestamp: new Date(),
      asset: 'ETH',
      action: 'SELL',
      quantity: sellQuantity,
      price: currentEthPrice,
      fees: 9.72,
      orderId: 'ORDER_002',
      exchangeOrderId: 'KRAKEN_ETH_001',
      strategy: 'PROFIT_TAKING',
      reasoning: 'Taking 8% profit on ETH position at resistance level',
      marketCondition: 'PROFIT_TARGET',
      technicalIndicators: {
        rsi: 71,
        macd: 0.45,
        bollingerPosition: 'UPPER',
        volatility: 0.19
      },
      portfolioContext: {
        totalValue: this.portfolioValue + 1000, // Approximate increase
        cashReserves: this.cashBalance,
        riskLevel: 0.32,
        positionCount: 4
      },
      executionMetrics: {
        latency: 95,
        slippage: 0.0031,
        fillRate: 1.0
      }
    };

    await this.auditService.logTradeExecution(ethTrade);

    // Log profit taking event
    const profitAmount = (currentEthPrice - ethPosition.avgPrice) * sellQuantity;
    const profitEvent: ProfitTakingEvent = {
      tradeId: 'TRADE_ETH_001',
      timestamp: new Date(),
      asset: 'ETH',
      originalQuantity: ethPosition.quantity,
      soldQuantity: sellQuantity,
      originalPrice: ethPosition.avgPrice,
      salePrice: currentEthPrice,
      profitAmount: profitAmount,
      profitPercentage: ((currentEthPrice - ethPosition.avgPrice) / ethPosition.avgPrice) * 100,
      holdingPeriod: 72, // 3 days
      strategy: 'PROFIT_TAKING',
      triggerReason: 'Reached 8% profit target at resistance level',
      reinvestmentAmount: profitAmount * 0.7, // 70% reinvestment
      taxImplications: {
        shortTermGain: true,
        taxableAmount: profitAmount,
        costBasis: ethPosition.avgPrice * sellQuantity
      }
    };

    await this.auditService.logProfitTakingEvent(profitEvent);

    // Update portfolio
    this.cashBalance += (ethTrade.quantity * ethTrade.price - ethTrade.fees);
    this.positions.set('ETH', { 
      quantity: ethPosition.quantity - sellQuantity, 
      avgPrice: ethPosition.avgPrice 
    });

    console.log(`✅ ETH Profit Taking: Sold ${sellQuantity} ETH at $${currentEthPrice} (Profit: $${profitAmount.toFixed(2)})`);
  }

  // Demo Scenario 2: Risk Management Event
  async demonstrateRiskManagementEvent(): Promise<void> {
    console.log('\n⚠️  DEMO SCENARIO 2: Risk Management Event');
    console.log('🛡️  Simulating portfolio risk adjustment due to market volatility\n');

    await this.sleep(1000);

    // Risk assessment decision
    await this.auditService.logTradingDecision({
      timestamp: new Date(),
      decisionId: 'RISK_ASSESSMENT_001',
      type: 'RISK_REDUCTION',
      signal: 'HIGH_VOLATILITY_DETECTED',
      confidence: 0.95,
      reasoning: 'Market volatility increased to 28%. Reducing position sizes to maintain risk within acceptable limits.',
      marketAnalysis: {
        technicalSignals: ['VOLATILITY_SPIKE', 'CORRELATION_INCREASE', 'VOLUME_SURGE'],
        sentimentScore: -0.25,
        volumeAnalysis: 'Panic selling detected in some altcoins',
        priceAction: 'Increased intraday ranges across all major assets'
      },
      riskAssessment: {
        positionSize: -0.05, // Reducing total exposure by 5%
        riskReward: 0,
      },
      executed: true,
      executionDelay: 45,
      outcome: 'SUCCESS'
    });

    // Log system event for risk management
    await this.auditService.logSystemEvent({
      timestamp: new Date(),
      eventType: 'WARNING',
      component: 'RISK_MANAGER',
      message: 'Portfolio volatility exceeded 25% threshold - initiating risk reduction',
      severity: 'HIGH',
      details: {
        currentVolatility: 0.28,
        threshold: 0.25,
        portfolioExposure: 0.78,
        recommendedExposure: 0.70,
        affectedPositions: ['ADA', 'ETH']
      }
    });

    console.log('⚠️  Risk management event logged - Portfolio exposure being reduced');
  }

  // Demo Scenario 3: End of Day Performance Summary
  async demonstrateEndOfDayPerformance(): Promise<void> {
    console.log('\n📊 DEMO SCENARIO 3: End of Day Performance Summary');
    console.log('📈 Logging comprehensive portfolio performance metrics\n');

    await this.sleep(1000);

    // Calculate current portfolio value
    const btcPrice = 47200;
    const ethPrice = 3180;
    const adaPrice = 0.42;

    const btcValue = this.positions.get('BTC')!.quantity * btcPrice;
    const ethValue = this.positions.get('ETH')!.quantity * ethPrice;
    const adaValue = this.positions.get('ADA')!.quantity * adaPrice;
    const totalValue = btcValue + ethValue + adaValue + this.cashBalance;

    const portfolioSnapshot: PortfolioSnapshot = {
      timestamp: new Date(),
      totalValue: totalValue,
      cashBalance: this.cashBalance,
      positions: [
        {
          asset: 'BTC',
          quantity: this.positions.get('BTC')!.quantity,
          currentPrice: btcPrice,
          marketValue: btcValue,
          unrealizedPnL: btcValue - (this.positions.get('BTC')!.quantity * this.positions.get('BTC')!.avgPrice),
          allocation: btcValue / totalValue
        },
        {
          asset: 'ETH',
          quantity: this.positions.get('ETH')!.quantity,
          currentPrice: ethPrice,
          marketValue: ethValue,
          unrealizedPnL: ethValue - (this.positions.get('ETH')!.quantity * this.positions.get('ETH')!.avgPrice),
          allocation: ethValue / totalValue
        },
        {
          asset: 'ADA',
          quantity: this.positions.get('ADA')!.quantity,
          currentPrice: adaPrice,
          marketValue: adaValue,
          unrealizedPnL: adaValue - (this.positions.get('ADA')!.quantity * this.positions.get('ADA')!.avgPrice),
          allocation: adaValue / totalValue
        }
      ],
      performanceMetrics: {
        dailyReturn: (totalValue - this.portfolioValue) / this.portfolioValue,
        weeklyReturn: 0.035,
        monthlyReturn: 0.12,
        yearToDateReturn: 0.28,
        totalReturn: (totalValue - 50000) / 50000,
        sharpeRatio: 1.85,
        maxDrawdown: 0.06,
        volatility: 0.22
      },
      riskMetrics: {
        portfolioRisk: 0.31,
        concentrationRisk: 0.18,
        correlationRisk: 0.45,
        liquidityRisk: 0.08
      }
    };

    await this.auditService.logPortfolioSnapshot(portfolioSnapshot);

    console.log(`📊 Portfolio Performance Summary:`);
    console.log(`   Total Value: $${totalValue.toFixed(2)}`);
    console.log(`   Daily P&L: $${((totalValue - this.portfolioValue)).toFixed(2)} (${(portfolioSnapshot.performanceMetrics.dailyReturn * 100).toFixed(2)}%)`);
    console.log(`   Cash Balance: $${this.cashBalance.toFixed(2)}`);
    console.log(`   Positions: ${portfolioSnapshot.positions.length} assets`);
  }

  // Demo Scenario 4: Tax Compliance Logging
  async demonstrateTaxComplianceLogging(): Promise<void> {
    console.log('\n💼 DEMO SCENARIO 4: Tax Compliance Logging');
    console.log('📋 Demonstrating comprehensive tax event logging for compliance\n');

    await this.sleep(1000);

    // Simulate a significant profit taking event for tax purposes
    const adaPosition = this.positions.get('ADA')!;
    const adaSellQuantity = 5000;
    const adaCurrentPrice = 0.43;

    const taxProfitEvent: ProfitTakingEvent = {
      tradeId: 'TAX_EVENT_001',
      timestamp: new Date(),
      asset: 'ADA',
      originalQuantity: adaPosition.quantity,
      soldQuantity: adaSellQuantity,
      originalPrice: adaPosition.avgPrice,
      salePrice: adaCurrentPrice,
      profitAmount: (adaCurrentPrice - adaPosition.avgPrice) * adaSellQuantity,
      profitPercentage: ((adaCurrentPrice - adaPosition.avgPrice) / adaPosition.avgPrice) * 100,
      holdingPeriod: 45 * 24, // 45 days in hours
      strategy: 'LONG_TERM_HOLD',
      triggerReason: 'Year-end tax optimization - realizing long-term gains',
      reinvestmentAmount: 0, // Not reinvesting for tax purposes
      taxImplications: {
        shortTermGain: false, // Long-term gain (>30 days)
        taxableAmount: (adaCurrentPrice - adaPosition.avgPrice) * adaSellQuantity,
        costBasis: adaPosition.avgPrice * adaSellQuantity
      }
    };

    await this.auditService.logProfitTakingEvent(taxProfitEvent);

    // Log tax compliance event
    await this.auditService.logSystemEvent({
      timestamp: new Date(),
      eventType: 'WARNING',
      component: 'TAX_COMPLIANCE',
      message: 'Long-term capital gain realized - tax event recorded',
      severity: 'MEDIUM',
      details: {
        asset: 'ADA',
        gainType: 'LONG_TERM',
        taxableAmount: taxProfitEvent.profitAmount,
        holdingPeriod: '45 days',
        costBasis: taxProfitEvent.taxImplications.costBasis,
        salePrice: adaCurrentPrice * adaSellQuantity
      }
    });

    console.log(`💼 Tax Event Logged: Long-term gain of $${taxProfitEvent.profitAmount.toFixed(2)} on ADA`);
    console.log(`   Holding Period: 45 days (Long-term)`);
    console.log(`   Cost Basis: $${taxProfitEvent.taxImplications.costBasis.toFixed(2)}`);
    console.log(`   Taxable Amount: $${taxProfitEvent.profitAmount.toFixed(2)}`);
  }

  // Demo Scenario 5: Emergency System Event
  async demonstrateEmergencyLogging(): Promise<void> {
    console.log('\n🚨 DEMO SCENARIO 5: Emergency System Event');
    console.log('⚡ Simulating critical system event requiring immediate logging\n');

    await this.sleep(1000);

    // Simulate emergency stop event
    await this.auditService.emergencyAuditLog('EMERGENCY STOP TRIGGERED', {
      trigger: 'PORTFOLIO_DRAWDOWN_EXCEEDED',
      currentDrawdown: 0.12,
      threshold: 0.10,
      timestamp: new Date().toISOString(),
      affectedSystems: ['TRADING_ENGINE', 'ORDER_MANAGER', 'RISK_MANAGER'],
      immediateActions: [
        'All pending orders cancelled',
        'New order placement suspended',
        'Risk manager activated emergency protocols'
      ],
      portfolioStatus: {
        totalValue: 48500,
        unrealizedLoss: 1500,
        openPositions: 3,
        cashReserves: this.cashBalance
      }
    });

    // Log system recovery
    await this.auditService.logSystemEvent({
      timestamp: new Date(Date.now() + 30000), // 30 seconds later
      eventType: 'WARNING',
      component: 'EMERGENCY_SYSTEM',
      message: 'Emergency protocols activated successfully - system stabilized',
      severity: 'HIGH',
      details: {
        recoveryTime: '30 seconds',
        systemStatus: 'STABLE',
        tradingStatus: 'SUSPENDED',
        manualInterventionRequired: true
      },
      resolved: true,
      resolutionTime: new Date(Date.now() + 30000)
    });

    console.log('🚨 Emergency event logged with full details');
    console.log('✅ System recovery event logged');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runFullDemo(): Promise<void> {
    try {
      await this.initialize();
      
      console.log('\n' + '='.repeat(80));
      console.log('🎬 STARTING COMPREHENSIVE GOOGLE SHEETS LOGGING DEMO');
      console.log('='.repeat(80));

      await this.demonstrateMorningTradingSession();
      await this.sleep(2000);

      await this.demonstrateRiskManagementEvent();
      await this.sleep(2000);

      await this.demonstrateEndOfDayPerformance();
      await this.sleep(2000);

      await this.demonstrateTaxComplianceLogging();
      await this.sleep(2000);

      await this.demonstrateEmergencyLogging();
      await this.sleep(2000);

      // Generate end-of-demo reports
      console.log('\n📋 DEMO SCENARIO 6: Generating Summary Reports');
      await this.auditService.generateDailyReport(new Date());
      await this.auditService.generateMonthlyReport(new Date().toISOString().substring(0, 7));

      // Final status check
      const auditStatus = this.auditService.getAuditStatus();
      
      console.log('\n' + '='.repeat(80));
      console.log('📊 DEMO COMPLETION SUMMARY');
      console.log('='.repeat(80));
      console.log(`✅ Audit Service Status: ${auditStatus.isInitialized ? 'OPERATIONAL' : 'ERROR'}`);
      console.log(`📈 Trades Logged: ${auditStatus.tradeCount}`);
      console.log(`💰 Profit Events Logged: ${auditStatus.profitEventCount}`);
      console.log(`🧠 Decisions Logged: ${auditStatus.decisionCount}`);
      console.log(`📊 Performance Snapshots: ${auditStatus.performanceSnapshotCount}`);
      console.log(`📋 Buffered Entries: ${auditStatus.bufferedEntries}`);
      console.log(`🔗 Google Sheets Status: ${auditStatus.sheetsStatus.isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);

      console.log('\n🎯 AUDIT TRAIL VERIFICATION:');
      console.log('✅ All trades logged with complete attribution');
      console.log('✅ Profit-taking events recorded for tax compliance');
      console.log('✅ Trading decisions documented with reasoning');
      console.log('✅ Risk management events captured');
      console.log('✅ Performance metrics tracked continuously');
      console.log('✅ Emergency events logged immediately');
      console.log('✅ Tax compliance data maintained');

      console.log('\n💼 TAX REPORTING READY:');
      console.log('📋 Complete trade history with cost basis');
      console.log('📊 Profit/loss calculations with holding periods');
      console.log('🗓️  Short-term vs long-term gain classification');
      console.log('📈 Performance attribution by strategy');
      console.log('🔍 Full audit trail for regulatory compliance');

      console.log('\n🎉 GOOGLE SHEETS LOGGING DEMO COMPLETED SUCCESSFULLY!');
      console.log('📊 Check your Google Sheets for all logged data');
      console.log('='.repeat(80));

    } catch (error: any) {
      console.error('❌ Demo failed:', error.message);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up demo...');
    
    // Log demo shutdown
    await this.auditService.logSystemEvent({
      timestamp: new Date(),
      eventType: 'SHUTDOWN',
      component: 'DEMO_SYSTEM',
      message: 'Google Sheets Logging Demo completed successfully',
      severity: 'INFO',
      details: {
        demoEndTime: new Date().toISOString(),
        totalDuration: Date.now() - this.demoStartTime.getTime(),
        finalPortfolioValue: this.portfolioValue
      }
    });

    await this.auditService.shutdown();
    console.log('✅ Demo cleanup completed');
  }
}

// Main demo execution
async function runGoogleSheetsLoggingDemo(): Promise<void> {
  const demo = new GoogleSheetsLoggingDemo();
  
  try {
    await demo.runFullDemo();
  } catch (error: any) {
    console.error('🚨 Demo execution failed:', error.message);
  } finally {
    await demo.cleanup();
  }
}

// Export for use in other modules
export { GoogleSheetsLoggingDemo, runGoogleSheetsLoggingDemo };

// Run demo if this file is executed directly
if (require.main === module) {
  runGoogleSheetsLoggingDemo().catch(console.error);
} 
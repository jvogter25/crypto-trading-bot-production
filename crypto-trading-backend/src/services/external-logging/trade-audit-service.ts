import GoogleSheetsLogger, { 
  TradeLogEntry, 
  PerformanceLogEntry, 
  DecisionLogEntry, 
  SystemEventLogEntry,
  GoogleSheetsConfig 
} from './google-sheets-logger';
import { EventEmitter } from 'events';

export interface AuditConfig {
  googleSheets: GoogleSheetsConfig;
  enableRealTimeLogging: boolean;
  enablePerformanceTracking: boolean;
  enableDecisionLogging: boolean;
  enableSystemEventLogging: boolean;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  auditRetentionDays: number;
  complianceMode: boolean;
}

export interface TradeExecutionData {
  tradeId: string;
  timestamp: Date;
  asset: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fees: number;
  orderId?: string;
  exchangeOrderId?: string;
  strategy: string;
  reasoning: string;
  marketCondition: string;
  technicalIndicators: {
    rsi?: number;
    macd?: number;
    bollingerPosition?: string;
    volatility?: number;
  };
  portfolioContext: {
    totalValue: number;
    cashReserves: number;
    riskLevel: number;
    positionCount: number;
  };
  executionMetrics: {
    latency?: number;
    slippage?: number;
    fillRate?: number;
  };
}

export interface ProfitTakingEvent {
  tradeId: string;
  timestamp: Date;
  asset: string;
  originalQuantity: number;
  soldQuantity: number;
  originalPrice: number;
  salePrice: number;
  profitAmount: number;
  profitPercentage: number;
  holdingPeriod: number; // in hours
  strategy: string;
  triggerReason: string;
  reinvestmentAmount?: number;
  taxImplications: {
    shortTermGain: boolean;
    taxableAmount: number;
    costBasis: number;
  };
}

export interface PortfolioSnapshot {
  timestamp: Date;
  totalValue: number;
  cashBalance: number;
  positions: Array<{
    asset: string;
    quantity: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    allocation: number;
  }>;
  performanceMetrics: {
    dailyReturn: number;
    weeklyReturn: number;
    monthlyReturn: number;
    yearToDateReturn: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
  };
  riskMetrics: {
    portfolioRisk: number;
    concentrationRisk: number;
    correlationRisk: number;
    liquidityRisk: number;
  };
}

export interface TradingDecision {
  timestamp: Date;
  decisionId: string;
  type: 'ENTRY' | 'EXIT' | 'HOLD' | 'REBALANCE' | 'RISK_REDUCTION';
  asset?: string;
  signal: string;
  confidence: number;
  reasoning: string;
  marketAnalysis: {
    technicalSignals: string[];
    sentimentScore?: number;
    volumeAnalysis?: string;
    priceAction?: string;
  };
  riskAssessment: {
    positionSize: number;
    riskReward: number;
    stopLoss?: number;
    takeProfit?: number;
  };
  executed: boolean;
  executionDelay?: number;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'CANCELLED';
}

export class TradeAuditService extends EventEmitter {
  private config: AuditConfig;
  private googleSheetsLogger: GoogleSheetsLogger;
  private isInitialized: boolean = false;
  private auditBuffer: Map<string, any[]> = new Map();
  private performanceHistory: PortfolioSnapshot[] = [];
  private tradeHistory: TradeExecutionData[] = [];
  private profitTakingHistory: ProfitTakingEvent[] = [];
  private decisionHistory: TradingDecision[] = [];

  // Performance tracking
  private dailyStats: Map<string, any> = new Map();
  private monthlyStats: Map<string, any> = new Map();
  private yearlyStats: Map<string, any> = new Map();

  constructor(config: AuditConfig) {
    super();
    this.config = config;
    this.googleSheetsLogger = new GoogleSheetsLogger(config.googleSheets);
    
    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.googleSheetsLogger.on('connected', () => {
      console.log('📊 Trade Audit Service: Google Sheets connected');
      this.emit('sheetsConnected');
    });

    this.googleSheetsLogger.on('connectionError', (error) => {
      console.error('📊 Trade Audit Service: Google Sheets connection error:', error);
      this.emit('sheetsConnectionError', error);
    });

    this.googleSheetsLogger.on('tradeLogged', (entry) => {
      this.emit('tradeAudited', entry);
    });

    this.googleSheetsLogger.on('batchProcessed', (count) => {
      console.log(`📊 Trade Audit Service: Processed batch of ${count} entries`);
      this.emit('batchAudited', count);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📊 Trade Audit Service already initialized');
      return;
    }

    console.log('📊 Initializing Trade Audit Service...');

    try {
      // Initialize Google Sheets logger
      await this.googleSheetsLogger.initialize();

      // Log system startup
      await this.logSystemEvent({
        timestamp: new Date(),
        eventType: 'STARTUP',
        component: 'TradeAuditService',
        message: 'Trade Audit Service initialized successfully',
        severity: 'INFO'
      });

      this.isInitialized = true;
      console.log('📊 Trade Audit Service initialized successfully');
      this.emit('initialized');

    } catch (error: any) {
      console.error('📊 Failed to initialize Trade Audit Service:', error.message);
      throw error;
    }
  }

  // Trade Execution Logging
  async logTradeExecution(tradeData: TradeExecutionData): Promise<void> {
    if (!this.isInitialized) {
      console.warn('📊 Trade Audit Service not initialized, buffering trade...');
      this.bufferAuditEntry('trades', tradeData);
      return;
    }

    try {
      // Calculate profit/loss for sell orders
      let profitLoss = 0;
      if (tradeData.action === 'SELL') {
        // This would typically look up the original buy price
        // For now, we'll use a placeholder calculation
        profitLoss = 0; // Would be calculated based on cost basis
      }

      const tradeLogEntry: TradeLogEntry = {
        timestamp: tradeData.timestamp,
        tradeId: tradeData.tradeId,
        asset: tradeData.asset,
        action: tradeData.action,
        quantity: tradeData.quantity,
        price: tradeData.price,
        totalValue: tradeData.quantity * tradeData.price,
        fees: tradeData.fees,
        profitLoss: profitLoss,
        strategy: tradeData.strategy,
        marketCondition: tradeData.marketCondition,
        reasoning: tradeData.reasoning,
        portfolioValue: tradeData.portfolioContext.totalValue,
        cashReserves: tradeData.portfolioContext.cashReserves,
        riskLevel: tradeData.portfolioContext.riskLevel,
        technicalIndicators: tradeData.technicalIndicators,
        executionLatency: tradeData.executionMetrics.latency,
        orderId: tradeData.orderId,
        exchangeOrderId: tradeData.exchangeOrderId
      };

      await this.googleSheetsLogger.logTrade(tradeLogEntry);
      
      // Store in local history
      this.tradeHistory.push(tradeData);
      
      // Update daily statistics
      this.updateDailyStats(tradeData);

      console.log(`📊 Trade execution logged: ${tradeData.action} ${tradeData.quantity} ${tradeData.asset} at $${tradeData.price}`);
      this.emit('tradeExecutionLogged', tradeData);

    } catch (error: any) {
      console.error('📊 Failed to log trade execution:', error.message);
      this.bufferAuditEntry('trades', tradeData);
      throw error;
    }
  }

  // Profit Taking Event Logging
  async logProfitTakingEvent(profitEvent: ProfitTakingEvent): Promise<void> {
    if (!this.isInitialized) {
      console.warn('📊 Trade Audit Service not initialized, buffering profit event...');
      this.bufferAuditEntry('profits', profitEvent);
      return;
    }

    try {
      const tradeLogEntry: TradeLogEntry = {
        timestamp: profitEvent.timestamp,
        tradeId: profitEvent.tradeId,
        asset: profitEvent.asset,
        action: 'PROFIT_TAKING',
        quantity: profitEvent.soldQuantity,
        price: profitEvent.salePrice,
        totalValue: profitEvent.soldQuantity * profitEvent.salePrice,
        fees: 0, // Would be calculated
        profitLoss: profitEvent.profitAmount,
        strategy: profitEvent.strategy,
        marketCondition: 'PROFIT_TARGET_HIT',
        reasoning: `${profitEvent.triggerReason} - ${profitEvent.profitPercentage.toFixed(2)}% profit after ${profitEvent.holdingPeriod}h`,
        portfolioValue: 0, // Would be provided
        cashReserves: 0,   // Would be provided
        riskLevel: 0,      // Would be provided
        technicalIndicators: {}
      };

      await this.googleSheetsLogger.logTrade(tradeLogEntry);
      
      // Store in local history
      this.profitTakingHistory.push(profitEvent);

      // Log tax implications if in compliance mode
      if (this.config.complianceMode) {
        await this.logTaxEvent(profitEvent);
      }

      console.log(`📊 Profit taking logged: ${profitEvent.profitPercentage.toFixed(2)}% profit on ${profitEvent.asset}`);
      this.emit('profitTakingLogged', profitEvent);

    } catch (error: any) {
      console.error('📊 Failed to log profit taking event:', error.message);
      this.bufferAuditEntry('profits', profitEvent);
      throw error;
    }
  }

  // Trading Decision Logging
  async logTradingDecision(decision: TradingDecision): Promise<void> {
    if (!this.config.enableDecisionLogging) return;

    if (!this.isInitialized) {
      console.warn('📊 Trade Audit Service not initialized, buffering decision...');
      this.bufferAuditEntry('decisions', decision);
      return;
    }

    try {
      const decisionLogEntry: DecisionLogEntry = {
        timestamp: decision.timestamp,
        decisionType: 'TRADE_SIGNAL',
        asset: decision.asset,
        decision: decision.signal,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        marketData: {
          price: 0, // Would be provided
          volume: 0, // Would be provided
          volatility: 0, // Would be provided
          sentiment: decision.marketAnalysis.sentimentScore
        },
        riskMetrics: {
          portfolioExposure: 0, // Would be calculated
          assetExposure: decision.riskAssessment.positionSize,
          correlationRisk: 0, // Would be calculated
          liquidityRisk: 0 // Would be calculated
        },
        outcome: decision.outcome,
        executed: decision.executed
      };

      await this.googleSheetsLogger.logDecision(decisionLogEntry);
      
      // Store in local history
      this.decisionHistory.push(decision);

      console.log(`📊 Trading decision logged: ${decision.signal} for ${decision.asset || 'portfolio'}`);
      this.emit('tradingDecisionLogged', decision);

    } catch (error: any) {
      console.error('📊 Failed to log trading decision:', error.message);
      this.bufferAuditEntry('decisions', decision);
      throw error;
    }
  }

  // Portfolio Performance Logging
  async logPortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    if (!this.config.enablePerformanceTracking) return;

    if (!this.isInitialized) {
      console.warn('📊 Trade Audit Service not initialized, buffering snapshot...');
      this.bufferAuditEntry('snapshots', snapshot);
      return;
    }

    try {
      const performanceLogEntry: PerformanceLogEntry = {
        timestamp: snapshot.timestamp,
        totalPortfolioValue: snapshot.totalValue,
        totalProfitLoss: snapshot.totalValue - 10000, // Would calculate from initial investment
        dailyReturn: snapshot.performanceMetrics.dailyReturn,
        weeklyReturn: snapshot.performanceMetrics.weeklyReturn,
        monthlyReturn: snapshot.performanceMetrics.monthlyReturn,
        sharpeRatio: snapshot.performanceMetrics.sharpeRatio,
        maxDrawdown: snapshot.performanceMetrics.maxDrawdown,
        winRate: 0, // Would be calculated from trade history
        totalTrades: this.tradeHistory.length,
        successfulTrades: 0, // Would be calculated
        averageTradeSize: 0, // Would be calculated
        largestWin: 0, // Would be calculated
        largestLoss: 0, // Would be calculated
        currentPositions: snapshot.positions.length,
        cashPercentage: (snapshot.cashBalance / snapshot.totalValue) * 100,
        riskScore: snapshot.riskMetrics.portfolioRisk
      };

      await this.googleSheetsLogger.logPerformance(performanceLogEntry);
      
      // Store in local history
      this.performanceHistory.push(snapshot);

      // Update monthly statistics
      this.updateMonthlyStats(snapshot);

      console.log(`📊 Portfolio snapshot logged: $${snapshot.totalValue.toFixed(2)} total value`);
      this.emit('portfolioSnapshotLogged', snapshot);

    } catch (error: any) {
      console.error('📊 Failed to log portfolio snapshot:', error.message);
      this.bufferAuditEntry('snapshots', snapshot);
      throw error;
    }
  }

  // System Event Logging
  async logSystemEvent(event: SystemEventLogEntry): Promise<void> {
    if (!this.config.enableSystemEventLogging) return;

    try {
      await this.googleSheetsLogger.logSystemEvent(event);
      
      console.log(`📊 System event logged: ${event.eventType} - ${event.message}`);
      this.emit('systemEventLogged', event);

    } catch (error: any) {
      console.error('📊 Failed to log system event:', error.message);
      // For system events, we'll try to buffer them
      this.bufferAuditEntry('events', event);
    }
  }

  // Tax Compliance Logging
  private async logTaxEvent(profitEvent: ProfitTakingEvent): Promise<void> {
    const taxLogEntry: DecisionLogEntry = {
      timestamp: profitEvent.timestamp,
      decisionType: 'TRADE_SIGNAL',
      asset: profitEvent.asset,
      decision: 'TAX_EVENT',
      reasoning: `Realized ${profitEvent.taxImplications.shortTermGain ? 'short-term' : 'long-term'} capital gain`,
      confidence: 1.0,
      marketData: {
        price: profitEvent.salePrice
      },
      riskMetrics: {
        portfolioExposure: 0,
        assetExposure: 0,
        correlationRisk: 0,
        liquidityRisk: 0
      },
      executed: true
    };

    await this.googleSheetsLogger.logDecision(taxLogEntry);
    console.log(`📊 Tax event logged: ${profitEvent.taxImplications.shortTermGain ? 'Short' : 'Long'}-term gain of $${profitEvent.profitAmount.toFixed(2)}`);
  }

  // Buffer Management
  private bufferAuditEntry(type: string, data: any): void {
    if (!this.auditBuffer.has(type)) {
      this.auditBuffer.set(type, []);
    }
    this.auditBuffer.get(type)!.push(data);
    
    console.log(`📊 Buffered ${type} entry (${this.auditBuffer.get(type)!.length} total buffered)`);
  }

  private async processBufferedEntries(): Promise<void> {
    if (this.auditBuffer.size === 0) return;

    console.log('📊 Processing buffered audit entries...');

    for (const [type, entries] of this.auditBuffer) {
      for (const entry of entries) {
        try {
          switch (type) {
            case 'trades':
              await this.logTradeExecution(entry);
              break;
            case 'profits':
              await this.logProfitTakingEvent(entry);
              break;
            case 'decisions':
              await this.logTradingDecision(entry);
              break;
            case 'snapshots':
              await this.logPortfolioSnapshot(entry);
              break;
            case 'events':
              await this.logSystemEvent(entry);
              break;
          }
        } catch (error: any) {
          console.error(`📊 Failed to process buffered ${type} entry:`, error.message);
        }
      }
    }

    // Clear processed entries
    this.auditBuffer.clear();
    console.log('📊 Buffered audit entries processed');
  }

  // Statistics Updates
  private updateDailyStats(tradeData: TradeExecutionData): void {
    const dateKey = tradeData.timestamp.toISOString().split('T')[0];
    
    if (!this.dailyStats.has(dateKey)) {
      this.dailyStats.set(dateKey, {
        date: dateKey,
        trades: 0,
        volume: 0,
        fees: 0,
        buyOrders: 0,
        sellOrders: 0,
        assets: new Set()
      });
    }

    const stats = this.dailyStats.get(dateKey)!;
    stats.trades++;
    stats.volume += tradeData.quantity * tradeData.price;
    stats.fees += tradeData.fees;
    stats.assets.add(tradeData.asset);
    
    if (tradeData.action === 'BUY') {
      stats.buyOrders++;
    } else {
      stats.sellOrders++;
    }
  }

  private updateMonthlyStats(snapshot: PortfolioSnapshot): void {
    const monthKey = snapshot.timestamp.toISOString().substring(0, 7); // YYYY-MM
    
    if (!this.monthlyStats.has(monthKey)) {
      this.monthlyStats.set(monthKey, {
        month: monthKey,
        startValue: snapshot.totalValue,
        endValue: snapshot.totalValue,
        maxValue: snapshot.totalValue,
        minValue: snapshot.totalValue,
        snapshots: 0
      });
    }

    const stats = this.monthlyStats.get(monthKey)!;
    stats.endValue = snapshot.totalValue;
    stats.maxValue = Math.max(stats.maxValue, snapshot.totalValue);
    stats.minValue = Math.min(stats.minValue, snapshot.totalValue);
    stats.snapshots++;
  }

  // Reporting Methods
  async generateDailyReport(date: Date): Promise<void> {
    try {
      await this.googleSheetsLogger.generateDailySummary(date);
      console.log(`📊 Daily report generated for ${date.toISOString().split('T')[0]}`);
    } catch (error: any) {
      console.error('📊 Failed to generate daily report:', error.message);
    }
  }

  async generateMonthlyReport(month: string): Promise<void> {
    try {
      await this.googleSheetsLogger.generateMonthlySummary(month);
      console.log(`📊 Monthly report generated for ${month}`);
    } catch (error: any) {
      console.error('📊 Failed to generate monthly report:', error.message);
    }
  }

  // Emergency Logging
  async emergencyAuditLog(message: string, details?: any): Promise<void> {
    try {
      await this.googleSheetsLogger.emergencyLog(message, details);
      console.log(`📊 Emergency audit log recorded: ${message}`);
    } catch (error: any) {
      console.error('📊 Failed to record emergency audit log:', error.message);
    }
  }

  // Status and Health Methods
  getAuditStatus(): {
    isInitialized: boolean;
    sheetsStatus: any;
    bufferedEntries: number;
    tradeCount: number;
    profitEventCount: number;
    decisionCount: number;
    performanceSnapshotCount: number;
  } {
    return {
      isInitialized: this.isInitialized,
      sheetsStatus: this.googleSheetsLogger.getConnectionStatus(),
      bufferedEntries: Array.from(this.auditBuffer.values()).reduce((sum, arr) => sum + arr.length, 0),
      tradeCount: this.tradeHistory.length,
      profitEventCount: this.profitTakingHistory.length,
      decisionCount: this.decisionHistory.length,
      performanceSnapshotCount: this.performanceHistory.length
    };
  }

  async validateAuditIntegrity(): Promise<boolean> {
    try {
      const sheetsConnected = await this.googleSheetsLogger.validateConnection();
      const hasBufferedEntries = this.auditBuffer.size > 0;
      
      if (hasBufferedEntries) {
        console.warn('📊 Audit integrity warning: Buffered entries detected');
        await this.processBufferedEntries();
      }

      return sheetsConnected && this.isInitialized;
    } catch (error: any) {
      console.error('📊 Audit integrity validation failed:', error.message);
      return false;
    }
  }

  async flushAuditBuffer(): Promise<void> {
    if (this.auditBuffer.size > 0) {
      console.log('📊 Flushing audit buffer...');
      await this.processBufferedEntries();
    }
    
    await this.googleSheetsLogger.flushPendingLogs();
  }

  async shutdown(): Promise<void> {
    console.log('📊 Shutting down Trade Audit Service...');

    // Process any buffered entries
    await this.flushAuditBuffer();

    // Log shutdown event
    await this.logSystemEvent({
      timestamp: new Date(),
      eventType: 'SHUTDOWN',
      component: 'TradeAuditService',
      message: 'Trade Audit Service shutting down',
      severity: 'INFO'
    });

    // Shutdown Google Sheets logger
    await this.googleSheetsLogger.shutdown();

    this.isInitialized = false;
    this.auditBuffer.clear();
    
    this.emit('shutdown');
    console.log('📊 Trade Audit Service shutdown complete');
  }
}

export default TradeAuditService; 
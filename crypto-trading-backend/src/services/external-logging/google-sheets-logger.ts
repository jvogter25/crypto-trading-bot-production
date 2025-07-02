import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { EventEmitter } from 'events';

export interface GoogleSheetsConfig {
  serviceAccountEmail: string;
  privateKey: string;
  spreadsheetId: string;
  enableBatchLogging: boolean;
  batchSize: number;
  batchInterval: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface TradeLogEntry {
  timestamp: Date;
  tradeId: string;
  asset: string;
  action: 'BUY' | 'SELL' | 'PROFIT_TAKING' | 'STOP_LOSS' | 'GRID_ORDER';
  quantity: number;
  price: number;
  totalValue: number;
  fees: number;
  profitLoss?: number;
  strategy: string;
  marketCondition: string;
  reasoning: string;
  portfolioValue: number;
  cashReserves: number;
  riskLevel: number;
  technicalIndicators: {
    rsi?: number;
    macd?: number;
    bollingerPosition?: string;
    volatility?: number;
  };
  executionLatency?: number;
  orderId?: string;
  exchangeOrderId?: string;
}

export interface PerformanceLogEntry {
  timestamp: Date;
  totalPortfolioValue: number;
  totalProfitLoss: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  successfulTrades: number;
  averageTradeSize: number;
  largestWin: number;
  largestLoss: number;
  currentPositions: number;
  cashPercentage: number;
  riskScore: number;
}

export interface DecisionLogEntry {
  timestamp: Date;
  decisionType: 'TRADE_SIGNAL' | 'RISK_ADJUSTMENT' | 'PORTFOLIO_REBALANCE' | 'EMERGENCY_STOP' | 'STRATEGY_CHANGE';
  asset?: string;
  decision: string;
  reasoning: string;
  confidence: number;
  marketData: {
    price?: number;
    volume?: number;
    volatility?: number;
    sentiment?: number;
  };
  riskMetrics: {
    portfolioExposure: number;
    assetExposure: number;
    correlationRisk: number;
    liquidityRisk: number;
  };
  outcome?: string;
  executed: boolean;
}

export interface SystemEventLogEntry {
  timestamp: Date;
  eventType: 'STARTUP' | 'SHUTDOWN' | 'ERROR' | 'WARNING' | 'CONNECTION_LOST' | 'CONNECTION_RESTORED' | 'API_LIMIT' | 'MAINTENANCE';
  component: string;
  message: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: any;
  resolved?: boolean;
  resolutionTime?: Date;
}

export class GoogleSheetsLogger extends EventEmitter {
  private config: GoogleSheetsConfig;
  private doc: GoogleSpreadsheet | null = null;
  private isConnected: boolean = false;
  private pendingLogs: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private worksheets: Map<string, GoogleSpreadsheetWorksheet> = new Map();
  private lastLogTime: Map<string, number> = new Map();
  private connectionRetries: number = 0;
  private isInitialized: boolean = false;

  // Worksheet names
  private readonly TRADES_SHEET = 'Trades';
  private readonly PERFORMANCE_SHEET = 'Performance';
  private readonly DECISIONS_SHEET = 'Decisions';
  private readonly SYSTEM_EVENTS_SHEET = 'System_Events';
  private readonly DAILY_SUMMARY_SHEET = 'Daily_Summary';
  private readonly MONTHLY_SUMMARY_SHEET = 'Monthly_Summary';

  constructor(config: GoogleSheetsConfig) {
    super();
    
    this.config = {
      enableBatchLogging: true,
      batchSize: 50,
      batchInterval: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 5000,
      ...config
    };

    this.setupBatchLogging();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📊 Google Sheets Logger already initialized');
      return;
    }

    console.log('📊 Initializing Google Sheets Logger...');

    try {
      // Create JWT auth
      const serviceAccountAuth = new JWT({
        email: this.config.serviceAccountEmail,
        key: this.config.privateKey.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      // Initialize document
      this.doc = new GoogleSpreadsheet(this.config.spreadsheetId, serviceAccountAuth);
      await this.doc.loadInfo();

      console.log(`📊 Connected to spreadsheet: ${this.doc.title}`);

      // Initialize worksheets
      await this.initializeWorksheets();

      this.isConnected = true;
      this.isInitialized = true;
      this.connectionRetries = 0;

      this.emit('connected');
      console.log('📊 Google Sheets Logger initialized successfully');

    } catch (error: any) {
      console.error('📊 Failed to initialize Google Sheets Logger:', error.message);
      this.isConnected = false;
      this.emit('connectionError', error);
      throw error;
    }
  }

  private async initializeWorksheets(): Promise<void> {
    if (!this.doc) throw new Error('Document not initialized');

    const requiredSheets = [
      this.TRADES_SHEET,
      this.PERFORMANCE_SHEET,
      this.DECISIONS_SHEET,
      this.SYSTEM_EVENTS_SHEET,
      this.DAILY_SUMMARY_SHEET,
      this.MONTHLY_SUMMARY_SHEET
    ];

    for (const sheetName of requiredSheets) {
      let worksheet = this.doc.sheetsByTitle[sheetName];
      
      if (!worksheet) {
        console.log(`📊 Creating worksheet: ${sheetName}`);
        worksheet = await this.doc.addSheet({ title: sheetName });
        await this.setupWorksheetHeaders(worksheet, sheetName);
      }

      this.worksheets.set(sheetName, worksheet);
    }
  }

  private async setupWorksheetHeaders(worksheet: GoogleSpreadsheetWorksheet, sheetName: string): Promise<void> {
    let headers: string[] = [];

    switch (sheetName) {
      case this.TRADES_SHEET:
        headers = [
          'Timestamp', 'Trade_ID', 'Asset', 'Action', 'Quantity', 'Price', 'Total_Value',
          'Fees', 'Profit_Loss', 'Strategy', 'Market_Condition', 'Reasoning',
          'Portfolio_Value', 'Cash_Reserves', 'Risk_Level', 'RSI', 'MACD',
          'Bollinger_Position', 'Volatility', 'Execution_Latency', 'Order_ID', 'Exchange_Order_ID'
        ];
        break;

      case this.PERFORMANCE_SHEET:
        headers = [
          'Timestamp', 'Total_Portfolio_Value', 'Total_Profit_Loss', 'Daily_Return',
          'Weekly_Return', 'Monthly_Return', 'Sharpe_Ratio', 'Max_Drawdown',
          'Win_Rate', 'Total_Trades', 'Successful_Trades', 'Average_Trade_Size',
          'Largest_Win', 'Largest_Loss', 'Current_Positions', 'Cash_Percentage', 'Risk_Score'
        ];
        break;

      case this.DECISIONS_SHEET:
        headers = [
          'Timestamp', 'Decision_Type', 'Asset', 'Decision', 'Reasoning', 'Confidence',
          'Market_Price', 'Market_Volume', 'Market_Volatility', 'Market_Sentiment',
          'Portfolio_Exposure', 'Asset_Exposure', 'Correlation_Risk', 'Liquidity_Risk',
          'Outcome', 'Executed'
        ];
        break;

      case this.SYSTEM_EVENTS_SHEET:
        headers = [
          'Timestamp', 'Event_Type', 'Component', 'Message', 'Severity',
          'Details', 'Resolved', 'Resolution_Time'
        ];
        break;

      case this.DAILY_SUMMARY_SHEET:
        headers = [
          'Date', 'Starting_Value', 'Ending_Value', 'Daily_Return', 'Total_Trades',
          'Winning_Trades', 'Losing_Trades', 'Win_Rate', 'Largest_Win', 'Largest_Loss',
          'Total_Fees', 'Net_Profit_Loss', 'Risk_Score', 'Max_Drawdown', 'Volatility'
        ];
        break;

      case this.MONTHLY_SUMMARY_SHEET:
        headers = [
          'Month', 'Starting_Value', 'Ending_Value', 'Monthly_Return', 'Total_Trades',
          'Win_Rate', 'Sharpe_Ratio', 'Max_Drawdown', 'Total_Fees', 'Net_Profit_Loss',
          'Best_Day', 'Worst_Day', 'Average_Daily_Return', 'Volatility', 'Risk_Score'
        ];
        break;
    }

    if (headers.length > 0) {
      await worksheet.setHeaderRow(headers);
      console.log(`📊 Set headers for ${sheetName}: ${headers.length} columns`);
    }
  }

  private setupBatchLogging(): void {
    if (this.config.enableBatchLogging) {
      this.batchTimer = setInterval(() => {
        this.processPendingLogs();
      }, this.config.batchInterval);
    }
  }

  // Trade Logging Methods
  async logTrade(entry: TradeLogEntry): Promise<void> {
    const logData = {
      worksheet: this.TRADES_SHEET,
      data: [
        entry.timestamp.toISOString(),
        entry.tradeId,
        entry.asset,
        entry.action,
        entry.quantity,
        entry.price,
        entry.totalValue,
        entry.fees,
        entry.profitLoss || 0,
        entry.strategy,
        entry.marketCondition,
        entry.reasoning,
        entry.portfolioValue,
        entry.cashReserves,
        entry.riskLevel,
        entry.technicalIndicators.rsi || '',
        entry.technicalIndicators.macd || '',
        entry.technicalIndicators.bollingerPosition || '',
        entry.technicalIndicators.volatility || '',
        entry.executionLatency || '',
        entry.orderId || '',
        entry.exchangeOrderId || ''
      ]
    };

    await this.addLogEntry(logData);
    this.emit('tradeLogged', entry);
    
    console.log(`📊 Trade logged: ${entry.action} ${entry.quantity} ${entry.asset} at $${entry.price}`);
  }

  async logPerformance(entry: PerformanceLogEntry): Promise<void> {
    const logData = {
      worksheet: this.PERFORMANCE_SHEET,
      data: [
        entry.timestamp.toISOString(),
        entry.totalPortfolioValue,
        entry.totalProfitLoss,
        entry.dailyReturn,
        entry.weeklyReturn,
        entry.monthlyReturn,
        entry.sharpeRatio,
        entry.maxDrawdown,
        entry.winRate,
        entry.totalTrades,
        entry.successfulTrades,
        entry.averageTradeSize,
        entry.largestWin,
        entry.largestLoss,
        entry.currentPositions,
        entry.cashPercentage,
        entry.riskScore
      ]
    };

    await this.addLogEntry(logData);
    this.emit('performanceLogged', entry);
    
    console.log(`📊 Performance logged: Portfolio $${entry.totalPortfolioValue.toFixed(2)}, P&L: $${entry.totalProfitLoss.toFixed(2)}`);
  }

  async logDecision(entry: DecisionLogEntry): Promise<void> {
    const logData = {
      worksheet: this.DECISIONS_SHEET,
      data: [
        entry.timestamp.toISOString(),
        entry.decisionType,
        entry.asset || '',
        entry.decision,
        entry.reasoning,
        entry.confidence,
        entry.marketData.price || '',
        entry.marketData.volume || '',
        entry.marketData.volatility || '',
        entry.marketData.sentiment || '',
        entry.riskMetrics.portfolioExposure,
        entry.riskMetrics.assetExposure,
        entry.riskMetrics.correlationRisk,
        entry.riskMetrics.liquidityRisk,
        entry.outcome || '',
        entry.executed
      ]
    };

    await this.addLogEntry(logData);
    this.emit('decisionLogged', entry);
    
    console.log(`📊 Decision logged: ${entry.decisionType} - ${entry.decision}`);
  }

  async logSystemEvent(entry: SystemEventLogEntry): Promise<void> {
    const logData = {
      worksheet: this.SYSTEM_EVENTS_SHEET,
      data: [
        entry.timestamp.toISOString(),
        entry.eventType,
        entry.component,
        entry.message,
        entry.severity,
        entry.details ? JSON.stringify(entry.details) : '',
        entry.resolved || false,
        entry.resolutionTime ? entry.resolutionTime.toISOString() : ''
      ]
    };

    await this.addLogEntry(logData);
    this.emit('systemEventLogged', entry);
    
    console.log(`📊 System event logged: ${entry.eventType} - ${entry.severity} - ${entry.message}`);
  }

  private async addLogEntry(logData: { worksheet: string; data: any[] }): Promise<void> {
    if (this.config.enableBatchLogging) {
      this.pendingLogs.push(logData);
      
      if (this.pendingLogs.length >= this.config.batchSize) {
        await this.processPendingLogs();
      }
    } else {
      await this.writeToSheet(logData.worksheet, [logData.data]);
    }
  }

  private async processPendingLogs(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToProcess = [...this.pendingLogs];
    this.pendingLogs = [];

    // Group logs by worksheet
    const logsByWorksheet = new Map<string, any[][]>();
    
    for (const log of logsToProcess) {
      if (!logsByWorksheet.has(log.worksheet)) {
        logsByWorksheet.set(log.worksheet, []);
      }
      logsByWorksheet.get(log.worksheet)!.push(log.data);
    }

    // Write to each worksheet
    for (const [worksheet, rows] of logsByWorksheet) {
      try {
        await this.writeToSheet(worksheet, rows);
        console.log(`📊 Batch logged ${rows.length} entries to ${worksheet}`);
      } catch (error: any) {
        console.error(`📊 Failed to batch log to ${worksheet}:`, error.message);
        // Re-add failed logs to pending queue
        for (const row of rows) {
          this.pendingLogs.push({ worksheet, data: row });
        }
      }
    }

    this.emit('batchProcessed', logsToProcess.length);
  }

  private async writeToSheet(worksheetName: string, rows: any[][]): Promise<void> {
    if (!this.isConnected) {
      console.warn('📊 Not connected to Google Sheets, queuing logs...');
      for (const row of rows) {
        this.pendingLogs.push({ worksheet: worksheetName, data: row });
      }
      await this.reconnect();
      return;
    }

    try {
      const worksheet = this.worksheets.get(worksheetName);
      if (!worksheet) {
        throw new Error(`Worksheet ${worksheetName} not found`);
      }

      await worksheet.addRows(rows);
      this.lastLogTime.set(worksheetName, Date.now());
      
    } catch (error: any) {
      console.error(`📊 Error writing to ${worksheetName}:`, error.message);
      
      if (error.message.includes('quota') || error.message.includes('rate')) {
        console.warn('📊 Rate limit hit, queuing logs for retry...');
        for (const row of rows) {
          this.pendingLogs.push({ worksheet: worksheetName, data: row });
        }
        await this.handleRateLimit();
      } else {
        this.isConnected = false;
        this.emit('connectionError', error);
        await this.reconnect();
      }
    }
  }

  private async handleRateLimit(): Promise<void> {
    console.log('📊 Handling rate limit, waiting 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    this.emit('rateLimitHandled');
  }

  private async reconnect(): Promise<void> {
    if (this.connectionRetries >= this.config.retryAttempts) {
      console.error('📊 Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.connectionRetries++;
    const delay = this.config.retryDelay * Math.pow(2, this.connectionRetries - 1);
    
    console.log(`📊 Attempting to reconnect (${this.connectionRetries}/${this.config.retryAttempts}) in ${delay}ms...`);
    
    setTimeout(async () => {
      try {
        await this.initialize();
        console.log('📊 Reconnected successfully');
        
        // Process any pending logs
        if (this.pendingLogs.length > 0) {
          console.log(`📊 Processing ${this.pendingLogs.length} queued logs...`);
          await this.processPendingLogs();
        }
        
      } catch (error) {
        console.error('📊 Reconnection failed:', error);
        await this.reconnect();
      }
    }, delay);
  }

  // Summary and Reporting Methods
  async generateDailySummary(date: Date): Promise<void> {
    if (!this.isConnected) {
      console.warn('📊 Cannot generate daily summary - not connected');
      return;
    }

    try {
      // This would typically aggregate data from the trades sheet
      // For now, we'll create a placeholder entry
      const summary = {
        date: date.toISOString().split('T')[0],
        startingValue: 0, // Would be calculated from data
        endingValue: 0,   // Would be calculated from data
        dailyReturn: 0,   // Would be calculated from data
        totalTrades: 0,   // Would be calculated from data
        winningTrades: 0, // Would be calculated from data
        losingTrades: 0,  // Would be calculated from data
        winRate: 0,       // Would be calculated from data
        largestWin: 0,    // Would be calculated from data
        largestLoss: 0,   // Would be calculated from data
        totalFees: 0,     // Would be calculated from data
        netProfitLoss: 0, // Would be calculated from data
        riskScore: 0,     // Would be calculated from data
        maxDrawdown: 0,   // Would be calculated from data
        volatility: 0     // Would be calculated from data
      };

      await this.writeToSheet(this.DAILY_SUMMARY_SHEET, [Object.values(summary)]);
      console.log(`📊 Daily summary generated for ${summary.date}`);
      
    } catch (error: any) {
      console.error('📊 Failed to generate daily summary:', error.message);
    }
  }

  async generateMonthlySummary(month: string): Promise<void> {
    if (!this.isConnected) {
      console.warn('📊 Cannot generate monthly summary - not connected');
      return;
    }

    try {
      // This would typically aggregate data from daily summaries
      // For now, we'll create a placeholder entry
      const summary = {
        month: month,
        startingValue: 0,     // Would be calculated from data
        endingValue: 0,       // Would be calculated from data
        monthlyReturn: 0,     // Would be calculated from data
        totalTrades: 0,       // Would be calculated from data
        winRate: 0,           // Would be calculated from data
        sharpeRatio: 0,       // Would be calculated from data
        maxDrawdown: 0,       // Would be calculated from data
        totalFees: 0,         // Would be calculated from data
        netProfitLoss: 0,     // Would be calculated from data
        bestDay: '',          // Would be calculated from data
        worstDay: '',         // Would be calculated from data
        averageDailyReturn: 0, // Would be calculated from data
        volatility: 0,        // Would be calculated from data
        riskScore: 0          // Would be calculated from data
      };

      await this.writeToSheet(this.MONTHLY_SUMMARY_SHEET, [Object.values(summary)]);
      console.log(`📊 Monthly summary generated for ${summary.month}`);
      
    } catch (error: any) {
      console.error('📊 Failed to generate monthly summary:', error.message);
    }
  }

  // Utility Methods
  getConnectionStatus(): {
    isConnected: boolean;
    isInitialized: boolean;
    pendingLogs: number;
    connectionRetries: number;
    lastLogTimes: Map<string, number>;
  } {
    return {
      isConnected: this.isConnected,
      isInitialized: this.isInitialized,
      pendingLogs: this.pendingLogs.length,
      connectionRetries: this.connectionRetries,
      lastLogTimes: new Map(this.lastLogTime)
    };
  }

  async validateConnection(): Promise<boolean> {
    try {
      if (!this.doc) return false;
      await this.doc.loadInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  async flushPendingLogs(): Promise<void> {
    if (this.pendingLogs.length > 0) {
      console.log(`📊 Flushing ${this.pendingLogs.length} pending logs...`);
      await this.processPendingLogs();
    }
  }

  async shutdown(): Promise<void> {
    console.log('📊 Shutting down Google Sheets Logger...');
    
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Flush any pending logs
    await this.flushPendingLogs();

    this.isConnected = false;
    this.isInitialized = false;
    this.worksheets.clear();
    this.lastLogTime.clear();
    
    this.emit('shutdown');
    console.log('📊 Google Sheets Logger shutdown complete');
  }

  // Emergency logging method for critical events
  async emergencyLog(message: string, details?: any): Promise<void> {
    const emergencyEntry: SystemEventLogEntry = {
      timestamp: new Date(),
      eventType: 'ERROR',
      component: 'EMERGENCY',
      message: message,
      severity: 'CRITICAL',
      details: details,
      resolved: false
    };

    // Try to log immediately, bypassing batch system
    try {
      await this.writeToSheet(this.SYSTEM_EVENTS_SHEET, [[
        emergencyEntry.timestamp.toISOString(),
        emergencyEntry.eventType,
        emergencyEntry.component,
        emergencyEntry.message,
        emergencyEntry.severity,
        emergencyEntry.details ? JSON.stringify(emergencyEntry.details) : '',
        emergencyEntry.resolved,
        ''
      ]]);
      
      console.log(`📊 Emergency log recorded: ${message}`);
    } catch (error: any) {
      console.error('📊 Failed to record emergency log:', error.message);
      // Store in pending logs as last resort
      this.pendingLogs.push({
        worksheet: this.SYSTEM_EVENTS_SHEET,
        data: [
          emergencyEntry.timestamp.toISOString(),
          emergencyEntry.eventType,
          emergencyEntry.component,
          emergencyEntry.message,
          emergencyEntry.severity,
          emergencyEntry.details ? JSON.stringify(emergencyEntry.details) : '',
          emergencyEntry.resolved,
          ''
        ]
      });
    }
  }
}

export default GoogleSheetsLogger; 
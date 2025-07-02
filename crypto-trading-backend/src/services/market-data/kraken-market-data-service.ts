import { EventEmitter } from 'events';
import { KrakenApiClient, TickerData, OrderBookData, TradeData, ConnectionStatus } from '../kraken-api/kraken-api-client';

export interface MarketDataConfig {
  symbols: string[];
  enableTicker: boolean;
  enableOrderBook: boolean;
  enableTrades: boolean;
  enableOHLC: boolean;
  orderBookDepth?: number;
  ohlcInterval?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface ProcessedTickerData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  volume24h: number;
  change24h: number;
  timestamp: number;
}

export interface ProcessedOrderBookData {
  symbol: string;
  bids: { price: number; volume: number; timestamp: number }[];
  asks: { price: number; volume: number; timestamp: number }[];
  spread: number;
  timestamp: number;
}

export interface ProcessedTradeData {
  symbol: string;
  price: number;
  volume: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface MarketDataSnapshot {
  symbol: string;
  ticker?: ProcessedTickerData;
  orderBook?: ProcessedOrderBookData;
  recentTrades?: ProcessedTradeData[];
  lastUpdate: number;
}

export class KrakenMarketDataService extends EventEmitter {
  private client: KrakenApiClient;
  private config: MarketDataConfig;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private dataSnapshots: Map<string, MarketDataSnapshot> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private connectionHealthTimer: NodeJS.Timeout | null = null;
  private dataQualityTimer: NodeJS.Timeout | null = null;
  private lastDataReceived: Map<string, number> = new Map();

  constructor(client: KrakenApiClient, config: MarketDataConfig) {
    super();
    
    this.client = client;
    this.config = {
      orderBookDepth: 10,
      ohlcInterval: 60,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      ...config
    };

    this.setupClientEventListeners();
    this.initializeDataSnapshots();
  }

  private setupClientEventListeners(): void {
    // Connection events
    this.client.on('connected', () => {
      console.log('📡 Market data service: Kraken WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.subscribeToDataFeeds();
    });

    this.client.on('disconnected', (data) => {
      console.log('📡 Market data service: Kraken WebSocket disconnected:', data);
      this.emit('disconnected', data);
      this.scheduleReconnect();
    });

    this.client.on('statusChange', (status: ConnectionStatus) => {
      this.emit('connectionStatusChange', status);
    });

    this.client.on('error', (error) => {
      console.error('📡 Market data service: Client error:', error);
      this.emit('error', error);
    });

    // Data events
    this.client.on('ticker', (data) => {
      this.handleTickerData(data);
    });

    this.client.on('orderBook', (data) => {
      this.handleOrderBookData(data);
    });

    this.client.on('trade', (data) => {
      this.handleTradeData(data);
    });

    this.client.on('ohlc', (data) => {
      this.handleOHLCData(data);
    });
  }

  private initializeDataSnapshots(): void {
    for (const symbol of this.config.symbols) {
      this.dataSnapshots.set(symbol, {
        symbol,
        lastUpdate: 0
      });
      this.priceHistory.set(symbol, []);
      this.lastDataReceived.set(symbol, 0);
    }
  }

  private async subscribeToDataFeeds(): Promise<void> {
    try {
      if (this.config.enableTicker) {
        await this.client.subscribeTicker(this.config.symbols);
        console.log('📊 Subscribed to ticker data for:', this.config.symbols);
      }

      if (this.config.enableOrderBook) {
        await this.client.subscribeOrderBook(this.config.symbols, this.config.orderBookDepth);
        console.log('📈 Subscribed to order book data for:', this.config.symbols);
      }

      if (this.config.enableTrades) {
        await this.client.subscribeTrades(this.config.symbols);
        console.log('💱 Subscribed to trade data for:', this.config.symbols);
      }

      if (this.config.enableOHLC) {
        await this.client.subscribeOHLC(this.config.symbols, this.config.ohlcInterval);
        console.log('📊 Subscribed to OHLC data for:', this.config.symbols);
      }

      this.emit('subscribed', this.config.symbols);
    } catch (error) {
      console.error('📡 Failed to subscribe to data feeds:', error);
      this.emit('subscriptionError', error);
    }
  }

  private handleTickerData(data: { symbol: string; data: TickerData }): void {
    const { symbol, data: tickerData } = data;
    
    try {
      const processedData: ProcessedTickerData = {
        symbol,
        price: parseFloat(tickerData.c[0]),
        bid: parseFloat(tickerData.b[0]),
        ask: parseFloat(tickerData.a[0]),
        spread: parseFloat(tickerData.a[0]) - parseFloat(tickerData.b[0]),
        volume24h: parseFloat(tickerData.v[1]),
        change24h: 0, // Calculate from price history
        timestamp: Date.now()
      };

      // Update price history for change calculation
      const priceHistory = this.priceHistory.get(symbol) || [];
      priceHistory.push(processedData.price);
      
      // Keep only last 24 hours of data (assuming 1 update per minute)
      if (priceHistory.length > 1440) {
        priceHistory.shift();
      }
      
      // Calculate 24h change
      if (priceHistory.length > 1) {
        const oldPrice = priceHistory[0];
        processedData.change24h = ((processedData.price - oldPrice) / oldPrice) * 100;
      }

      this.priceHistory.set(symbol, priceHistory);

      // Update snapshot
      const snapshot = this.dataSnapshots.get(symbol);
      if (snapshot) {
        snapshot.ticker = processedData;
        snapshot.lastUpdate = Date.now();
        this.dataSnapshots.set(symbol, snapshot);
      }

      this.lastDataReceived.set(symbol, Date.now());
      this.emit('ticker', processedData);
      this.emit('dataUpdate', { type: 'ticker', symbol, data: processedData });

    } catch (error) {
      console.error(`📡 Error processing ticker data for ${symbol}:`, error);
      this.emit('dataError', { type: 'ticker', symbol, error });
    }
  }

  private handleOrderBookData(data: { symbol: string; data: OrderBookData }): void {
    const { symbol, data: orderBookData } = data;
    
    try {
      const processedData: ProcessedOrderBookData = {
        symbol,
        bids: orderBookData.bids.map(([price, volume, timestamp]) => ({
          price: parseFloat(price),
          volume: parseFloat(volume),
          timestamp: timestamp * 1000
        })),
        asks: orderBookData.asks.map(([price, volume, timestamp]) => ({
          price: parseFloat(price),
          volume: parseFloat(volume),
          timestamp: timestamp * 1000
        })),
        spread: 0,
        timestamp: Date.now()
      };

      // Calculate spread
      if (processedData.asks.length > 0 && processedData.bids.length > 0) {
        processedData.spread = processedData.asks[0].price - processedData.bids[0].price;
      }

      // Update snapshot
      const snapshot = this.dataSnapshots.get(symbol);
      if (snapshot) {
        snapshot.orderBook = processedData;
        snapshot.lastUpdate = Date.now();
        this.dataSnapshots.set(symbol, snapshot);
      }

      this.lastDataReceived.set(symbol, Date.now());
      this.emit('orderBook', processedData);
      this.emit('dataUpdate', { type: 'orderBook', symbol, data: processedData });

    } catch (error) {
      console.error(`📡 Error processing order book data for ${symbol}:`, error);
      this.emit('dataError', { type: 'orderBook', symbol, error });
    }
  }

  private handleTradeData(data: { symbol: string; data: TradeData }): void {
    const { symbol, data: tradeData } = data;
    
    try {
      const processedData: ProcessedTradeData = {
        symbol,
        price: parseFloat(tradeData.price),
        volume: parseFloat(tradeData.volume),
        side: tradeData.side,
        timestamp: tradeData.time * 1000
      };

      // Update snapshot with recent trades
      const snapshot = this.dataSnapshots.get(symbol);
      if (snapshot) {
        if (!snapshot.recentTrades) {
          snapshot.recentTrades = [];
        }
        
        snapshot.recentTrades.unshift(processedData);
        
        // Keep only last 100 trades
        if (snapshot.recentTrades.length > 100) {
          snapshot.recentTrades = snapshot.recentTrades.slice(0, 100);
        }
        
        snapshot.lastUpdate = Date.now();
        this.dataSnapshots.set(symbol, snapshot);
      }

      this.lastDataReceived.set(symbol, Date.now());
      this.emit('trade', processedData);
      this.emit('dataUpdate', { type: 'trade', symbol, data: processedData });

    } catch (error) {
      console.error(`📡 Error processing trade data for ${symbol}:`, error);
      this.emit('dataError', { type: 'trade', symbol, error });
    }
  }

  private handleOHLCData(data: { symbol: string; data: any }): void {
    const { symbol, data: ohlcData } = data;
    
    try {
      // Process OHLC data
      this.lastDataReceived.set(symbol, Date.now());
      this.emit('ohlc', { symbol, data: ohlcData });
      this.emit('dataUpdate', { type: 'ohlc', symbol, data: ohlcData });

    } catch (error) {
      console.error(`📡 Error processing OHLC data for ${symbol}:`, error);
      this.emit('dataError', { type: 'ohlc', symbol, error });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error('📡 Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(
      (this.config.reconnectDelay || 5000) * Math.pow(2, this.reconnectAttempts),
      30000
    );

    this.reconnectAttempts++;
    
    console.log(`📡 Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.isRunning) {
        this.client.connectWebSocket().catch(error => {
          console.error('📡 Reconnection failed:', error);
        });
      }
    }, delay);
  }

  private startHealthMonitoring(): void {
    // Connection health monitoring
    this.connectionHealthTimer = setInterval(() => {
      const status = this.client.getConnectionStatus();
      const isConnected = this.client.isConnected();
      
      this.emit('healthCheck', {
        connectionStatus: status,
        isConnected,
        reconnectAttempts: this.reconnectAttempts,
        subscribedSymbols: this.config.symbols.length,
        dataSnapshots: this.dataSnapshots.size
      });
    }, 30000); // Every 30 seconds

    // Data quality monitoring
    this.dataQualityTimer = setInterval(() => {
      const now = Date.now();
      const staleDataThreshold = 60000; // 1 minute
      
      for (const [symbol, lastReceived] of this.lastDataReceived) {
        if (now - lastReceived > staleDataThreshold) {
          console.warn(`📡 Stale data detected for ${symbol}: ${now - lastReceived}ms ago`);
          this.emit('staleData', { symbol, lastReceived, age: now - lastReceived });
        }
      }
    }, 30000); // Every 30 seconds
  }

  private stopHealthMonitoring(): void {
    if (this.connectionHealthTimer) {
      clearInterval(this.connectionHealthTimer);
      this.connectionHealthTimer = null;
    }

    if (this.dataQualityTimer) {
      clearInterval(this.dataQualityTimer);
      this.dataQualityTimer = null;
    }
  }

  // Public methods
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📡 Market data service is already running');
      return;
    }

    console.log('📡 Starting Kraken market data service...');
    this.isRunning = true;
    this.reconnectAttempts = 0;

    try {
      await this.client.connectWebSocket();
      this.startHealthMonitoring();
      console.log('📡 Market data service started successfully');
      this.emit('started');
    } catch (error) {
      console.error('📡 Failed to start market data service:', error);
      this.isRunning = false;
      this.emit('startError', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('📡 Market data service is not running');
      return;
    }

    console.log('📡 Stopping Kraken market data service...');
    this.isRunning = false;

    this.stopHealthMonitoring();
    this.client.disconnect();

    // Clear data
    this.dataSnapshots.clear();
    this.priceHistory.clear();
    this.lastDataReceived.clear();

    console.log('📡 Market data service stopped');
    this.emit('stopped');
  }

  // Data access methods
  getSnapshot(symbol: string): MarketDataSnapshot | undefined {
    return this.dataSnapshots.get(symbol);
  }

  getAllSnapshots(): Map<string, MarketDataSnapshot> {
    return new Map(this.dataSnapshots);
  }

  getCurrentPrice(symbol: string): number | undefined {
    const snapshot = this.dataSnapshots.get(symbol);
    return snapshot?.ticker?.price;
  }

  getSpread(symbol: string): number | undefined {
    const snapshot = this.dataSnapshots.get(symbol);
    return snapshot?.ticker?.spread || snapshot?.orderBook?.spread;
  }

  getBidAsk(symbol: string): { bid: number; ask: number } | undefined {
    const snapshot = this.dataSnapshots.get(symbol);
    if (snapshot?.ticker) {
      return { bid: snapshot.ticker.bid, ask: snapshot.ticker.ask };
    }
    if (snapshot?.orderBook && snapshot.orderBook.bids.length > 0 && snapshot.orderBook.asks.length > 0) {
      return { 
        bid: snapshot.orderBook.bids[0].price, 
        ask: snapshot.orderBook.asks[0].price 
      };
    }
    return undefined;
  }

  getPriceHistory(symbol: string): number[] {
    return this.priceHistory.get(symbol) || [];
  }

  getRecentTrades(symbol: string, limit: number = 10): ProcessedTradeData[] {
    const snapshot = this.dataSnapshots.get(symbol);
    return snapshot?.recentTrades?.slice(0, limit) || [];
  }

  // Status methods
  isConnected(): boolean {
    return this.client.isConnected();
  }

  getConnectionStatus(): ConnectionStatus {
    return this.client.getConnectionStatus();
  }

  getServiceStatus(): {
    isRunning: boolean;
    isConnected: boolean;
    connectionStatus: ConnectionStatus;
    subscribedSymbols: string[];
    reconnectAttempts: number;
    dataSnapshots: number;
    lastDataReceived: Map<string, number>;
  } {
    return {
      isRunning: this.isRunning,
      isConnected: this.isConnected(),
      connectionStatus: this.getConnectionStatus(),
      subscribedSymbols: this.config.symbols,
      reconnectAttempts: this.reconnectAttempts,
      dataSnapshots: this.dataSnapshots.size,
      lastDataReceived: new Map(this.lastDataReceived)
    };
  }

  // Configuration methods
  updateSymbols(symbols: string[]): void {
    this.config.symbols = symbols;
    this.initializeDataSnapshots();
    
    if (this.isRunning && this.isConnected()) {
      // Resubscribe with new symbols
      this.subscribeToDataFeeds();
    }
  }

  updateConfig(config: Partial<MarketDataConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.symbols) {
      this.updateSymbols(config.symbols);
    }
  }

  // Utility methods
  async validateDataQuality(): Promise<{
    symbol: string;
    hasRecentData: boolean;
    lastUpdate: number;
    dataAge: number;
    hasTicker: boolean;
    hasOrderBook: boolean;
    hasTrades: boolean;
  }[]> {
    const now = Date.now();
    const results = [];

    for (const [symbol, snapshot] of this.dataSnapshots) {
      const lastReceived = this.lastDataReceived.get(symbol) || 0;
      
      results.push({
        symbol,
        hasRecentData: now - lastReceived < 60000, // Within last minute
        lastUpdate: snapshot.lastUpdate,
        dataAge: now - lastReceived,
        hasTicker: !!snapshot.ticker,
        hasOrderBook: !!snapshot.orderBook,
        hasTrades: !!snapshot.recentTrades && snapshot.recentTrades.length > 0
      });
    }

    return results;
  }

  async getMarketSummary(): Promise<{
    totalSymbols: number;
    activeSymbols: number;
    averageSpread: number;
    totalVolume24h: number;
    priceChanges: { symbol: string; change24h: number }[];
  }> {
    let totalVolume = 0;
    let totalSpread = 0;
    let activeSymbols = 0;
    const priceChanges = [];

    for (const [symbol, snapshot] of this.dataSnapshots) {
      if (snapshot.ticker) {
        activeSymbols++;
        totalVolume += snapshot.ticker.volume24h;
        totalSpread += snapshot.ticker.spread;
        priceChanges.push({
          symbol,
          change24h: snapshot.ticker.change24h
        });
      }
    }

    return {
      totalSymbols: this.config.symbols.length,
      activeSymbols,
      averageSpread: activeSymbols > 0 ? totalSpread / activeSymbols : 0,
      totalVolume24h: totalVolume,
      priceChanges
    };
  }
}

export default KrakenMarketDataService;
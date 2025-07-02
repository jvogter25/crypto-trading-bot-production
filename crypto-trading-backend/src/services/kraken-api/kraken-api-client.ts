import * as WebSocket from 'ws';
import crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

// Types and Interfaces
export interface KrakenConfig {
  apiKey?: string;
  apiSecret?: string;
  sandbox?: boolean;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface KrakenApiResponse<T = any> {
  error: string[];
  result: T;
}

export interface TickerData {
  a: [string, string, string]; // ask [price, whole lot volume, lot volume]
  b: [string, string, string]; // bid [price, whole lot volume, lot volume]
  c: [string, string]; // last trade closed [price, lot volume]
  v: [string, string]; // volume [today, last 24 hours]
  p: [string, string]; // volume weighted average price [today, last 24 hours]
  t: [number, number]; // number of trades [today, last 24 hours]
  l: [string, string]; // low [today, last 24 hours]
  h: [string, string]; // high [today, last 24 hours]
  o: string; // today's opening price
}

export interface OrderBookData {
  asks: [string, string, number][]; // [price, volume, timestamp]
  bids: [string, string, number][];
}

export interface TradeData {
  price: string;
  volume: string;
  time: number;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  misc: string;
}

export interface AccountBalance {
  [currency: string]: string;
}

export interface OrderInfo {
  refid?: string;
  userref?: number;
  status: string;
  opentm: number;
  starttm?: number;
  expiretm?: number;
  descr: {
    pair: string;
    type: 'buy' | 'sell';
    ordertype: string;
    price?: string;
    price2?: string;
    leverage?: string;
    order: string;
    close?: string;
  };
  vol: string;
  vol_exec: string;
  cost: string;
  fee: string;
  price: string;
  stopprice?: string;
  limitprice?: string;
  misc: string;
  oflags: string;
  trades?: string[];
}

export interface PlaceOrderRequest {
  pair: string;
  type: 'buy' | 'sell';
  ordertype: 'market' | 'limit' | 'stop-loss' | 'take-profit' | 'stop-loss-limit' | 'take-profit-limit';
  volume: string;
  price?: string;
  price2?: string;
  leverage?: string;
  oflags?: string;
  starttm?: string;
  expiretm?: string;
  userref?: number;
  validate?: boolean;
  close?: {
    ordertype: string;
    price?: string;
    price2?: string;
  };
}

export interface WebSocketSubscription {
  name: string;
  subscription?: {
    interval?: number;
    depth?: number;
    token?: string;
  };
}

// Connection Status Enum
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// Rate Limiting Class
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number;

  constructor(maxRequests: number = 60, timeWindow: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldestRequest) + 100;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForSlot();
    }

    this.requests.push(now);
  }
}

// Main Kraken API Client Class
export class KrakenApiClient extends EventEmitter {
  private readonly config: Required<KrakenConfig>;
  private readonly baseUrl: string;
  private readonly wsUrl: string;
  private readonly wsAuthUrl: string;
  private ws: WebSocket | null = null;
  private wsAuth: WebSocket | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private rateLimiter: RateLimiter;
  private subscriptions: Map<string, WebSocketSubscription> = new Map();
  private lastPrices: Map<string, TickerData> = new Map();
  private connectionHealthCheck: NodeJS.Timeout | null = null;

  constructor(config: KrakenConfig = {}) {
    super();
    
    this.config = {
      apiKey: config.apiKey || process.env.KRAKEN_API_KEY || '',
      apiSecret: config.apiSecret || process.env.KRAKEN_API_SECRET || '',
      sandbox: config.sandbox || false,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000
    };

    this.baseUrl = 'https://api.kraken.com';
    this.wsUrl = 'wss://ws.kraken.com/v2';
    this.wsAuthUrl = 'wss://ws-auth.kraken.com/v2';
    this.rateLimiter = new RateLimiter(60, 60000); // 60 requests per minute

    if (!this.config.apiKey || !this.config.apiSecret) {
      console.warn('Kraken API credentials not provided. Some features will be disabled.');
    }

    this.setupConnectionHealthCheck();
  }

  // REST API Methods
  private generateSignature(path: string, data: string, nonce: string): string {
    const message = path + crypto.createHash('sha256').update(nonce + data).digest();
    const secret = Buffer.from(this.config.apiSecret, 'base64');
    return crypto.createHmac('sha512', secret).update(message).digest('base64');
  }

  private async makePrivateRequest<T>(
    endpoint: string,
    data: Record<string, any> = {},
    retryCount: number = 0
  ): Promise<T> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('API credentials required for private endpoints');
    }

    await this.rateLimiter.waitForSlot();

    const nonce = Date.now().toString();
    const postData = new URLSearchParams({ nonce, ...data }).toString();
    const path = `/0/private/${endpoint}`;
    const signature = this.generateSignature(path, postData, nonce);

    try {
      const response: AxiosResponse<KrakenApiResponse<T>> = await axios.post(
        `${this.baseUrl}${path}`,
        postData,
        {
          headers: {
            'API-Key': this.config.apiKey,
            'API-Sign': signature,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: this.config.timeout,
        }
      );

      if (response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
      }

      return response.data.result;
    } catch (error: any) {
      if (retryCount < this.config.retryAttempts) {
        console.warn(`Kraken private API request failed for ${endpoint} (attempt ${retryCount + 1}/${this.config.retryAttempts}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, retryCount)));
        return this.makePrivateRequest<T>(endpoint, data, retryCount + 1);
      }
      throw error;
    }
  }

  private async makePublicRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    retryCount: number = 0
  ): Promise<T> {
    await this.rateLimiter.waitForSlot();

    const url = `${this.baseUrl}/0/public/${endpoint}`;
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    try {
      const response: AxiosResponse<KrakenApiResponse<T>> = await axios.get(fullUrl, {
        timeout: this.config.timeout,
      });

      if (response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
      }

      return response.data.result;
    } catch (error: any) {
      if (retryCount < this.config.retryAttempts) {
        console.warn(`Kraken public API request failed for ${endpoint} (attempt ${retryCount + 1}/${this.config.retryAttempts}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, retryCount)));
        return this.makePublicRequest<T>(endpoint, params, retryCount + 1);
      }
      throw error;
    }
  }

  // Public API Methods
  async getServerTime(): Promise<{ unixtime: number; rfc1123: string }> {
    return this.makePublicRequest('Time');
  }

  async getSystemStatus(): Promise<{ status: string; timestamp: string }> {
    return this.makePublicRequest('SystemStatus');
  }

  async getAssetInfo(assets?: string[]): Promise<Record<string, any>> {
    const params = assets ? { asset: assets.join(',') } : {};
    return this.makePublicRequest('Assets', params);
  }

  async getTradableAssetPairs(pairs?: string[]): Promise<Record<string, any>> {
    const params = pairs ? { pair: pairs.join(',') } : {};
    return this.makePublicRequest('AssetPairs', params);
  }

  async getTicker(pairs: string[]): Promise<Record<string, TickerData>> {
    return this.makePublicRequest('Ticker', { pair: pairs.join(',') });
  }

  async getOrderBook(pair: string, count?: number): Promise<Record<string, OrderBookData>> {
    const params: any = { pair };
    if (count) params.count = count;
    return this.makePublicRequest('Depth', params);
  }

  async getRecentTrades(pair: string, since?: string): Promise<any> {
    const params: any = { pair };
    if (since) params.since = since;
    return this.makePublicRequest('Trades', params);
  }

  async getOHLCData(pair: string, interval?: number, since?: number): Promise<any> {
    const params: any = { pair };
    if (interval) params.interval = interval;
    if (since) params.since = since;
    return this.makePublicRequest('OHLC', params);
  }

  // Private API Methods
  async getAccountBalance(): Promise<AccountBalance> {
    return this.makePrivateRequest('Balance');
  }

  async getTradeBalance(asset?: string): Promise<{
    eb: string; // equivalent balance
    tb: string; // trade balance
    m: string;  // margin amount
    n: string;  // unrealized net profit/loss
    c: string;  // cost basis
    v: string;  // current floating valuation
    e: string;  // equity
    mf: string; // free margin
  }> {
    const params = asset ? { asset } : {};
    return this.makePrivateRequest('TradeBalance', params);
  }

  async getOpenOrders(trades?: boolean, userref?: number): Promise<{
    open: Record<string, OrderInfo>;
    count: number;
  }> {
    const params: any = {};
    if (trades !== undefined) params.trades = trades;
    if (userref !== undefined) params.userref = userref;
    return this.makePrivateRequest('OpenOrders', params);
  }

  async getClosedOrders(
    trades?: boolean,
    userref?: number,
    start?: number,
    end?: number,
    ofs?: number,
    closetime?: 'open' | 'close' | 'both'
  ): Promise<{
    closed: Record<string, OrderInfo>;
    count: number;
  }> {
    const params: any = {};
    if (trades !== undefined) params.trades = trades;
    if (userref !== undefined) params.userref = userref;
    if (start !== undefined) params.start = start;
    if (end !== undefined) params.end = end;
    if (ofs !== undefined) params.ofs = ofs;
    if (closetime !== undefined) params.closetime = closetime;
    return this.makePrivateRequest('ClosedOrders', params);
  }

  async queryOrders(txids: string[], trades?: boolean, userref?: number): Promise<Record<string, OrderInfo>> {
    const params: any = { txid: txids.join(',') };
    if (trades !== undefined) params.trades = trades;
    if (userref !== undefined) params.userref = userref;
    return this.makePrivateRequest('QueryOrders', params);
  }

  async getTradesHistory(
    type?: 'all' | 'any position' | 'closed position' | 'closing position' | 'no position',
    trades?: boolean,
    start?: number,
    end?: number,
    ofs?: number
  ): Promise<{
    trades: Record<string, any>;
    count: number;
  }> {
    const params: any = {};
    if (type !== undefined) params.type = type;
    if (trades !== undefined) params.trades = trades;
    if (start !== undefined) params.start = start;
    if (end !== undefined) params.end = end;
    if (ofs !== undefined) params.ofs = ofs;
    return this.makePrivateRequest('TradesHistory', params);
  }

  async queryTrades(txids: string[], trades?: boolean): Promise<Record<string, any>> {
    const params: any = { txid: txids.join(',') };
    if (trades !== undefined) params.trades = trades;
    return this.makePrivateRequest('QueryTrades', params);
  }

  async getOpenPositions(txids?: string[], docalcs?: boolean): Promise<Record<string, any>> {
    const params: any = {};
    if (txids) params.txid = txids.join(',');
    if (docalcs !== undefined) params.docalcs = docalcs;
    return this.makePrivateRequest('OpenPositions', params);
  }

  async getLedgers(
    assets?: string[],
    aclass?: string,
    type?: string,
    start?: number,
    end?: number,
    ofs?: number
  ): Promise<{
    ledger: Record<string, any>;
    count: number;
  }> {
    const params: any = {};
    if (assets) params.asset = assets.join(',');
    if (aclass) params.aclass = aclass;
    if (type) params.type = type;
    if (start !== undefined) params.start = start;
    if (end !== undefined) params.end = end;
    if (ofs !== undefined) params.ofs = ofs;
    return this.makePrivateRequest('Ledgers', params);
  }

  async queryLedgers(ledgerIds: string[]): Promise<Record<string, any>> {
    return this.makePrivateRequest('QueryLedgers', { id: ledgerIds.join(',') });
  }

  async getTradeVolume(pairs?: string[], feeInfo?: boolean): Promise<{
    currency: string;
    volume: string;
    fees?: Record<string, any>;
    fees_maker?: Record<string, any>;
  }> {
    const params: any = {};
    if (pairs) params.pair = pairs.join(',');
    if (feeInfo !== undefined) params['fee-info'] = feeInfo;
    return this.makePrivateRequest('TradeVolume', params);
  }

  // Order Management Methods
  async addOrder(order: PlaceOrderRequest): Promise<{
    descr: { order: string };
    txid: string[];
  }> {
    return this.makePrivateRequest('AddOrder', order);
  }

  async cancelOrder(txid: string): Promise<{
    count: number;
    pending?: boolean;
  }> {
    return this.makePrivateRequest('CancelOrder', { txid });
  }

  async cancelAllOrders(): Promise<{
    count: number;
  }> {
    return this.makePrivateRequest('CancelAll');
  }

  async cancelAllOrdersAfter(timeout: number): Promise<{
    currentTime: string;
    triggerTime: string;
  }> {
    return this.makePrivateRequest('CancelAllOrdersAfter', { timeout });
  }

  // WebSocket Connection Management
  private setupConnectionHealthCheck(): void {
    this.connectionHealthCheck = setInterval(() => {
      if (this.connectionStatus === ConnectionStatus.CONNECTED) {
        this.emit('healthCheck', {
          status: this.connectionStatus,
          subscriptions: this.subscriptions.size,
          lastPrices: this.lastPrices.size,
          uptime: Date.now()
        });
      }
    }, 30000); // Health check every 30 seconds
  }

  async connectWebSocket(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.connectionStatus = ConnectionStatus.CONNECTING;
    this.emit('statusChange', this.connectionStatus);

    try {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.on('open', () => {
        console.log('Kraken WebSocket connected');
        this.connectionStatus = ConnectionStatus.CONNECTED;
        this.reconnectAttempts = 0;
        this.emit('statusChange', this.connectionStatus);
        this.emit('connected');
        this.startHeartbeat();
        this.resubscribeAll();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.emit('error', error);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log(`Kraken WebSocket closed: ${code} - ${reason.toString()}`);
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
        this.emit('statusChange', this.connectionStatus);
        this.emit('disconnected', { code, reason: reason.toString() });
        this.stopHeartbeat();
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        console.error('Kraken WebSocket error:', error);
        this.connectionStatus = ConnectionStatus.ERROR;
        this.emit('statusChange', this.connectionStatus);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.connectionStatus = ConnectionStatus.ERROR;
      this.emit('statusChange', this.connectionStatus);
      this.emit('error', error);
      throw error;
    }
  }

  async connectAuthenticatedWebSocket(): Promise<void> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('API credentials required for authenticated WebSocket');
    }

    if (this.wsAuth && this.wsAuth.readyState === WebSocket.OPEN) {
      console.log('Authenticated WebSocket already connected');
      return;
    }

    try {
      // Get WebSocket token
      const tokenResponse = await this.makePrivateRequest<{ token: string }>('GetWebSocketsToken');
      const token = tokenResponse.token;

      this.wsAuth = new WebSocket(this.wsAuthUrl);

      this.wsAuth.on('open', () => {
        console.log('Kraken authenticated WebSocket connected');
        this.emit('authConnected');
        
        // Subscribe to private channels with token
        this.wsAuth?.send(JSON.stringify({
          method: 'subscribe',
          params: {
            channel: 'executions',
            token: token
          }
        }));
      });

      this.wsAuth.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleAuthenticatedWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing authenticated WebSocket message:', error);
          this.emit('error', error);
        }
      });

      this.wsAuth.on('close', (code: number, reason: Buffer) => {
        console.log(`Kraken authenticated WebSocket closed: ${code} - ${reason.toString()}`);
        this.emit('authDisconnected', { code, reason: reason.toString() });
      });

      this.wsAuth.on('error', (error: Error) => {
        console.error('Kraken authenticated WebSocket error:', error);
        this.emit('authError', error);
      });

    } catch (error) {
      console.error('Failed to connect authenticated WebSocket:', error);
      this.emit('authError', error);
      throw error;
    }
  }

  private handleWebSocketMessage(message: any): void {
    if (message.method === 'heartbeat') {
      this.handleHeartbeat();
      return;
    }

    if (message.channel === 'ticker' && message.data) {
      message.data.forEach((tickerData: any) => {
        const symbol = tickerData.symbol;
        this.lastPrices.set(symbol, tickerData);
        this.emit('ticker', { symbol, data: tickerData });
      });
    }

    if (message.channel === 'book' && message.data) {
      message.data.forEach((bookData: any) => {
        this.emit('orderBook', { symbol: bookData.symbol, data: bookData });
      });
    }

    if (message.channel === 'trade' && message.data) {
      message.data.forEach((tradeData: any) => {
        this.emit('trade', { symbol: tradeData.symbol, data: tradeData });
      });
    }

    if (message.channel === 'ohlc' && message.data) {
      message.data.forEach((ohlcData: any) => {
        this.emit('ohlc', { symbol: ohlcData.symbol, data: ohlcData });
      });
    }

    // Handle subscription confirmations
    if (message.method === 'subscribe' && message.result) {
      console.log('Subscription confirmed:', message.result);
      this.emit('subscribed', message.result);
    }

    // Handle errors
    if (message.error) {
      console.error('WebSocket error:', message.error);
      this.emit('wsError', message.error);
    }
  }

  private handleAuthenticatedWebSocketMessage(message: any): void {
    if (message.channel === 'executions' && message.data) {
      message.data.forEach((execution: any) => {
        this.emit('execution', execution);
      });
    }

    if (message.channel === 'balances' && message.data) {
      this.emit('balanceUpdate', message.data);
    }

    if (message.error) {
      console.error('Authenticated WebSocket error:', message.error);
      this.emit('authWsError', message.error);
    }
  }

  private handleHeartbeat(): void {
    // Respond to heartbeat to keep connection alive
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: 'pong' }));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.connectionStatus = ConnectionStatus.RECONNECTING;
    this.emit('statusChange', this.connectionStatus);

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connectWebSocket().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  private resubscribeAll(): void {
    for (const [channel, subscription] of this.subscriptions) {
      this.subscribe(subscription.name, subscription.subscription);
    }
  }

  // WebSocket Subscription Methods
  async subscribe(channel: string, params?: any): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const subscription: WebSocketSubscription = { name: channel, subscription: params };
    this.subscriptions.set(channel, subscription);

    const message = {
      method: 'subscribe',
      params: {
        channel: channel,
        ...params
      }
    };

    this.ws.send(JSON.stringify(message));
    console.log(`Subscribed to ${channel}:`, params);
  }

  async unsubscribe(channel: string, params?: any): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.subscriptions.delete(channel);

    const message = {
      method: 'unsubscribe',
      params: {
        channel: channel,
        ...params
      }
    };

    this.ws.send(JSON.stringify(message));
    console.log(`Unsubscribed from ${channel}:`, params);
  }

  async subscribeTicker(symbols: string[]): Promise<void> {
    await this.subscribe('ticker', { symbol: symbols });
  }

  async subscribeOrderBook(symbols: string[], depth?: number): Promise<void> {
    const params: any = { symbol: symbols };
    if (depth) params.depth = depth;
    await this.subscribe('book', params);
  }

  async subscribeTrades(symbols: string[]): Promise<void> {
    await this.subscribe('trade', { symbol: symbols });
  }

  async subscribeOHLC(symbols: string[], interval?: number): Promise<void> {
    const params: any = { symbol: symbols };
    if (interval) params.interval = interval;
    await this.subscribe('ohlc', params);
  }

  // Utility Methods
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  getLastPrice(symbol: string): TickerData | undefined {
    return this.lastPrices.get(symbol);
  }

  getAllLastPrices(): Map<string, TickerData> {
    return new Map(this.lastPrices);
  }

  isConnected(): boolean {
    return this.connectionStatus === ConnectionStatus.CONNECTED;
  }

  async validateConnection(): Promise<boolean> {
    try {
      const serverTime = await this.getServerTime();
      const systemStatus = await this.getSystemStatus();
      
      console.log('Kraken API connection validated successfully');
      console.log('Server time:', new Date(serverTime.unixtime * 1000).toISOString());
      console.log('System status:', systemStatus.status);
      
      return true;
    } catch (error) {
      console.error('Kraken API connection validation failed:', error);
      return false;
    }
  }

  // Cleanup Methods
  disconnect(): void {
    this.connectionStatus = ConnectionStatus.DISCONNECTED;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.wsAuth) {
      this.wsAuth.close();
      this.wsAuth = null;
    }

    this.stopHeartbeat();
    
    if (this.connectionHealthCheck) {
      clearInterval(this.connectionHealthCheck);
      this.connectionHealthCheck = null;
    }

    this.subscriptions.clear();
    this.lastPrices.clear();
    
    this.emit('statusChange', this.connectionStatus);
    console.log('Kraken API client disconnected');
  }

  // Advanced Trading Methods
  async placeMarketOrder(pair: string, type: 'buy' | 'sell', volume: string): Promise<{
    descr: { order: string };
    txid: string[];
  }> {
    return this.addOrder({
      pair,
      type,
      ordertype: 'market',
      volume
    });
  }

  async placeLimitOrder(
    pair: string,
    type: 'buy' | 'sell',
    volume: string,
    price: string
  ): Promise<{
    descr: { order: string };
    txid: string[];
  }> {
    return this.addOrder({
      pair,
      type,
      ordertype: 'limit',
      volume,
      price
    });
  }

  async placeStopLossOrder(
    pair: string,
    type: 'buy' | 'sell',
    volume: string,
    price: string
  ): Promise<{
    descr: { order: string };
    txid: string[];
  }> {
    return this.addOrder({
      pair,
      type,
      ordertype: 'stop-loss',
      volume,
      price
    });
  }

  async getMarketPrice(pair: string): Promise<number> {
    const ticker = await this.getTicker([pair]);
    const pairData = ticker[pair];
    if (!pairData) {
      throw new Error(`No ticker data found for pair: ${pair}`);
    }
    return parseFloat(pairData.c[0]); // Last trade price
  }

  async getSpread(pair: string): Promise<{ bid: number; ask: number; spread: number }> {
    const ticker = await this.getTicker([pair]);
    const pairData = ticker[pair];
    if (!pairData) {
      throw new Error(`No ticker data found for pair: ${pair}`);
    }
    
    const bid = parseFloat(pairData.b[0]);
    const ask = parseFloat(pairData.a[0]);
    const spread = ask - bid;
    
    return { bid, ask, spread };
  }

  // Portfolio Management Helpers
  async getPortfolioValue(baseCurrency: string = 'USD'): Promise<number> {
    const balances = await this.getAccountBalance();
    let totalValue = 0;

    for (const [currency, balance] of Object.entries(balances)) {
      const amount = parseFloat(balance);
      if (amount > 0) {
        if (currency === baseCurrency) {
          totalValue += amount;
        } else {
          try {
            const pair = `${currency}${baseCurrency}`;
            const price = await this.getMarketPrice(pair);
            totalValue += amount * price;
          } catch (error) {
            console.warn(`Could not get price for ${currency}/${baseCurrency}:`, error);
          }
        }
      }
    }

    return totalValue;
  }

  async getPositionSize(pair: string): Promise<number> {
    const balances = await this.getAccountBalance();
    const baseCurrency = pair.substring(0, 3); // Assuming 3-character currency codes
    const balance = balances[baseCurrency];
    return balance ? parseFloat(balance) : 0;
  }
}

export default KrakenApiClient;
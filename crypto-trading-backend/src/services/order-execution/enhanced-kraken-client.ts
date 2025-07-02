import * as crypto from 'crypto';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { KrakenWebSocketClient, TickerData, OrderUpdate, BalanceUpdate } from './kraken-websocket-client';

// Rate limiting interface
interface RateLimiter {
    canMakeRequest(): boolean;
    recordRequest(): void;
    getRemainingRequests(): number;
    getResetTime(): number;
}

// Simple rate limiter implementation
class SimpleRateLimiter implements RateLimiter {
    private requests: number[] = [];
    private readonly maxRequests: number;
    private readonly windowMs: number;

    constructor(maxRequests: number, windowMs: number) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    canMakeRequest(): boolean {
        this.cleanOldRequests();
        return this.requests.length < this.maxRequests;
    }

    recordRequest(): void {
        this.requests.push(Date.now());
    }

    getRemainingRequests(): number {
        this.cleanOldRequests();
        return Math.max(0, this.maxRequests - this.requests.length);
    }

    getResetTime(): number {
        if (this.requests.length === 0) return 0;
        return this.requests[0] + this.windowMs;
    }

    private cleanOldRequests(): void {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.windowMs);
    }
}

// Enhanced interfaces
export interface KrakenApiResponse<T = any> {
    error: string[];
    result: T;
}

export interface KrakenOrderRequest {
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
    userref?: string;
    validate?: boolean;
    close?: {
        ordertype: string;
        price?: string;
        price2?: string;
    };
}

export interface KrakenOrderResponse {
    descr: {
        order: string;
        close?: string;
    };
    txid: string[];
}

export interface KrakenBalance {
    [currency: string]: string;
}

export interface KrakenTicker {
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

export interface KrakenOrderInfo {
    refid?: string;
    userref?: string;
    status: string;
    opentm: number;
    starttm: number;
    expiretm: number;
    descr: {
        pair: string;
        type: string;
        ordertype: string;
        price: string;
        price2: string;
        leverage: string;
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

export interface KrakenAssetPair {
    altname: string;
    wsname: string;
    aclass_base: string;
    base: string;
    aclass_quote: string;
    quote: string;
    lot: string;
    pair_decimals: number;
    lot_decimals: number;
    lot_multiplier: number;
    leverage_buy: number[];
    leverage_sell: number[];
    fees: number[][];
    fees_maker: number[][];
    fee_volume_currency: string;
    margin_call: number;
    margin_stop: number;
    ordermin: string;
}

export interface TradingPairInfo {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    minOrderSize: number;
    maxOrderSize: number;
    priceDecimals: number;
    quantityDecimals: number;
    tickSize: number;
    stepSize: number;
}

export interface OrderValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    adjustedQuantity?: string;
    adjustedPrice?: string;
}

export class EnhancedKrakenClient extends EventEmitter {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly baseUrl: string;
    private readonly timeout: number;
    private readonly rateLimiter: RateLimiter;
    private wsClient: KrakenWebSocketClient | null = null;
    private isWebSocketEnabled = false;
    private lastPrices: Map<string, number> = new Map();
    private orderCache: Map<string, KrakenOrderInfo> = new Map();
    private balanceCache: Map<string, number> = new Map();
    private assetPairsCache: Map<string, KrakenAssetPair> = new Map();
    private tradingPairInfoCache: Map<string, TradingPairInfo> = new Map();
    private connectionHealthy = false;
    private lastHealthCheck = 0;
    private readonly healthCheckInterval = 60000; // 1 minute
    private emergencyStopEnabled = false;

    constructor(config: {
        apiKey?: string;
        apiSecret?: string;
        sandbox?: boolean;
        enableWebSocket?: boolean;
        rateLimitRpm?: number;
        timeout?: number;
    } = {}) {
        super();
        
        this.apiKey = config.apiKey || process.env.KRAKEN_API_KEY || '';
        this.apiSecret = config.apiSecret || process.env.KRAKEN_API_SECRET || '';
        this.baseUrl = config.sandbox ? 'https://api.kraken.com' : 'https://api.kraken.com'; // Kraken doesn't have separate sandbox
        this.timeout = config.timeout || 30000;
        
        // Initialize rate limiter (60 requests per minute by default)
        const rateLimitRpm = config.rateLimitRpm || parseInt(process.env.KRAKEN_RATE_LIMIT_REQUESTS_PER_MINUTE || '60');
        this.rateLimiter = new SimpleRateLimiter(rateLimitRpm, 60000);
        
        if (!this.apiKey || !this.apiSecret) {
            console.warn('Kraken API credentials not found. Some features will be disabled.');
        }

        if (config.enableWebSocket !== false && this.apiKey && this.apiSecret) {
            this.initializeWebSocket();
        }

        // Start health monitoring
        this.startHealthMonitoring();
    }

    private initializeWebSocket(): void {
        try {
            this.wsClient = new KrakenWebSocketClient({
                apiKey: this.apiKey,
                apiSecret: this.apiSecret,
                reconnectInterval: parseInt(process.env.WS_RECONNECT_INTERVAL || '5000'),
                heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000'),
                maxReconnectAttempts: parseInt(process.env.WS_MAX_RECONNECT_ATTEMPTS || '10')
            });

            this.wsClient.on('connected', () => {
                console.log('Enhanced Kraken WebSocket connected');
                this.isWebSocketEnabled = true;
                this.emit('wsConnected');
            });

            this.wsClient.on('disconnected', () => {
                console.log('Enhanced Kraken WebSocket disconnected');
                this.isWebSocketEnabled = false;
                this.emit('wsDisconnected');
            });

            this.wsClient.on('ticker', (tickerData: TickerData) => {
                this.lastPrices.set(tickerData.symbol, tickerData.last);
                this.emit('priceUpdate', tickerData);
            });

            this.wsClient.on('orderUpdate', (orderUpdate: OrderUpdate) => {
                // Update order cache with latest status
                if (this.orderCache.has(orderUpdate.orderId)) {
                    const existingOrder = this.orderCache.get(orderUpdate.orderId)!;
                    // Update relevant fields
                    existingOrder.status = orderUpdate.status;
                    existingOrder.vol_exec = orderUpdate.filledQuantity.toString();
                    if (orderUpdate.averagePrice) {
                        existingOrder.price = orderUpdate.averagePrice.toString();
                    }
                }
                this.emit('orderUpdate', orderUpdate);
            });

            this.wsClient.on('balanceUpdate', (balanceUpdate: BalanceUpdate) => {
                this.balanceCache.set(balanceUpdate.currency, balanceUpdate.balance);
                this.emit('balanceUpdate', balanceUpdate);
            });

            this.wsClient.on('error', (error: Error) => {
                console.error('Enhanced Kraken WebSocket error:', error);
                this.emit('wsError', error);
            });

        } catch (error) {
            console.error('Failed to initialize Enhanced WebSocket:', error);
        }
    }

    private startHealthMonitoring(): void {
        setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                console.error('Health check failed:', error);
            }
        }, this.healthCheckInterval);
    }

    private async performHealthCheck(): Promise<void> {
        try {
            // Check API connectivity
            await this.getServerTime();
            
            // Check WebSocket connectivity
            if (this.wsClient && !this.isWebSocketEnabled) {
                console.warn('WebSocket connection lost, attempting reconnection...');
                await this.connectWebSocket();
            }
            
            this.connectionHealthy = true;
            this.lastHealthCheck = Date.now();
            this.emit('healthCheckPassed');
            
        } catch (error) {
            this.connectionHealthy = false;
            this.emit('healthCheckFailed', error);
            throw error;
        }
    }

    async getServerTime(): Promise<{ unixtime: number; rfc1123: string }> {
        const result = await this.makePublicRequest<{ unixtime: number; rfc1123: string }>('Time');
        return result;
    }

    private generateSignature(path: string, nonce: number, postData: string): string {
        const message = path + crypto.createHash('sha256').update(nonce + postData).digest();
        const secret = Buffer.from(this.apiSecret, 'base64');
        return crypto.createHmac('sha512', secret).update(message).digest('base64');
    }

    private async waitForRateLimit(): Promise<void> {
        while (!this.rateLimiter.canMakeRequest()) {
            const resetTime = this.rateLimiter.getResetTime();
            const waitTime = Math.max(1000, resetTime - Date.now());
            console.log(`Rate limit reached, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }

    private async makePrivateRequest<T>(endpoint: string, data: Record<string, any> = {}, retries = 3): Promise<T> {
        if (this.emergencyStopEnabled) {
            throw new Error('Emergency stop is enabled - all trading operations are suspended');
        }

        await this.waitForRateLimit();
        
        const path = `/0/private/${endpoint}`;
        const nonce = Date.now() * 1000;
        const postData = new URLSearchParams({ nonce: nonce.toString(), ...data }).toString();
        
        const signature = this.generateSignature(path, nonce, postData);
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                this.rateLimiter.recordRequest();
                
                const response: AxiosResponse<KrakenApiResponse<T>> = await axios.post(
                    `${this.baseUrl}${path}`,
                    postData,
                    {
                        headers: {
                            'API-Key': this.apiKey,
                            'API-Sign': signature,
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Enhanced-Kraken-Client/1.0'
                        },
                        timeout: this.timeout,
                    }
                );

                if (response.data.error && response.data.error.length > 0) {
                    const errorMsg = response.data.error.join(', ');
                    
                    // Handle specific error types
                    if (errorMsg.includes('Invalid nonce')) {
                        console.warn('Invalid nonce error, retrying with new nonce...');
                        if (attempt < retries) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                    }
                    
                    if (errorMsg.includes('Rate limit exceeded')) {
                        console.warn('Rate limit exceeded, waiting before retry...');
                        if (attempt < retries) {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            continue;
                        }
                    }
                    
                    throw new Error(`Kraken API Error: ${errorMsg}`);
                }

                return response.data.result;
                
            } catch (error) {
                console.error(`Kraken API request failed for ${endpoint} (attempt ${attempt}/${retries}):`, error);
                
                if (attempt === retries) {
                    // Check if this is a network error that should trigger emergency stop
                    if (axios.isAxiosError(error)) {
                        const axiosError = error as AxiosError;
                        if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
                            this.emit('connectionError', error);
                        }
                    }
                    throw error;
                }
                
                // Exponential backoff
                const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
        }
        
        throw new Error(`Failed to complete request after ${retries} attempts`);
    }

    private async makePublicRequest<T>(endpoint: string, params: Record<string, any> = {}, retries = 3): Promise<T> {
        await this.waitForRateLimit();
        
        const path = `/0/public/${endpoint}`;
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                this.rateLimiter.recordRequest();
                
                const response: AxiosResponse<KrakenApiResponse<T>> = await axios.get(url, {
                    timeout: this.timeout,
                    headers: {
                        'User-Agent': 'Enhanced-Kraken-Client/1.0'
                    }
                });

                if (response.data.error && response.data.error.length > 0) {
                    throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
                }

                return response.data.result;
                
            } catch (error) {
                console.error(`Kraken public API request failed for ${endpoint} (attempt ${attempt}/${retries}):`, error);
                
                if (attempt === retries) {
                    throw error;
                }
                
                // Exponential backoff
                const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
        }
        
        throw new Error(`Failed to complete public request after ${retries} attempts`);
    }

    // Account and Balance Management
    async getAccountBalance(useCache = false): Promise<KrakenBalance> {
        if (useCache && this.balanceCache.size > 0) {
            const cachedBalance: KrakenBalance = {};
            this.balanceCache.forEach((balance, currency) => {
                cachedBalance[currency] = balance.toString();
            });
            return cachedBalance;
        }

        console.log('Fetching account balance from Kraken...');
        const balance = await this.makePrivateRequest<KrakenBalance>('Balance');
        
        // Update cache
        Object.entries(balance).forEach(([currency, amount]) => {
            this.balanceCache.set(currency, parseFloat(amount));
        });
        
        console.log('Account balance retrieved:', Object.keys(balance).length, 'currencies');
        return balance;
    }

    async getAvailableBalance(currency: string): Promise<number> {
        const balance = await this.getAccountBalance();
        return parseFloat(balance[currency] || '0');
    }

    async getTradingBalance(): Promise<{ [currency: string]: { balance: number; available: number; reserved: number } }> {
        const [balance, openOrders] = await Promise.all([
            this.getAccountBalance(),
            this.getOpenOrders()
        ]);

        const tradingBalance: { [currency: string]: { balance: number; available: number; reserved: number } } = {};

        // Calculate reserved amounts from open orders
        const reservedAmounts: { [currency: string]: number } = {};
        
        Object.values(openOrders.open).forEach((order: any) => {
            const pair = order.descr.pair;
            const type = order.descr.type;
            const volume = parseFloat(order.vol) - parseFloat(order.vol_exec);
            const price = parseFloat(order.descr.price);

            if (type === 'buy') {
                // For buy orders, quote currency is reserved
                const quoteCurrency = this.getQuoteCurrency(pair);
                const reservedAmount = volume * price;
                reservedAmounts[quoteCurrency] = (reservedAmounts[quoteCurrency] || 0) + reservedAmount;
            } else {
                // For sell orders, base currency is reserved
                const baseCurrency = this.getBaseCurrency(pair);
                reservedAmounts[baseCurrency] = (reservedAmounts[baseCurrency] || 0) + volume;
            }
        });

        // Build trading balance object
        Object.entries(balance).forEach(([currency, amount]) => {
            const totalBalance = parseFloat(amount);
            const reserved = reservedAmounts[currency] || 0;
            const available = Math.max(0, totalBalance - reserved);

            tradingBalance[currency] = {
                balance: totalBalance,
                available,
                reserved
            };
        });

        return tradingBalance;
    }

    // Market Data
    async getTicker(pair: string): Promise<KrakenTicker> {
        console.log(`Fetching ticker for ${pair}...`);
        const result = await this.makePublicRequest<{ [key: string]: KrakenTicker }>('Ticker', { pair });
        
        const tickerKey = Object.keys(result)[0];
        if (!tickerKey) {
            throw new Error(`No ticker data found for pair: ${pair}`);
        }
        
        return result[tickerKey];
    }

    async getCurrentPrice(pair: string, useWebSocket = true): Promise<number> {
        // Try WebSocket first if available
        if (useWebSocket && this.isWebSocketEnabled && this.lastPrices.has(pair)) {
            return this.lastPrices.get(pair)!;
        }
        
        // Fallback to REST API
        const ticker = await this.getTicker(pair);
        const price = parseFloat(ticker.c[0]); // Last trade price
        
        // Update cache
        this.lastPrices.set(pair, price);
        
        return price;
    }

    async getOrderBook(pair: string, count = 100): Promise<{
        asks: [string, string, number][];
        bids: [string, string, number][];
    }> {
        const result = await this.makePublicRequest<{
            [key: string]: {
                asks: [string, string, number][];
                bids: [string, string, number][];
            }
        }>('Depth', { pair, count });
        
        const orderBookKey = Object.keys(result)[0];
        if (!orderBookKey) {
            throw new Error(`No order book data found for pair: ${pair}`);
        }
        
        return result[orderBookKey];
    }

    // Asset Pair Information
    async getAssetPairs(info = 'info'): Promise<{ [key: string]: KrakenAssetPair }> {
        if (this.assetPairsCache.size > 0 && info === 'info') {
            const cached: { [key: string]: KrakenAssetPair } = {};
            this.assetPairsCache.forEach((pairInfo, pair) => {
                cached[pair] = pairInfo;
            });
            return cached;
        }

        const result = await this.makePublicRequest<{ [key: string]: KrakenAssetPair }>('AssetPairs', { info });
        
        // Update cache
        Object.entries(result).forEach(([pair, pairInfo]) => {
            this.assetPairsCache.set(pair, pairInfo);
        });
        
        return result;
    }

    async getTradingPairInfo(pair: string): Promise<TradingPairInfo> {
        if (this.tradingPairInfoCache.has(pair)) {
            return this.tradingPairInfoCache.get(pair)!;
        }

        const assetPairs = await this.getAssetPairs();
        const pairData = assetPairs[pair];
        
        if (!pairData) {
            throw new Error(`Trading pair not found: ${pair}`);
        }

        const tradingPairInfo: TradingPairInfo = {
            symbol: pair,
            baseAsset: pairData.base,
            quoteAsset: pairData.quote,
            minOrderSize: parseFloat(pairData.ordermin),
            maxOrderSize: 1000000, // Kraken doesn't specify max, using large number
            priceDecimals: pairData.pair_decimals,
            quantityDecimals: pairData.lot_decimals,
            tickSize: 1 / Math.pow(10, pairData.pair_decimals),
            stepSize: 1 / Math.pow(10, pairData.lot_decimals)
        };

        this.tradingPairInfoCache.set(pair, tradingPairInfo);
        return tradingPairInfo;
    }

    private getBaseCurrency(pair: string): string {
        // Simple implementation - in production, use asset pairs data
        const commonPairs: { [key: string]: string } = {
            'XBTUSD': 'XBT',
            'ETHUSD': 'ETH',
            'USDCUSD': 'USDC',
            'USDTUSD': 'USDT'
        };
        return commonPairs[pair] || pair.substring(0, 3);
    }

    private getQuoteCurrency(pair: string): string {
        // Simple implementation - in production, use asset pairs data
        const commonPairs: { [key: string]: string } = {
            'XBTUSD': 'USD',
            'ETHUSD': 'USD',
            'USDCUSD': 'USD',
            'USDTUSD': 'USD'
        };
        return commonPairs[pair] || pair.substring(3);
    }

    // Order Validation
    async validateOrder(orderRequest: KrakenOrderRequest): Promise<OrderValidationResult> {
        const result: OrderValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        try {
            // Get trading pair info
            const pairInfo = await this.getTradingPairInfo(orderRequest.pair);
            
            // Validate quantity
            const quantity = parseFloat(orderRequest.volume);
            if (quantity < pairInfo.minOrderSize) {
                result.errors.push(`Order quantity ${quantity} is below minimum ${pairInfo.minOrderSize}`);
                result.isValid = false;
            }
            
            if (quantity > pairInfo.maxOrderSize) {
                result.errors.push(`Order quantity ${quantity} exceeds maximum ${pairInfo.maxOrderSize}`);
                result.isValid = false;
            }

            // Validate price precision for limit orders
            if (orderRequest.ordertype === 'limit' && orderRequest.price) {
                const price = parseFloat(orderRequest.price);
                const priceStr = price.toFixed(pairInfo.priceDecimals);
                if (parseFloat(priceStr) !== price) {
                    result.warnings.push(`Price precision adjusted from ${price} to ${priceStr}`);
                    result.adjustedPrice = priceStr;
                }
            }

            // Validate quantity precision
            const quantityStr = quantity.toFixed(pairInfo.quantityDecimals);
            if (parseFloat(quantityStr) !== quantity) {
                result.warnings.push(`Quantity precision adjusted from ${quantity} to ${quantityStr}`);
                result.adjustedQuantity = quantityStr;
            }

            // Check available balance
            const tradingBalance = await this.getTradingBalance();
            
            if (orderRequest.type === 'buy') {
                const quoteCurrency = pairInfo.quoteAsset;
                const requiredAmount = orderRequest.ordertype === 'market' 
                    ? quantity * (await this.getCurrentPrice(orderRequest.pair))
                    : quantity * parseFloat(orderRequest.price || '0');
                
                const available = tradingBalance[quoteCurrency]?.available || 0;
                if (available < requiredAmount) {
                    result.errors.push(`Insufficient ${quoteCurrency} balance. Required: ${requiredAmount}, Available: ${available}`);
                    result.isValid = false;
                }
            } else {
                const baseCurrency = pairInfo.baseAsset;
                const available = tradingBalance[baseCurrency]?.available || 0;
                if (available < quantity) {
                    result.errors.push(`Insufficient ${baseCurrency} balance. Required: ${quantity}, Available: ${available}`);
                    result.isValid = false;
                }
            }

        } catch (error) {
            result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            result.isValid = false;
        }

        return result;
    }

    // Order Management
    async placeOrder(orderRequest: KrakenOrderRequest, validate = true): Promise<KrakenOrderResponse> {
        if (this.emergencyStopEnabled) {
            throw new Error('Emergency stop is enabled - all trading operations are suspended');
        }

        console.log('Placing order:', JSON.stringify(orderRequest, null, 2));

        // Validate order if requested
        if (validate) {
            const validation = await this.validateOrder(orderRequest);
            if (!validation.isValid) {
                throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Apply adjustments if any
            if (validation.adjustedPrice) {
                orderRequest.price = validation.adjustedPrice;
            }
            if (validation.adjustedQuantity) {
                orderRequest.volume = validation.adjustedQuantity;
            }
            
            // Log warnings
            if (validation.warnings.length > 0) {
                console.warn('Order validation warnings:', validation.warnings.join(', '));
            }
        }

        const orderData: Record<string, any> = {
            pair: orderRequest.pair,
            type: orderRequest.type,
            ordertype: orderRequest.ordertype,
            volume: orderRequest.volume
        };

        // Add optional parameters
        if (orderRequest.price) orderData.price = orderRequest.price;
        if (orderRequest.price2) orderData.price2 = orderRequest.price2;
        if (orderRequest.leverage) orderData.leverage = orderRequest.leverage;
        if (orderRequest.oflags) orderData.oflags = orderRequest.oflags;
        if (orderRequest.starttm) orderData.starttm = orderRequest.starttm;
        if (orderRequest.expiretm) orderData.expiretm = orderRequest.expiretm;
        if (orderRequest.userref) orderData.userref = orderRequest.userref;
        if (orderRequest.validate) orderData.validate = orderRequest.validate;
        if (orderRequest.close) {
            orderData['close[ordertype]'] = orderRequest.close.ordertype;
            if (orderRequest.close.price) orderData['close[price]'] = orderRequest.close.price;
            if (orderRequest.close.price2) orderData['close[price2]'] = orderRequest.close.price2;
        }

        const result = await this.makePrivateRequest<KrakenOrderResponse>('AddOrder', orderData);
        
        console.log('Order placed successfully:', result.txid);
        this.emit('orderPlaced', { orderRequest, response: result });
        
        return result;
    }

    async cancelOrder(txid: string): Promise<{ count: number; pending?: boolean }> {
        console.log(`Cancelling order: ${txid}`);
        const result = await this.makePrivateRequest<{ count: number; pending?: boolean }>('CancelOrder', { txid });
        
        // Remove from cache
        this.orderCache.delete(txid);
        
        console.log('Order cancelled:', result);
        this.emit('orderCancelled', { txid, result });
        
        return result;
    }

    async cancelAllOrders(): Promise<{ count: number }> {
        console.log('Cancelling all open orders...');
        const result = await this.makePrivateRequest<{ count: number }>('CancelAll');
        
        // Clear order cache
        this.orderCache.clear();
        
        console.log('All orders cancelled:', result);
        this.emit('allOrdersCancelled', result);
        
        return result;
    }

    async getOpenOrders(): Promise<{ open: Record<string, KrakenOrderInfo> }> {
        const result = await this.makePrivateRequest<{ open: Record<string, KrakenOrderInfo> }>('OpenOrders');
        
        // Update cache
        Object.entries(result.open).forEach(([txid, orderInfo]) => {
            this.orderCache.set(txid, orderInfo);
        });
        
        return result;
    }

    async getOrderStatus(txid: string): Promise<KrakenOrderInfo | null> {
        // Check cache first
        if (this.orderCache.has(txid)) {
            return this.orderCache.get(txid)!;
        }

        try {
            const result = await this.makePrivateRequest<{ [txid: string]: KrakenOrderInfo }>('QueryOrders', { txid });
            const orderInfo = result[txid];
            
            if (orderInfo) {
                this.orderCache.set(txid, orderInfo);
                return orderInfo;
            }
            
            return null;
        } catch (error) {
            console.error(`Failed to get order status for ${txid}:`, error);
            return null;
        }
    }

    // Convenience methods for common order types
    async placeLimitBuyOrder(pair: string, volume: string, price: string, validate = true): Promise<string> {
        const orderRequest: KrakenOrderRequest = {
            pair,
            type: 'buy',
            ordertype: 'limit',
            volume,
            price
        };

        const response = await this.placeOrder(orderRequest, validate);
        return response.txid[0];
    }

    async placeLimitSellOrder(pair: string, volume: string, price: string, validate = true): Promise<string> {
        const orderRequest: KrakenOrderRequest = {
            pair,
            type: 'sell',
            ordertype: 'limit',
            volume,
            price
        };

        const response = await this.placeOrder(orderRequest, validate);
        return response.txid[0];
    }

    async placeMarketOrder(pair: string, type: 'buy' | 'sell', volume: string, validate = true): Promise<string> {
        const orderRequest: KrakenOrderRequest = {
            pair,
            type,
            ordertype: 'market',
            volume
        };

        const response = await this.placeOrder(orderRequest, validate);
        return response.txid[0];
    }

    async placeStopLossOrder(pair: string, type: 'buy' | 'sell', volume: string, stopPrice: string, validate = true): Promise<string> {
        const orderRequest: KrakenOrderRequest = {
            pair,
            type,
            ordertype: 'stop-loss',
            volume,
            price: stopPrice
        };

        const response = await this.placeOrder(orderRequest, validate);
        return response.txid[0];
    }

    async placeTakeProfitOrder(pair: string, type: 'buy' | 'sell', volume: string, profitPrice: string, validate = true): Promise<string> {
        const orderRequest: KrakenOrderRequest = {
            pair,
            type,
            ordertype: 'take-profit',
            volume,
            price: profitPrice
        };

        const response = await this.placeOrder(orderRequest, validate);
        return response.txid[0];
    }

    // WebSocket Management
    async connectWebSocket(): Promise<void> {
        if (!this.wsClient) {
            throw new Error('WebSocket client not initialized');
        }
        await this.wsClient.connect();
    }

    async disconnectWebSocket(): Promise<void> {
        if (this.wsClient) {
            await this.wsClient.disconnect();
            this.isWebSocketEnabled = false;
        }
    }

    async subscribeToTicker(symbols: string[]): Promise<void> {
        if (!this.wsClient || !this.isWebSocketEnabled) {
            throw new Error('WebSocket not connected');
        }
        await this.wsClient.subscribeTicker(symbols);
    }

    async subscribeToOrderUpdates(): Promise<void> {
        if (!this.wsClient || !this.isWebSocketEnabled) {
            throw new Error('WebSocket not connected');
        }
        await this.wsClient.subscribeOrderUpdates();
    }

    async subscribeToBalanceUpdates(): Promise<void> {
        if (!this.wsClient || !this.isWebSocketEnabled) {
            throw new Error('WebSocket not connected');
        }
        await this.wsClient.subscribeBalanceUpdates();
    }

    // Connection and Health Management
    async validateConnection(): Promise<boolean> {
        try {
            console.log('Validating Enhanced Kraken API connection...');
            
            // Test public API
            await this.getServerTime();
            
            // Test private API if credentials available
            if (this.apiKey && this.apiSecret) {
                await this.getAccountBalance();
            }
            
            this.connectionHealthy = true;
            console.log('Enhanced Kraken API connection validated successfully');
            return true;
            
        } catch (error) {
            this.connectionHealthy = false;
            console.error('Enhanced Kraken API connection validation failed:', error);
            return false;
        }
    }

    isConnectionHealthy(): boolean {
        return this.connectionHealthy && (Date.now() - this.lastHealthCheck) < this.healthCheckInterval * 2;
    }

    getRateLimitStatus(): { remaining: number; resetTime: number } {
        return {
            remaining: this.rateLimiter.getRemainingRequests(),
            resetTime: this.rateLimiter.getResetTime()
        };
    }

    // Emergency Controls
    enableEmergencyStop(): void {
        this.emergencyStopEnabled = true;
        console.warn('EMERGENCY STOP ENABLED - All trading operations suspended');
        this.emit('emergencyStopEnabled');
    }

    disableEmergencyStop(): void {
        this.emergencyStopEnabled = false;
        console.log('Emergency stop disabled - Trading operations resumed');
        this.emit('emergencyStopDisabled');
    }

    isEmergencyStopEnabled(): boolean {
        return this.emergencyStopEnabled;
    }

    // Utility methods
    getLastPrice(symbol: string): number | undefined {
        return this.lastPrices.get(symbol);
    }

    getCachedOrderUpdate(orderId: string): KrakenOrderInfo | undefined {
        return this.orderCache.get(orderId);
    }

    getCachedBalance(currency: string): number | undefined {
        return this.balanceCache.get(currency);
    }

    isWebSocketConnected(): boolean {
        return this.isWebSocketEnabled;
    }

    // Cleanup
    async disconnect(): Promise<void> {
        console.log('Disconnecting Enhanced Kraken Client...');
        
        if (this.wsClient) {
            await this.disconnectWebSocket();
        }
        
        // Clear caches
        this.lastPrices.clear();
        this.orderCache.clear();
        this.balanceCache.clear();
        this.assetPairsCache.clear();
        this.tradingPairInfoCache.clear();
        
        console.log('Enhanced Kraken Client disconnected');
    }

    // Missing methods needed by other services
    async getOHLCData(symbol: string, interval: string = '1', count: number = 100): Promise<any[]> {
        try {
            const params = {
                pair: symbol,
                interval: interval,
                since: Math.floor(Date.now() / 1000) - (count * 60) // Approximate time for count candles
            };
            
            const result = await this.makePublicRequest<any>('OHLC', params);
            
            // Return the OHLC data array
            const pairData = result[Object.keys(result)[0]];
            return Array.isArray(pairData) ? pairData.slice(-count) : [];
        } catch (error) {
            console.error(`Error getting OHLC data for ${symbol}:`, error);
            return [];
        }
    }

    async getPortfolioValue(): Promise<number> {
        try {
            const balance = await this.getAccountBalance();
            let totalValue = 0;
            
            // Convert all balances to USD equivalent
            for (const [currency, amount] of Object.entries(balance)) {
                const numericAmount = parseFloat(amount);
                if (numericAmount > 0) {
                    if (currency === 'ZUSD' || currency === 'USD') {
                        totalValue += numericAmount;
                    } else {
                        // Try to get USD price for other currencies
                        try {
                            const pair = `${currency}USD`;
                            const price = await this.getCurrentPrice(pair, false);
                            totalValue += numericAmount * price;
                        } catch {
                            // If can't get price, skip this currency
                            console.warn(`Could not get USD price for ${currency}`);
                        }
                    }
                }
            }
            
            return totalValue;
        } catch (error) {
            console.error('Error calculating portfolio value:', error);
            return 0;
        }
    }
} 
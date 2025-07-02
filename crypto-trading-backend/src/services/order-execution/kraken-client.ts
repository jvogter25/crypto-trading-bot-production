import * as crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { KrakenWebSocketClient, TickerData, OrderUpdate, BalanceUpdate } from './kraken-websocket-client';
import { EventEmitter } from 'events';

interface KrakenApiResponse<T = any> {
    error: string[];
    result: T;
}

interface KrakenOrderRequest {
    pair: string;
    type: 'buy' | 'sell';
    ordertype: 'market' | 'limit' | 'stop-loss' | 'take-profit';
    volume: string;
    price?: string;
    price2?: string;
    leverage?: string;
    oflags?: string;
    starttm?: string;
    expiretm?: string;
    userref?: string;
    validate?: boolean;
}

interface KrakenOrderResponse {
    descr: {
        order: string;
    };
    txid: string[];
}

interface KrakenBalance {
    [currency: string]: string;
}

interface KrakenTicker {
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

export class KrakenClient extends EventEmitter {
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly baseUrl = 'https://api.kraken.com';
    private readonly timeout = 30000; // 30 seconds
    private wsClient: KrakenWebSocketClient | null = null;
    private isWebSocketEnabled = false;
    private lastPrices: Map<string, number> = new Map();
    private orderCache: Map<string, any> = new Map();

    constructor(enableWebSocket = true) {
        super();
        this.apiKey = process.env.KRAKEN_API_KEY || '';
        this.apiSecret = process.env.KRAKEN_API_SECRET || '';
        
        if (!this.apiKey || !this.apiSecret) {
            console.warn('Kraken API credentials not found in environment variables');
            // Don't throw error to allow testing without credentials
        }

        if (enableWebSocket && this.apiKey && this.apiSecret) {
            this.initializeWebSocket();
        }
    }

    private initializeWebSocket(): void {
        try {
            this.wsClient = new KrakenWebSocketClient({
                apiKey: this.apiKey,
                apiSecret: this.apiSecret
            });

            this.wsClient.on('connected', () => {
                console.log('Kraken WebSocket connected');
                this.isWebSocketEnabled = true;
                this.emit('wsConnected');
            });

            this.wsClient.on('disconnected', () => {
                console.log('Kraken WebSocket disconnected');
                this.isWebSocketEnabled = false;
                this.emit('wsDisconnected');
            });

            this.wsClient.on('ticker', (tickerData: TickerData) => {
                this.lastPrices.set(tickerData.symbol, tickerData.last);
                this.emit('priceUpdate', tickerData);
            });

            this.wsClient.on('orderUpdate', (orderUpdate: OrderUpdate) => {
                this.orderCache.set(orderUpdate.orderId, orderUpdate);
                this.emit('orderUpdate', orderUpdate);
            });

            this.wsClient.on('balanceUpdate', (balanceUpdate: BalanceUpdate) => {
                this.emit('balanceUpdate', balanceUpdate);
            });

            this.wsClient.on('error', (error: Error) => {
                console.error('Kraken WebSocket error:', error);
                this.emit('wsError', error);
            });

        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
        }
    }

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

    getLastPrice(symbol: string): number | undefined {
        return this.lastPrices.get(symbol);
    }

    getCachedOrderUpdate(orderId: string): OrderUpdate | undefined {
        return this.orderCache.get(orderId);
    }

    private generateSignature(path: string, nonce: number, postData: string): string {
        const message = path + crypto.createHash('sha256').update(nonce + postData).digest();
        const secret = Buffer.from(this.apiSecret, 'base64');
        return crypto.createHmac('sha512', secret).update(message).digest('base64');
    }

    private async makePrivateRequest<T>(endpoint: string, data: Record<string, any> = {}): Promise<T> {
        const path = `/0/private/${endpoint}`;
        const nonce = Date.now() * 1000;
        const postData = new URLSearchParams({ nonce: nonce.toString(), ...data }).toString();
        
        const signature = this.generateSignature(path, nonce, postData);
        
        try {
            const response: AxiosResponse<KrakenApiResponse<T>> = await axios.post(
                `${this.baseUrl}${path}`,
                postData,
                {
                    headers: {
                        'API-Key': this.apiKey,
                        'API-Sign': signature,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: this.timeout,
                }
            );

            if (response.data.error && response.data.error.length > 0) {
                throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
            }

            return response.data.result;
        } catch (error) {
            console.error(`Kraken API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    private async makePublicRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
        const path = `/0/public/${endpoint}`;
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
        
        try {
            const response: AxiosResponse<KrakenApiResponse<T>> = await axios.get(url, {
                timeout: this.timeout,
            });

            if (response.data.error && response.data.error.length > 0) {
                throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
            }

            return response.data.result;
        } catch (error) {
            console.error(`Kraken public API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    async getAccountBalance(): Promise<KrakenBalance> {
        try {
            console.log('Fetching account balance from Kraken...');
            const balance = await this.makePrivateRequest<KrakenBalance>('Balance');
            console.log('Account balance retrieved successfully');
            return balance;
        } catch (error) {
            console.error('Failed to get account balance:', error);
            throw error;
        }
    }

    async getTicker(pair: string): Promise<KrakenTicker> {
        try {
            console.log(`Fetching ticker for ${pair}...`);
            const result = await this.makePublicRequest<{ [key: string]: KrakenTicker }>('Ticker', { pair });
            const ticker = result[Object.keys(result)[0]];
            console.log(`Ticker for ${pair} retrieved: ${ticker.c[0]}`);
            return ticker;
        } catch (error) {
            console.error(`Failed to get ticker for ${pair}:`, error);
            throw error;
        }
    }

    async getCurrentPrice(pair: string): Promise<number> {
        try {
            const ticker = await this.getTicker(pair);
            return parseFloat(ticker.c[0]); // Last trade price
        } catch (error) {
            console.error(`Failed to get current price for ${pair}:`, error);
            throw error;
        }
    }

    async placeOrder(orderRequest: KrakenOrderRequest): Promise<KrakenOrderResponse> {
        try {
            console.log(`Placing ${orderRequest.type} order for ${orderRequest.volume} ${orderRequest.pair} at ${orderRequest.price || 'market'}`);
            
            const orderData: Record<string, any> = {
                pair: orderRequest.pair,
                type: orderRequest.type,
                ordertype: orderRequest.ordertype,
                volume: orderRequest.volume,
            };

            if (orderRequest.price) orderData.price = orderRequest.price;
            if (orderRequest.price2) orderData.price2 = orderRequest.price2;
            if (orderRequest.leverage) orderData.leverage = orderRequest.leverage;
            if (orderRequest.oflags) orderData.oflags = orderRequest.oflags;
            if (orderRequest.starttm) orderData.starttm = orderRequest.starttm;
            if (orderRequest.expiretm) orderData.expiretm = orderRequest.expiretm;
            if (orderRequest.userref) orderData.userref = orderRequest.userref;
            if (orderRequest.validate) orderData.validate = orderRequest.validate;

            const result = await this.makePrivateRequest<KrakenOrderResponse>('AddOrder', orderData);
            
            console.log(`Order placed successfully. Transaction ID: ${result.txid[0]}`);
            return result;
        } catch (error) {
            console.error('Failed to place order:', error);
            throw error;
        }
    }

    async cancelOrder(txid: string): Promise<{ count: number; pending?: boolean }> {
        try {
            console.log(`Cancelling order ${txid}...`);
            const result = await this.makePrivateRequest<{ count: number; pending?: boolean }>('CancelOrder', { txid });
            console.log(`Order ${txid} cancelled successfully`);
            return result;
        } catch (error) {
            console.error(`Failed to cancel order ${txid}:`, error);
            throw error;
        }
    }

    async getOpenOrders(): Promise<{ open: Record<string, any> }> {
        try {
            console.log('Fetching open orders...');
            const result = await this.makePrivateRequest<{ open: Record<string, any> }>('OpenOrders');
            console.log(`Retrieved ${Object.keys(result.open || {}).length} open orders`);
            return result;
        } catch (error) {
            console.error('Failed to get open orders:', error);
            throw error;
        }
    }

    async getOrderStatus(txid: string): Promise<any> {
        try {
            console.log(`Checking status of order ${txid}...`);
            const result = await this.makePrivateRequest('QueryOrders', { txid });
            return result;
        } catch (error) {
            console.error(`Failed to get order status for ${txid}:`, error);
            throw error;
        }
    }

    // Grid trading specific methods
    async placeLimitBuyOrder(pair: string, volume: string, price: string): Promise<string> {
        try {
            const orderRequest: KrakenOrderRequest = {
                pair,
                type: 'buy',
                ordertype: 'limit',
                volume,
                price
            };

            const result = await this.placeOrder(orderRequest);
            return result.txid[0];
        } catch (error) {
            console.error('Failed to place limit buy order:', error);
            throw error;
        }
    }

    async placeLimitSellOrder(pair: string, volume: string, price: string): Promise<string> {
        try {
            const orderRequest: KrakenOrderRequest = {
                pair,
                type: 'sell',
                ordertype: 'limit',
                volume,
                price
            };

            const result = await this.placeOrder(orderRequest);
            return result.txid[0];
        } catch (error) {
            console.error('Failed to place limit sell order:', error);
            throw error;
        }
    }

    async placeMarketOrder(pair: string, type: 'buy' | 'sell', volume: string): Promise<string> {
        try {
            const orderRequest: KrakenOrderRequest = {
                pair,
                type,
                ordertype: 'market',
                volume
            };

            const result = await this.placeOrder(orderRequest);
            return result.txid[0];
        } catch (error) {
            console.error('Failed to place market order:', error);
            throw error;
        }
    }

    // Validation method for testing connection
    async validateConnection(): Promise<boolean> {
        try {
            console.log('Validating Kraken API connection...');
            await this.getAccountBalance();
            console.log('Kraken API connection validated successfully');
            return true;
        } catch (error) {
            console.error('Kraken API connection validation failed:', error);
            return false;
        }
    }

    // Get trading pair information
    async getAssetPairs(): Promise<any> {
        try {
            console.log('Fetching asset pairs...');
            const result = await this.makePublicRequest('AssetPairs');
            return result;
        } catch (error) {
            console.error('Failed to get asset pairs:', error);
            throw error;
        }
    }
} 
import WebSocket from 'ws';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

interface KrakenWebSocketConfig {
    apiKey?: string;
    apiSecret?: string;
    reconnectInterval?: number;
    heartbeatInterval?: number;
    maxReconnectAttempts?: number;
}

export interface TickerData {
    symbol: string;
    ask: number;
    askQty: number;
    bid: number;
    bidQty: number;
    last: number;
    change: number;
    changePct: number;
    high: number;
    low: number;
    volume: number;
    vwap: number;
    timestamp: number;
}

export interface OrderUpdate {
    orderId: string;
    status: string;
    symbol: string;
    side: string;
    orderType: string;
    quantity: number;
    price?: number;
    filledQuantity: number;
    averagePrice?: number;
    timestamp: number;
    fees?: number;
}

export interface BalanceUpdate {
    currency: string;
    balance: number;
    available: number;
    timestamp: number;
}

export class KrakenWebSocketClient extends EventEmitter {
    private ws: WebSocket | null = null;
    private authWs: WebSocket | null = null;
    private config: KrakenWebSocketConfig;
    private reconnectAttempts = 0;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private isConnected = false;
    private isAuthConnected = false;
    private subscribedChannels: Set<string> = new Set();
    private authSubscribedChannels: Set<string> = new Set();

    private readonly publicUrl = 'wss://ws.kraken.com/v2';
    private readonly privateUrl = 'wss://ws-auth.kraken.com/v2';

    constructor(config: KrakenWebSocketConfig = {}) {
        super();
        this.config = {
            reconnectInterval: 5000,
            heartbeatInterval: 30000,
            maxReconnectAttempts: 10,
            ...config
        };

        // Load credentials from environment if not provided
        if (!this.config.apiKey && process.env.KRAKEN_API_KEY) {
            this.config.apiKey = process.env.KRAKEN_API_KEY;
        }
        if (!this.config.apiSecret && process.env.KRAKEN_API_SECRET) {
            this.config.apiSecret = process.env.KRAKEN_API_SECRET;
        }
    }

    async connect(): Promise<void> {
        try {
            console.log('Connecting to Kraken WebSocket...');
            await this.connectPublic();
            
            if (this.config.apiKey && this.config.apiSecret) {
                await this.connectPrivate();
            }
        } catch (error) {
            console.error('Failed to connect to Kraken WebSocket:', error);
            throw error;
        }
    }

    private async connectPublic(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.publicUrl);

            this.ws.on('open', () => {
                console.log('Kraken public WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.emit('connected');
                resolve();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handlePublicMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            this.ws.on('close', (code: number, reason: Buffer) => {
                console.log(`Kraken public WebSocket closed: ${code} - ${reason.toString()}`);
                this.isConnected = false;
                this.stopHeartbeat();
                this.emit('disconnected');
                this.handleReconnect();
            });

            this.ws.on('error', (error: Error) => {
                console.error('Kraken public WebSocket error:', error);
                this.emit('error', error);
                reject(error);
            });

            this.ws.on('pong', () => {
                // Handle pong response
                console.log('Received pong from Kraken public WebSocket');
            });
        });
    }

    private async connectPrivate(): Promise<void> {
        if (!this.config.apiKey || !this.config.apiSecret) {
            throw new Error('API credentials required for private WebSocket connection');
        }

        return new Promise((resolve, reject) => {
            this.authWs = new WebSocket(this.privateUrl);

            this.authWs.on('open', () => {
                console.log('Kraken private WebSocket connected');
                this.isAuthConnected = true;
                this.authenticatePrivateConnection();
                this.emit('authConnected');
                resolve();
            });

            this.authWs.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handlePrivateMessage(message);
                } catch (error) {
                    console.error('Error parsing private WebSocket message:', error);
                }
            });

            this.authWs.on('close', (code: number, reason: Buffer) => {
                console.log(`Kraken private WebSocket closed: ${code} - ${reason.toString()}`);
                this.isAuthConnected = false;
                this.emit('authDisconnected');
                this.handleAuthReconnect();
            });

            this.authWs.on('error', (error: Error) => {
                console.error('Kraken private WebSocket error:', error);
                this.emit('authError', error);
                reject(error);
            });
        });
    }

    private authenticatePrivateConnection(): void {
        if (!this.authWs || !this.config.apiKey || !this.config.apiSecret) {
            return;
        }

        const nonce = Date.now().toString();
        const authMessage = {
            method: 'subscribe',
            params: {
                channel: 'balances',
                token: this.generateAuthToken(nonce)
            }
        };

        this.authWs.send(JSON.stringify(authMessage));
    }

    private generateAuthToken(nonce: string): string {
        if (!this.config.apiSecret) {
            throw new Error('API secret required for authentication');
        }

        const message = nonce;
        const secret = Buffer.from(this.config.apiSecret, 'base64');
        return crypto.createHmac('sha512', secret).update(message).digest('base64');
    }

    private handlePublicMessage(message: any): void {
        if (message.channel === 'ticker') {
            this.handleTickerUpdate(message);
        } else if (message.method === 'pong') {
            // Handle pong response
        } else if (message.error) {
            console.error('Kraken WebSocket error:', message.error);
            this.emit('error', new Error(message.error));
        }
    }

    private handlePrivateMessage(message: any): void {
        if (message.channel === 'executions') {
            this.handleOrderUpdate(message);
        } else if (message.channel === 'balances') {
            this.handleBalanceUpdate(message);
        } else if (message.error) {
            console.error('Kraken private WebSocket error:', message.error);
            this.emit('authError', new Error(message.error));
        }
    }

    private handleTickerUpdate(message: any): void {
        if (!message.data || !Array.isArray(message.data)) {
            return;
        }

        message.data.forEach((ticker: any) => {
            const tickerData: TickerData = {
                symbol: ticker.symbol,
                ask: parseFloat(ticker.ask),
                askQty: parseFloat(ticker.ask_qty),
                bid: parseFloat(ticker.bid),
                bidQty: parseFloat(ticker.bid_qty),
                last: parseFloat(ticker.last),
                change: parseFloat(ticker.change),
                changePct: parseFloat(ticker.change_pct),
                high: parseFloat(ticker.high),
                low: parseFloat(ticker.low),
                volume: parseFloat(ticker.volume),
                vwap: parseFloat(ticker.vwap),
                timestamp: Date.now()
            };

            this.emit('ticker', tickerData);
        });
    }

    private handleOrderUpdate(message: any): void {
        if (!message.data || !Array.isArray(message.data)) {
            return;
        }

        message.data.forEach((order: any) => {
            const orderUpdate: OrderUpdate = {
                orderId: order.order_id,
                status: order.order_status,
                symbol: order.symbol,
                side: order.side,
                orderType: order.order_type,
                quantity: parseFloat(order.order_qty),
                price: order.limit_price ? parseFloat(order.limit_price) : undefined,
                filledQuantity: parseFloat(order.cum_qty),
                averagePrice: order.avg_price ? parseFloat(order.avg_price) : undefined,
                timestamp: new Date(order.timestamp).getTime(),
                fees: order.fee ? parseFloat(order.fee) : undefined
            };

            this.emit('orderUpdate', orderUpdate);
        });
    }

    private handleBalanceUpdate(message: any): void {
        if (!message.data || !Array.isArray(message.data)) {
            return;
        }

        message.data.forEach((balance: any) => {
            const balanceUpdate: BalanceUpdate = {
                currency: balance.asset,
                balance: parseFloat(balance.balance),
                available: parseFloat(balance.available),
                timestamp: Date.now()
            };

            this.emit('balanceUpdate', balanceUpdate);
        });
    }

    async subscribeTicker(symbols: string[]): Promise<void> {
        if (!this.isConnected || !this.ws) {
            throw new Error('WebSocket not connected');
        }

        const subscribeMessage = {
            method: 'subscribe',
            params: {
                channel: 'ticker',
                symbol: symbols,
                event_trigger: 'bbo'
            }
        };

        this.ws.send(JSON.stringify(subscribeMessage));
        symbols.forEach(symbol => this.subscribedChannels.add(`ticker:${symbol}`));
        console.log(`Subscribed to ticker updates for: ${symbols.join(', ')}`);
    }

    async subscribeOrderUpdates(): Promise<void> {
        if (!this.isAuthConnected || !this.authWs) {
            throw new Error('Private WebSocket not connected');
        }

        const subscribeMessage = {
            method: 'subscribe',
            params: {
                channel: 'executions',
                token: this.generateAuthToken(Date.now().toString())
            }
        };

        this.authWs.send(JSON.stringify(subscribeMessage));
        this.authSubscribedChannels.add('executions');
        console.log('Subscribed to order updates');
    }

    async subscribeBalanceUpdates(): Promise<void> {
        if (!this.isAuthConnected || !this.authWs) {
            throw new Error('Private WebSocket not connected');
        }

        const subscribeMessage = {
            method: 'subscribe',
            params: {
                channel: 'balances',
                token: this.generateAuthToken(Date.now().toString())
            }
        };

        this.authWs.send(JSON.stringify(subscribeMessage));
        this.authSubscribedChannels.add('balances');
        console.log('Subscribed to balance updates');
    }

    private startHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
            }
            if (this.authWs && this.authWs.readyState === WebSocket.OPEN) {
                this.authWs.ping();
            }
        }, this.config.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
            console.error('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);

        this.reconnectTimer = setTimeout(() => {
            this.connectPublic().catch(error => {
                console.error('Reconnection failed:', error);
            });
        }, this.config.reconnectInterval);
    }

    private handleAuthReconnect(): void {
        if (!this.config.apiKey || !this.config.apiSecret) {
            return;
        }

        setTimeout(() => {
            this.connectPrivate().catch(error => {
                console.error('Private WebSocket reconnection failed:', error);
            });
        }, this.config.reconnectInterval);
    }

    async disconnect(): Promise<void> {
        console.log('Disconnecting from Kraken WebSocket...');
        
        this.stopHeartbeat();
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        if (this.authWs) {
            this.authWs.close();
            this.authWs = null;
        }

        this.isConnected = false;
        this.isAuthConnected = false;
        this.subscribedChannels.clear();
        this.authSubscribedChannels.clear();
    }

    isPublicConnected(): boolean {
        return this.isConnected;
    }

    isPrivateConnected(): boolean {
        return this.isAuthConnected;
    }

    getSubscribedChannels(): string[] {
        return Array.from(this.subscribedChannels);
    }

    getAuthSubscribedChannels(): string[] {
        return Array.from(this.authSubscribedChannels);
    }
} 
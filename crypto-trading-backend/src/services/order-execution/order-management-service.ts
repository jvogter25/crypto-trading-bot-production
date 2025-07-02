import { EventEmitter } from 'events';
import { EnhancedKrakenClient, KrakenOrderRequest, KrakenOrderInfo, OrderValidationResult } from './enhanced-kraken-client';
import { createClient } from '@supabase/supabase-js';

interface OrderRecord {
    id: string;
    external_order_id: string;
    trading_pair: string;
    order_type: 'buy' | 'sell';
    order_subtype: 'market' | 'limit' | 'stop-loss' | 'take-profit';
    quantity: number;
    price?: number;
    status: 'pending' | 'open' | 'filled' | 'cancelled' | 'rejected' | 'expired';
    filled_quantity: number;
    average_fill_price?: number;
    fees: number;
    created_at: Date;
    updated_at: Date;
    strategy_id?: string;
    grid_level?: number;
    profit_target?: number;
    stop_loss?: number;
    metadata?: Record<string, any>;
}

interface OrderExecutionResult {
    success: boolean;
    orderId?: string;
    externalOrderId?: string;
    error?: string;
    validation?: OrderValidationResult;
    executionTime: number;
}

interface OrderUpdateEvent {
    orderId: string;
    externalOrderId: string;
    status: string;
    filledQuantity: number;
    averagePrice?: number;
    fees?: number;
    timestamp: Date;
}

export class OrderManagementService extends EventEmitter {
    private krakenClient: EnhancedKrakenClient;
    private supabase: any;
    private orderCache: Map<string, OrderRecord> = new Map();
    private orderStatusMonitor: NodeJS.Timeout | null = null;
    private readonly monitorInterval = 5000; // 5 seconds
    private isMonitoring = false;

    constructor() {
        super();
        
        // Initialize Kraken client
        this.krakenClient = new EnhancedKrakenClient({
            enableWebSocket: true,
            rateLimitRpm: 60,
            timeout: 30000
        });

        // Initialize Supabase client
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        this.setupEventListeners();
        this.startOrderMonitoring();
    }

    private setupEventListeners(): void {
        // Kraken client events
        this.krakenClient.on('orderUpdate', (orderUpdate) => {
            this.handleOrderUpdate(orderUpdate);
        });

        this.krakenClient.on('orderPlaced', (data) => {
            console.log(`📋 Order placed: ${data.response.txid[0]}`);
            this.emit('orderPlaced', data);
        });

        this.krakenClient.on('orderCancelled', (data) => {
            console.log(`❌ Order cancelled: ${data.txid}`);
            this.emit('orderCancelled', data);
        });

        this.krakenClient.on('emergencyStopEnabled', () => {
            console.log('🚨 Emergency stop enabled - suspending all order operations');
            this.emit('emergencyStop', { enabled: true });
        });

        this.krakenClient.on('connectionError', (error) => {
            console.error('🔌 Kraken connection error:', error);
            this.emit('connectionError', error);
        });
    }

    private async handleOrderUpdate(orderUpdate: any): Promise<void> {
        try {
            const orderRecord = await this.getOrderByExternalId(orderUpdate.orderId);
            if (orderRecord) {
                // Update order record
                const updatedRecord: Partial<OrderRecord> = {
                    status: this.mapKrakenStatusToInternal(orderUpdate.status),
                    filled_quantity: orderUpdate.filledQuantity || 0,
                    average_fill_price: orderUpdate.averagePrice,
                    fees: orderUpdate.fees || 0,
                    updated_at: new Date()
                };

                await this.updateOrderRecord(orderRecord.id, updatedRecord);

                // Emit update event
                const updateEvent: OrderUpdateEvent = {
                    orderId: orderRecord.id,
                    externalOrderId: orderUpdate.orderId,
                    status: updatedRecord.status!,
                    filledQuantity: updatedRecord.filled_quantity!,
                    averagePrice: updatedRecord.average_fill_price,
                    fees: updatedRecord.fees,
                    timestamp: new Date()
                };

                this.emit('orderUpdated', updateEvent);

                // Handle filled orders
                if (updatedRecord.status === 'filled') {
                    await this.handleFilledOrder(orderRecord, updatedRecord);
                }
            }
        } catch (error) {
            console.error('Error handling order update:', error);
        }
    }

    private async handleFilledOrder(orderRecord: OrderRecord, update: Partial<OrderRecord>): Promise<void> {
        try {
            // Calculate profit/loss if this was a sell order
            if (orderRecord.order_type === 'sell' && update.average_fill_price) {
                const totalValue = update.average_fill_price * orderRecord.quantity;
                const totalFees = update.fees || 0;
                const netProceeds = totalValue - totalFees;

                // Emit filled order event with profit calculation
                this.emit('orderFilled', {
                    orderId: orderRecord.id,
                    externalOrderId: orderRecord.external_order_id,
                    orderType: orderRecord.order_type,
                    quantity: orderRecord.quantity,
                    averagePrice: update.average_fill_price,
                    totalValue,
                    fees: totalFees,
                    netProceeds,
                    strategyId: orderRecord.strategy_id,
                    gridLevel: orderRecord.grid_level
                });

                // If this was a profit-taking order, handle reinvestment
                if (orderRecord.metadata?.isProfitTaking) {
                    await this.handleProfitReinvestment(orderRecord, netProceeds);
                }
            }

            console.log(`✅ Order filled: ${orderRecord.external_order_id} - ${orderRecord.order_type} ${orderRecord.quantity} ${orderRecord.trading_pair} @ $${update.average_fill_price}`);

        } catch (error) {
            console.error('Error handling filled order:', error);
        }
    }

    private async handleProfitReinvestment(orderRecord: OrderRecord, netProceeds: number): Promise<void> {
        try {
            const reinvestmentPercent = parseFloat(process.env.REINVESTMENT_PERCENT || '70') / 100;
            const reinvestmentAmount = netProceeds * reinvestmentPercent;
            const profitExtraction = netProceeds - reinvestmentAmount;

            // Log profit distribution
            console.log(`💰 Profit distribution for order ${orderRecord.external_order_id}:`);
            console.log(`   Total proceeds: $${netProceeds.toFixed(2)}`);
            console.log(`   Reinvestment (${(reinvestmentPercent * 100).toFixed(0)}%): $${reinvestmentAmount.toFixed(2)}`);
            console.log(`   Profit extraction: $${profitExtraction.toFixed(2)}`);

            // Emit profit distribution event
            this.emit('profitDistributed', {
                orderId: orderRecord.id,
                totalProceeds: netProceeds,
                reinvestmentAmount,
                profitExtraction,
                reinvestmentPercent: reinvestmentPercent * 100,
                strategyId: orderRecord.strategy_id
            });

            // Record profit in database
            await this.recordProfitDistribution(orderRecord, netProceeds, reinvestmentAmount, profitExtraction);

        } catch (error) {
            console.error('Error handling profit reinvestment:', error);
        }
    }

    private async recordProfitDistribution(
        orderRecord: OrderRecord,
        totalProceeds: number,
        reinvestmentAmount: number,
        profitExtraction: number
    ): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('profit_distributions')
                .insert({
                    order_id: orderRecord.id,
                    external_order_id: orderRecord.external_order_id,
                    trading_pair: orderRecord.trading_pair,
                    total_proceeds: totalProceeds,
                    reinvestment_amount: reinvestmentAmount,
                    profit_extraction: profitExtraction,
                    strategy_id: orderRecord.strategy_id,
                    grid_level: orderRecord.grid_level,
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error recording profit distribution:', error);
            }
        } catch (error) {
            console.error('Error recording profit distribution:', error);
        }
    }

    private mapKrakenStatusToInternal(krakenStatus: string): OrderRecord['status'] {
        const statusMap: Record<string, OrderRecord['status']> = {
            'pending': 'pending',
            'open': 'open',
            'closed': 'filled',
            'canceled': 'cancelled',
            'expired': 'expired'
        };

        return statusMap[krakenStatus.toLowerCase()] || 'pending';
    }

    async placeOrder(orderRequest: {
        tradingPair: string;
        orderType: 'buy' | 'sell';
        orderSubtype: 'market' | 'limit' | 'stop-loss' | 'take-profit';
        quantity: number;
        price?: number;
        strategyId?: string;
        gridLevel?: number;
        profitTarget?: number;
        stopLoss?: number;
        metadata?: Record<string, any>;
    }): Promise<OrderExecutionResult> {
        const startTime = Date.now();

        try {
            // Check if emergency stop is enabled
            if (this.krakenClient.isEmergencyStopEnabled()) {
                return {
                    success: false,
                    error: 'Emergency stop is enabled - order placement suspended',
                    executionTime: Date.now() - startTime
                };
            }

            // Build Kraken order request
            const krakenOrderRequest: KrakenOrderRequest = {
                pair: orderRequest.tradingPair,
                type: orderRequest.orderType,
                ordertype: orderRequest.orderSubtype,
                volume: orderRequest.quantity.toString(),
                price: orderRequest.price?.toString()
            };

            // Validate order
            const validation = await this.krakenClient.validateOrder(krakenOrderRequest);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: `Order validation failed: ${validation.errors.join(', ')}`,
                    validation,
                    executionTime: Date.now() - startTime
                };
            }

            // Apply validation adjustments
            if (validation.adjustedPrice) {
                krakenOrderRequest.price = validation.adjustedPrice;
            }
            if (validation.adjustedQuantity) {
                krakenOrderRequest.volume = validation.adjustedQuantity;
            }

            // Place order with Kraken
            const krakenResponse = await this.krakenClient.placeOrder(krakenOrderRequest, false);
            const externalOrderId = krakenResponse.txid[0];

            // Create order record
            const orderRecord: Omit<OrderRecord, 'id'> = {
                external_order_id: externalOrderId,
                trading_pair: orderRequest.tradingPair,
                order_type: orderRequest.orderType,
                order_subtype: orderRequest.orderSubtype,
                quantity: parseFloat(krakenOrderRequest.volume),
                price: krakenOrderRequest.price ? parseFloat(krakenOrderRequest.price) : undefined,
                status: 'pending',
                filled_quantity: 0,
                fees: 0,
                created_at: new Date(),
                updated_at: new Date(),
                strategy_id: orderRequest.strategyId,
                grid_level: orderRequest.gridLevel,
                profit_target: orderRequest.profitTarget,
                stop_loss: orderRequest.stopLoss,
                metadata: orderRequest.metadata
            };

            // Save to database
            const { data, error } = await this.supabase
                .from('orders')
                .insert(orderRecord)
                .select()
                .single();

            if (error) {
                console.error('Error saving order to database:', error);
                // Order was placed but not recorded - this is a critical issue
                this.emit('orderRecordingError', { externalOrderId, error });
            }

            const orderId = data?.id || `temp_${externalOrderId}`;
            const fullOrderRecord = { ...orderRecord, id: orderId };

            // Cache the order
            this.orderCache.set(orderId, fullOrderRecord);

            console.log(`✅ Order placed successfully: ${externalOrderId}`);

            return {
                success: true,
                orderId,
                externalOrderId,
                validation,
                executionTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('Error placing order:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime: Date.now() - startTime
            };
        }
    }

    async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const orderRecord = await this.getOrderById(orderId);
            if (!orderRecord) {
                return { success: false, error: 'Order not found' };
            }

            if (orderRecord.status === 'filled' || orderRecord.status === 'cancelled') {
                return { success: false, error: `Order is already ${orderRecord.status}` };
            }

            // Cancel with Kraken
            await this.krakenClient.cancelOrder(orderRecord.external_order_id);

            // Update order record
            await this.updateOrderRecord(orderId, {
                status: 'cancelled',
                updated_at: new Date()
            });

            console.log(`❌ Order cancelled: ${orderRecord.external_order_id}`);
            return { success: true };

        } catch (error) {
            console.error('Error cancelling order:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async cancelAllOrders(strategyId?: string): Promise<{ success: boolean; cancelledCount: number; error?: string }> {
        try {
            let ordersToCancel: OrderRecord[];

            if (strategyId) {
                // Cancel orders for specific strategy
                ordersToCancel = await this.getOpenOrdersByStrategy(strategyId);
            } else {
                // Cancel all open orders
                ordersToCancel = await this.getAllOpenOrders();
            }

            let cancelledCount = 0;
            const errors: string[] = [];

            for (const order of ordersToCancel) {
                try {
                    await this.krakenClient.cancelOrder(order.external_order_id);
                    await this.updateOrderRecord(order.id, {
                        status: 'cancelled',
                        updated_at: new Date()
                    });
                    cancelledCount++;
                } catch (error) {
                    errors.push(`Failed to cancel ${order.external_order_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            console.log(`❌ Cancelled ${cancelledCount} orders${strategyId ? ` for strategy ${strategyId}` : ''}`);

            return {
                success: errors.length === 0,
                cancelledCount,
                error: errors.length > 0 ? errors.join('; ') : undefined
            };

        } catch (error) {
            console.error('Error cancelling orders:', error);
            return {
                success: false,
                cancelledCount: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getOrderById(orderId: string): Promise<OrderRecord | null> {
        // Check cache first
        if (this.orderCache.has(orderId)) {
            return this.orderCache.get(orderId)!;
        }

        try {
            const { data, error } = await this.supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (error || !data) {
                return null;
            }

            const orderRecord = this.mapDatabaseToOrderRecord(data);
            this.orderCache.set(orderId, orderRecord);
            return orderRecord;

        } catch (error) {
            console.error('Error fetching order:', error);
            return null;
        }
    }

    async getOrderByExternalId(externalOrderId: string): Promise<OrderRecord | null> {
        try {
            const { data, error } = await this.supabase
                .from('orders')
                .select('*')
                .eq('external_order_id', externalOrderId)
                .single();

            if (error || !data) {
                return null;
            }

            const orderRecord = this.mapDatabaseToOrderRecord(data);
            this.orderCache.set(orderRecord.id, orderRecord);
            return orderRecord;

        } catch (error) {
            console.error('Error fetching order by external ID:', error);
            return null;
        }
    }

    async getAllOpenOrders(): Promise<OrderRecord[]> {
        try {
            const { data, error } = await this.supabase
                .from('orders')
                .select('*')
                .in('status', ['pending', 'open'])
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching open orders:', error);
                return [];
            }

            return data.map(this.mapDatabaseToOrderRecord);

        } catch (error) {
            console.error('Error fetching open orders:', error);
            return [];
        }
    }

    async getOpenOrdersByStrategy(strategyId: string): Promise<OrderRecord[]> {
        try {
            const { data, error } = await this.supabase
                .from('orders')
                .select('*')
                .eq('strategy_id', strategyId)
                .in('status', ['pending', 'open'])
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching strategy orders:', error);
                return [];
            }

            return data.map(this.mapDatabaseToOrderRecord);

        } catch (error) {
            console.error('Error fetching strategy orders:', error);
            return [];
        }
    }

    async getOrderHistory(limit = 100, strategyId?: string): Promise<OrderRecord[]> {
        try {
            let query = this.supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (strategyId) {
                query = query.eq('strategy_id', strategyId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching order history:', error);
                return [];
            }

            return data.map(this.mapDatabaseToOrderRecord);

        } catch (error) {
            console.error('Error fetching order history:', error);
            return [];
        }
    }

    private async updateOrderRecord(orderId: string, updates: Partial<OrderRecord>): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('orders')
                .update(updates)
                .eq('id', orderId);

            if (error) {
                console.error('Error updating order record:', error);
                return;
            }

            // Update cache
            if (this.orderCache.has(orderId)) {
                const cachedOrder = this.orderCache.get(orderId)!;
                this.orderCache.set(orderId, { ...cachedOrder, ...updates });
            }

        } catch (error) {
            console.error('Error updating order record:', error);
        }
    }

    private mapDatabaseToOrderRecord(data: any): OrderRecord {
        return {
            id: data.id,
            external_order_id: data.external_order_id,
            trading_pair: data.trading_pair,
            order_type: data.order_type,
            order_subtype: data.order_subtype,
            quantity: parseFloat(data.quantity),
            price: data.price ? parseFloat(data.price) : undefined,
            status: data.status,
            filled_quantity: parseFloat(data.filled_quantity || '0'),
            average_fill_price: data.average_fill_price ? parseFloat(data.average_fill_price) : undefined,
            fees: parseFloat(data.fees || '0'),
            created_at: new Date(data.created_at),
            updated_at: new Date(data.updated_at),
            strategy_id: data.strategy_id,
            grid_level: data.grid_level,
            profit_target: data.profit_target ? parseFloat(data.profit_target) : undefined,
            stop_loss: data.stop_loss ? parseFloat(data.stop_loss) : undefined,
            metadata: data.metadata
        };
    }

    private startOrderMonitoring(): void {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.orderStatusMonitor = setInterval(async () => {
            await this.syncOrderStatuses();
        }, this.monitorInterval);

        console.log('📊 Order status monitoring started');
    }

    private stopOrderMonitoring(): void {
        if (this.orderStatusMonitor) {
            clearInterval(this.orderStatusMonitor);
            this.orderStatusMonitor = null;
        }
        this.isMonitoring = false;
        console.log('📊 Order status monitoring stopped');
    }

    private async syncOrderStatuses(): Promise<void> {
        try {
            // Get all open orders from database
            const openOrders = await this.getAllOpenOrders();
            
            if (openOrders.length === 0) return;

            // Get current order statuses from Kraken
            const krakenOrders = await this.krakenClient.getOpenOrders();
            const krakenOrderIds = new Set(Object.keys(krakenOrders.open));

            // Check each order
            for (const order of openOrders) {
                if (!krakenOrderIds.has(order.external_order_id)) {
                    // Order is no longer open on Kraken, check its final status
                    const orderStatus = await this.krakenClient.getOrderStatus(order.external_order_id);
                    
                    if (orderStatus) {
                        const newStatus = this.mapKrakenStatusToInternal(orderStatus.status);
                        
                        if (newStatus !== order.status) {
                            await this.updateOrderRecord(order.id, {
                                status: newStatus,
                                filled_quantity: parseFloat(orderStatus.vol_exec),
                                average_fill_price: parseFloat(orderStatus.price),
                                fees: parseFloat(orderStatus.fee),
                                updated_at: new Date()
                            });

                            // Handle filled orders
                            if (newStatus === 'filled') {
                                await this.handleFilledOrder(order, {
                                    status: newStatus,
                                    filled_quantity: parseFloat(orderStatus.vol_exec),
                                    average_fill_price: parseFloat(orderStatus.price),
                                    fees: parseFloat(orderStatus.fee)
                                });
                            }
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error syncing order statuses:', error);
        }
    }

    // Emergency controls
    enableEmergencyStop(): void {
        this.krakenClient.enableEmergencyStop();
    }

    disableEmergencyStop(): void {
        this.krakenClient.disableEmergencyStop();
    }

    isEmergencyStopEnabled(): boolean {
        return this.krakenClient.isEmergencyStopEnabled();
    }

    // Connection management
    async validateConnection(): Promise<boolean> {
        return await this.krakenClient.validateConnection();
    }

    isConnectionHealthy(): boolean {
        return this.krakenClient.isConnectionHealthy();
    }

    // Cleanup
    async disconnect(): Promise<void> {
        this.stopOrderMonitoring();
        await this.krakenClient.disconnect();
        this.orderCache.clear();
        console.log('📋 Order Management Service disconnected');
    }
}
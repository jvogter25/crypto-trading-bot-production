import { SupabaseService } from '../../database/supabase-client';
import { KrakenClient } from '../order-execution/kraken-client';

interface GridOrder {
    id: string;
    level: number;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    orderId?: string;
    status: 'pending' | 'placed' | 'filled' | 'cancelled';
    timestamp: Date;
}

interface GridState {
    tradingPair: string;
    currentPrice: number;
    gridUpperBound: number;
    gridLowerBound: number;
    gridSpacing: number;
    totalGridLevels: number;
    activeBuyOrders: number;
    activeSellOrders: number;
    totalInvested: number;
    currentProfit: number;
    lastRebalanceTime: Date;
    orders: Map<number, GridOrder>;
}

export class GridStateManager {
    private supabaseService: SupabaseService;
    private krakenClient: KrakenClient;
    private gridStates: Map<string, GridState> = new Map();

    constructor() {
        this.supabaseService = new SupabaseService();
        this.krakenClient = new KrakenClient();
    }

    async initializeGridState(tradingPair: string, initialPrice: number, config: {
        gridRange: number;
        gridLevels: number;
        baseOrderSize: number;
    }): Promise<GridState> {
        try {
            console.log(`Initializing grid state for ${tradingPair} at price ${initialPrice}`);

            const gridSpacing = (config.gridRange * 2) / config.gridLevels;
            const gridUpperBound = initialPrice * (1 + config.gridRange);
            const gridLowerBound = initialPrice * (1 - config.gridRange);

            const gridState: GridState = {
                tradingPair,
                currentPrice: initialPrice,
                gridUpperBound,
                gridLowerBound,
                gridSpacing,
                totalGridLevels: config.gridLevels,
                activeBuyOrders: 0,
                activeSellOrders: 0,
                totalInvested: 0,
                currentProfit: 0,
                lastRebalanceTime: new Date(),
                orders: new Map()
            };

            // Store in database
            await this.supabaseService.createGridState({
                trading_pair: tradingPair,
                current_price: initialPrice,
                grid_upper_bound: gridUpperBound,
                grid_lower_bound: gridLowerBound,
                grid_spacing: gridSpacing,
                total_grid_levels: config.gridLevels,
                active_buy_orders: 0,
                active_sell_orders: 0,
                total_invested: 0,
                current_profit: 0,
                last_rebalance_time: new Date()
            });

            // Store in memory
            this.gridStates.set(tradingPair, gridState);

            console.log(`Grid state initialized for ${tradingPair}`);
            return gridState;
        } catch (error) {
            console.error(`Failed to initialize grid state for ${tradingPair}:`, error);
            throw error;
        }
    }

    async loadGridState(tradingPair: string): Promise<GridState | null> {
        try {
            // Try to load from memory first
            if (this.gridStates.has(tradingPair)) {
                return this.gridStates.get(tradingPair)!;
            }

            // Load from database
            const dbState = await this.supabaseService.getGridState(tradingPair);
            if (!dbState) {
                return null;
            }

            const gridState: GridState = {
                tradingPair: dbState.trading_pair,
                currentPrice: dbState.current_price,
                gridUpperBound: dbState.grid_upper_bound,
                gridLowerBound: dbState.grid_lower_bound,
                gridSpacing: dbState.grid_spacing,
                totalGridLevels: dbState.total_grid_levels,
                activeBuyOrders: dbState.active_buy_orders,
                activeSellOrders: dbState.active_sell_orders,
                totalInvested: dbState.total_invested,
                currentProfit: dbState.current_profit,
                lastRebalanceTime: new Date(dbState.last_rebalance_time || dbState.created_at),
                orders: new Map()
            };

            // Load active positions/orders
            await this.loadActiveOrders(gridState);

            this.gridStates.set(tradingPair, gridState);
            return gridState;
        } catch (error) {
            console.error(`Failed to load grid state for ${tradingPair}:`, error);
            throw error;
        }
    }

    private async loadActiveOrders(gridState: GridState): Promise<void> {
        try {
            const activePositions = await this.supabaseService.getActivePositions(gridState.tradingPair);
            
            for (const position of activePositions) {
                if (position.grid_level !== null && position.grid_level !== undefined) {
                    const order: GridOrder = {
                        id: position.id,
                        level: position.grid_level,
                        price: position.entry_price,
                        size: position.size,
                        side: position.side.toLowerCase() as 'buy' | 'sell',
                        status: 'placed',
                        timestamp: new Date(position.entry_time)
                    };
                    
                    gridState.orders.set(position.grid_level, order);
                }
            }
        } catch (error) {
            console.error('Failed to load active orders:', error);
        }
    }

    async updateGridState(tradingPair: string, updates: {
        currentPrice?: number;
        totalInvested?: number;
        currentProfit?: number;
    }): Promise<void> {
        try {
            const gridState = this.gridStates.get(tradingPair);
            if (!gridState) {
                throw new Error(`Grid state not found for ${tradingPair}`);
            }

            // Update memory state
            if (updates.currentPrice !== undefined) {
                gridState.currentPrice = updates.currentPrice;
            }
            if (updates.totalInvested !== undefined) {
                gridState.totalInvested = updates.totalInvested;
            }
            if (updates.currentProfit !== undefined) {
                gridState.currentProfit = updates.currentProfit;
            }

            // Update database
            await this.supabaseService.updateGridState(tradingPair, {
                current_price: gridState.currentPrice,
                total_invested: gridState.totalInvested,
                current_profit: gridState.currentProfit,
                active_buy_orders: gridState.activeBuyOrders,
                active_sell_orders: gridState.activeSellOrders
            });

            console.log(`Grid state updated for ${tradingPair}`);
        } catch (error) {
            console.error(`Failed to update grid state for ${tradingPair}:`, error);
            throw error;
        }
    }

    async placeGridOrder(tradingPair: string, level: number, price: number, size: number, side: 'buy' | 'sell'): Promise<string> {
        try {
            console.log(`Placing grid ${side} order at level ${level}: ${size} @ ${price}`);

            // Place order on exchange
            let orderId: string;
            if (side === 'buy') {
                orderId = await this.krakenClient.placeLimitBuyOrder(tradingPair, size.toString(), price.toString());
            } else {
                orderId = await this.krakenClient.placeLimitSellOrder(tradingPair, size.toString(), price.toString());
            }

            // Create position record
            const position = await this.supabaseService.createPosition({
                trading_pair: tradingPair,
                entry_price: price,
                current_price: price,
                size: size,
                side: side.toUpperCase(),
                status: 'OPEN',
                entry_time: new Date(),
                strategy_type: 'STABLE_COIN_GRID',
                grid_level: level
            });

            // Update grid state
            const gridState = this.gridStates.get(tradingPair);
            if (gridState) {
                const order: GridOrder = {
                    id: position.id,
                    level,
                    price,
                    size,
                    side,
                    orderId,
                    status: 'placed',
                    timestamp: new Date()
                };

                gridState.orders.set(level, order);
                
                if (side === 'buy') {
                    gridState.activeBuyOrders++;
                } else {
                    gridState.activeSellOrders++;
                }

                await this.updateGridState(tradingPair, {});
            }

            console.log(`Grid order placed successfully: ${orderId}`);
            return orderId;
        } catch (error) {
            console.error(`Failed to place grid order:`, error);
            throw error;
        }
    }

    async cancelGridOrder(tradingPair: string, level: number): Promise<boolean> {
        try {
            const gridState = this.gridStates.get(tradingPair);
            if (!gridState) {
                throw new Error(`Grid state not found for ${tradingPair}`);
            }

            const order = gridState.orders.get(level);
            if (!order || !order.orderId) {
                console.warn(`No order found at level ${level} for ${tradingPair}`);
                return false;
            }

            // Cancel order on exchange
            await this.krakenClient.cancelOrder(order.orderId);

            // Update position status
            await this.supabaseService.updatePosition(order.id, {
                status: 'CLOSED',
                exit_time: new Date()
            });

            // Update grid state
            gridState.orders.delete(level);
            if (order.side === 'buy') {
                gridState.activeBuyOrders--;
            } else {
                gridState.activeSellOrders--;
            }

            await this.updateGridState(tradingPair, {});

            console.log(`Grid order cancelled at level ${level}`);
            return true;
        } catch (error) {
            console.error(`Failed to cancel grid order at level ${level}:`, error);
            return false;
        }
    }

    async checkOrderFills(tradingPair: string): Promise<void> {
        try {
            const gridState = this.gridStates.get(tradingPair);
            if (!gridState) {
                return;
            }

            const openOrders = await this.krakenClient.getOpenOrders();
            const openOrderIds = new Set(Object.keys(openOrders.open || {}));

            for (const [level, order] of gridState.orders) {
                if (order.orderId && !openOrderIds.has(order.orderId)) {
                    // Order has been filled
                    await this.handleOrderFill(tradingPair, level, order);
                }
            }
        } catch (error) {
            console.error(`Failed to check order fills for ${tradingPair}:`, error);
        }
    }

    private async handleOrderFill(tradingPair: string, level: number, order: GridOrder): Promise<void> {
        try {
            console.log(`Order filled at level ${level}: ${order.side} ${order.size} @ ${order.price}`);

            const gridState = this.gridStates.get(tradingPair);
            if (!gridState) {
                return;
            }

            // Update position status
            await this.supabaseService.updatePosition(order.id, {
                status: 'CLOSED',
                exit_time: new Date(),
                realized_pnl: this.calculatePnL(order, gridState.currentPrice)
            });

            // Remove from grid state
            gridState.orders.delete(level);
            if (order.side === 'buy') {
                gridState.activeBuyOrders--;
            } else {
                gridState.activeSellOrders--;
            }

            // Check if this is a profit-taking fill
            const profitPercentage = Math.abs(gridState.currentPrice - order.price) / order.price;
            if (profitPercentage >= 0.02) { // 2% profit threshold
                await this.handleProfitTaking(tradingPair, order, profitPercentage);
            }

            await this.updateGridState(tradingPair, {});
        } catch (error) {
            console.error(`Failed to handle order fill:`, error);
        }
    }

    private async handleProfitTaking(tradingPair: string, order: GridOrder, profitPercentage: number): Promise<void> {
        try {
            const profitAmount = order.size * order.price * profitPercentage;
            const reinvestmentAmount = profitAmount * 0.70; // 70% reinvestment
            const extractedAmount = profitAmount * 0.30; // 30% extraction

            console.log(`Profit taking: ${profitAmount} (${profitPercentage * 100}%) - Reinvest: ${reinvestmentAmount}, Extract: ${extractedAmount}`);

            // Record performance metrics
            await this.recordProfitTaking(tradingPair, {
                profitAmount,
                reinvestmentAmount,
                extractedAmount,
                profitPercentage,
                orderSize: order.size,
                orderPrice: order.price
            });

            // Update grid state with new capital
            const gridState = this.gridStates.get(tradingPair);
            if (gridState) {
                gridState.totalInvested += reinvestmentAmount;
                gridState.currentProfit += extractedAmount;
                await this.updateGridState(tradingPair, {
                    totalInvested: gridState.totalInvested,
                    currentProfit: gridState.currentProfit
                });
            }
        } catch (error) {
            console.error('Failed to handle profit taking:', error);
        }
    }

    private async recordProfitTaking(tradingPair: string, profitData: {
        profitAmount: number;
        reinvestmentAmount: number;
        extractedAmount: number;
        profitPercentage: number;
        orderSize: number;
        orderPrice: number;
    }): Promise<void> {
        try {
            // This could be expanded to record in a separate profit_taking table
            console.log(`Recording profit taking for ${tradingPair}:`, profitData);
            
            // For now, we'll log it and could integrate with Google Sheets or other external logging
            // TODO: Implement external logging (Google Sheets, audit trail, etc.)
        } catch (error) {
            console.error('Failed to record profit taking:', error);
        }
    }

    private calculatePnL(order: GridOrder, currentPrice: number): number {
        if (order.side === 'buy') {
            return (currentPrice - order.price) * order.size;
        } else {
            return (order.price - currentPrice) * order.size;
        }
    }

    async getGridState(tradingPair: string): Promise<GridState | null> {
        return this.gridStates.get(tradingPair) || null;
    }

    async rebalanceGrid(tradingPair: string, newPrice: number, config: {
        gridRange: number;
        gridLevels: number;
        baseOrderSize: number;
    }): Promise<void> {
        try {
            console.log(`Rebalancing grid for ${tradingPair} at new price ${newPrice}`);

            const gridState = this.gridStates.get(tradingPair);
            if (!gridState) {
                throw new Error(`Grid state not found for ${tradingPair}`);
            }

            // Cancel all existing orders
            const cancelPromises = Array.from(gridState.orders.keys()).map(level => 
                this.cancelGridOrder(tradingPair, level)
            );
            await Promise.all(cancelPromises);

            // Update grid bounds
            const gridSpacing = (config.gridRange * 2) / config.gridLevels;
            gridState.gridUpperBound = newPrice * (1 + config.gridRange);
            gridState.gridLowerBound = newPrice * (1 - config.gridRange);
            gridState.gridSpacing = gridSpacing;
            gridState.currentPrice = newPrice;
            gridState.lastRebalanceTime = new Date();

            // Place new grid orders
            const priceStep = (gridState.gridUpperBound - gridState.gridLowerBound) / config.gridLevels;
            
            for (let i = 0; i < config.gridLevels; i++) {
                const levelPrice = gridState.gridLowerBound + (i * priceStep);
                
                // Place buy orders below current price, sell orders above
                if (levelPrice < newPrice * 0.999) { // Buy orders
                    await this.placeGridOrder(tradingPair, i, levelPrice, config.baseOrderSize, 'buy');
                } else if (levelPrice > newPrice * 1.001) { // Sell orders
                    await this.placeGridOrder(tradingPair, i, levelPrice, config.baseOrderSize, 'sell');
                }
            }

            await this.updateGridState(tradingPair, { currentPrice: newPrice });
            console.log(`Grid rebalanced for ${tradingPair}`);
        } catch (error) {
            console.error(`Failed to rebalance grid for ${tradingPair}:`, error);
            throw error;
        }
    }
} 
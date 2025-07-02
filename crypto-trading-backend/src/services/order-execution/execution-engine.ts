import { KrakenClient } from './kraken-client';
import { TradingSignal } from '../trading-engine/types/TradingSignal';
import { PositionSide } from '../trading-engine/types/Position';

interface ExecutionResult {
    success: boolean;
    orderId?: string;
    error?: string;
    executedPrice?: number;
    executedVolume?: number;
}

interface ProfitTakingResult {
    success: boolean;
    profitAmount: number;
    reinvestmentAmount: number;
    extractedAmount: number;
    orderId?: string;
    error?: string;
}

export class ExecutionEngine {
    private krakenClient: KrakenClient;
    private readonly REINVESTMENT_PERCENTAGE = 0.70; // 70% reinvestment
    private readonly PROFIT_EXTRACTION_PERCENTAGE = 0.30; // 30% profit extraction

    constructor() {
        this.krakenClient = new KrakenClient();
    }

    async executeSignal(signal: TradingSignal): Promise<ExecutionResult> {
        try {
            console.log(`Executing signal: ${signal.side} ${signal.size} ${signal.tradingPair} at ${signal.entryPrice}`);

            // Validate signal before execution
            if (!await this.validateSignal(signal)) {
                return {
                    success: false,
                    error: 'Signal validation failed'
                };
            }

            let orderId: string;

            // Handle profit-taking signals (market orders for immediate execution)
            if (signal.metadata.profitTaking) {
                orderId = await this.executeProfitTaking(signal);
            } else {
                // Handle regular grid trading signals (limit orders)
                orderId = await this.executeLimitOrder(signal);
            }

            console.log(`Signal executed successfully. Order ID: ${orderId}`);
            
            return {
                success: true,
                orderId,
                executedPrice: signal.entryPrice,
                executedVolume: signal.size
            };

        } catch (error) {
            console.error('Error executing signal:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private async executeProfitTaking(signal: TradingSignal): Promise<string> {
        try {
            console.log(`Executing profit-taking for ${signal.tradingPair}`);
            
            // Use market order for immediate execution
            const orderId = await this.krakenClient.placeMarketOrder(
                signal.tradingPair,
                signal.side === PositionSide.LONG ? 'sell' : 'buy',
                signal.size.toString()
            );

            // Calculate and handle profit distribution
            await this.handleProfitDistribution(signal);

            return orderId;
        } catch (error) {
            console.error('Error executing profit-taking:', error);
            throw error;
        }
    }

    private async executeLimitOrder(signal: TradingSignal): Promise<string> {
        try {
            console.log(`Executing limit order for ${signal.tradingPair} at ${signal.entryPrice}`);
            
            if (signal.side === PositionSide.LONG) {
                return await this.krakenClient.placeLimitBuyOrder(
                    signal.tradingPair,
                    signal.size.toString(),
                    signal.entryPrice.toString()
                );
            } else {
                return await this.krakenClient.placeLimitSellOrder(
                    signal.tradingPair,
                    signal.size.toString(),
                    signal.entryPrice.toString()
                );
            }
        } catch (error) {
            console.error('Error executing limit order:', error);
            throw error;
        }
    }

    private async handleProfitDistribution(signal: TradingSignal): Promise<ProfitTakingResult> {
        try {
            // Calculate profit amount (this would be more sophisticated in production)
            const profitAmount = signal.size * signal.entryPrice * 0.02; // Assuming 2% profit
            const reinvestmentAmount = profitAmount * this.REINVESTMENT_PERCENTAGE;
            const extractedAmount = profitAmount * this.PROFIT_EXTRACTION_PERCENTAGE;

            console.log(`Profit Distribution - Total: ${profitAmount}, Reinvested: ${reinvestmentAmount}, Extracted: ${extractedAmount}`);

            // Log to external systems (Google Sheets, database, etc.)
            await this.logProfitExtraction({
                tradingPair: signal.tradingPair,
                profitAmount,
                reinvestmentAmount,
                extractedAmount,
                timestamp: new Date()
            });

            return {
                success: true,
                profitAmount,
                reinvestmentAmount,
                extractedAmount
            };
        } catch (error) {
            console.error('Error handling profit distribution:', error);
            return {
                success: false,
                profitAmount: 0,
                reinvestmentAmount: 0,
                extractedAmount: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private async validateSignal(signal: TradingSignal): Promise<boolean> {
        try {
            // Validate trading pair
            if (!signal.tradingPair || signal.tradingPair.length === 0) {
                console.error('Invalid trading pair');
                return false;
            }

            // Validate price and size
            if (signal.entryPrice <= 0 || signal.size <= 0) {
                console.error('Invalid price or size');
                return false;
            }

            // Validate account balance
            const balance = await this.krakenClient.getAccountBalance();
            const requiredBalance = signal.size * signal.entryPrice;
            
            // Check if we have sufficient balance (simplified check)
            const usdBalance = parseFloat(balance.ZUSD || '0');
            if (signal.side === PositionSide.LONG && usdBalance < requiredBalance) {
                console.error(`Insufficient USD balance. Required: ${requiredBalance}, Available: ${usdBalance}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error validating signal:', error);
            return false;
        }
    }

    async cancelOrder(orderId: string): Promise<boolean> {
        try {
            console.log(`Cancelling order: ${orderId}`);
            await this.krakenClient.cancelOrder(orderId);
            console.log(`Order ${orderId} cancelled successfully`);
            return true;
        } catch (error) {
            console.error(`Error cancelling order ${orderId}:`, error);
            return false;
        }
    }

    async getOrderStatus(orderId: string): Promise<any> {
        try {
            return await this.krakenClient.getOrderStatus(orderId);
        } catch (error) {
            console.error(`Error getting order status for ${orderId}:`, error);
            throw error;
        }
    }

    async getOpenOrders(): Promise<any> {
        try {
            return await this.krakenClient.getOpenOrders();
        } catch (error) {
            console.error('Error getting open orders:', error);
            throw error;
        }
    }

    async validateConnection(): Promise<boolean> {
        try {
            return await this.krakenClient.validateConnection();
        } catch (error) {
            console.error('Error validating connection:', error);
            return false;
        }
    }

    private async logProfitExtraction(profitData: {
        tradingPair: string;
        profitAmount: number;
        reinvestmentAmount: number;
        extractedAmount: number;
        timestamp: Date;
    }): Promise<void> {
        try {
            // This would integrate with your logging service (Google Sheets, database, etc.)
            console.log('Logging profit extraction:', profitData);
            
            // TODO: Implement Google Sheets logging
            // TODO: Implement database logging
            // TODO: Implement external audit trail
            
        } catch (error) {
            console.error('Error logging profit extraction:', error);
        }
    }

    // Grid trading specific methods
    async executeGridRebalancing(signals: TradingSignal[]): Promise<ExecutionResult[]> {
        const results: ExecutionResult[] = [];
        
        try {
            console.log(`Executing grid rebalancing with ${signals.length} signals`);
            
            for (const signal of signals) {
                const result = await this.executeSignal(signal);
                results.push(result);
                
                // Add small delay between orders to avoid rate limiting
                await this.delay(100);
            }
            
            console.log(`Grid rebalancing completed. ${results.filter(r => r.success).length}/${results.length} orders executed successfully`);
            
        } catch (error) {
            console.error('Error during grid rebalancing:', error);
        }
        
        return results;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Emergency stop - cancel all open orders
    async emergencyStop(): Promise<void> {
        try {
            console.log('EMERGENCY STOP - Cancelling all open orders');
            
            const openOrders = await this.getOpenOrders();
            const orderIds = Object.keys(openOrders.open || {});
            
            for (const orderId of orderIds) {
                await this.cancelOrder(orderId);
            }
            
            console.log(`Emergency stop completed. Cancelled ${orderIds.length} orders`);
            
        } catch (error) {
            console.error('Error during emergency stop:', error);
            throw error;
        }
    }
} 
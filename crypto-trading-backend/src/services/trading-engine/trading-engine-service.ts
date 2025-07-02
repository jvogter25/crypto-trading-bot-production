import { TradingRulesEngine } from './TradingRulesEngine';
import { StableCoinGridStrategy } from './strategies/StableCoinGridStrategy';
import { ExecutionEngine } from '../order-execution/execution-engine';
import { TradingSignal } from './types/TradingSignal';

export class TradingEngineService {
    private tradingRulesEngine: TradingRulesEngine;
    private executionEngine: ExecutionEngine;
    private stableCoinStrategy: StableCoinGridStrategy;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private readonly EXECUTION_INTERVAL = 30000; // 30 seconds

    constructor() {
        this.tradingRulesEngine = new TradingRulesEngine();
        this.executionEngine = new ExecutionEngine();
        this.stableCoinStrategy = new StableCoinGridStrategy();
    }

    async initialize(): Promise<void> {
        try {
            console.log('Initializing Trading Engine Service...');

            // Validate Kraken connection
            const connectionValid = await this.executionEngine.validateConnection();
            if (!connectionValid) {
                throw new Error('Failed to validate Kraken API connection');
            }

            // Register the stable coin grid strategy
            await this.tradingRulesEngine.registerStrategy(this.stableCoinStrategy);

            console.log('Trading Engine Service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Trading Engine Service:', error);
            throw error;
        }
    }

    async start(): Promise<void> {
        try {
            if (this.isRunning) {
                console.log('Trading Engine Service is already running');
                return;
            }

            console.log('Starting Trading Engine Service...');
            this.isRunning = true;

            // Start the main trading loop
            this.intervalId = setInterval(async () => {
                await this.executeTradingCycle();
            }, this.EXECUTION_INTERVAL);

            // Execute first cycle immediately
            await this.executeTradingCycle();

            console.log(`Trading Engine Service started. Executing every ${this.EXECUTION_INTERVAL / 1000} seconds.`);
        } catch (error) {
            console.error('Failed to start Trading Engine Service:', error);
            this.isRunning = false;
            throw error;
        }
    }

    async stop(): Promise<void> {
        try {
            console.log('Stopping Trading Engine Service...');
            this.isRunning = false;

            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }

            console.log('Trading Engine Service stopped');
        } catch (error) {
            console.error('Error stopping Trading Engine Service:', error);
            throw error;
        }
    }

    async emergencyStop(): Promise<void> {
        try {
            console.log('EMERGENCY STOP - Shutting down trading and cancelling all orders');
            
            // Stop the service
            await this.stop();
            
            // Cancel all open orders
            await this.executionEngine.emergencyStop();
            
            console.log('Emergency stop completed');
        } catch (error) {
            console.error('Error during emergency stop:', error);
            throw error;
        }
    }

    private async executeTradingCycle(): Promise<void> {
        try {
            console.log('=== Starting Trading Cycle ===');
            
            // Update market conditions
            await this.tradingRulesEngine.updateMarketCondition();
            const marketCondition = await this.tradingRulesEngine.getCurrentMarketCondition();
            console.log(`Current market condition: ${marketCondition}`);

            // Generate trading signals
            const signals = await this.tradingRulesEngine.generateTradingSignals();
            console.log(`Generated ${signals.length} trading signals`);

            if (signals.length === 0) {
                console.log('No trading signals generated');
                return;
            }

            // Execute signals
            const executionResults = await this.executionEngine.executeGridRebalancing(signals);
            
            // Log execution results
            const successfulExecutions = executionResults.filter(r => r.success).length;
            const failedExecutions = executionResults.length - successfulExecutions;
            
            console.log(`Execution Results: ${successfulExecutions} successful, ${failedExecutions} failed`);
            
            if (failedExecutions > 0) {
                console.warn('Some executions failed:', executionResults.filter(r => !r.success));
            }

            // Update positions
            await this.tradingRulesEngine.updatePositions();

            console.log('=== Trading Cycle Completed ===');
            
        } catch (error) {
            console.error('Error during trading cycle:', error);
            
            // If there are critical errors, consider emergency stop
            if (this.isCriticalError(error)) {
                console.error('Critical error detected, initiating emergency stop');
                await this.emergencyStop();
            }
        }
    }

    private isCriticalError(error: any): boolean {
        // Define what constitutes a critical error that requires emergency stop
        const criticalErrorMessages = [
            'API key invalid',
            'Insufficient funds',
            'Account suspended',
            'Connection timeout',
            'Rate limit exceeded'
        ];

        const errorMessage = error?.message?.toLowerCase() || '';
        return criticalErrorMessages.some(msg => errorMessage.includes(msg));
    }

    async getStatus(): Promise<{
        isRunning: boolean;
        marketCondition: string;
        activePositions: number;
        openOrders: number;
        lastUpdate: Date;
    }> {
        try {
            const marketCondition = await this.tradingRulesEngine.getCurrentMarketCondition();
            const activePositions = await this.tradingRulesEngine.getActivePositions();
            const openOrders = await this.executionEngine.getOpenOrders();
            
            return {
                isRunning: this.isRunning,
                marketCondition: marketCondition.toString(),
                activePositions: activePositions.length,
                openOrders: Object.keys(openOrders.open || {}).length,
                lastUpdate: new Date()
            };
        } catch (error) {
            console.error('Error getting status:', error);
            throw error;
        }
    }

    async getActivePositions(): Promise<any[]> {
        try {
            return await this.tradingRulesEngine.getActivePositions();
        } catch (error) {
            console.error('Error getting active positions:', error);
            throw error;
        }
    }

    async getOpenOrders(): Promise<any> {
        try {
            return await this.executionEngine.getOpenOrders();
        } catch (error) {
            console.error('Error getting open orders:', error);
            throw error;
        }
    }

    async cancelOrder(orderId: string): Promise<boolean> {
        try {
            return await this.executionEngine.cancelOrder(orderId);
        } catch (error) {
            console.error(`Error cancelling order ${orderId}:`, error);
            return false;
        }
    }

    // Manual signal execution for testing
    async executeManualSignal(signal: TradingSignal): Promise<any> {
        try {
            console.log('Executing manual signal:', signal);
            return await this.executionEngine.executeSignal(signal);
        } catch (error) {
            console.error('Error executing manual signal:', error);
            throw error;
        }
    }

    // Get strategy-specific information
    async getStrategyInfo(): Promise<{
        stableCoinGrid: {
            supportedAssets: string[];
            maxPositionSize: number;
            reinvestmentPercentage: number;
        };
    }> {
        try {
            return {
                stableCoinGrid: {
                    supportedAssets: this.stableCoinStrategy.supportedAssets,
                    maxPositionSize: await this.stableCoinStrategy.getMaxPositionSize(),
                    reinvestmentPercentage: await this.stableCoinStrategy.getReinvestmentPercentage()
                }
            };
        } catch (error) {
            console.error('Error getting strategy info:', error);
            throw error;
        }
    }
} 
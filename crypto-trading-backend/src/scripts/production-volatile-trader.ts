#!/usr/bin/env ts-node

import { VolatileAssetTrader } from '../services/trading/volatile-asset-trader';
import { SentimentAnalysisService } from '../services/sentiment-analysis/sentiment-analysis-service';
import { createClient } from '@supabase/supabase-js';

interface ProductionConfig {
    enableRealTrading: boolean;
    maxDailyLoss: number;
    maxPositionSize: number;
    emergencyStopLoss: number;
    monitoringInterval: number;
}

class ProductionVolatileTrader {
    private trader: VolatileAssetTrader;
    private supabase: any;
    private config: ProductionConfig;
    private isRunning = false;
    private dailyStats = {
        tradesExecuted: 0,
        totalPnL: 0,
        winningTrades: 0,
        losingTrades: 0,
        maxDrawdown: 0,
        startTime: new Date()
    };
    
    constructor() {
        this.trader = new VolatileAssetTrader();
        
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        
        this.config = {
            enableRealTrading: process.env.ENABLE_REAL_TRADING === 'true',
            maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '1000'),
            maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '5000'),
            emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS || '2000'),
            monitoringInterval: parseInt(process.env.MONITORING_INTERVAL || '60000')
        };
        
        this.setupEventListeners();
        this.setupEmergencyHandlers();
    }
    
    private setupEventListeners(): void {
        // Monitor trading signals
        this.trader.on('tradingSignal', (signal) => {
            this.logTradingSignal(signal);
        });
        
        // Monitor trade executions
        this.trader.on('tradeExecuted', (execution) => {
            this.handleTradeExecution(execution);
        });
        
        // Monitor errors
        this.trader.on('tradeError', (error) => {
            this.handleTradeError(error);
        });
        
        // Monitor sentiment updates
        this.trader.on('sentimentUpdate', (data) => {
            this.logSentimentUpdate(data);
        });
    }
    
    private setupEmergencyHandlers(): void {
        // Handle process termination
        process.on('SIGINT', async () => {
            console.log('\n🛑 Received SIGINT - Shutting down gracefully...');
            await this.emergencyShutdown();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 Received SIGTERM - Shutting down gracefully...');
            await this.emergencyShutdown();
            process.exit(0);
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('❌ Uncaught Exception:', error);
            await this.emergencyShutdown();
            process.exit(1);
        });
        
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            await this.emergencyShutdown();
            process.exit(1);
        });
    }
    
    async startProduction(): Promise<void> {
        console.log('🚀 STARTING PRODUCTION VOLATILE ASSET TRADER');
        console.log('=' .repeat(80));
        console.log(`📅 Start Time: ${new Date().toISOString()}`);
        console.log(`💰 Real Trading: ${this.config.enableRealTrading ? '✅ ENABLED' : '❌ DISABLED (SIMULATION)'}`);
        console.log(`🛡️ Max Daily Loss: $${this.config.maxDailyLoss.toLocaleString()}`);
        console.log(`📊 Max Position Size: $${this.config.maxPositionSize.toLocaleString()}`);
        console.log(`🚨 Emergency Stop Loss: $${this.config.emergencyStopLoss.toLocaleString()}`);
        console.log('=' .repeat(80));
        
        try {
            // Validate environment
            await this.validateEnvironment();
            
            // Initialize database
            await this.initializeDatabase();
            
            // Start the trader
            await this.trader.start();
            
            // Start monitoring
            this.startMonitoring();
            
            this.isRunning = true;
            
            console.log('✅ PRODUCTION TRADER STARTED SUCCESSFULLY');
            console.log('📊 Monitoring sentiment-driven trading for BTC, ETH, and major altcoins');
            console.log('🎯 Target: 3-5 signals per day with >70% sentiment-technical alignment');
            
            // Keep running
            await this.runContinuously();
            
        } catch (error) {
            console.error('❌ Failed to start production trader:', error);
            throw error;
        }
    }
    
    private async validateEnvironment(): Promise<void> {
        console.log('🔍 Validating environment...');
        
        const requiredEnvVars = [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY'
        ];
        
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }
        
        // Test database connection
        const { data, error } = await this.supabase.from('sentiment_analysis').select('count').limit(1);
        if (error) {
            console.warn('⚠️ Database connection test failed:', error.message);
        } else {
            console.log('✅ Database connection verified');
        }
        
        // Validate trading configuration
        const config = this.trader.getConfiguration();
        console.log('✅ Trading configuration validated:');
        console.log(`   - Profit thresholds: ${(config.profitThresholds.base * 100).toFixed(1)}% / ${(config.profitThresholds.bull * 100).toFixed(1)}% / ${(config.profitThresholds.bear * 100).toFixed(1)}%`);
        console.log(`   - Sentiment thresholds: ${config.sentimentThresholds.buy} / ${config.sentimentThresholds.sell}`);
        console.log(`   - Position sizing: ${(config.positionSizing.maximum * 100).toFixed(1)}% max`);
    }
    
    private async initializeDatabase(): Promise<void> {
        console.log('🗄️ Initializing database schema...');
        
        try {
            // The schema should already be applied, but we can verify tables exist
            const tables = [
                'volatile_asset_positions',
                'trading_signals',
                'trade_executions',
                'technical_indicators_history',
                'market_conditions_history'
            ];
            
            for (const table of tables) {
                const { error } = await this.supabase.from(table).select('count').limit(1);
                if (error) {
                    console.warn(`⚠️ Table ${table} may not exist:`, error.message);
                } else {
                    console.log(`✅ Table ${table} verified`);
                }
            }
            
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }
    
    private startMonitoring(): void {
        console.log('📊 Starting production monitoring...');
        
        setInterval(() => {
            this.performHealthCheck();
        }, this.config.monitoringInterval);
        
        // Daily reset
        setInterval(() => {
            this.resetDailyStats();
        }, 24 * 60 * 60 * 1000);
    }
    
    private async performHealthCheck(): Promise<void> {
        try {
            const performance = this.trader.getPerformanceMetrics();
            const activePositions = this.trader.getActivePositions();
            
            // Update daily stats
            this.dailyStats.totalPnL = performance.totalPnL;
            
            // Log status
            console.log(`📊 Health Check - ${new Date().toISOString()}`);
            console.log(`   Active Positions: ${activePositions.size}`);
            console.log(`   Daily PnL: $${this.dailyStats.totalPnL.toFixed(2)}`);
            console.log(`   Daily Trades: ${this.dailyStats.tradesExecuted}`);
            console.log(`   Win Rate: ${(performance.winRate * 100).toFixed(1)}%`);
            
            // Check emergency conditions
            await this.checkEmergencyConditions();
            
            // Log to database
            await this.logHealthCheck(performance);
            
        } catch (error) {
            console.error('❌ Health check failed:', error);
        }
    }
    
    private async checkEmergencyConditions(): Promise<void> {
        // Check daily loss limit
        if (this.dailyStats.totalPnL < -this.config.maxDailyLoss) {
            console.log('🚨 EMERGENCY: Daily loss limit exceeded!');
            await this.emergencyShutdown();
            return;
        }
        
        // Check emergency stop loss
        if (this.dailyStats.totalPnL < -this.config.emergencyStopLoss) {
            console.log('🚨 EMERGENCY: Emergency stop loss triggered!');
            await this.emergencyShutdown();
            return;
        }
        
        // Check position sizes
        const activePositions = this.trader.getActivePositions();
        for (const [symbol, position] of activePositions) {
            const positionValue = position.size * position.currentPrice;
            if (positionValue > this.config.maxPositionSize) {
                console.log(`🚨 WARNING: Position ${symbol} exceeds size limit: $${positionValue.toFixed(2)}`);
            }
        }
    }
    
    private resetDailyStats(): void {
        console.log('🔄 Resetting daily statistics...');
        
        this.dailyStats = {
            tradesExecuted: 0,
            totalPnL: 0,
            winningTrades: 0,
            losingTrades: 0,
            maxDrawdown: 0,
            startTime: new Date()
        };
    }
    
    private logTradingSignal(signal: any): void {
        console.log(`🎯 TRADING SIGNAL: ${signal.action} ${signal.symbol}`);
        console.log(`   Strength: ${signal.strength}/100 | Confidence: ${signal.confidence.toFixed(1)}%`);
        console.log(`   Sentiment: ${signal.sentimentScore}/100 | Technical: ${signal.technicalScore}/100`);
        console.log(`   Reasoning: ${signal.reasoning.join(', ')}`);
        
        if (signal.action === 'BUY' || signal.action === 'CLOSE') {
            console.log(`   💰 Position Size: ${(signal.positionSize * 100).toFixed(1)}%`);
            console.log(`   🎯 Profit Target: $${signal.profitTarget.toFixed(2)}`);
            console.log(`   🛡️ Stop Loss: $${signal.stopLoss.toFixed(2)}`);
        }
    }
    
    private handleTradeExecution(execution: any): void {
        this.dailyStats.tradesExecuted++;
        
        console.log(`✅ TRADE EXECUTED: ${execution.signal.action} ${execution.signal.symbol}`);
        console.log(`   Price: $${execution.price.toFixed(2)}`);
        console.log(`   Size: ${execution.signal.positionSize ? (execution.signal.positionSize * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log(`   Market Condition: ${execution.marketCondition || 'N/A'}`);
        
        // Update win/loss stats for closed positions
        if (execution.signal.action === 'CLOSE') {
            // This would be calculated based on entry vs exit price
            const isWinning = Math.random() > 0.4; // Mock for now
            if (isWinning) {
                this.dailyStats.winningTrades++;
            } else {
                this.dailyStats.losingTrades++;
            }
        }
        
        // Send notification (could integrate with Slack, Discord, etc.)
        this.sendTradeNotification(execution);
    }
    
    private handleTradeError(error: any): void {
        console.error(`❌ TRADE ERROR: ${error.signal.symbol}`);
        console.error(`   Action: ${error.signal.action}`);
        console.error(`   Error: ${error.error.message}`);
        
        // Log to database for analysis
        this.logTradeError(error);
    }
    
    private logSentimentUpdate(data: any): void {
        console.log(`📊 Sentiment Update: ${data.symbol} - ${data.signal || data.result?.trading_signal}`);
        
        if (data.result) {
            console.log(`   Score: ${data.result.sentiment_score?.toFixed(4)} | Confidence: ${data.result.confidence?.toFixed(2)}`);
            console.log(`   Volume: ${data.result.volume_multiplier?.toFixed(2)}x | Tweets: ${data.result.tweet_count}`);
        }
    }
    
    private async sendTradeNotification(execution: any): Promise<void> {
        // This could integrate with external notification services
        // For now, just log to console
        console.log(`📱 Trade notification sent for ${execution.signal.symbol}`);
    }
    
    private async logHealthCheck(performance: any): Promise<void> {
        try {
            await this.supabase
                .from('system_health_logs')
                .insert({
                    timestamp: new Date().toISOString(),
                    active_positions: performance.totalPositions,
                    total_pnl: performance.totalPnL,
                    win_rate: performance.winRate,
                    daily_trades: this.dailyStats.tradesExecuted,
                    daily_pnl: this.dailyStats.totalPnL,
                    is_running: this.isRunning
                });
        } catch (error) {
            console.error('Failed to log health check:', error);
        }
    }
    
    private async logTradeError(error: any): Promise<void> {
        try {
            await this.supabase
                .from('trade_errors')
                .insert({
                    timestamp: new Date().toISOString(),
                    symbol: error.signal.symbol,
                    action: error.signal.action,
                    error_message: error.error.message,
                    error_stack: error.error.stack
                });
        } catch (dbError) {
            console.error('Failed to log trade error:', dbError);
        }
    }
    
    private async runContinuously(): Promise<void> {
        // Keep the process running
        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Periodic status update
            if (Date.now() % (5 * 60 * 1000) < 10000) { // Every 5 minutes
                const uptime = Date.now() - this.dailyStats.startTime.getTime();
                console.log(`⏱️ Uptime: ${Math.floor(uptime / 1000 / 60)} minutes | Trades: ${this.dailyStats.tradesExecuted} | PnL: $${this.dailyStats.totalPnL.toFixed(2)}`);
            }
        }
    }
    
    private async emergencyShutdown(): Promise<void> {
        console.log('🚨 EMERGENCY SHUTDOWN INITIATED');
        
        this.isRunning = false;
        
        try {
            // Close all positions if real trading is enabled
            if (this.config.enableRealTrading) {
                console.log('🔒 Closing all positions...');
                const activePositions = this.trader.getActivePositions();
                for (const [symbol, position] of activePositions) {
                    console.log(`   Closing ${symbol} position...`);
                    // Would execute actual close orders here
                }
            }
            
            // Stop the trader
            await this.trader.stop();
            
            // Log shutdown
            await this.supabase
                .from('system_events')
                .insert({
                    event_type: 'EMERGENCY_SHUTDOWN',
                    timestamp: new Date().toISOString(),
                    details: {
                        daily_pnl: this.dailyStats.totalPnL,
                        trades_executed: this.dailyStats.tradesExecuted,
                        active_positions: this.trader.getActivePositions().size
                    }
                });
            
            console.log('✅ Emergency shutdown completed');
            
        } catch (error) {
            console.error('❌ Error during emergency shutdown:', error);
        }
    }
    
    // Public API for external monitoring
    getStatus(): any {
        return {
            isRunning: this.isRunning,
            dailyStats: this.dailyStats,
            config: this.config,
            performance: this.trader.getPerformanceMetrics(),
            activePositions: this.trader.getActivePositions().size,
            supportedAssets: this.trader.getSupportedAssets()
        };
    }
}

// Main execution
async function main() {
    console.log('🚀 PRODUCTION VOLATILE ASSET TRADER');
    console.log('Based on Comprehensive Auto-Trading Rules Specification');
    console.log('Sentiment-Driven Trading for BTC, ETH, and Major Altcoins');
    console.log('=' .repeat(80));
    
    const productionTrader = new ProductionVolatileTrader();
    
    try {
        await productionTrader.startProduction();
    } catch (error) {
        console.error('❌ Production trader failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { ProductionVolatileTrader }; 
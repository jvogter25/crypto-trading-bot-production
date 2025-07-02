import { BaseStrategy } from './BaseStrategy';
import { MarketCondition } from '../types/MarketCondition';
import { TradingSignal } from '../types/TradingSignal';
import { PositionSide } from '../types/Position';
import { KrakenClient } from '../../order-execution/kraken-client';
import { GridStateManager } from '../../grid-management/GridStateManager';
import { SupabaseService } from '../../../database/supabase-client';

interface GridLevel {
    level: number;
    price: number;
    buyOrderId?: string;
    sellOrderId?: string;
    size: number;
    isActive: boolean;
}

interface GridConfig {
    upperBound: number;
    lowerBound: number;
    spacing: number;
    totalLevels: number;
    baseOrderSize: number;
}

export class StableCoinGridStrategy extends BaseStrategy {
    private gridLevels: Map<number, GridLevel> = new Map();
    private gridConfig: GridConfig;
    private currentPrice: number = 0;
    private cashReserves: number = 0;
    private totalInvested: number = 0;
    private currentProfit: number = 0;
    private lastRebalanceTime: Date = new Date();
    private krakenClient: KrakenClient;
    private gridStateManager: GridStateManager;
    private supabaseService: SupabaseService;
    
    // Configuration parameters from specification
    private readonly PROFIT_THRESHOLD = 0.02; // 2% profit threshold
    private readonly REINVESTMENT_PERCENTAGE = 0.70; // 70% reinvestment
    private readonly GRID_RANGE = 0.02; // ±2% from current price
    private readonly GRID_LEVELS = 20; // 20 grid levels
    private readonly GRID_SPACING = 0.002; // 0.2% spacing
    private readonly STOP_LOSS_THRESHOLD = 0.05; // 5% stop loss
    private readonly MIN_CASH_RESERVES = 0.20; // 20% minimum cash reserves
    private readonly EXTREME_ORDER_MULTIPLIER = 1.5; // 1.5x size for extreme orders

    constructor() {
        super('STABLE_COIN_GRID', ['USDCUSD', 'USDTUSD']);
        this.krakenClient = new KrakenClient();
        this.gridStateManager = new GridStateManager();
        this.supabaseService = new SupabaseService();
        this.initializeGridConfig();
    }

    private initializeGridConfig(): void {
        this.gridConfig = {
            upperBound: 0,
            lowerBound: 0,
            spacing: this.GRID_SPACING,
            totalLevels: this.GRID_LEVELS,
            baseOrderSize: 0
        };
    }

    async getMarketCondition(): Promise<MarketCondition> {
        try {
            // For stable coins, primarily sideways market with volatility-based adjustments
            const volatility = await this.calculateVolatility();
            
            if (volatility < 0.01) { // < 1% daily range
                return MarketCondition.SIDEWAYS;
            } else if (volatility > 0.03) { // > 3% daily range
                // High volatility - could be trending
                const trendStrength = await this.calculateTrendStrength();
                return trendStrength > 0.5 ? MarketCondition.BULL : MarketCondition.BEAR;
            }
            
            return MarketCondition.SIDEWAYS;
        } catch (error) {
            console.error('Error determining market condition:', error);
            return MarketCondition.SIDEWAYS; // Default to sideways for stable coins
        }
    }

    async generateSignals(): Promise<TradingSignal[]> {
        const signals: TradingSignal[] = [];
        
        try {
            await this.updateCurrentPrice();
            await this.updateGridConfiguration();
            
            // Check for profit-taking opportunities
            const profitSignals = await this.checkProfitTaking();
            signals.push(...profitSignals);
            
            // Generate grid rebalancing signals
            const gridSignals = await this.generateGridSignals();
            signals.push(...gridSignals);
            
            return signals;
        } catch (error) {
            console.error('Error generating signals:', error);
            return [];
        }
    }

    async validateSignal(signal: TradingSignal): Promise<boolean> {
        try {
            // Validate cash reserves
            if (this.cashReserves < this.MIN_CASH_RESERVES * this.totalInvested) {
                console.warn('Insufficient cash reserves for signal validation');
                return false;
            }
            
            // Validate price is within reasonable bounds
            if (signal.entryPrice <= 0 || signal.size <= 0) {
                return false;
            }
            
            // Validate grid level exists and is active
            if (signal.metadata.gridLevel) {
                const gridLevel = this.gridLevels.get(signal.metadata.gridLevel);
                if (!gridLevel || !gridLevel.isActive) {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error validating signal:', error);
            return false;
        }
    }

    async calculatePositionSize(signal: TradingSignal): Promise<number> {
        try {
            const baseSize = this.gridConfig.baseOrderSize;
            
            // Apply extreme order multiplier for grid extremes
            if (signal.metadata.gridLevel) {
                const level = signal.metadata.gridLevel;
                const isExtreme = level <= 2 || level >= this.GRID_LEVELS - 2;
                
                if (isExtreme) {
                    return baseSize * this.EXTREME_ORDER_MULTIPLIER;
                }
            }
            
            return baseSize;
        } catch (error) {
            console.error('Error calculating position size:', error);
            return 0;
        }
    }

    async calculateStopLoss(signal: TradingSignal): Promise<number> {
        const stopLossDistance = signal.entryPrice * this.STOP_LOSS_THRESHOLD;
        return signal.side === PositionSide.LONG 
            ? signal.entryPrice - stopLossDistance
            : signal.entryPrice + stopLossDistance;
    }

    async calculateTakeProfit(signal: TradingSignal): Promise<number> {
        const profitDistance = signal.entryPrice * this.PROFIT_THRESHOLD;
        return signal.side === PositionSide.LONG
            ? signal.entryPrice + profitDistance
            : signal.entryPrice - profitDistance;
    }

    private async updateCurrentPrice(): Promise<void> {
        try {
            console.log('Updating current price from Kraken API...');
            this.currentPrice = await this.krakenClient.getCurrentPrice(this.supportedAssets[0]);
            console.log(`Current price updated: ${this.currentPrice}`);
        } catch (error) {
            console.error('Error updating current price:', error);
            throw error;
        }
    }

    private async updateGridConfiguration(): Promise<void> {
        try {
            const volatility = await this.calculateVolatility();
            
            // Dynamic range adjustment based on volatility
            let gridRange = this.GRID_RANGE;
            let gridSpacing = this.GRID_SPACING;
            
            if (volatility < 0.01) { // Low volatility
                gridRange = 0.015; // ±1.5%
                gridSpacing = 0.0015; // 0.15% spacing
            } else if (volatility > 0.03) { // High volatility
                gridRange = 0.03; // ±3%
                gridSpacing = 0.003; // 0.3% spacing
            }
            
            this.gridConfig.upperBound = this.currentPrice * (1 + gridRange);
            this.gridConfig.lowerBound = this.currentPrice * (1 - gridRange);
            this.gridConfig.spacing = gridSpacing;
            
            // Calculate base order size based on available capital
            const availableCapital = this.cashReserves * (1 - this.MIN_CASH_RESERVES);
            this.gridConfig.baseOrderSize = availableCapital / this.GRID_LEVELS;
            
            await this.updateGridLevels();
        } catch (error) {
            console.error('Error updating grid configuration:', error);
            throw error;
        }
    }

    private async updateGridLevels(): Promise<void> {
        try {
            this.gridLevels.clear();
            
            const priceStep = (this.gridConfig.upperBound - this.gridConfig.lowerBound) / this.GRID_LEVELS;
            
            for (let i = 0; i < this.GRID_LEVELS; i++) {
                const price = this.gridConfig.lowerBound + (i * priceStep);
                
                const gridLevel: GridLevel = {
                    level: i,
                    price: price,
                    size: this.gridConfig.baseOrderSize,
                    isActive: true
                };
                
                this.gridLevels.set(i, gridLevel);
            }
        } catch (error) {
            console.error('Error updating grid levels:', error);
            throw error;
        }
    }

    private async checkProfitTaking(): Promise<TradingSignal[]> {
        const signals: TradingSignal[] = [];
        
        try {
            for (const [level, gridLevel] of this.gridLevels) {
                if (!gridLevel.isActive || !gridLevel.sellOrderId) continue;
                
                // Check if position has reached 2% profit
                const profitPercentage = Math.abs(this.currentPrice - gridLevel.price) / gridLevel.price;
                
                if (profitPercentage >= this.PROFIT_THRESHOLD) {
                    // Generate profit-taking signal
                    const signal: TradingSignal = {
                        tradingPair: this.supportedAssets[0],
                        side: this.currentPrice > gridLevel.price ? PositionSide.SHORT : PositionSide.LONG,
                        entryPrice: this.currentPrice,
                        stopLoss: await this.calculateStopLoss({
                            entryPrice: this.currentPrice,
                            side: this.currentPrice > gridLevel.price ? PositionSide.SHORT : PositionSide.LONG
                        } as TradingSignal),
                        takeProfit: this.currentPrice, // Immediate execution for profit-taking
                        size: gridLevel.size,
                        confidence: 0.9, // High confidence for profit-taking
                        strategyType: this.strategyType,
                        timestamp: new Date(),
                        metadata: {
                            gridLevel: level,
                            marketCondition: this.marketCondition.toString(),
                            profitTaking: true
                        }
                    };
                    
                    signals.push(signal);
                    
                    // Schedule reinvestment
                    await this.scheduleReinvestment(gridLevel.size * profitPercentage);
                }
            }
        } catch (error) {
            console.error('Error checking profit taking:', error);
        }
        
        return signals;
    }

    private async generateGridSignals(): Promise<TradingSignal[]> {
        const signals: TradingSignal[] = [];
        
        try {
            for (const [level, gridLevel] of this.gridLevels) {
                if (!gridLevel.isActive) continue;
                
                // Generate buy signal if price is near grid level and no active buy order
                if (!gridLevel.buyOrderId && this.currentPrice <= gridLevel.price * 1.001) {
                    const buySignal: TradingSignal = {
                        tradingPair: this.supportedAssets[0],
                        side: PositionSide.LONG,
                        entryPrice: gridLevel.price,
                        stopLoss: await this.calculateStopLoss({
                            entryPrice: gridLevel.price,
                            side: PositionSide.LONG
                        } as TradingSignal),
                        takeProfit: await this.calculateTakeProfit({
                            entryPrice: gridLevel.price,
                            side: PositionSide.LONG
                        } as TradingSignal),
                        size: gridLevel.size,
                        confidence: 0.8,
                        strategyType: this.strategyType,
                        timestamp: new Date(),
                        metadata: {
                            gridLevel: level,
                            marketCondition: this.marketCondition.toString()
                        }
                    };
                    
                    signals.push(buySignal);
                }
                
                // Generate sell signal if price is near grid level and no active sell order
                if (!gridLevel.sellOrderId && this.currentPrice >= gridLevel.price * 0.999) {
                    const sellSignal: TradingSignal = {
                        tradingPair: this.supportedAssets[0],
                        side: PositionSide.SHORT,
                        entryPrice: gridLevel.price,
                        stopLoss: await this.calculateStopLoss({
                            entryPrice: gridLevel.price,
                            side: PositionSide.SHORT
                        } as TradingSignal),
                        takeProfit: await this.calculateTakeProfit({
                            entryPrice: gridLevel.price,
                            side: PositionSide.SHORT
                        } as TradingSignal),
                        size: gridLevel.size,
                        confidence: 0.8,
                        strategyType: this.strategyType,
                        timestamp: new Date(),
                        metadata: {
                            gridLevel: level,
                            marketCondition: this.marketCondition.toString()
                        }
                    };
                    
                    signals.push(sellSignal);
                }
            }
        } catch (error) {
            console.error('Error generating grid signals:', error);
        }
        
        return signals;
    }

    private async scheduleReinvestment(profitAmount: number): Promise<void> {
        try {
            const reinvestmentAmount = profitAmount * this.REINVESTMENT_PERCENTAGE;
            const profitExtraction = profitAmount * (1 - this.REINVESTMENT_PERCENTAGE);
            
            // Add to cash reserves for reinvestment
            this.cashReserves += reinvestmentAmount;
            
            // Log profit extraction
            console.log(`Profit extracted: ${profitExtraction}, Reinvested: ${reinvestmentAmount}`);
            
            // Update grid configuration with new capital
            await this.updateGridConfiguration();
        } catch (error) {
            console.error('Error scheduling reinvestment:', error);
        }
    }

    private async calculateVolatility(): Promise<number> {
        try {
            // This would calculate 24-hour volatility from market data
            // For now, return a default value
            // In production: return await marketDataService.calculate24HourVolatility(this.supportedAssets[0]);
            return 0.02; // 2% default volatility
        } catch (error) {
            console.error('Error calculating volatility:', error);
            return 0.02;
        }
    }

    private async calculateTrendStrength(): Promise<number> {
        try {
            // This would calculate trend strength using technical indicators
            // For now, return a default value
            // In production: return await technicalAnalysisService.calculateTrendStrength(this.supportedAssets[0]);
            return 0.3; // Neutral trend strength
        } catch (error) {
            console.error('Error calculating trend strength:', error);
            return 0.3;
        }
    }

    async initialize(): Promise<void> {
        try {
            await super.initialize();
            
            console.log('Initializing StableCoinGridStrategy with database integration');
            
            // Test database connection
            const dbConnected = await this.supabaseService.testConnection();
            if (!dbConnected) {
                throw new Error('Database connection failed');
            }
            
            // Set initial values (these would come from your portfolio service)
            this.cashReserves = 10000; // Example: $10,000 initial capital
            this.totalInvested = 0;
            this.currentProfit = 0;
            
            await this.updateCurrentPrice();
            
            // Initialize or load grid state from database
            const tradingPair = this.supportedAssets[0];
            let gridState = await this.gridStateManager.loadGridState(tradingPair);
            
            if (!gridState) {
                // Initialize new grid state
                gridState = await this.gridStateManager.initializeGridState(tradingPair, this.currentPrice, {
                    gridRange: this.GRID_RANGE,
                    gridLevels: this.GRID_LEVELS,
                    baseOrderSize: this.cashReserves / this.GRID_LEVELS
                });
                console.log('New grid state initialized');
            } else {
                // Load existing grid state
                this.totalInvested = gridState.totalInvested;
                this.currentProfit = gridState.currentProfit;
                console.log('Existing grid state loaded');
            }
            
            await this.updateGridConfiguration();
            
            console.log('StableCoinGridStrategy initialized successfully');
        } catch (error) {
            console.error('Error initializing StableCoinGridStrategy:', error);
            throw error;
        }
    }

    async updateState(): Promise<void> {
        try {
            await super.updateState();
            await this.updateCurrentPrice();
            
            // Check for order fills and update grid state
            const tradingPair = this.supportedAssets[0];
            await this.gridStateManager.checkOrderFills(tradingPair);
            
            // Update grid configuration
            await this.updateGridConfiguration();
            
            // Update performance metrics
            this.currentProfit = await this.calculateCurrentProfit();
            
            // Update grid state in database
            await this.gridStateManager.updateGridState(tradingPair, {
                currentPrice: this.currentPrice,
                totalInvested: this.totalInvested,
                currentProfit: this.currentProfit
            });
            
            // Store market data for analysis
            await this.storeMarketData();
            
            console.log(`Grid Strategy State - Price: ${this.currentPrice}, Profit: ${this.currentProfit}, Cash: ${this.cashReserves}`);
        } catch (error) {
            console.error('Error updating StableCoinGridStrategy state:', error);
        }
    }

    private async calculateCurrentProfit(): Promise<number> {
        try {
            // Calculate unrealized profit from all active positions
            let totalProfit = 0;
            
            for (const gridLevel of this.gridLevels.values()) {
                if (gridLevel.buyOrderId || gridLevel.sellOrderId) {
                    const profitPercentage = Math.abs(this.currentPrice - gridLevel.price) / gridLevel.price;
                    totalProfit += gridLevel.size * profitPercentage;
                }
            }
            
            return totalProfit;
        } catch (error) {
            console.error('Error calculating current profit:', error);
            return 0;
        }
    }

    private async storeMarketData(): Promise<void> {
        try {
            const tradingPair = this.supportedAssets[0];
            const volatility = await this.calculateVolatility();
            
            // Store current market data with basic technical indicators
            await this.supabaseService.storeMarketData({
                trading_pair: tradingPair,
                timestamp: new Date(),
                open: this.currentPrice * 0.9995, // Simulated OHLC data
                high: this.currentPrice * 1.0005,
                low: this.currentPrice * 0.9995,
                close: this.currentPrice,
                volume: 1000000, // Simulated volume
                vwap: this.currentPrice,
                rsi_14: 50 + (Math.random() - 0.5) * 20, // Simulated RSI
                atr_14: volatility * this.currentPrice
            });
        } catch (error) {
            console.error('Error storing market data:', error);
        }
    }

    async cleanup(): Promise<void> {
        try {
            await super.cleanup();
            
            // Cancel all active orders
            for (const gridLevel of this.gridLevels.values()) {
                if (gridLevel.buyOrderId) {
                    // Cancel buy order
                    console.log(`Cancelling buy order: ${gridLevel.buyOrderId}`);
                }
                if (gridLevel.sellOrderId) {
                    // Cancel sell order
                    console.log(`Cancelling sell order: ${gridLevel.sellOrderId}`);
                }
            }
            
            this.gridLevels.clear();
            console.log('StableCoinGridStrategy cleanup completed');
        } catch (error) {
            console.error('Error during StableCoinGridStrategy cleanup:', error);
        }
    }
} 
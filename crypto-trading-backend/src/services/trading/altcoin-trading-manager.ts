import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { SentimentAnalysisService } from '../sentiment-analysis/sentiment-analysis-service';

// Mock interfaces for missing services (to be implemented)
interface EnhancedKrakenClient extends EventEmitter {
    getServerTime(): Promise<{ unixtime: number }>;
    getCurrentPrice(symbol: string): Promise<number>;
    getPortfolioValue(): Promise<number>;
    getOHLCData(symbol: string, interval: string, count: number): Promise<any[]>;
    placeOrder(order: any): Promise<{ txid: string[] }>;
}

interface TechnicalIndicators {
    symbol: string;
    price: number;
    timestamp: Date;
    rsi: { value: number; signal: string };
    macd: { signal_type: string; trend: string };
    bollinger: { position: string };
    atr: number;
    volume: { ratio: number };
    trend: string;
    strength: number;
}

interface TechnicalIndicatorService {
    getIndicators(symbol: string): Promise<TechnicalIndicators | null>;
}

export interface AltCoinPosition {
    symbol: string;
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    realizedPnL: number;
    stopLoss: number;
    trailingStop: number;
    profitTarget: number;
    entryTime: Date;
    lastUpdate: Date;
    pyramidLevel: number;
    maxPyramidLevel: number;
}

export interface MarketCondition {
    type: 'BULL' | 'BEAR' | 'SIDEWAYS';
    confidence: number;
    indicators: {
        sentiment: number;
        rsi: number;
        macd: number;
        bollinger: string;
        volume: number;
    };
    timestamp: Date;
}

export interface TradingSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD' | 'PYRAMID' | 'CLOSE';
    strength: number;
    confidence: number;
    reasoning: string[];
    positionSize: number;
    stopLoss: number;
    profitTarget: number;
    timestamp: Date;
}

export class AltCoinTradingManager extends EventEmitter {
    private sentimentService: SentimentAnalysisService;
    private supabase: any;
    
    private positions: Map<string, AltCoinPosition> = new Map();
    private marketConditions: Map<string, MarketCondition> = new Map();
    private isRunning = false;
    
    // Configuration from comprehensive trading rules
    private readonly BASE_PROFIT_THRESHOLD = 0.03;      // 3% base profit
    private readonly BULL_PROFIT_THRESHOLD = 0.08;     // 8% bull market profit
    private readonly BEAR_PROFIT_THRESHOLD = 0.015;    // 1.5% bear market profit
    private readonly REINVESTMENT_PERCENTAGE = 0.70;   // 70% reinvestment
    
    // Position sizing from trading rules
    private readonly BASE_POSITION_SIZE = 0.02;        // 2% of portfolio for small altcoins
    private readonly BTC_ETH_POSITION_SIZE = 0.03;     // 3% for BTC/ETH
    private readonly MAX_POSITION_SIZE = 0.05;         // 5% maximum exposure
    private readonly PYRAMID_SIZE = 0.01;              // 1% for pyramid additions
    
    // Market condition adjustments
    private readonly BULL_POSITION_MULTIPLIER = 1.25;  // 25% increase in bull market
    private readonly BEAR_POSITION_MULTIPLIER = 0.5;   // 50% reduction in bear market
    private readonly SIDEWAYS_POSITION_MULTIPLIER = 0.7; // 30% reduction in sideways
    
    constructor() {
        super();
        
        this.sentimentService = new SentimentAnalysisService();
        
        // Initialize Supabase
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        
        this.setupEventListeners();
        console.log('🚀 AltCoin Trading Manager initialized');
    }
    
    private setupEventListeners(): void {
        // Listen for sentiment signals
        this.sentimentService.on('signalChanged', (signal) => {
            this.processSentimentSignal(signal);
        });
    }
    
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️ AltCoin trading manager already running');
            return;
        }
        
        console.log('🚀 Starting AltCoin Trading Manager...');
        
        try {
            // Start sentiment analysis
            await this.sentimentService.start();
            
            // Load existing positions
            await this.loadPositions();
            
            // Start monitoring
            this.isRunning = true;
            
            // Start periodic market condition analysis
            setInterval(() => {
                this.analyzeMarketConditions();
            }, 5 * 60 * 1000); // Every 5 minutes
            
            console.log('✅ AltCoin Trading Manager started');
            this.emit('managerStarted');
            
        } catch (error) {
            console.error('❌ Failed to start AltCoin trading manager:', error);
            throw error;
        }
    }
    
    async stop(): Promise<void> {
        if (!this.isRunning) return;
        
        console.log('🛑 Stopping AltCoin Trading Manager...');
        this.isRunning = false;
        
        // Stop sentiment service
        await this.sentimentService.stop();
        
        // Save positions
        await this.savePositions();
        
        console.log('✅ AltCoin Trading Manager stopped');
        this.emit('managerStopped');
    }
    
    private async processSentimentSignal(signal: any): Promise<void> {
        if (!this.isRunning) return;
        
        try {
            console.log(`📊 Processing sentiment signal for ${signal.symbol}: ${signal.signal}`);
            
            // Determine market condition based on sentiment
            const marketCondition = await this.determineMarketCondition(signal);
            this.marketConditions.set(signal.symbol, marketCondition);
            
            // Generate trading signal
            const tradingSignal = this.generateTradingSignal(signal, marketCondition);
            
            if (tradingSignal.action !== 'HOLD') {
                console.log(`🎯 Generated ${tradingSignal.action} signal for ${signal.symbol}`);
                console.log(`   Reasoning: ${tradingSignal.reasoning.join(', ')}`);
                console.log(`   Confidence: ${tradingSignal.confidence.toFixed(2)}`);
                console.log(`   Position Size: ${(tradingSignal.positionSize * 100).toFixed(1)}%`);
                
                // In production, this would execute the trade
                // await this.executeTradingSignal(tradingSignal);
                
                // For now, just emit the signal
                this.emit('tradingSignal', tradingSignal);
            }
            
        } catch (error) {
            console.error(`Error processing sentiment signal for ${signal.symbol}:`, error);
        }
    }
    
    private async determineMarketCondition(signal: any): Promise<MarketCondition> {
        const indicators = {
            sentiment: signal.sentiment_scores?.adjusted_compound || 0,
            rsi: 50, // Would come from technical service
            macd: 0, // Would come from technical service
            bollinger: 'MIDDLE', // Would come from technical service
            volume: signal.volume_multiplier || 1
        };
        
        // Bull market conditions
        const bullConditions = [
            indicators.sentiment > 0.05,  // Relaxed threshold in bull market
            indicators.rsi < 70 && indicators.rsi > 50,
            indicators.macd > 0,
            indicators.bollinger === 'UPPER' || indicators.bollinger === 'ABOVE',
            indicators.volume > 1.2
        ];
        
        // Bear market conditions  
        const bearConditions = [
            indicators.sentiment < -0.05,
            indicators.rsi > 30 && indicators.rsi < 50,
            indicators.macd < 0,
            indicators.bollinger === 'LOWER' || indicators.bollinger === 'BELOW',
            indicators.volume < 0.8
        ];
        
        const bullScore = bullConditions.filter(Boolean).length / bullConditions.length;
        const bearScore = bearConditions.filter(Boolean).length / bearConditions.length;
        
        let marketType: 'BULL' | 'BEAR' | 'SIDEWAYS';
        let confidence: number;
        
        if (bullScore > 0.6) {
            marketType = 'BULL';
            confidence = bullScore;
        } else if (bearScore > 0.6) {
            marketType = 'BEAR';
            confidence = bearScore;
        } else {
            marketType = 'SIDEWAYS';
            confidence = 1 - Math.max(bullScore, bearScore);
        }
        
        return {
            type: marketType,
            confidence,
            indicators,
            timestamp: new Date()
        };
    }
    
    private generateTradingSignal(signal: any, marketCondition: MarketCondition): TradingSignal {
        const symbol = signal.symbol;
        const currentPosition = this.positions.get(symbol);
        const reasoning: string[] = [];
        
        // Base position size calculation
        let baseSize = symbol === 'BTC' || symbol === 'ETH' 
            ? this.BTC_ETH_POSITION_SIZE 
            : this.BASE_POSITION_SIZE;
            
        // Market condition adjustments
        switch (marketCondition.type) {
            case 'BULL':
                baseSize *= this.BULL_POSITION_MULTIPLIER;
                reasoning.push(`Bull market: increased position size by 25%`);
                break;
            case 'BEAR':
                baseSize *= this.BEAR_POSITION_MULTIPLIER;
                reasoning.push(`Bear market: reduced position size by 50%`);
                break;
            case 'SIDEWAYS':
                baseSize *= this.SIDEWAYS_POSITION_MULTIPLIER;
                reasoning.push(`Sideways market: reduced position size by 30%`);
                break;
        }
        
        // Determine action based on sentiment and market conditions
        let action: 'BUY' | 'SELL' | 'HOLD' | 'PYRAMID' | 'CLOSE' = 'HOLD';
        let strength = 0;
        let confidence = signal.confidence || 0.5;
        
        // BUY signal logic
        if (signal.trading_signal === 'BUY' && this.shouldBuy(signal, marketCondition)) {
            if (currentPosition) {
                // Check for pyramid opportunity
                if (this.shouldPyramid(currentPosition, signal)) {
                    action = 'PYRAMID';
                    baseSize = this.PYRAMID_SIZE;
                    reasoning.push('Pyramiding into existing position');
                } else {
                    action = 'HOLD';
                    reasoning.push('Already have position, no pyramid opportunity');
                }
            } else {
                action = 'BUY';
                reasoning.push('New buy signal with market confirmation');
            }
            strength = signal.strength || 0.7;
        }
        
        // SELL signal logic
        else if (signal.trading_signal === 'SELL' && currentPosition) {
            if (this.shouldSell(currentPosition, signal, marketCondition)) {
                action = 'CLOSE';
                reasoning.push('Sell signal with market confirmation');
                strength = signal.strength || 0.7;
            }
        }
        
        // Profit taking logic
        else if (currentPosition && this.shouldTakeProfit(currentPosition, marketCondition)) {
            action = 'CLOSE';
            reasoning.push('Profit target reached');
            strength = 0.8;
        }
        
        // Calculate stop loss and profit target
        const currentPrice = 50000; // Would come from price service
        const profitTarget = this.calculateProfitTarget(currentPrice, marketCondition);
        const stopLoss = currentPrice * 0.95; // 5% stop loss
        
        return {
            symbol,
            action,
            strength,
            confidence,
            reasoning,
            positionSize: baseSize,
            stopLoss,
            profitTarget,
            timestamp: new Date()
        };
    }
    
    private shouldBuy(signal: any, marketCondition: MarketCondition): boolean {
        const conditions = [
            signal.sentiment_scores?.adjusted_compound > 0.06, // Base sentiment threshold
            signal.confidence > 0.5, // Minimum confidence
            marketCondition.confidence > 0.4, // Market condition confidence
            signal.tweet_count > 50 // Minimum tweet volume
        ];
        
        // Require at least 3 out of 4 conditions in normal markets
        // Relax to 2 out of 4 in bull markets
        const requiredConditions = marketCondition.type === 'BULL' ? 2 : 3;
        return conditions.filter(Boolean).length >= requiredConditions;
    }
    
    private shouldSell(
        position: AltCoinPosition, 
        signal: any, 
        marketCondition: MarketCondition
    ): boolean {
        const conditions = [
            signal.sentiment_scores?.adjusted_compound < 0.04, // Negative sentiment
            position.unrealizedPnL < -0.05, // 5% loss threshold
            marketCondition.type === 'BEAR', // Bear market
            signal.confidence > 0.6 // High confidence in sell signal
        ];
        
        // More aggressive selling in bear markets
        const requiredConditions = marketCondition.type === 'BEAR' ? 2 : 3;
        return conditions.filter(Boolean).length >= requiredConditions;
    }
    
    private shouldPyramid(position: AltCoinPosition, signal: any): boolean {
        return (
            position.pyramidLevel < position.maxPyramidLevel &&
            position.unrealizedPnL > 0.005 && // At least 0.5% profit
            signal.strength > 0.7 &&
            signal.confidence > 0.6
        );
    }
    
    private shouldTakeProfit(position: AltCoinPosition, marketCondition: MarketCondition): boolean {
        const profitThreshold = this.getProfitThreshold(marketCondition);
        return position.unrealizedPnL >= profitThreshold;
    }
    
    private getProfitThreshold(marketCondition: MarketCondition): number {
        switch (marketCondition.type) {
            case 'BULL':
                return this.BULL_PROFIT_THRESHOLD;
            case 'BEAR':
                return this.BEAR_PROFIT_THRESHOLD;
            default:
                return this.BASE_PROFIT_THRESHOLD;
        }
    }
    
    private calculateProfitTarget(currentPrice: number, marketCondition: MarketCondition): number {
        const profitThreshold = this.getProfitThreshold(marketCondition);
        return currentPrice * (1 + profitThreshold);
    }
    
    private async analyzeMarketConditions(): Promise<void> {
        // Periodic market condition analysis
        for (const symbol of ['BTC', 'ETH']) {
            try {
                const sentiment = this.sentimentService.getLatestSignal(symbol);
                
                if (sentiment) {
                    const marketCondition = await this.determineMarketCondition(sentiment);
                    this.marketConditions.set(symbol, marketCondition);
                    
                    console.log(`📈 ${symbol} market condition: ${marketCondition.type} (confidence: ${marketCondition.confidence.toFixed(2)})`);
                }
            } catch (error) {
                console.error(`Error analyzing market conditions for ${symbol}:`, error);
            }
        }
    }
    
    private async loadPositions(): Promise<void> {
        try {
            const { data, error } = await this.supabase
                .from('altcoin_positions')
                .select('*')
                .eq('status', 'ACTIVE');
                
            if (error) throw error;
            
            for (const pos of data || []) {
                this.positions.set(pos.symbol, {
                    symbol: pos.symbol,
                    size: pos.size,
                    entryPrice: pos.entry_price,
                    currentPrice: pos.current_price,
                    unrealizedPnL: pos.unrealized_pnl,
                    realizedPnL: pos.realized_pnl,
                    stopLoss: pos.stop_loss,
                    trailingStop: pos.trailing_stop,
                    profitTarget: pos.profit_target,
                    entryTime: new Date(pos.entry_time),
                    lastUpdate: new Date(pos.last_update),
                    pyramidLevel: pos.pyramid_level,
                    maxPyramidLevel: pos.max_pyramid_level
                });
            }
            
            console.log(`📊 Loaded ${this.positions.size} active positions`);
        } catch (error) {
            console.error('Error loading positions:', error);
        }
    }
    
    private async savePositions(): Promise<void> {
        try {
            for (const [symbol, position] of this.positions) {
                await this.supabase
                    .from('altcoin_positions')
                    .upsert({
                        symbol: position.symbol,
                        size: position.size,
                        entry_price: position.entryPrice,
                        current_price: position.currentPrice,
                        unrealized_pnl: position.unrealizedPnL,
                        realized_pnl: position.realizedPnL,
                        stop_loss: position.stopLoss,
                        trailing_stop: position.trailingStop,
                        profit_target: position.profitTarget,
                        entry_time: position.entryTime.toISOString(),
                        last_update: position.lastUpdate.toISOString(),
                        pyramid_level: position.pyramidLevel,
                        max_pyramid_level: position.maxPyramidLevel,
                        status: 'ACTIVE'
                    });
            }
        } catch (error) {
            console.error('Error saving positions:', error);
        }
    }
    
    // Public API methods
    
    getPositions(): Map<string, AltCoinPosition> {
        return new Map(this.positions);
    }
    
    getMarketConditions(): Map<string, MarketCondition> {
        return new Map(this.marketConditions);
    }
    
    getPerformanceMetrics(): any {
        const totalPositions = this.positions.size;
        const totalUnrealizedPnL = Array.from(this.positions.values())
            .reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
        const totalRealizedPnL = Array.from(this.positions.values())
            .reduce((sum, pos) => sum + pos.realizedPnL, 0);
            
        return {
            totalPositions,
            totalUnrealizedPnL,
            totalRealizedPnL,
            totalPnL: totalUnrealizedPnL + totalRealizedPnL,
            isRunning: this.isRunning,
            marketConditions: Object.fromEntries(this.marketConditions),
            profitThresholds: {
                base: this.BASE_PROFIT_THRESHOLD,
                bull: this.BULL_PROFIT_THRESHOLD,
                bear: this.BEAR_PROFIT_THRESHOLD
            },
            reinvestmentRate: this.REINVESTMENT_PERCENTAGE
        };
    }
    
    // Configuration methods
    
    getStrategyConfig(): any {
        return {
            profitThresholds: {
                base: this.BASE_PROFIT_THRESHOLD,
                bull: this.BULL_PROFIT_THRESHOLD,
                bear: this.BEAR_PROFIT_THRESHOLD
            },
            positionSizes: {
                base: this.BASE_POSITION_SIZE,
                btcEth: this.BTC_ETH_POSITION_SIZE,
                max: this.MAX_POSITION_SIZE,
                pyramid: this.PYRAMID_SIZE
            },
            marketMultipliers: {
                bull: this.BULL_POSITION_MULTIPLIER,
                bear: this.BEAR_POSITION_MULTIPLIER,
                sideways: this.SIDEWAYS_POSITION_MULTIPLIER
            },
            reinvestmentRate: this.REINVESTMENT_PERCENTAGE
        };
    }
} 
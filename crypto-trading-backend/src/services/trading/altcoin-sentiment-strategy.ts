import { EventEmitter } from 'events';
import { EnhancedKrakenClient } from '../order-execution/enhanced-kraken-client';
import { SentimentAnalysisService, SentimentSignal } from '../sentiment-analysis/sentiment-analysis-service';
import { TechnicalIndicatorService } from './technical-indicator-service';
import { createClient } from '@supabase/supabase-js';

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

export class AltCoinSentimentStrategy extends EventEmitter {
    private krakenClient: EnhancedKrakenClient;
    private sentimentService: SentimentAnalysisService;
    private technicalService: TechnicalIndicatorService;
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
    
    // Technical indicator thresholds
    private readonly RSI_OVERBOUGHT = 70;
    private readonly RSI_OVERSOLD = 30;
    private readonly ATR_MULTIPLIER = 2.5;             // 2.5x ATR for altcoin stops
    
    // Market condition adjustments
    private readonly BULL_POSITION_MULTIPLIER = 1.25;  // 25% increase in bull market
    private readonly BEAR_POSITION_MULTIPLIER = 0.5;   // 50% reduction in bear market
    private readonly SIDEWAYS_POSITION_MULTIPLIER = 0.7; // 30% reduction in sideways
    
    constructor(
        krakenClient: EnhancedKrakenClient,
        sentimentService: SentimentAnalysisService,
        technicalService: TechnicalIndicatorService
    ) {
        super();
        
        this.krakenClient = krakenClient;
        this.sentimentService = sentimentService;
        this.technicalService = technicalService;
        
        // Initialize Supabase (optional)
        try {
            if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
                this.supabase = createClient(
                    process.env.SUPABASE_URL,
                    process.env.SUPABASE_ANON_KEY
                );
                console.log('✅ Supabase client initialized');
            } else {
                console.log('⚠️ Supabase not configured - running without database persistence');
                this.supabase = null;
            }
        } catch (error) {
            console.warn('⚠️ Supabase initialization failed - running without database persistence');
            this.supabase = null;
        }
        
        this.setupEventListeners();
        console.log('🚀 AltCoin Sentiment Strategy initialized');
    }
    
    private setupEventListeners(): void {
        // Listen for sentiment signals
        this.sentimentService.on('signalChanged', (signal: SentimentSignal) => {
            this.processSentimentSignal(signal);
        });
        
        // Listen for price updates
        this.krakenClient.on('priceUpdate', (data) => {
            this.updatePositions(data);
        });
        
        // Listen for order fills
        this.krakenClient.on('orderFilled', (order) => {
            this.handleOrderFill(order);
        });
    }
    
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️ AltCoin strategy already running');
            return;
        }
        
        console.log('🚀 Starting AltCoin Sentiment Strategy...');
        
        try {
            // Load existing positions
            await this.loadPositions();
            
            // Start monitoring
            this.isRunning = true;
            
            // Start aggressive market condition analysis
            setInterval(() => {
                this.analyzeMarketConditions();
            }, 1 * 60 * 1000); // Every 1 minute for faster KPI monitoring
            
            console.log('✅ AltCoin Sentiment Strategy started');
            this.emit('strategyStarted');
            
        } catch (error) {
            console.error('❌ Failed to start AltCoin strategy:', error);
            throw error;
        }
    }
    
    async stop(): Promise<void> {
        if (!this.isRunning) return;
        
        console.log('🛑 Stopping AltCoin Sentiment Strategy...');
        this.isRunning = false;
        
        // Save positions
        await this.savePositions();
        
        console.log('✅ AltCoin Sentiment Strategy stopped');
        this.emit('strategyStopped');
    }
    
    private async processSentimentSignal(signal: SentimentSignal): Promise<void> {
        if (!this.isRunning) return;
        
        try {
            console.log(`📊 Processing sentiment signal for ${signal.symbol}: ${signal.signal}`);
            
            // Get technical indicators
            const technicals = await this.technicalService.getIndicators(signal.symbol);
            
            // Determine market condition
            const marketCondition = await this.determineMarketCondition(signal.symbol, signal, technicals);
            this.marketConditions.set(signal.symbol, marketCondition);
            
            // Generate trading signal
            const tradingSignal = this.generateTradingSignal(signal, technicals, marketCondition);
            
            if (tradingSignal.action !== 'HOLD') {
                await this.executeTradingSignal(tradingSignal);
            }
            
        } catch (error) {
            console.error(`Error processing sentiment signal for ${signal.symbol}:`, error);
        }
    }
    
    private async determineMarketCondition(
        symbol: string, 
        sentiment: SentimentSignal, 
        technicals: any
    ): Promise<MarketCondition> {
        
        const indicators = {
            sentiment: sentiment.sentiment_score,
            rsi: technicals.rsi || 50,
            macd: technicals.macd?.histogram || 0,
            bollinger: technicals.bollinger?.position || 'MIDDLE',
            volume: technicals.volume?.ratio || 1
        };
        
        // Bull market conditions
        const bullConditions = [
            sentiment.sentiment_score > 0.05,  // Relaxed threshold in bull market
            indicators.rsi < 70 && indicators.rsi > 50,
            indicators.macd > 0,
            indicators.bollinger === 'UPPER' || indicators.bollinger === 'ABOVE',
            indicators.volume > 1.2
        ];
        
        // Bear market conditions  
        const bearConditions = [
            sentiment.sentiment_score < -0.05,
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
    
    private generateTradingSignal(
        sentiment: SentimentSignal,
        technicals: any,
        marketCondition: MarketCondition
    ): TradingSignal {
        
        const symbol = sentiment.symbol;
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
        
        // Determine action based on sentiment and technical confluence
        let action: 'BUY' | 'SELL' | 'HOLD' | 'PYRAMID' | 'CLOSE' = 'HOLD';
        let strength = 0;
        let confidence = sentiment.confidence;
        
        // BUY signal logic
        if (sentiment.signal === 'BUY' && this.shouldBuy(sentiment, technicals, marketCondition)) {
            if (currentPosition) {
                // Check for pyramid opportunity
                if (this.shouldPyramid(currentPosition, sentiment, technicals)) {
                    action = 'PYRAMID';
                    baseSize = this.PYRAMID_SIZE;
                    reasoning.push('Pyramiding into existing position');
                } else {
                    action = 'HOLD';
                    reasoning.push('Already have position, no pyramid opportunity');
                }
            } else {
                action = 'BUY';
                reasoning.push('New buy signal with technical confirmation');
            }
            strength = sentiment.strength;
        }
        
        // SELL signal logic
        else if (sentiment.signal === 'SELL' && currentPosition) {
            if (this.shouldSell(currentPosition, sentiment, technicals, marketCondition)) {
                action = 'CLOSE';
                reasoning.push('Sell signal with technical confirmation');
                strength = sentiment.strength;
            }
        }
        
        // Profit taking logic
        else if (currentPosition && this.shouldTakeProfit(currentPosition, marketCondition)) {
            action = 'CLOSE';
            reasoning.push('Profit target reached');
            strength = 0.8;
        }
        
        // Stop loss logic
        else if (currentPosition && this.shouldStopLoss(currentPosition)) {
            action = 'CLOSE';
            reasoning.push('Stop loss triggered');
            strength = 1.0;
        }
        
        // Calculate stop loss and profit target
        const currentPrice = technicals.price || 0;
        const atr = technicals.atr || currentPrice * 0.02;
        
        const stopLoss = action === 'BUY' || action === 'PYRAMID' 
            ? currentPrice - (atr * this.ATR_MULTIPLIER)
            : 0;
            
        const profitTarget = this.calculateProfitTarget(currentPrice, marketCondition);
        
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
    
    private shouldBuy(sentiment: SentimentSignal, technicals: any, marketCondition: MarketCondition): boolean {
        const conditions = [
            sentiment.sentiment_score > 0.06, // Base sentiment threshold
            technicals.rsi < this.RSI_OVERBOUGHT, // Not overbought
            technicals.macd?.signal === 'BULLISH_CROSSOVER', // MACD confirmation
            technicals.bollinger?.position !== 'ABOVE', // Not extended above Bollinger
            sentiment.confidence > 0.5 // Minimum confidence
        ];
        
        // Require at least 3 out of 5 conditions in normal markets
        // Relax to 2 out of 5 in bull markets
        const requiredConditions = marketCondition.type === 'BULL' ? 2 : 3;
        return conditions.filter(Boolean).length >= requiredConditions;
    }
    
    private shouldSell(
        position: AltCoinPosition, 
        sentiment: SentimentSignal, 
        technicals: any, 
        marketCondition: MarketCondition
    ): boolean {
        const conditions = [
            sentiment.sentiment_score < 0.04, // Negative sentiment
            technicals.rsi > this.RSI_OVERBOUGHT, // Overbought
            technicals.macd?.signal === 'BEARISH_CROSSOVER', // MACD bearish
            technicals.bollinger?.position === 'ABOVE', // Extended above Bollinger
            position.unrealizedPnL < -0.05 // 5% loss threshold
        ];
        
        // More aggressive selling in bear markets
        const requiredConditions = marketCondition.type === 'BEAR' ? 2 : 3;
        return conditions.filter(Boolean).length >= requiredConditions;
    }
    
    private shouldPyramid(
        position: AltCoinPosition, 
        sentiment: SentimentSignal, 
        technicals: any
    ): boolean {
        return (
            position.pyramidLevel < position.maxPyramidLevel &&
            position.unrealizedPnL > 0.005 && // At least 0.5% profit
            sentiment.strength > 0.7 &&
            technicals.rsi < 65 // Not too overbought
        );
    }
    
    private shouldTakeProfit(position: AltCoinPosition, marketCondition: MarketCondition): boolean {
        const profitThreshold = this.getProfitThreshold(marketCondition);
        return position.unrealizedPnL >= profitThreshold;
    }
    
    private shouldStopLoss(position: AltCoinPosition): boolean {
        return position.currentPrice <= position.stopLoss;
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
    
    private async executeTradingSignal(signal: TradingSignal): Promise<void> {
        try {
            console.log(`🎯 Executing ${signal.action} signal for ${signal.symbol}`);
            console.log(`   Reasoning: ${signal.reasoning.join(', ')}`);
            console.log(`   Position Size: ${(signal.positionSize * 100).toFixed(1)}%`);
            console.log(`   Confidence: ${signal.confidence.toFixed(2)}`);
            
            const currentPrice = await this.krakenClient.getCurrentPrice(signal.symbol);
            const portfolioValue = await this.krakenClient.getPortfolioValue();
            const orderSize = portfolioValue * signal.positionSize;
            
            let orderId: string | null = null;
            
            switch (signal.action) {
                case 'BUY':
                    orderId = await this.executeBuyOrder(signal, orderSize, currentPrice);
                    break;
                    
                case 'PYRAMID':
                    orderId = await this.executePyramidOrder(signal, orderSize, currentPrice);
                    break;
                    
                case 'CLOSE':
                    await this.executeClosePosition(signal.symbol);
                    break;
            }
            
            // Log the trade
            await this.logTrade(signal, orderId, orderSize, currentPrice);
            
            this.emit('tradeExecuted', {
                signal,
                orderId,
                orderSize,
                currentPrice
            });
            
        } catch (error) {
            console.error(`Error executing trading signal for ${signal.symbol}:`, error);
            this.emit('tradeError', { signal, error });
        }
    }
    
    private async executeBuyOrder(signal: TradingSignal, orderSize: number, currentPrice: number): Promise<string> {
        const order = await this.krakenClient.placeOrder({
            pair: `${signal.symbol}USD`,
            type: 'buy',
            ordertype: 'market',
            volume: (orderSize / currentPrice).toString(),
            validate: false
        });
        
        // Create position tracking
        const position: AltCoinPosition = {
            symbol: signal.symbol,
            size: orderSize / currentPrice,
            entryPrice: currentPrice,
            currentPrice,
            unrealizedPnL: 0,
            realizedPnL: 0,
            stopLoss: signal.stopLoss,
            trailingStop: signal.stopLoss,
            profitTarget: signal.profitTarget,
            entryTime: new Date(),
            lastUpdate: new Date(),
            pyramidLevel: 1,
            maxPyramidLevel: 3
        };
        
        this.positions.set(signal.symbol, position);
        
        return order.txid[0];
    }
    
    private async executePyramidOrder(signal: TradingSignal, orderSize: number, currentPrice: number): Promise<string> {
        const position = this.positions.get(signal.symbol)!;
        
        const order = await this.krakenClient.placeOrder({
            pair: `${signal.symbol}USD`,
            type: 'buy',
            ordertype: 'market',
            volume: (orderSize / currentPrice).toString(),
            validate: false
        });
        
        // Update position
        const newSize = position.size + (orderSize / currentPrice);
        const newEntryPrice = ((position.entryPrice * position.size) + (currentPrice * (orderSize / currentPrice))) / newSize;
        
        position.size = newSize;
        position.entryPrice = newEntryPrice;
        position.pyramidLevel += 1;
        position.lastUpdate = new Date();
        
        return order.txid[0];
    }
    
    private async executeClosePosition(symbol: string): Promise<void> {
        const position = this.positions.get(symbol);
        if (!position) return;
        
        await this.krakenClient.placeOrder({
            pair: `${symbol}USD`,
            type: 'sell',
            ordertype: 'market',
            volume: position.size.toString(),
            validate: false
        });
        
        // Calculate realized PnL
        const realizedPnL = (position.currentPrice - position.entryPrice) * position.size;
        position.realizedPnL = realizedPnL;
        
        // Handle reinvestment (70% as specified)
        if (realizedPnL > 0) {
            const reinvestAmount = realizedPnL * this.REINVESTMENT_PERCENTAGE;
            console.log(`💰 Profit: $${realizedPnL.toFixed(2)}, Reinvesting: $${reinvestAmount.toFixed(2)} (70%)`);
        }
        
        // Remove position
        this.positions.delete(symbol);
    }
    
    private async updatePositions(priceData: any): Promise<void> {
        for (const [symbol, position] of this.positions) {
            if (priceData.symbol === symbol) {
                position.currentPrice = priceData.price;
                position.unrealizedPnL = (priceData.price - position.entryPrice) / position.entryPrice;
                position.lastUpdate = new Date();
                
                // Update trailing stop
                if (position.unrealizedPnL > 0.01) { // Start trailing after 1% profit
                    const newTrailingStop = priceData.price * 0.98; // 2% trailing stop
                    if (newTrailingStop > position.trailingStop) {
                        position.trailingStop = newTrailingStop;
                    }
                }
            }
        }
    }
    
    private async handleOrderFill(order: any): Promise<void> {
        console.log(`✅ Order filled: ${order.pair} ${order.type} ${order.vol} @ ${order.price}`);
        // Additional order fill handling logic
    }
    
    private async analyzeMarketConditions(): Promise<void> {
        // Periodic market condition analysis
        for (const symbol of ['BTC', 'ETH']) {
            try {
                const sentiment = this.sentimentService.getLatestSignal(symbol);
                const technicals = await this.technicalService.getIndicators(symbol);
                
                if (sentiment && technicals) {
                    const marketCondition = await this.determineMarketCondition(symbol, sentiment, technicals);
                    this.marketConditions.set(symbol, marketCondition);
                    
                    console.log(`📈 ${symbol} market condition: ${marketCondition.type} (confidence: ${marketCondition.confidence.toFixed(2)})`);
                }
            } catch (error) {
                console.error(`Error analyzing market conditions for ${symbol}:`, error);
            }
        }
    }
    
    private async loadPositions(): Promise<void> {
        if (!this.supabase) {
            console.log('📊 No database configured - starting with empty positions');
            return;
        }
        
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
            
            console.log(`📊 Loaded ${this.positions.size} active positions from database`);
        } catch (error) {
            console.error('Error loading positions:', error);
        }
    }
    
    private async savePositions(): Promise<void> {
        if (!this.supabase) {
            console.log('📊 No database configured - positions not persisted');
            return;
        }
        
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
            console.log('📊 Positions saved to database');
        } catch (error) {
            console.error('Error saving positions:', error);
        }
    }
    
    private async logTrade(signal: TradingSignal, orderId: string | null, orderSize: number, price: number): Promise<void> {
        if (!this.supabase) {
            console.log(`📝 Trade logged locally: ${signal.action} ${signal.symbol} @ $${price} (DB not configured)`);
            return;
        }
        
        try {
            await this.supabase
                .from('altcoin_trades')
                .insert({
                    symbol: signal.symbol,
                    action: signal.action,
                    order_id: orderId,
                    size: orderSize,
                    price: price,
                    confidence: signal.confidence,
                    reasoning: signal.reasoning.join('; '),
                    timestamp: signal.timestamp.toISOString()
                });
        } catch (error) {
            console.error('Error logging trade:', error);
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
            isRunning: this.isRunning
        };
    }
} 
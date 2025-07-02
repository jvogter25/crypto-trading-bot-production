import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { SentimentAnalysisService, SentimentSignal } from '../sentiment-analysis/sentiment-analysis-service';

// Trading interfaces
export interface VolatileAssetPosition {
    id: string;
    symbol: string;
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    realizedPnL: number;
    stopLoss: number;
    trailingStop: number;
    profitTarget: number;
    entryTime: Date;
    lastUpdate: Date;
    marketCondition: 'BULL' | 'BEAR' | 'SIDEWAYS';
    sentimentScore: number;
    confidence: number;
    status: 'ACTIVE' | 'CLOSED' | 'STOPPED';
}

export interface TechnicalIndicators {
    symbol: string;
    timestamp: Date;
    price: number;
    rsi: {
        value: number;
        signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
        divergence?: 'BULLISH' | 'BEARISH' | 'NONE';
    };
    macd: {
        macd: number;
        signal: number;
        histogram: number;
        crossover: 'BULLISH' | 'BEARISH' | 'NONE';
        trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    };
    movingAverages: {
        sma20: number;
        sma50: number;
        ema12: number;
        ema26: number;
        trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    };
    atr: number;
    volume: {
        current: number;
        average: number;
        ratio: number;
    };
}

export interface MarketCondition {
    symbol: string;
    condition: 'BULL' | 'BEAR' | 'SIDEWAYS';
    confidence: number;
    indicators: {
        sentiment: number;
        rsi: number;
        macd: number;
        volume: number;
        trend: string;
    };
    timestamp: Date;
}

export interface TradingSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
    strength: number; // 0-100 scale
    confidence: number; // 0-100 scale
    reasoning: string[];
    positionSize: number; // Percentage of portfolio
    profitTarget: number;
    stopLoss: number;
    sentimentScore: number;
    technicalScore: number;
    timestamp: Date;
}

export interface TradeExecution {
    id: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    size: number;
    price: number;
    totalValue: number;
    sentimentScore: number;
    confidence: number;
    marketCondition: string;
    profitTarget: number;
    stopLoss: number;
    timestamp: Date;
    orderId?: string;
}

export class VolatileAssetTrader extends EventEmitter {
    private sentimentService: SentimentAnalysisService;
    private supabase: any;
    private positions: Map<string, VolatileAssetPosition> = new Map();
    private technicalIndicators: Map<string, TechnicalIndicators> = new Map();
    private marketConditions: Map<string, MarketCondition> = new Map();
    private isRunning = false;
    private priceUpdateInterval: NodeJS.Timeout | null = null;
    private analysisInterval: NodeJS.Timeout | null = null;
    
    // Configuration from comprehensive trading rules
    private readonly SUPPORTED_ASSETS = ['BTC', 'ETH', 'ADA', 'SOL', 'MATIC', 'LINK', 'DOT', 'AVAX'];
    
    // Profit thresholds (exact specification)
    private readonly BASE_PROFIT_THRESHOLD = 0.03;      // 3% base profit
    private readonly BULL_PROFIT_THRESHOLD = 0.08;     // 8% bull market
    private readonly BEAR_PROFIT_THRESHOLD = 0.015;    // 1.5% bear market
    
    // Position sizing (exact specification)
    private readonly BTC_ETH_POSITION_SIZE = 0.03;     // 3% for BTC/ETH
    private readonly ALT_POSITION_SIZE = 0.02;         // 2% for other alts
    private readonly MAX_POSITION_SIZE = 0.05;         // 5% maximum exposure
    
    // Sentiment thresholds (exact specification)
    private readonly SENTIMENT_BUY_THRESHOLD = 0.06;   // Buy above 0.06
    private readonly SENTIMENT_SELL_THRESHOLD = 0.04;  // Sell below 0.04
    private readonly SENTIMENT_NEUTRAL_ZONE = [0.04, 0.06]; // Neutral zone
    
    // Technical indicator thresholds
    private readonly RSI_OVERBOUGHT = 70;
    private readonly RSI_OVERSOLD = 30;
    private readonly ATR_STOP_MULTIPLIER = 2.0; // 2x ATR for stops
    
    // Risk management
    private readonly MAX_PORTFOLIO_EXPOSURE = 0.80;    // 80% max exposure
    private readonly CASH_RESERVE = 0.20;              // 20% cash reserve
    
    constructor() {
        super();
        
        this.sentimentService = new SentimentAnalysisService();
        
        // Initialize Supabase
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        
        this.setupEventListeners();
        console.log('🚀 Volatile Asset Trader initialized for:', this.SUPPORTED_ASSETS.join(', '));
    }
    
    private setupEventListeners(): void {
        // Listen for sentiment signals
        this.sentimentService.on('signalChanged', (signal: SentimentSignal) => {
            this.processSentimentSignal(signal);
        });
        
        // Listen for sentiment updates
        this.sentimentService.on('sentimentUpdate', (data) => {
            this.updateSentimentData(data);
        });
    }
    
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️ Volatile Asset Trader already running');
            return;
        }
        
        console.log('🚀 Starting Volatile Asset Trader...');
        
        try {
            // Start sentiment analysis service
            await this.sentimentService.start();
            
            // Load existing positions
            await this.loadPositions();
            
            // Start price monitoring
            this.startPriceMonitoring();
            
            // Start technical analysis
            this.startTechnicalAnalysis();
            
            this.isRunning = true;
            
            console.log('✅ Volatile Asset Trader started successfully');
            console.log(`📊 Monitoring ${this.SUPPORTED_ASSETS.length} assets for trading opportunities`);
            
            this.emit('traderStarted', {
                assets: this.SUPPORTED_ASSETS,
                activePositions: this.positions.size
            });
            
        } catch (error) {
            console.error('❌ Failed to start Volatile Asset Trader:', error);
            throw error;
        }
    }
    
    async stop(): Promise<void> {
        if (!this.isRunning) return;
        
        console.log('🛑 Stopping Volatile Asset Trader...');
        
        // Stop intervals
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
            this.priceUpdateInterval = null;
        }
        
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        
        // Stop sentiment service
        await this.sentimentService.stop();
        
        // Save positions
        await this.savePositions();
        
        this.isRunning = false;
        
        console.log('✅ Volatile Asset Trader stopped');
        this.emit('traderStopped');
    }
    
    private startPriceMonitoring(): void {
        // Monitor prices every 30 seconds
        this.priceUpdateInterval = setInterval(async () => {
            await this.updatePrices();
        }, 30000);
        
        console.log('📈 Price monitoring started (30-second intervals)');
    }
    
    private startTechnicalAnalysis(): void {
        // Run technical analysis every 5 minutes
        this.analysisInterval = setInterval(async () => {
            await this.runTechnicalAnalysis();
        }, 5 * 60 * 1000);
        
        console.log('📊 Technical analysis started (5-minute intervals)');
    }
    
    private async processSentimentSignal(signal: SentimentSignal): Promise<void> {
        if (!this.isRunning || !this.SUPPORTED_ASSETS.includes(signal.symbol)) {
            return;
        }
        
        try {
            console.log(`📊 Processing sentiment signal for ${signal.symbol}: ${signal.signal}`);
            console.log(`   Score: ${signal.sentiment_score.toFixed(4)} | Confidence: ${signal.confidence.toFixed(2)}`);
            
            // Get technical indicators
            const technicals = this.technicalIndicators.get(signal.symbol);
            if (!technicals) {
                console.log(`⚠️ No technical indicators available for ${signal.symbol}, skipping`);
                return;
            }
            
            // Determine market condition
            const marketCondition = this.determineMarketCondition(signal, technicals);
            this.marketConditions.set(signal.symbol, marketCondition);
            
            // Generate trading signal
            const tradingSignal = this.generateTradingSignal(signal, technicals, marketCondition);
            
            // Execute trading signal if actionable
            if (tradingSignal.action !== 'HOLD') {
                await this.executeTradingSignal(tradingSignal);
            }
            
            // Log signal for analysis
            await this.logTradingSignal(tradingSignal);
            
        } catch (error) {
            console.error(`Error processing sentiment signal for ${signal.symbol}:`, error);
        }
    }
    
    private determineMarketCondition(
        sentiment: SentimentSignal, 
        technicals: TechnicalIndicators
    ): MarketCondition {
        
        const indicators = {
            sentiment: sentiment.sentiment_score,
            rsi: technicals.rsi.value,
            macd: technicals.macd.histogram,
            volume: technicals.volume.ratio,
            trend: technicals.movingAverages.trend
        };
        
        // Bull market conditions (from trading rules)
        const bullConditions = [
            sentiment.sentiment_score > 0.05,  // Relaxed threshold in bull market
            technicals.rsi.value < 70 && technicals.rsi.value > 50,
            technicals.macd.histogram > 0,
            technicals.movingAverages.trend === 'BULLISH',
            technicals.volume.ratio > 1.2
        ];
        
        // Bear market conditions
        const bearConditions = [
            sentiment.sentiment_score < -0.05,
            technicals.rsi.value > 30 && technicals.rsi.value < 50,
            technicals.macd.histogram < 0,
            technicals.movingAverages.trend === 'BEARISH',
            technicals.volume.ratio < 0.8
        ];
        
        const bullScore = bullConditions.filter(Boolean).length / bullConditions.length;
        const bearScore = bearConditions.filter(Boolean).length / bearConditions.length;
        
        let condition: 'BULL' | 'BEAR' | 'SIDEWAYS';
        let confidence: number;
        
        if (bullScore > 0.6) {
            condition = 'BULL';
            confidence = bullScore;
        } else if (bearScore > 0.6) {
            condition = 'BEAR';
            confidence = bearScore;
        } else {
            condition = 'SIDEWAYS';
            confidence = 1 - Math.max(bullScore, bearScore);
        }
        
        return {
            symbol: sentiment.symbol,
            condition,
            confidence,
            indicators,
            timestamp: new Date()
        };
    }
    
    private generateTradingSignal(
        sentiment: SentimentSignal,
        technicals: TechnicalIndicators,
        marketCondition: MarketCondition
    ): TradingSignal {
        
        const symbol = sentiment.symbol;
        const currentPosition = this.positions.get(symbol);
        const reasoning: string[] = [];
        
        // Calculate sentiment score (0-100 scale)
        const sentimentScore = Math.round((sentiment.sentiment_score + 1) * 50);
        
        // Calculate technical score (0-100 scale)
        let technicalScore = 0;
        
        // RSI component (25 points)
        if (technicals.rsi.signal === 'OVERSOLD') technicalScore += 25;
        else if (technicals.rsi.signal === 'OVERBOUGHT') technicalScore -= 25;
        else technicalScore += (50 - technicals.rsi.value) / 2;
        
        // MACD component (25 points)
        if (technicals.macd.crossover === 'BULLISH') technicalScore += 25;
        else if (technicals.macd.crossover === 'BEARISH') technicalScore -= 25;
        else technicalScore += technicals.macd.histogram > 0 ? 15 : -15;
        
        // Moving average component (25 points)
        if (technicals.movingAverages.trend === 'BULLISH') technicalScore += 25;
        else if (technicals.movingAverages.trend === 'BEARISH') technicalScore -= 25;
        
        // Volume component (25 points)
        technicalScore += Math.min(25, (technicals.volume.ratio - 1) * 25);
        
        technicalScore = Math.max(0, Math.min(100, technicalScore + 50));
        
        // Determine action
        let action: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE' = 'HOLD';
        let strength = 0;
        let confidence = sentiment.confidence * 100;
        
        // BUY signal logic (exact thresholds from trading rules)
        if (sentiment.sentiment_score > this.SENTIMENT_BUY_THRESHOLD && 
            this.shouldBuy(sentiment, technicals, marketCondition)) {
            
            if (!currentPosition) {
                action = 'BUY';
                strength = Math.min(100, sentimentScore + (technicalScore - 50));
                reasoning.push('Sentiment above buy threshold (0.06)');
                reasoning.push('Technical indicators confirm bullish trend');
                reasoning.push(`Market condition: ${marketCondition.condition}`);
            } else {
                reasoning.push('Already have position');
            }
        }
        
        // SELL signal logic
        else if (sentiment.sentiment_score < this.SENTIMENT_SELL_THRESHOLD && currentPosition) {
            if (this.shouldSell(sentiment, technicals, marketCondition)) {
                action = 'CLOSE';
                strength = Math.min(100, (50 - sentimentScore) + (50 - technicalScore));
                reasoning.push('Sentiment below sell threshold (0.04)');
                reasoning.push('Technical indicators suggest weakness');
            }
        }
        
        // Profit taking logic
        else if (currentPosition && this.shouldTakeProfit(currentPosition, marketCondition)) {
            action = 'CLOSE';
            strength = 80;
            reasoning.push('Profit target reached');
            reasoning.push(`Current PnL: ${(currentPosition.unrealizedPnLPercent * 100).toFixed(1)}%`);
        }
        
        // Stop loss logic
        else if (currentPosition && this.shouldStopLoss(currentPosition)) {
            action = 'CLOSE';
            strength = 100;
            reasoning.push('Stop loss triggered');
        }
        
        // Calculate position size
        const positionSize = this.calculatePositionSize(symbol, marketCondition);
        
        // Calculate profit target and stop loss
        const profitTarget = this.calculateProfitTarget(technicals.price, marketCondition);
        const stopLoss = technicals.price - (technicals.atr * this.ATR_STOP_MULTIPLIER);
        
        return {
            symbol,
            action,
            strength,
            confidence,
            reasoning,
            positionSize,
            profitTarget,
            stopLoss,
            sentimentScore,
            technicalScore,
            timestamp: new Date()
        };
    }
    
    private shouldBuy(
        sentiment: SentimentSignal,
        technicals: TechnicalIndicators,
        marketCondition: MarketCondition
    ): boolean {
        
        const conditions = [
            sentiment.sentiment_score > this.SENTIMENT_BUY_THRESHOLD, // Sentiment threshold
            technicals.rsi.value < this.RSI_OVERBOUGHT, // Not overbought
            technicals.macd.trend === 'BULLISH' || technicals.macd.crossover === 'BULLISH', // MACD bullish
            technicals.movingAverages.trend === 'BULLISH', // MA trend bullish
            sentiment.confidence > 0.5, // Minimum confidence
            this.hasAvailableCapital() // Available capital
        ];
        
        // Require at least 4 out of 6 conditions
        // Relax to 3 out of 6 in bull markets
        const requiredConditions = marketCondition.condition === 'BULL' ? 3 : 4;
        const metConditions = conditions.filter(Boolean).length;
        
        return metConditions >= requiredConditions;
    }
    
    private shouldSell(
        sentiment: SentimentSignal,
        technicals: TechnicalIndicators,
        marketCondition: MarketCondition
    ): boolean {
        
        const conditions = [
            sentiment.sentiment_score < this.SENTIMENT_SELL_THRESHOLD, // Sentiment threshold
            technicals.rsi.value > this.RSI_OVERBOUGHT, // Overbought
            technicals.macd.trend === 'BEARISH' || technicals.macd.crossover === 'BEARISH', // MACD bearish
            technicals.movingAverages.trend === 'BEARISH', // MA trend bearish
            sentiment.confidence > 0.5 // Minimum confidence
        ];
        
        // More aggressive selling in bear markets
        const requiredConditions = marketCondition.condition === 'BEAR' ? 2 : 3;
        const metConditions = conditions.filter(Boolean).length;
        
        return metConditions >= requiredConditions;
    }
    
    private shouldTakeProfit(position: VolatileAssetPosition, marketCondition: MarketCondition): boolean {
        const profitThreshold = this.getProfitThreshold(marketCondition.condition);
        return position.unrealizedPnLPercent >= profitThreshold;
    }
    
    private shouldStopLoss(position: VolatileAssetPosition): boolean {
        return position.currentPrice <= position.stopLoss;
    }
    
    private getProfitThreshold(condition: 'BULL' | 'BEAR' | 'SIDEWAYS'): number {
        switch (condition) {
            case 'BULL':
                return this.BULL_PROFIT_THRESHOLD; // 8%
            case 'BEAR':
                return this.BEAR_PROFIT_THRESHOLD; // 1.5%
            default:
                return this.BASE_PROFIT_THRESHOLD; // 3%
        }
    }
    
    private calculatePositionSize(symbol: string, marketCondition: MarketCondition): number {
        // Base position size
        let baseSize = (symbol === 'BTC' || symbol === 'ETH') 
            ? this.BTC_ETH_POSITION_SIZE 
            : this.ALT_POSITION_SIZE;
        
        // Market condition adjustments (from trading rules)
        switch (marketCondition.condition) {
            case 'BULL':
                baseSize *= 1.25; // 25% increase
                break;
            case 'BEAR':
                baseSize *= 0.5; // 50% reduction
                break;
            case 'SIDEWAYS':
                baseSize *= 0.7; // 30% reduction
                break;
        }
        
        // Ensure we don't exceed maximum position size
        return Math.min(baseSize, this.MAX_POSITION_SIZE);
    }
    
    private calculateProfitTarget(currentPrice: number, marketCondition: MarketCondition): number {
        const profitThreshold = this.getProfitThreshold(marketCondition.condition);
        return currentPrice * (1 + profitThreshold);
    }
    
    private hasAvailableCapital(): boolean {
        const totalExposure = Array.from(this.positions.values())
            .reduce((sum, pos) => sum + (pos.size * pos.currentPrice), 0);
        
        // Assume portfolio value for calculation (would come from API in production)
        const portfolioValue = 100000; // $100k example
        const currentExposure = totalExposure / portfolioValue;
        
        return currentExposure < this.MAX_PORTFOLIO_EXPOSURE;
    }
    
    private async executeTradingSignal(signal: TradingSignal): Promise<void> {
        try {
            console.log(`🎯 EXECUTING TRADE: ${signal.action} ${signal.symbol}`);
            console.log(`   Strength: ${signal.strength}/100 | Confidence: ${signal.confidence.toFixed(1)}%`);
            console.log(`   Position Size: ${(signal.positionSize * 100).toFixed(1)}%`);
            console.log(`   Profit Target: $${signal.profitTarget.toFixed(2)}`);
            console.log(`   Stop Loss: $${signal.stopLoss.toFixed(2)}`);
            console.log(`   Reasoning: ${signal.reasoning.join(', ')}`);
            
            // Get current price (mock for now - would use real API)
            const currentPrice = await this.getCurrentPrice(signal.symbol);
            
            if (signal.action === 'BUY') {
                await this.executeBuyOrder(signal, currentPrice);
            } else if (signal.action === 'CLOSE') {
                await this.executeClosePosition(signal.symbol, currentPrice);
            }
            
            // Emit trade execution event
            this.emit('tradeExecuted', {
                signal,
                price: currentPrice,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error(`Error executing trade for ${signal.symbol}:`, error);
            this.emit('tradeError', { signal, error });
        }
    }
    
    private async executeBuyOrder(signal: TradingSignal, currentPrice: number): Promise<void> {
        // Calculate order size
        const portfolioValue = 100000; // Would come from API
        const orderValue = portfolioValue * signal.positionSize;
        const orderSize = orderValue / currentPrice;
        
        // Create position
        const position: VolatileAssetPosition = {
            id: `${signal.symbol}_${Date.now()}`,
            symbol: signal.symbol,
            size: orderSize,
            entryPrice: currentPrice,
            currentPrice: currentPrice,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
            realizedPnL: 0,
            stopLoss: signal.stopLoss,
            trailingStop: signal.stopLoss,
            profitTarget: signal.profitTarget,
            entryTime: new Date(),
            lastUpdate: new Date(),
            marketCondition: this.marketConditions.get(signal.symbol)?.condition || 'SIDEWAYS',
            sentimentScore: signal.sentimentScore,
            confidence: signal.confidence,
            status: 'ACTIVE'
        };
        
        this.positions.set(signal.symbol, position);
        
        // Log trade execution
        const execution: TradeExecution = {
            id: `exec_${Date.now()}`,
            symbol: signal.symbol,
            action: 'BUY',
            size: orderSize,
            price: currentPrice,
            totalValue: orderValue,
            sentimentScore: signal.sentimentScore,
            confidence: signal.confidence,
            marketCondition: position.marketCondition,
            profitTarget: signal.profitTarget,
            stopLoss: signal.stopLoss,
            timestamp: new Date()
        };
        
        await this.logTradeExecution(execution);
        
        console.log(`✅ BUY order executed: ${orderSize.toFixed(6)} ${signal.symbol} @ $${currentPrice.toFixed(2)}`);
    }
    
    private async executeClosePosition(symbol: string, currentPrice: number): Promise<void> {
        const position = this.positions.get(symbol);
        if (!position) return;
        
        // Calculate PnL
        const pnl = (currentPrice - position.entryPrice) * position.size;
        const pnlPercent = (currentPrice - position.entryPrice) / position.entryPrice;
        
        // Update position
        position.currentPrice = currentPrice;
        position.realizedPnL = pnl;
        position.status = 'CLOSED';
        
        // Log trade execution
        const execution: TradeExecution = {
            id: `exec_${Date.now()}`,
            symbol: symbol,
            action: 'SELL',
            size: position.size,
            price: currentPrice,
            totalValue: position.size * currentPrice,
            sentimentScore: position.sentimentScore,
            confidence: position.confidence,
            marketCondition: position.marketCondition,
            profitTarget: position.profitTarget,
            stopLoss: position.stopLoss,
            timestamp: new Date()
        };
        
        await this.logTradeExecution(execution);
        
        // Remove from active positions
        this.positions.delete(symbol);
        
        console.log(`✅ CLOSE order executed: ${position.size.toFixed(6)} ${symbol} @ $${currentPrice.toFixed(2)}`);
        console.log(`💰 PnL: $${pnl.toFixed(2)} (${(pnlPercent * 100).toFixed(2)}%)`);
        
        // Handle profit reinvestment (70% as specified)
        if (pnl > 0) {
            const reinvestAmount = pnl * 0.70;
            console.log(`🔄 Reinvesting 70% of profit: $${reinvestAmount.toFixed(2)}`);
        }
    }
    
    private async getCurrentPrice(symbol: string): Promise<number> {
        // Mock price data - in production would use real API
        const mockPrices: { [key: string]: number } = {
            'BTC': 45000 + (Math.random() - 0.5) * 2000,
            'ETH': 3000 + (Math.random() - 0.5) * 200,
            'ADA': 0.5 + (Math.random() - 0.5) * 0.1,
            'SOL': 100 + (Math.random() - 0.5) * 10,
            'MATIC': 1.2 + (Math.random() - 0.5) * 0.2,
            'LINK': 15 + (Math.random() - 0.5) * 2,
            'DOT': 8 + (Math.random() - 0.5) * 1,
            'AVAX': 25 + (Math.random() - 0.5) * 3
        };
        
        return mockPrices[symbol] || 100;
    }
    
    private async updatePrices(): Promise<void> {
        for (const [symbol, position] of this.positions) {
            const currentPrice = await this.getCurrentPrice(symbol);
            
            // Update position
            position.currentPrice = currentPrice;
            position.unrealizedPnL = (currentPrice - position.entryPrice) * position.size;
            position.unrealizedPnLPercent = (currentPrice - position.entryPrice) / position.entryPrice;
            position.lastUpdate = new Date();
            
            // Update trailing stop
            if (position.unrealizedPnLPercent > 0.01) { // Start trailing after 1% profit
                const newTrailingStop = currentPrice * 0.98; // 2% trailing stop
                if (newTrailingStop > position.trailingStop) {
                    position.trailingStop = newTrailingStop;
                }
            }
        }
    }
    
    private async runTechnicalAnalysis(): Promise<void> {
        for (const symbol of this.SUPPORTED_ASSETS) {
            try {
                const indicators = await this.calculateTechnicalIndicators(symbol);
                this.technicalIndicators.set(symbol, indicators);
                
                console.log(`📊 ${symbol} Technical Update: RSI ${indicators.rsi.value.toFixed(1)} | MACD ${indicators.macd.trend} | MA ${indicators.movingAverages.trend}`);
                
            } catch (error) {
                console.error(`Error calculating technical indicators for ${symbol}:`, error);
            }
        }
    }
    
    private async calculateTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
        // Mock technical indicators - in production would calculate from real price data
        const currentPrice = await this.getCurrentPrice(symbol);
        
        // Mock RSI (14-period)
        const rsiValue = 30 + Math.random() * 40; // Random between 30-70
        let rsiSignal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL' = 'NEUTRAL';
        if (rsiValue > this.RSI_OVERBOUGHT) rsiSignal = 'OVERBOUGHT';
        else if (rsiValue < this.RSI_OVERSOLD) rsiSignal = 'OVERSOLD';
        
        // Mock MACD
        const macdValue = (Math.random() - 0.5) * 100;
        const signalValue = (Math.random() - 0.5) * 80;
        const histogram = macdValue - signalValue;
        
        // Mock moving averages
        const sma20 = currentPrice * (0.98 + Math.random() * 0.04);
        const sma50 = currentPrice * (0.95 + Math.random() * 0.1);
        const ema12 = currentPrice * (0.99 + Math.random() * 0.02);
        const ema26 = currentPrice * (0.97 + Math.random() * 0.06);
        
        const maTrend = currentPrice > sma20 && sma20 > sma50 ? 'BULLISH' : 
                       currentPrice < sma20 && sma20 < sma50 ? 'BEARISH' : 'NEUTRAL';
        
        return {
            symbol,
            timestamp: new Date(),
            price: currentPrice,
            rsi: {
                value: rsiValue,
                signal: rsiSignal,
                divergence: 'NONE'
            },
            macd: {
                macd: macdValue,
                signal: signalValue,
                histogram: histogram,
                crossover: histogram > 0 ? 'BULLISH' : 'BEARISH',
                trend: histogram > 0 ? 'BULLISH' : 'BEARISH'
            },
            movingAverages: {
                sma20,
                sma50,
                ema12,
                ema26,
                trend: maTrend
            },
            atr: currentPrice * 0.02, // 2% ATR
            volume: {
                current: 1000000 + Math.random() * 500000,
                average: 1000000,
                ratio: 0.8 + Math.random() * 0.4
            }
        };
    }
    
    private updateSentimentData(data: any): void {
        // Update internal sentiment tracking
        console.log(`📈 Sentiment update for ${data.symbol}: ${data.result.trading_signal}`);
    }
    
    private async loadPositions(): Promise<void> {
        try {
            const { data, error } = await this.supabase
                .from('volatile_asset_positions')
                .select('*')
                .eq('status', 'ACTIVE');
                
            if (error) throw error;
            
            for (const pos of data || []) {
                this.positions.set(pos.symbol, {
                    id: pos.id,
                    symbol: pos.symbol,
                    size: pos.size,
                    entryPrice: pos.entry_price,
                    currentPrice: pos.current_price,
                    unrealizedPnL: pos.unrealized_pnl,
                    unrealizedPnLPercent: pos.unrealized_pnl_percent,
                    realizedPnL: pos.realized_pnl,
                    stopLoss: pos.stop_loss,
                    trailingStop: pos.trailing_stop,
                    profitTarget: pos.profit_target,
                    entryTime: new Date(pos.entry_time),
                    lastUpdate: new Date(pos.last_update),
                    marketCondition: pos.market_condition,
                    sentimentScore: pos.sentiment_score,
                    confidence: pos.confidence,
                    status: pos.status
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
                    .from('volatile_asset_positions')
                    .upsert({
                        id: position.id,
                        symbol: position.symbol,
                        size: position.size,
                        entry_price: position.entryPrice,
                        current_price: position.currentPrice,
                        unrealized_pnl: position.unrealizedPnL,
                        unrealized_pnl_percent: position.unrealizedPnLPercent,
                        realized_pnl: position.realizedPnL,
                        stop_loss: position.stopLoss,
                        trailing_stop: position.trailingStop,
                        profit_target: position.profitTarget,
                        entry_time: position.entryTime.toISOString(),
                        last_update: position.lastUpdate.toISOString(),
                        market_condition: position.marketCondition,
                        sentiment_score: position.sentimentScore,
                        confidence: position.confidence,
                        status: position.status
                    });
            }
        } catch (error) {
            console.error('Error saving positions:', error);
        }
    }
    
    private async logTradingSignal(signal: TradingSignal): Promise<void> {
        try {
            await this.supabase
                .from('trading_signals')
                .insert({
                    symbol: signal.symbol,
                    action: signal.action,
                    strength: signal.strength,
                    confidence: signal.confidence,
                    reasoning: signal.reasoning.join('; '),
                    position_size: signal.positionSize,
                    profit_target: signal.profitTarget,
                    stop_loss: signal.stopLoss,
                    sentiment_score: signal.sentimentScore,
                    technical_score: signal.technicalScore,
                    timestamp: signal.timestamp.toISOString()
                });
        } catch (error) {
            console.error('Error logging trading signal:', error);
        }
    }
    
    private async logTradeExecution(execution: TradeExecution): Promise<void> {
        try {
            await this.supabase
                .from('trade_executions')
                .insert({
                    id: execution.id,
                    symbol: execution.symbol,
                    action: execution.action,
                    size: execution.size,
                    price: execution.price,
                    total_value: execution.totalValue,
                    sentiment_score: execution.sentimentScore,
                    confidence: execution.confidence,
                    market_condition: execution.marketCondition,
                    profit_target: execution.profitTarget,
                    stop_loss: execution.stopLoss,
                    timestamp: execution.timestamp.toISOString(),
                    order_id: execution.orderId
                });
        } catch (error) {
            console.error('Error logging trade execution:', error);
        }
    }
    
    // Public API methods
    
    getActivePositions(): Map<string, VolatileAssetPosition> {
        return new Map(this.positions);
    }
    
    getTechnicalIndicators(): Map<string, TechnicalIndicators> {
        return new Map(this.technicalIndicators);
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
        
        const profitablePositions = Array.from(this.positions.values())
            .filter(pos => pos.unrealizedPnL > 0).length;
        
        return {
            totalPositions,
            profitablePositions,
            winRate: totalPositions > 0 ? profitablePositions / totalPositions : 0,
            totalUnrealizedPnL,
            totalRealizedPnL,
            totalPnL: totalUnrealizedPnL + totalRealizedPnL,
            isRunning: this.isRunning,
            supportedAssets: this.SUPPORTED_ASSETS,
            profitThresholds: {
                base: this.BASE_PROFIT_THRESHOLD,
                bull: this.BULL_PROFIT_THRESHOLD,
                bear: this.BEAR_PROFIT_THRESHOLD
            }
        };
    }
    
    getSupportedAssets(): string[] {
        return [...this.SUPPORTED_ASSETS];
    }
    
    getConfiguration(): any {
        return {
            profitThresholds: {
                base: this.BASE_PROFIT_THRESHOLD,
                bull: this.BULL_PROFIT_THRESHOLD,
                bear: this.BEAR_PROFIT_THRESHOLD
            },
            positionSizing: {
                btcEth: this.BTC_ETH_POSITION_SIZE,
                alts: this.ALT_POSITION_SIZE,
                maximum: this.MAX_POSITION_SIZE
            },
            sentimentThresholds: {
                buy: this.SENTIMENT_BUY_THRESHOLD,
                sell: this.SENTIMENT_SELL_THRESHOLD,
                neutral: this.SENTIMENT_NEUTRAL_ZONE
            },
            riskManagement: {
                maxExposure: this.MAX_PORTFOLIO_EXPOSURE,
                cashReserve: this.CASH_RESERVE,
                atrMultiplier: this.ATR_STOP_MULTIPLIER
            }
        };
    }
} 
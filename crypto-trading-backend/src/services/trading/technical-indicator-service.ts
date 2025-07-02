import { EventEmitter } from 'events';
import { EnhancedKrakenClient } from '../order-execution/enhanced-kraken-client';

export interface RSIData {
    value: number;
    signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
    divergence?: 'BULLISH' | 'BEARISH' | 'NONE';
}

export interface MACDData {
    macd: number;
    signal: number;
    histogram: number;
    signal_type: 'BULLISH_CROSSOVER' | 'BEARISH_CROSSOVER' | 'NEUTRAL';
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface BollingerBandsData {
    upper: number;
    middle: number;
    lower: number;
    position: 'ABOVE' | 'UPPER' | 'MIDDLE' | 'LOWER' | 'BELOW';
    squeeze: boolean;
    expansion: boolean;
}

export interface ATRData {
    value: number;
    volatility: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface VolumeData {
    current: number;
    average: number;
    ratio: number;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

export interface TechnicalIndicators {
    symbol: string;
    price: number;
    timestamp: Date;
    rsi: RSIData;
    macd: MACDData;
    bollinger: BollingerBandsData;
    atr: ATRData;
    volume: VolumeData;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number;
}

export class TechnicalIndicatorService extends EventEmitter {
    private krakenClient: EnhancedKrakenClient;
    private priceHistory: Map<string, number[]> = new Map();
    private volumeHistory: Map<string, number[]> = new Map();
    private indicators: Map<string, TechnicalIndicators> = new Map();
    
    // Configuration from comprehensive trading rules
    private readonly RSI_PERIOD = 14;
    private readonly MACD_FAST = 12;
    private readonly MACD_SLOW = 26;
    private readonly MACD_SIGNAL = 9;
    private readonly BB_PERIOD = 20;
    private readonly BB_DEVIATION = 2;
    private readonly ATR_PERIOD = 14;
    private readonly VOLUME_PERIOD = 20;
    
    // Thresholds from trading rules
    private readonly RSI_OVERBOUGHT = 70;
    private readonly RSI_OVERSOLD = 30;
    
    constructor(krakenClient: EnhancedKrakenClient) {
        super();
        this.krakenClient = krakenClient;
        
        // Listen for price updates
        this.krakenClient.on('priceUpdate', (data) => {
            this.updateIndicators(data);
        });
        
        console.log('📊 Technical Indicator Service initialized');
    }
    
    async getIndicators(symbol: string): Promise<TechnicalIndicators | null> {
        try {
            // Get latest price data
            const priceData = await this.krakenClient.getOHLCData(symbol, '1', 100);
            
            if (!priceData || priceData.length < 50) {
                console.warn(`Insufficient price data for ${symbol}`);
                return null;
            }
            
            // Update price history
            const prices = priceData.map(candle => parseFloat(candle[4])); // Close prices
            const volumes = priceData.map(candle => parseFloat(candle[6])); // Volumes
            const highs = priceData.map(candle => parseFloat(candle[2]));
            const lows = priceData.map(candle => parseFloat(candle[3]));
            
            this.priceHistory.set(symbol, prices);
            this.volumeHistory.set(symbol, volumes);
            
            // Calculate all indicators
            const currentPrice = prices[prices.length - 1];
            const rsi = this.calculateRSI(prices);
            const macd = this.calculateMACD(prices);
            const bollinger = this.calculateBollingerBands(prices);
            const atr = this.calculateATR(highs, lows, prices);
            const volume = this.calculateVolumeIndicators(volumes);
            
            // Determine overall trend and strength
            const { trend, strength } = this.calculateTrendStrength(rsi, macd, bollinger);
            
            const indicators: TechnicalIndicators = {
                symbol,
                price: currentPrice,
                timestamp: new Date(),
                rsi,
                macd,
                bollinger,
                atr,
                volume,
                trend,
                strength
            };
            
            this.indicators.set(symbol, indicators);
            this.emit('indicatorsUpdated', indicators);
            
            return indicators;
            
        } catch (error) {
            console.error(`Error calculating indicators for ${symbol}:`, error);
            return null;
        }
    }
    
    private calculateRSI(prices: number[]): RSIData {
        if (prices.length < this.RSI_PERIOD + 1) {
            return { value: 50, signal: 'NEUTRAL' };
        }
        
        const gains: number[] = [];
        const losses: number[] = [];
        
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        
        // Calculate initial averages
        let avgGain = gains.slice(0, this.RSI_PERIOD).reduce((a, b) => a + b) / this.RSI_PERIOD;
        let avgLoss = losses.slice(0, this.RSI_PERIOD).reduce((a, b) => a + b) / this.RSI_PERIOD;
        
        // Calculate smoothed averages
        for (let i = this.RSI_PERIOD; i < gains.length; i++) {
            avgGain = ((avgGain * (this.RSI_PERIOD - 1)) + gains[i]) / this.RSI_PERIOD;
            avgLoss = ((avgLoss * (this.RSI_PERIOD - 1)) + losses[i]) / this.RSI_PERIOD;
        }
        
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        
        let signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
        if (rsi > this.RSI_OVERBOUGHT) {
            signal = 'OVERBOUGHT';
        } else if (rsi < this.RSI_OVERSOLD) {
            signal = 'OVERSOLD';
        } else {
            signal = 'NEUTRAL';
        }
        
        // Check for divergences (simplified)
        const divergence = this.checkRSIDivergence(prices, gains, losses);
        
        return { value: rsi, signal, divergence };
    }
    
    private calculateMACD(prices: number[]): MACDData {
        if (prices.length < this.MACD_SLOW) {
            return {
                macd: 0,
                signal: 0,
                histogram: 0,
                signal_type: 'NEUTRAL',
                trend: 'NEUTRAL'
            };
        }
        
        // Calculate EMAs
        const emaFast = this.calculateEMA(prices, this.MACD_FAST);
        const emaSlow = this.calculateEMA(prices, this.MACD_SLOW);
        
        // Calculate MACD line
        const macdLine: number[] = [];
        for (let i = 0; i < Math.min(emaFast.length, emaSlow.length); i++) {
            macdLine.push(emaFast[i] - emaSlow[i]);
        }
        
        // Calculate signal line
        const signalLine = this.calculateEMA(macdLine, this.MACD_SIGNAL);
        
        // Get current values
        const macd = macdLine[macdLine.length - 1];
        const signal = signalLine[signalLine.length - 1];
        const histogram = macd - signal;
        
        // Determine signal type
        let signal_type: 'BULLISH_CROSSOVER' | 'BEARISH_CROSSOVER' | 'NEUTRAL' = 'NEUTRAL';
        if (macdLine.length > 1 && signalLine.length > 1) {
            const prevMACD = macdLine[macdLine.length - 2];
            const prevSignal = signalLine[signalLine.length - 2];
            
            if (prevMACD <= prevSignal && macd > signal) {
                signal_type = 'BULLISH_CROSSOVER';
            } else if (prevMACD >= prevSignal && macd < signal) {
                signal_type = 'BEARISH_CROSSOVER';
            }
        }
        
        // Determine trend
        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        if (macd > 0 && histogram > 0) {
            trend = 'BULLISH';
        } else if (macd < 0 && histogram < 0) {
            trend = 'BEARISH';
        } else {
            trend = 'NEUTRAL';
        }
        
        return { macd, signal, histogram, signal_type, trend };
    }
    
    private calculateBollingerBands(prices: number[]): BollingerBandsData {
        if (prices.length < this.BB_PERIOD) {
            const price = prices[prices.length - 1];
            return {
                upper: price * 1.02,
                middle: price,
                lower: price * 0.98,
                position: 'MIDDLE',
                squeeze: false,
                expansion: false
            };
        }
        
        // Calculate moving average (middle band)
        const recentPrices = prices.slice(-this.BB_PERIOD);
        const middle = recentPrices.reduce((a, b) => a + b) / this.BB_PERIOD;
        
        // Calculate standard deviation
        const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / this.BB_PERIOD;
        const stdDev = Math.sqrt(variance);
        
        // Calculate bands
        const upper = middle + (stdDev * this.BB_DEVIATION);
        const lower = middle - (stdDev * this.BB_DEVIATION);
        
        // Determine position
        const currentPrice = prices[prices.length - 1];
        let position: 'ABOVE' | 'UPPER' | 'MIDDLE' | 'LOWER' | 'BELOW';
        
        if (currentPrice > upper) {
            position = 'ABOVE';
        } else if (currentPrice > middle + (stdDev * 0.5)) {
            position = 'UPPER';
        } else if (currentPrice > middle - (stdDev * 0.5)) {
            position = 'MIDDLE';
        } else if (currentPrice > lower) {
            position = 'LOWER';
        } else {
            position = 'BELOW';
        }
        
        // Check for squeeze and expansion
        const bandWidth = (upper - lower) / middle;
        const avgBandWidth = this.calculateAverageBandWidth(prices);
        
        const squeeze = bandWidth < avgBandWidth * 0.8;
        const expansion = bandWidth > avgBandWidth * 1.2;
        
        return { upper, middle, lower, position, squeeze, expansion };
    }
    
    private calculateATR(highs: number[], lows: number[], closes: number[]): ATRData {
        if (highs.length < this.ATR_PERIOD + 1) {
            const avgPrice = closes[closes.length - 1];
            return {
                value: avgPrice * 0.02, // 2% default
                volatility: 'MEDIUM'
            };
        }
        
        const trueRanges: number[] = [];
        
        for (let i = 1; i < highs.length; i++) {
            const tr1 = highs[i] - lows[i];
            const tr2 = Math.abs(highs[i] - closes[i - 1]);
            const tr3 = Math.abs(lows[i] - closes[i - 1]);
            
            trueRanges.push(Math.max(tr1, tr2, tr3));
        }
        
        // Calculate ATR using simple moving average
        const recentTR = trueRanges.slice(-this.ATR_PERIOD);
        const atr = recentTR.reduce((a, b) => a + b) / this.ATR_PERIOD;
        
        // Determine volatility level
        const currentPrice = closes[closes.length - 1];
        const atrPercent = (atr / currentPrice) * 100;
        
        let volatility: 'HIGH' | 'MEDIUM' | 'LOW';
        if (atrPercent > 3) {
            volatility = 'HIGH';
        } else if (atrPercent > 1.5) {
            volatility = 'MEDIUM';
        } else {
            volatility = 'LOW';
        }
        
        return { value: atr, volatility };
    }
    
    private calculateVolumeIndicators(volumes: number[]): VolumeData {
        if (volumes.length < this.VOLUME_PERIOD) {
            return {
                current: volumes[volumes.length - 1] || 0,
                average: volumes[volumes.length - 1] || 0,
                ratio: 1,
                trend: 'STABLE'
            };
        }
        
        const current = volumes[volumes.length - 1];
        const recentVolumes = volumes.slice(-this.VOLUME_PERIOD);
        const average = recentVolumes.reduce((a, b) => a + b) / this.VOLUME_PERIOD;
        const ratio = current / average;
        
        // Determine trend
        const firstHalf = recentVolumes.slice(0, this.VOLUME_PERIOD / 2);
        const secondHalf = recentVolumes.slice(this.VOLUME_PERIOD / 2);
        
        const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
        
        let trend: 'INCREASING' | 'DECREASING' | 'STABLE';
        if (secondAvg > firstAvg * 1.1) {
            trend = 'INCREASING';
        } else if (secondAvg < firstAvg * 0.9) {
            trend = 'DECREASING';
        } else {
            trend = 'STABLE';
        }
        
        return { current, average, ratio, trend };
    }
    
    private calculateTrendStrength(
        rsi: RSIData, 
        macd: MACDData, 
        bollinger: BollingerBandsData
    ): { trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; strength: number } {
        
        let bullishSignals = 0;
        let bearishSignals = 0;
        let totalSignals = 0;
        
        // RSI signals
        if (rsi.signal === 'OVERSOLD') bullishSignals++;
        if (rsi.signal === 'OVERBOUGHT') bearishSignals++;
        totalSignals++;
        
        // MACD signals
        if (macd.signal_type === 'BULLISH_CROSSOVER' || macd.trend === 'BULLISH') bullishSignals++;
        if (macd.signal_type === 'BEARISH_CROSSOVER' || macd.trend === 'BEARISH') bearishSignals++;
        totalSignals++;
        
        // Bollinger Bands signals
        if (bollinger.position === 'LOWER' || bollinger.position === 'BELOW') bullishSignals++;
        if (bollinger.position === 'UPPER' || bollinger.position === 'ABOVE') bearishSignals++;
        totalSignals++;
        
        const bullishStrength = bullishSignals / totalSignals;
        const bearishStrength = bearishSignals / totalSignals;
        
        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        let strength: number;
        
        if (bullishStrength > 0.6) {
            trend = 'BULLISH';
            strength = bullishStrength;
        } else if (bearishStrength > 0.6) {
            trend = 'BEARISH';
            strength = bearishStrength;
        } else {
            trend = 'NEUTRAL';
            strength = Math.max(bullishStrength, bearishStrength);
        }
        
        return { trend, strength };
    }
    
    private calculateEMA(prices: number[], period: number): number[] {
        const ema: number[] = [];
        const multiplier = 2 / (period + 1);
        
        // Start with SMA for first value
        let sum = 0;
        for (let i = 0; i < period && i < prices.length; i++) {
            sum += prices[i];
        }
        ema.push(sum / Math.min(period, prices.length));
        
        // Calculate EMA for remaining values
        for (let i = period; i < prices.length; i++) {
            const emaValue = (prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
            ema.push(emaValue);
        }
        
        return ema;
    }
    
    private checkRSIDivergence(prices: number[], gains: number[], losses: number[]): 'BULLISH' | 'BEARISH' | 'NONE' {
        // Simplified divergence detection
        if (prices.length < 20) return 'NONE';
        
        const recentPrices = prices.slice(-10);
        const recentGains = gains.slice(-10);
        
        const priceDirection = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'UP' : 'DOWN';
        const rsiDirection = recentGains.reduce((a, b) => a + b) > 0 ? 'UP' : 'DOWN';
        
        if (priceDirection === 'DOWN' && rsiDirection === 'UP') {
            return 'BULLISH';
        } else if (priceDirection === 'UP' && rsiDirection === 'DOWN') {
            return 'BEARISH';
        }
        
        return 'NONE';
    }
    
    private calculateAverageBandWidth(prices: number[]): number {
        // Calculate average Bollinger Band width over recent periods
        if (prices.length < this.BB_PERIOD * 2) return 0.04; // 4% default
        
        let totalWidth = 0;
        let count = 0;
        
        for (let i = this.BB_PERIOD; i < prices.length; i++) {
            const periodPrices = prices.slice(i - this.BB_PERIOD, i);
            const avg = periodPrices.reduce((a, b) => a + b) / this.BB_PERIOD;
            const variance = periodPrices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / this.BB_PERIOD;
            const stdDev = Math.sqrt(variance);
            const width = (stdDev * this.BB_DEVIATION * 2) / avg;
            
            totalWidth += width;
            count++;
        }
        
        return count > 0 ? totalWidth / count : 0.04;
    }
    
    private updateIndicators(priceData: any): void {
        // Update indicators when new price data arrives
        if (priceData.symbol) {
            this.getIndicators(priceData.symbol).catch(error => {
                console.error(`Error updating indicators for ${priceData.symbol}:`, error);
            });
        }
    }
    
    // Public API methods
    
    getLatestIndicators(symbol: string): TechnicalIndicators | null {
        return this.indicators.get(symbol) || null;
    }
    
    getAllIndicators(): Map<string, TechnicalIndicators> {
        return new Map(this.indicators);
    }
    
    async refreshIndicators(symbol: string): Promise<TechnicalIndicators | null> {
        return await this.getIndicators(symbol);
    }
} 
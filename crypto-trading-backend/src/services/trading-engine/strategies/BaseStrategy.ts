import { ITradingStrategy } from '../interfaces/ITradingStrategy';
import { MarketCondition, MarketConditionMetrics } from '../types/MarketCondition';
import { Position } from '../types/Position';
import { TradingSignal } from '../types/TradingSignal';

export abstract class BaseStrategy implements ITradingStrategy {
    protected marketCondition: MarketCondition = MarketCondition.SIDEWAYS;
    protected marketMetrics: MarketConditionMetrics;
    protected maxPositionSize: number = 0.05; // 5% of portfolio
    protected maxDrawdown: number = 0.10; // 10% max drawdown
    protected reinvestmentPercentage: number = 0.70; // 70% reinvestment

    constructor(
        public readonly strategyType: string,
        public readonly supportedAssets: string[]
    ) {}

    abstract getMarketCondition(): Promise<MarketCondition>;
    abstract generateSignals(): Promise<TradingSignal[]>;
    abstract validateSignal(signal: TradingSignal): Promise<boolean>;
    abstract calculatePositionSize(signal: TradingSignal): Promise<number>;
    abstract calculateStopLoss(signal: TradingSignal): Promise<number>;
    abstract calculateTakeProfit(signal: TradingSignal): Promise<number>;

    async adaptToMarketCondition(condition: MarketCondition): Promise<void> {
        this.marketCondition = condition;
        switch (condition) {
            case MarketCondition.BULL:
                this.maxPositionSize = 0.05;
                this.reinvestmentPercentage = 0.80;
                break;
            case MarketCondition.BEAR:
                this.maxPositionSize = 0.025;
                this.reinvestmentPercentage = 0.50;
                break;
            case MarketCondition.SIDEWAYS:
                this.maxPositionSize = 0.05;
                this.reinvestmentPercentage = 0.70;
                break;
        }
    }

    async getMaxPositionSize(): Promise<number> {
        return this.maxPositionSize;
    }

    async getMaxDrawdown(): Promise<number> {
        return this.maxDrawdown;
    }

    async getReinvestmentPercentage(): Promise<number> {
        return this.reinvestmentPercentage;
    }

    async initialize(): Promise<void> {
        // Initialize strategy state
        this.marketMetrics = {
            volatility: 0,
            trendStrength: 0,
            volumeProfile: 0,
            sentimentScore: 0,
            technicalScore: 0
        };
    }

    async updateState(): Promise<void> {
        // Update strategy state
        this.marketCondition = await this.getMarketCondition();
    }

    async cleanup(): Promise<void> {
        // Cleanup strategy resources
    }
} 
import { MarketCondition } from '../types/MarketCondition';
import { Position } from '../types/Position';
import { TradingSignal } from '../types/TradingSignal';

export interface ITradingStrategy {
    // Strategy identification
    readonly strategyType: string;
    readonly supportedAssets: string[];
    
    // Market condition handling
    getMarketCondition(): Promise<MarketCondition>;
    adaptToMarketCondition(condition: MarketCondition): Promise<void>;
    
    // Signal generation
    generateSignals(): Promise<TradingSignal[]>;
    validateSignal(signal: TradingSignal): Promise<boolean>;
    
    // Position management
    calculatePositionSize(signal: TradingSignal): Promise<number>;
    calculateStopLoss(signal: TradingSignal): Promise<number>;
    calculateTakeProfit(signal: TradingSignal): Promise<number>;
    
    // Risk management
    getMaxPositionSize(): Promise<number>;
    getMaxDrawdown(): Promise<number>;
    getReinvestmentPercentage(): Promise<number>;
    
    // State management
    initialize(): Promise<void>;
    updateState(): Promise<void>;
    cleanup(): Promise<void>;
} 
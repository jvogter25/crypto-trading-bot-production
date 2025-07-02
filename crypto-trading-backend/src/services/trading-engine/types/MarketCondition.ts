export enum MarketCondition {
    BULL = 'BULL',
    BEAR = 'BEAR',
    SIDEWAYS = 'SIDEWAYS'
}

export interface MarketConditionMetrics {
    volatility: number;
    trendStrength: number;
    volumeProfile: number;
    sentimentScore: number;
    technicalScore: number;
} 
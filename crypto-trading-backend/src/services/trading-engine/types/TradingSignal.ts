import { PositionSide } from './Position';

export interface TradingSignal {
    tradingPair: string;
    side: PositionSide;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    size: number;
    confidence: number;
    strategyType: string;
    timestamp: Date;
    metadata: {
        sentimentScore?: number;
        technicalScore?: number;
        volumeProfile?: number;
        gridLevel?: number;
        marketCondition?: string;
        profitTaking?: boolean;
    };
} 
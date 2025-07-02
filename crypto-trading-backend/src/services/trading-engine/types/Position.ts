export enum PositionSide {
    LONG = 'LONG',
    SHORT = 'SHORT'
}

export enum PositionStatus {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
    PENDING = 'PENDING'
}

export interface Position {
    id: string;
    tradingPair: string;
    entryPrice: number;
    currentPrice: number;
    size: number;
    side: PositionSide;
    status: PositionStatus;
    entryTime: Date;
    exitTime?: Date;
    realizedPnl?: number;
    unrealizedPnl?: number;
    stopLoss?: number;
    takeProfit?: number;
    strategyType: string;
    gridLevel?: number;
} 
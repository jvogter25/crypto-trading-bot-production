import { ITradingStrategy } from './interfaces/ITradingStrategy';
import { MarketCondition } from './types/MarketCondition';
import { Position } from './types/Position';
import { TradingSignal } from './types/TradingSignal';

export class TradingRulesEngine {
    private strategies: Map<string, ITradingStrategy> = new Map();
    private activePositions: Map<string, Position> = new Map();
    private marketCondition: MarketCondition = MarketCondition.SIDEWAYS;

    constructor() {}

    async registerStrategy(strategy: ITradingStrategy): Promise<void> {
        await strategy.initialize();
        this.strategies.set(strategy.strategyType, strategy);
    }

    async unregisterStrategy(strategyType: string): Promise<void> {
        const strategy = this.strategies.get(strategyType);
        if (strategy) {
            await strategy.cleanup();
            this.strategies.delete(strategyType);
        }
    }

    async updateMarketCondition(): Promise<void> {
        // Aggregate market conditions from all strategies
        const conditions = await Promise.all(
            Array.from(this.strategies.values()).map(strategy => strategy.getMarketCondition())
        );

        // Determine overall market condition (simplified logic)
        const bullCount = conditions.filter(c => c === MarketCondition.BULL).length;
        const bearCount = conditions.filter(c => c === MarketCondition.BEAR).length;
        const sidewaysCount = conditions.filter(c => c === MarketCondition.SIDEWAYS).length;

        if (bullCount > bearCount && bullCount > sidewaysCount) {
            this.marketCondition = MarketCondition.BULL;
        } else if (bearCount > bullCount && bearCount > sidewaysCount) {
            this.marketCondition = MarketCondition.BEAR;
        } else {
            this.marketCondition = MarketCondition.SIDEWAYS;
        }

        // Update all strategies with new market condition
        await Promise.all(
            Array.from(this.strategies.values()).map(strategy => 
                strategy.adaptToMarketCondition(this.marketCondition)
            )
        );
    }

    async generateTradingSignals(): Promise<TradingSignal[]> {
        const allSignals: TradingSignal[] = [];

        for (const strategy of this.strategies.values()) {
            const signals = await strategy.generateSignals();
            const validatedSignals = await Promise.all(
                signals.map(async signal => {
                    if (await strategy.validateSignal(signal)) {
                        return {
                            ...signal,
                            size: await strategy.calculatePositionSize(signal),
                            stopLoss: await strategy.calculateStopLoss(signal),
                            takeProfit: await strategy.calculateTakeProfit(signal)
                        };
                    }
                    return null;
                })
            );

            allSignals.push(...validatedSignals.filter((signal): signal is TradingSignal => signal !== null));
        }

        return allSignals;
    }

    async updatePositions(): Promise<void> {
        for (const position of this.activePositions.values()) {
            const strategy = this.strategies.get(position.strategyType);
            if (strategy) {
                // Update position metrics
                // Implement position update logic
            }
        }
    }

    async getActivePositions(): Promise<Position[]> {
        return Array.from(this.activePositions.values());
    }

    async getStrategyPositions(strategyType: string): Promise<Position[]> {
        return Array.from(this.activePositions.values())
            .filter(position => position.strategyType === strategyType);
    }

    async getCurrentMarketCondition(): Promise<MarketCondition> {
        return this.marketCondition;
    }
} 
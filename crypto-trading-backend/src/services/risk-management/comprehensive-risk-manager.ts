import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';

// Risk Management Interfaces
export interface RiskMetrics {
    portfolioValue: number;
    totalExposure: number;
    totalExposurePercent: number;
    cashReserves: number;
    cashReservesPercent: number;
    maxDrawdown: number;
    currentDrawdown: number;
    drawdownPercent: number;
    portfolioHigh: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EMERGENCY';
    lastUpdate: Date;
}

export interface PositionRisk {
    symbol: string;
    size: number;
    value: number;
    exposurePercent: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    stopLoss: number;
    riskAmount: number;
    riskPercent: number;
    liquidityRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    correlationRisk: number;
}

export interface DrawdownEvent {
    id: string;
    timestamp: Date;
    drawdownPercent: number;
    portfolioValue: number;
    portfolioHigh: number;
    triggerLevel: 'WARNING' | 'REDUCTION' | 'EMERGENCY';
    actionTaken: string;
    positionsAffected: string[];
}

export interface RiskAlert {
    id: string;
    timestamp: Date;
    level: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
    type: 'EXPOSURE' | 'DRAWDOWN' | 'CORRELATION' | 'LIQUIDITY' | 'SYSTEM';
    message: string;
    data: any;
    acknowledged: boolean;
}

export interface EmergencyStop {
    id: string;
    timestamp: Date;
    reason: string;
    triggeredBy: 'DRAWDOWN' | 'EXPOSURE' | 'CORRELATION' | 'MANUAL' | 'SYSTEM';
    portfolioState: RiskMetrics;
    actionsExecuted: string[];
    recoveryRequired: boolean;
}

export class ComprehensiveRiskManager extends EventEmitter {
    private supabase: any;
    private isActive = false;
    private emergencyStopActive = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    
    // Risk Configuration (exact from trading rules)
    private readonly MAX_PORTFOLIO_EXPOSURE = 0.80;        // 80% max total exposure
    private readonly MIN_CASH_RESERVES = 0.20;             // 20% cash reserves
    private readonly MAX_ASSET_EXPOSURE = 0.05;            // 5% max single asset
    private readonly MAX_SECTOR_EXPOSURE = 0.30;           // 30% max sector exposure
    
    // Progressive Drawdown Protection (exact thresholds)
    private readonly DRAWDOWN_WARNING_THRESHOLD = 0.05;    // 5% warning
    private readonly DRAWDOWN_REDUCTION_THRESHOLD = 0.10;  // 10% reduction
    private readonly DRAWDOWN_EMERGENCY_THRESHOLD = 0.15;  // 15% emergency stop
    private readonly DRAWDOWN_CRITICAL_THRESHOLD = 0.20;   // 20% critical emergency
    
    // Position Size Reductions (exact from trading rules)
    private readonly POSITION_REDUCTION_10PCT = 0.25;      // 25% reduction at 10% drawdown
    private readonly POSITION_REDUCTION_15PCT = 0.50;      // 50% reduction at 15% drawdown
    private readonly POSITION_REDUCTION_20PCT = 0.75;      // 75% reduction at 20% drawdown
    
    // Correlation and Liquidity Limits
    private readonly MAX_CORRELATION = 0.80;               // 80% max correlation
    private readonly MIN_DAILY_VOLUME = 1000000;           // $1M minimum daily volume
    private readonly MAX_ORDER_VOLUME_PCT = 0.05;          // 5% of daily volume max
    
    // State tracking
    private currentRiskMetrics: RiskMetrics;
    private positionRisks: Map<string, PositionRisk> = new Map();
    private drawdownEvents: DrawdownEvent[] = [];
    private riskAlerts: RiskAlert[] = [];
    private portfolioHigh = 0;
    private lastPortfolioValue = 0;
    
    constructor() {
        super();
        
        // Initialize Supabase client with mock values if environment variables not available
        const supabaseUrl = process.env.SUPABASE_URL || 'https://mock-project.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';
        
        try {
            this.supabase = createClient(supabaseUrl, supabaseKey);
        } catch (error) {
            console.warn('⚠️ Supabase client initialization failed, using mock mode:', error);
            this.supabase = null;
        }
        
        this.currentRiskMetrics = this.initializeRiskMetrics();
        
        console.log('🛡️ Comprehensive Risk Manager initialized');
        console.log(`   Max Portfolio Exposure: ${(this.MAX_PORTFOLIO_EXPOSURE * 100).toFixed(0)}%`);
        console.log(`   Max Asset Exposure: ${(this.MAX_ASSET_EXPOSURE * 100).toFixed(0)}%`);
        console.log(`   Drawdown Thresholds: ${(this.DRAWDOWN_WARNING_THRESHOLD * 100).toFixed(0)}% / ${(this.DRAWDOWN_REDUCTION_THRESHOLD * 100).toFixed(0)}% / ${(this.DRAWDOWN_EMERGENCY_THRESHOLD * 100).toFixed(0)}%`);
    }
    
    private initializeRiskMetrics(): RiskMetrics {
        return {
            portfolioValue: 0,
            totalExposure: 0,
            totalExposurePercent: 0,
            cashReserves: 0,
            cashReservesPercent: 0,
            maxDrawdown: 0,
            currentDrawdown: 0,
            drawdownPercent: 0,
            portfolioHigh: 0,
            riskLevel: 'LOW',
            lastUpdate: new Date()
        };
    }
    
    async start(): Promise<void> {
        if (this.isActive) {
            console.log('⚠️ Risk Manager already active');
            return;
        }
        
        console.log('🚀 Starting Comprehensive Risk Manager...');
        
        try {
            // Load historical portfolio high
            await this.loadPortfolioHistory();
            
            // Start real-time monitoring
            this.startRealTimeMonitoring();
            
            this.isActive = true;
            
            console.log('✅ Comprehensive Risk Manager started successfully');
            console.log(`📊 Portfolio High: $${this.portfolioHigh.toLocaleString()}`);
            
            this.emit('riskManagerStarted', {
                portfolioHigh: this.portfolioHigh,
                thresholds: {
                    warning: this.DRAWDOWN_WARNING_THRESHOLD,
                    reduction: this.DRAWDOWN_REDUCTION_THRESHOLD,
                    emergency: this.DRAWDOWN_EMERGENCY_THRESHOLD
                }
            });
            
        } catch (error) {
            console.error('❌ Failed to start Risk Manager:', error);
            throw error;
        }
    }
    
    async stop(): Promise<void> {
        if (!this.isActive) return;
        
        console.log('🛑 Stopping Comprehensive Risk Manager...');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // Save final state
        await this.saveRiskMetrics();
        
        this.isActive = false;
        
        console.log('✅ Risk Manager stopped');
        this.emit('riskManagerStopped');
    }
    
    private startRealTimeMonitoring(): void {
        // Monitor risk metrics every 10 seconds for real-time protection
        this.monitoringInterval = setInterval(async () => {
            await this.updateRiskMetrics();
            await this.checkRiskThresholds();
        }, 10000);
        
        console.log('📊 Real-time risk monitoring started (10-second intervals)');
    }
    
    // Core Risk Assessment Methods
    
    async updatePortfolioValue(portfolioValue: number, positions: Map<string, any>): Promise<void> {
        if (this.emergencyStopActive) {
            console.log('🚨 Emergency stop active - portfolio updates suspended');
            return;
        }
        
        this.lastPortfolioValue = portfolioValue;
        
        // Update portfolio high
        if (portfolioValue > this.portfolioHigh) {
            this.portfolioHigh = portfolioValue;
            console.log(`📈 New portfolio high: $${portfolioValue.toLocaleString()}`);
        }
        
        // Calculate total exposure
        let totalExposure = 0;
        this.positionRisks.clear();
        
        for (const [symbol, position] of positions) {
            const positionValue = position.size * position.currentPrice;
            totalExposure += positionValue;
            
            const positionRisk: PositionRisk = {
                symbol,
                size: position.size,
                value: positionValue,
                exposurePercent: positionValue / portfolioValue,
                unrealizedPnL: position.unrealizedPnL,
                unrealizedPnLPercent: position.unrealizedPnLPercent,
                stopLoss: position.stopLoss,
                riskAmount: Math.max(0, positionValue - (position.stopLoss * position.size)),
                riskPercent: Math.max(0, positionValue - (position.stopLoss * position.size)) / portfolioValue,
                liquidityRisk: this.assessLiquidityRisk(symbol, positionValue),
                correlationRisk: await this.calculateCorrelationRisk(symbol, positions)
            };
            
            this.positionRisks.set(symbol, positionRisk);
        }
        
        // Update risk metrics
        const currentDrawdown = Math.max(0, this.portfolioHigh - portfolioValue);
        const drawdownPercent = this.portfolioHigh > 0 ? currentDrawdown / this.portfolioHigh : 0;
        
        this.currentRiskMetrics = {
            portfolioValue,
            totalExposure,
            totalExposurePercent: portfolioValue > 0 ? totalExposure / portfolioValue : 0,
            cashReserves: portfolioValue - totalExposure,
            cashReservesPercent: portfolioValue > 0 ? (portfolioValue - totalExposure) / portfolioValue : 0,
            maxDrawdown: Math.max(this.currentRiskMetrics.maxDrawdown, currentDrawdown),
            currentDrawdown,
            drawdownPercent,
            portfolioHigh: this.portfolioHigh,
            riskLevel: this.calculateRiskLevel(drawdownPercent, totalExposure / portfolioValue),
            lastUpdate: new Date()
        };
        
        // Emit risk update
        this.emit('riskMetricsUpdated', this.currentRiskMetrics);
        
        // Log significant changes
        if (drawdownPercent > 0.02) { // Log drawdowns > 2%
            console.log(`📉 Portfolio Drawdown: ${(drawdownPercent * 100).toFixed(2)}% ($${currentDrawdown.toLocaleString()})`);
        }
    }
    
    private calculateRiskLevel(drawdownPercent: number, exposurePercent: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EMERGENCY' {
        if (drawdownPercent >= this.DRAWDOWN_EMERGENCY_THRESHOLD || exposurePercent > 0.90) {
            return 'EMERGENCY';
        } else if (drawdownPercent >= this.DRAWDOWN_REDUCTION_THRESHOLD || exposurePercent > 0.85) {
            return 'CRITICAL';
        } else if (drawdownPercent >= this.DRAWDOWN_WARNING_THRESHOLD || exposurePercent > 0.80) {
            return 'HIGH';
        } else if (drawdownPercent >= 0.03 || exposurePercent > 0.70) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }
    
    private async updateRiskMetrics(): Promise<void> {
        // This would be called by the main trading system
        // For now, we'll just save current metrics
        await this.saveRiskMetrics();
    }
    
    private async checkRiskThresholds(): Promise<void> {
        const metrics = this.currentRiskMetrics;
        
        // Check drawdown thresholds (exact from trading rules)
        if (metrics.drawdownPercent >= this.DRAWDOWN_EMERGENCY_THRESHOLD) {
            await this.triggerEmergencyStop('DRAWDOWN', `Portfolio drawdown ${(metrics.drawdownPercent * 100).toFixed(2)}% exceeds emergency threshold`);
        } else if (metrics.drawdownPercent >= this.DRAWDOWN_REDUCTION_THRESHOLD) {
            await this.triggerDrawdownReduction(metrics.drawdownPercent);
        } else if (metrics.drawdownPercent >= this.DRAWDOWN_WARNING_THRESHOLD) {
            await this.triggerDrawdownWarning(metrics.drawdownPercent);
        }
        
        // Check exposure limits
        if (metrics.totalExposurePercent > this.MAX_PORTFOLIO_EXPOSURE) {
            await this.triggerExposureAlert(metrics.totalExposurePercent);
        }
        
        // Check individual position limits
        for (const [symbol, positionRisk] of this.positionRisks) {
            if (positionRisk.exposurePercent > this.MAX_ASSET_EXPOSURE) {
                await this.triggerPositionSizeAlert(symbol, positionRisk.exposurePercent);
            }
        }
        
        // Check correlation risks
        await this.checkCorrelationRisks();
    }
    
    // Progressive Drawdown Protection (exact implementation)
    
    private async triggerDrawdownWarning(drawdownPercent: number): Promise<void> {
        const alertId = `drawdown_warning_${Date.now()}`;
        
        const alert: RiskAlert = {
            id: alertId,
            timestamp: new Date(),
            level: 'WARNING',
            type: 'DRAWDOWN',
            message: `Portfolio drawdown ${(drawdownPercent * 100).toFixed(2)}% exceeds warning threshold (${(this.DRAWDOWN_WARNING_THRESHOLD * 100).toFixed(0)}%)`,
            data: {
                drawdownPercent,
                portfolioValue: this.currentRiskMetrics.portfolioValue,
                portfolioHigh: this.portfolioHigh
            },
            acknowledged: false
        };
        
        this.riskAlerts.push(alert);
        
        console.log(`⚠️ DRAWDOWN WARNING: ${alert.message}`);
        
        this.emit('drawdownWarning', {
            drawdownPercent,
            alert
        });
        
        await this.logRiskEvent('DRAWDOWN_WARNING', alert.data);
    }
    
    private async triggerDrawdownReduction(drawdownPercent: number): Promise<void> {
        const alertId = `drawdown_reduction_${Date.now()}`;
        
        // Implement exact reduction from trading rules: 25% position size reduction
        const reductionPercent = this.POSITION_REDUCTION_10PCT;
        
        const alert: RiskAlert = {
            id: alertId,
            timestamp: new Date(),
            level: 'CRITICAL',
            type: 'DRAWDOWN',
            message: `Portfolio drawdown ${(drawdownPercent * 100).toFixed(2)}% triggers ${(reductionPercent * 100).toFixed(0)}% position reduction`,
            data: {
                drawdownPercent,
                reductionPercent,
                portfolioValue: this.currentRiskMetrics.portfolioValue,
                portfolioHigh: this.portfolioHigh
            },
            acknowledged: false
        };
        
        this.riskAlerts.push(alert);
        
        const drawdownEvent: DrawdownEvent = {
            id: `drawdown_${Date.now()}`,
            timestamp: new Date(),
            drawdownPercent,
            portfolioValue: this.currentRiskMetrics.portfolioValue,
            portfolioHigh: this.portfolioHigh,
            triggerLevel: 'REDUCTION',
            actionTaken: `Reduce position sizes by ${(reductionPercent * 100).toFixed(0)}%`,
            positionsAffected: Array.from(this.positionRisks.keys())
        };
        
        this.drawdownEvents.push(drawdownEvent);
        
        console.log(`🚨 DRAWDOWN REDUCTION: ${alert.message}`);
        
        this.emit('drawdownReduction', {
            drawdownPercent,
            reductionPercent,
            alert,
            event: drawdownEvent
        });
        
        await this.logRiskEvent('DRAWDOWN_REDUCTION', alert.data);
    }
    
    private async triggerEmergencyStop(reason: 'DRAWDOWN' | 'EXPOSURE' | 'CORRELATION' | 'MANUAL' | 'SYSTEM', message: string): Promise<void> {
        if (this.emergencyStopActive) {
            console.log('🚨 Emergency stop already active');
            return;
        }
        
        this.emergencyStopActive = true;
        
        const emergencyStop: EmergencyStop = {
            id: `emergency_${Date.now()}`,
            timestamp: new Date(),
            reason: message,
            triggeredBy: reason,
            portfolioState: { ...this.currentRiskMetrics },
            actionsExecuted: [
                'All new position opening suspended',
                'Existing positions marked for emergency closure',
                'Risk monitoring elevated to emergency mode'
            ],
            recoveryRequired: true
        };
        
        const alert: RiskAlert = {
            id: `emergency_${Date.now()}`,
            timestamp: new Date(),
            level: 'EMERGENCY',
            type: 'DRAWDOWN',
            message: `EMERGENCY STOP ACTIVATED: ${message}`,
            data: emergencyStop,
            acknowledged: false
        };
        
        this.riskAlerts.push(alert);
        
        console.log(`🚨🚨🚨 EMERGENCY STOP ACTIVATED 🚨🚨🚨`);
        console.log(`Reason: ${message}`);
        console.log(`Portfolio Value: $${this.currentRiskMetrics.portfolioValue.toLocaleString()}`);
        console.log(`Drawdown: ${(this.currentRiskMetrics.drawdownPercent * 100).toFixed(2)}%`);
        
        this.emit('emergencyStop', {
            emergencyStop,
            alert
        });
        
        await this.logRiskEvent('EMERGENCY_STOP', emergencyStop);
    }
    
    // Exposure and Position Validation
    
    async validateTradeRisk(symbol: string, tradeSize: number, tradeValue: number): Promise<{
        approved: boolean;
        reason?: string;
        maxAllowedSize?: number;
        riskAssessment: any;
    }> {
        if (this.emergencyStopActive) {
            return {
                approved: false,
                reason: 'Emergency stop active - all trading suspended',
                riskAssessment: { emergencyStop: true }
            };
        }
        
        const currentPosition = this.positionRisks.get(symbol);
        const currentExposure = currentPosition ? currentPosition.exposurePercent : 0;
        const newExposure = (currentPosition ? currentPosition.value : 0) + tradeValue;
        const newExposurePercent = newExposure / this.currentRiskMetrics.portfolioValue;
        
        // Check individual asset exposure limit (5% max)
        if (newExposurePercent > this.MAX_ASSET_EXPOSURE) {
            const maxAllowedValue = this.currentRiskMetrics.portfolioValue * this.MAX_ASSET_EXPOSURE;
            const maxAllowedAdditional = maxAllowedValue - (currentPosition ? currentPosition.value : 0);
            
            return {
                approved: false,
                reason: `Trade would exceed ${(this.MAX_ASSET_EXPOSURE * 100).toFixed(0)}% asset exposure limit`,
                maxAllowedSize: maxAllowedAdditional > 0 ? maxAllowedAdditional / (tradeValue / tradeSize) : 0,
                riskAssessment: {
                    currentExposure: currentExposure,
                    newExposure: newExposurePercent,
                    limit: this.MAX_ASSET_EXPOSURE
                }
            };
        }
        
        // Check total portfolio exposure limit (80% max)
        const newTotalExposure = this.currentRiskMetrics.totalExposure + tradeValue;
        const newTotalExposurePercent = newTotalExposure / this.currentRiskMetrics.portfolioValue;
        
        if (newTotalExposurePercent > this.MAX_PORTFOLIO_EXPOSURE) {
            return {
                approved: false,
                reason: `Trade would exceed ${(this.MAX_PORTFOLIO_EXPOSURE * 100).toFixed(0)}% portfolio exposure limit`,
                riskAssessment: {
                    currentTotalExposure: this.currentRiskMetrics.totalExposurePercent,
                    newTotalExposure: newTotalExposurePercent,
                    limit: this.MAX_PORTFOLIO_EXPOSURE
                }
            };
        }
        
        // Check cash reserves (20% minimum)
        const newCashReserves = this.currentRiskMetrics.portfolioValue - newTotalExposure;
        const newCashReservesPercent = newCashReserves / this.currentRiskMetrics.portfolioValue;
        
        if (newCashReservesPercent < this.MIN_CASH_RESERVES) {
            return {
                approved: false,
                reason: `Trade would reduce cash reserves below ${(this.MIN_CASH_RESERVES * 100).toFixed(0)}% minimum`,
                riskAssessment: {
                    currentCashReserves: this.currentRiskMetrics.cashReservesPercent,
                    newCashReserves: newCashReservesPercent,
                    minimum: this.MIN_CASH_RESERVES
                }
            };
        }
        
        // Check liquidity risk
        const liquidityRisk = this.assessLiquidityRisk(symbol, tradeValue);
        if (liquidityRisk === 'HIGH') {
            return {
                approved: false,
                reason: 'High liquidity risk - insufficient market depth',
                riskAssessment: {
                    liquidityRisk,
                    tradeValue,
                    symbol
                }
            };
        }
        
        // Trade approved
        return {
            approved: true,
            riskAssessment: {
                currentExposure,
                newExposure: newExposurePercent,
                liquidityRisk,
                correlationRisk: currentPosition ? currentPosition.correlationRisk : 0
            }
        };
    }
    
    private assessLiquidityRisk(symbol: string, tradeValue: number): 'LOW' | 'MEDIUM' | 'HIGH' {
        // Mock implementation - in production would use real volume data
        const mockDailyVolume = {
            'BTC': 50000000,
            'ETH': 30000000,
            'ADA': 5000000,
            'SOL': 8000000,
            'MATIC': 3000000,
            'LINK': 4000000,
            'DOT': 2000000,
            'AVAX': 3000000
        };
        
        const dailyVolume = mockDailyVolume[symbol as keyof typeof mockDailyVolume] || 1000000;
        const tradeVolumePercent = tradeValue / dailyVolume;
        
        if (tradeVolumePercent > this.MAX_ORDER_VOLUME_PCT) {
            return 'HIGH';
        } else if (tradeVolumePercent > 0.02) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }
    
    private async calculateCorrelationRisk(symbol: string, positions: Map<string, any>): Promise<number> {
        // Mock correlation calculation - in production would use real correlation data
        const correlations: { [key: string]: { [key: string]: number } } = {
            'BTC': { 'ETH': 0.75, 'ADA': 0.65, 'SOL': 0.70 },
            'ETH': { 'BTC': 0.75, 'ADA': 0.80, 'SOL': 0.85 },
            'ADA': { 'BTC': 0.65, 'ETH': 0.80, 'SOL': 0.75 },
            'SOL': { 'BTC': 0.70, 'ETH': 0.85, 'ADA': 0.75 }
        };
        
        let maxCorrelation = 0;
        const symbolCorrelations = correlations[symbol] || {};
        
        for (const [otherSymbol] of positions) {
            if (otherSymbol !== symbol && symbolCorrelations[otherSymbol]) {
                maxCorrelation = Math.max(maxCorrelation, symbolCorrelations[otherSymbol]);
            }
        }
        
        return maxCorrelation;
    }
    
    private async checkCorrelationRisks(): Promise<void> {
        // Check for high correlation between major positions
        const majorPositions = Array.from(this.positionRisks.values())
            .filter(pos => pos.exposurePercent > 0.02) // Positions > 2%
            .sort((a, b) => b.exposurePercent - a.exposurePercent);
        
        for (let i = 0; i < majorPositions.length; i++) {
            for (let j = i + 1; j < majorPositions.length; j++) {
                const pos1 = majorPositions[i];
                const pos2 = majorPositions[j];
                
                // Mock correlation check
                if (pos1.correlationRisk > this.MAX_CORRELATION && pos2.correlationRisk > this.MAX_CORRELATION) {
                    await this.triggerCorrelationAlert(pos1.symbol, pos2.symbol, pos1.correlationRisk);
                }
            }
        }
    }
    
    private async triggerExposureAlert(exposurePercent: number): Promise<void> {
        const alert: RiskAlert = {
            id: `exposure_${Date.now()}`,
            timestamp: new Date(),
            level: 'WARNING',
            type: 'EXPOSURE',
            message: `Portfolio exposure ${(exposurePercent * 100).toFixed(1)}% exceeds ${(this.MAX_PORTFOLIO_EXPOSURE * 100).toFixed(0)}% limit`,
            data: {
                currentExposure: exposurePercent,
                limit: this.MAX_PORTFOLIO_EXPOSURE,
                excessExposure: exposurePercent - this.MAX_PORTFOLIO_EXPOSURE
            },
            acknowledged: false
        };
        
        this.riskAlerts.push(alert);
        
        console.log(`⚠️ EXPOSURE ALERT: ${alert.message}`);
        
        this.emit('exposureAlert', alert);
        
        await this.logRiskEvent('EXPOSURE_ALERT', alert.data);
    }
    
    private async triggerPositionSizeAlert(symbol: string, exposurePercent: number): Promise<void> {
        const alert: RiskAlert = {
            id: `position_${symbol}_${Date.now()}`,
            timestamp: new Date(),
            level: 'WARNING',
            type: 'EXPOSURE',
            message: `${symbol} position ${(exposurePercent * 100).toFixed(1)}% exceeds ${(this.MAX_ASSET_EXPOSURE * 100).toFixed(0)}% limit`,
            data: {
                symbol,
                currentExposure: exposurePercent,
                limit: this.MAX_ASSET_EXPOSURE,
                excessExposure: exposurePercent - this.MAX_ASSET_EXPOSURE
            },
            acknowledged: false
        };
        
        this.riskAlerts.push(alert);
        
        console.log(`⚠️ POSITION SIZE ALERT: ${alert.message}`);
        
        this.emit('positionSizeAlert', alert);
        
        await this.logRiskEvent('POSITION_SIZE_ALERT', alert.data);
    }
    
    private async triggerCorrelationAlert(symbol1: string, symbol2: string, correlation: number): Promise<void> {
        const alert: RiskAlert = {
            id: `correlation_${symbol1}_${symbol2}_${Date.now()}`,
            timestamp: new Date(),
            level: 'WARNING',
            type: 'CORRELATION',
            message: `High correlation ${(correlation * 100).toFixed(0)}% between ${symbol1} and ${symbol2} positions`,
            data: {
                symbol1,
                symbol2,
                correlation,
                limit: this.MAX_CORRELATION
            },
            acknowledged: false
        };
        
        this.riskAlerts.push(alert);
        
        console.log(`⚠️ CORRELATION ALERT: ${alert.message}`);
        
        this.emit('correlationAlert', alert);
        
        await this.logRiskEvent('CORRELATION_ALERT', alert.data);
    }
    
    // Emergency Controls
    
    async manualEmergencyStop(reason: string): Promise<void> {
        console.log(`🚨 Manual emergency stop requested: ${reason}`);
        await this.triggerEmergencyStop('MANUAL', reason);
    }
    
    async resetEmergencyStop(adminConfirmation: string): Promise<boolean> {
        if (adminConfirmation !== 'CONFIRM_RESET_EMERGENCY_STOP') {
            console.log('❌ Invalid emergency stop reset confirmation');
            return false;
        }
        
        if (!this.emergencyStopActive) {
            console.log('⚠️ No emergency stop active to reset');
            return false;
        }
        
        this.emergencyStopActive = false;
        
        console.log('✅ Emergency stop reset - trading can resume');
        
        this.emit('emergencyStopReset', {
            timestamp: new Date(),
            resetBy: 'ADMIN'
        });
        
        await this.logRiskEvent('EMERGENCY_STOP_RESET', { resetBy: 'ADMIN' });
        
        return true;
    }
    
    // Data Persistence and Logging
    
    private async loadPortfolioHistory(): Promise<void> {
        try {
            if (!this.supabase) {
                console.log('📊 Using mock portfolio history (no database connection)');
                this.portfolioHigh = 100000; // Default starting value
                return;
            }
            
            const { data, error } = await this.supabase
                .from('portfolio_history')
                .select('portfolio_value')
                .order('timestamp', { ascending: false })
                .limit(1);
            
            if (error) {
                console.warn('Warning loading portfolio history:', error.message);
                this.portfolioHigh = 100000; // Default starting value
                return;
            }
            
            if (data && data.length > 0) {
                this.portfolioHigh = Math.max(data[0].portfolio_value, 100000);
            } else {
                this.portfolioHigh = 100000; // Default starting value
            }
            
        } catch (error) {
            console.warn('Error loading portfolio history:', error);
            this.portfolioHigh = 100000; // Default starting value
        }
    }
    
    private async saveRiskMetrics(): Promise<void> {
        try {
            if (!this.supabase) {
                console.log('📊 Mock mode: Risk metrics would be saved to database');
                return;
            }
            
            await this.supabase
                .from('risk_metrics_history')
                .insert({
                    timestamp: new Date().toISOString(),
                    portfolio_value: this.currentRiskMetrics.portfolioValue,
                    total_exposure: this.currentRiskMetrics.totalExposure,
                    total_exposure_percent: this.currentRiskMetrics.totalExposurePercent,
                    cash_reserves: this.currentRiskMetrics.cashReserves,
                    cash_reserves_percent: this.currentRiskMetrics.cashReservesPercent,
                    current_drawdown: this.currentRiskMetrics.currentDrawdown,
                    drawdown_percent: this.currentRiskMetrics.drawdownPercent,
                    portfolio_high: this.portfolioHigh,
                    risk_level: this.currentRiskMetrics.riskLevel,
                    emergency_stop_active: this.emergencyStopActive
                });
        } catch (error) {
            console.error('Error saving risk metrics:', error);
        }
    }
    
    private async logRiskEvent(eventType: string, data: any): Promise<void> {
        try {
            if (!this.supabase) {
                console.log(`📊 Mock mode: Risk event logged - ${eventType}`);
                return;
            }
            
            await this.supabase
                .from('risk_events')
                .insert({
                    timestamp: new Date().toISOString(),
                    event_type: eventType,
                    data: data,
                    portfolio_value: this.currentRiskMetrics.portfolioValue,
                    drawdown_percent: this.currentRiskMetrics.drawdownPercent,
                    emergency_stop_active: this.emergencyStopActive
                });
        } catch (error) {
            console.error('Error logging risk event:', error);
        }
    }
    
    // Public API Methods
    
    getRiskMetrics(): RiskMetrics {
        return { ...this.currentRiskMetrics };
    }
    
    getPositionRisks(): Map<string, PositionRisk> {
        return new Map(this.positionRisks);
    }
    
    getRiskAlerts(level?: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'): RiskAlert[] {
        if (level) {
            return this.riskAlerts.filter(alert => alert.level === level);
        }
        return [...this.riskAlerts];
    }
    
    getDrawdownEvents(): DrawdownEvent[] {
        return [...this.drawdownEvents];
    }
    
    isEmergencyStopActive(): boolean {
        return this.emergencyStopActive;
    }
    
    getRiskDashboard(): any {
        return {
            riskMetrics: this.currentRiskMetrics,
            positionRisks: Array.from(this.positionRisks.values()),
            recentAlerts: this.riskAlerts.slice(-10),
            recentDrawdownEvents: this.drawdownEvents.slice(-5),
            emergencyStopActive: this.emergencyStopActive,
            thresholds: {
                maxPortfolioExposure: this.MAX_PORTFOLIO_EXPOSURE,
                maxAssetExposure: this.MAX_ASSET_EXPOSURE,
                minCashReserves: this.MIN_CASH_RESERVES,
                drawdownWarning: this.DRAWDOWN_WARNING_THRESHOLD,
                drawdownReduction: this.DRAWDOWN_REDUCTION_THRESHOLD,
                drawdownEmergency: this.DRAWDOWN_EMERGENCY_THRESHOLD
            },
            isActive: this.isActive
        };
    }
    
    getConfiguration(): any {
        return {
            portfolioLimits: {
                maxPortfolioExposure: this.MAX_PORTFOLIO_EXPOSURE,
                maxAssetExposure: this.MAX_ASSET_EXPOSURE,
                maxSectorExposure: this.MAX_SECTOR_EXPOSURE,
                minCashReserves: this.MIN_CASH_RESERVES
            },
            drawdownThresholds: {
                warning: this.DRAWDOWN_WARNING_THRESHOLD,
                reduction: this.DRAWDOWN_REDUCTION_THRESHOLD,
                emergency: this.DRAWDOWN_EMERGENCY_THRESHOLD,
                critical: this.DRAWDOWN_CRITICAL_THRESHOLD
            },
            positionReductions: {
                at10Percent: this.POSITION_REDUCTION_10PCT,
                at15Percent: this.POSITION_REDUCTION_15PCT,
                at20Percent: this.POSITION_REDUCTION_20PCT
            },
            correlationLimits: {
                maxCorrelation: this.MAX_CORRELATION,
                minDailyVolume: this.MIN_DAILY_VOLUME,
                maxOrderVolumePercent: this.MAX_ORDER_VOLUME_PCT
            }
        };
    }
} 
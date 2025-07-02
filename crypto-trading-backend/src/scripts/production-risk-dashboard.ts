import { ComprehensiveRiskManager } from '../services/risk-management/comprehensive-risk-manager';
import { createClient } from '@supabase/supabase-js';

interface DashboardConfig {
    refreshInterval: number;
    alertThresholds: {
        exposureWarning: number;
        drawdownWarning: number;
        correlationWarning: number;
    };
    displayOptions: {
        showPositionDetails: boolean;
        showHistoricalData: boolean;
        showAlerts: boolean;
        autoRefresh: boolean;
    };
}

class ProductionRiskDashboard {
    private riskManager: ComprehensiveRiskManager;
    private supabase: any;
    private isRunning = false;
    private refreshInterval: NodeJS.Timeout | null = null;
    private lastUpdate: Date = new Date();
    
    private config: DashboardConfig = {
        refreshInterval: 5000, // 5 seconds
        alertThresholds: {
            exposureWarning: 0.75,    // 75% exposure warning
            drawdownWarning: 0.03,    // 3% drawdown warning
            correlationWarning: 0.70  // 70% correlation warning
        },
        displayOptions: {
            showPositionDetails: true,
            showHistoricalData: true,
            showAlerts: true,
            autoRefresh: true
        }
    };
    
    constructor() {
        this.riskManager = new ComprehensiveRiskManager();
        
        this.supabase = createClient(
            process.env.SUPABASE_URL || 'mock-url',
            process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key'
        );
        
        this.setupEventListeners();
    }
    
    private setupEventListeners(): void {
        this.riskManager.on('riskMetricsUpdated', (metrics) => {
            this.handleRiskMetricsUpdate(metrics);
        });
        
        this.riskManager.on('drawdownWarning', (data) => {
            this.handleDrawdownAlert('WARNING', data);
        });
        
        this.riskManager.on('drawdownReduction', (data) => {
            this.handleDrawdownAlert('CRITICAL', data);
        });
        
        this.riskManager.on('emergencyStop', (data) => {
            this.handleEmergencyStop(data);
        });
        
        this.riskManager.on('exposureAlert', (alert) => {
            this.handleExposureAlert(alert);
        });
        
        this.riskManager.on('positionSizeAlert', (alert) => {
            this.handlePositionSizeAlert(alert);
        });
        
        this.riskManager.on('correlationAlert', (alert) => {
            this.handleCorrelationAlert(alert);
        });
    }
    
    async start(): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️ Risk Dashboard already running');
            return;
        }
        
        console.log('🚀 Starting Production Risk Management Dashboard...');
        console.log('='.repeat(80));
        
        try {
            // Start the risk manager
            await this.riskManager.start();
            
            // Display initial dashboard
            await this.displayDashboard();
            
            // Start auto-refresh if enabled
            if (this.config.displayOptions.autoRefresh) {
                this.startAutoRefresh();
            }
            
            this.isRunning = true;
            
            console.log('✅ Risk Management Dashboard started successfully');
            console.log(`📊 Auto-refresh: ${this.config.displayOptions.autoRefresh ? 'ON' : 'OFF'} (${this.config.refreshInterval}ms)`);
            console.log(`🚨 Emergency Stop Status: ${this.riskManager.isEmergencyStopActive() ? 'ACTIVE' : 'INACTIVE'}`);
            
        } catch (error) {
            console.error('❌ Failed to start Risk Dashboard:', error);
            throw error;
        }
    }
    
    async stop(): Promise<void> {
        if (!this.isRunning) return;
        
        console.log('🛑 Stopping Risk Management Dashboard...');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        await this.riskManager.stop();
        
        this.isRunning = false;
        
        console.log('✅ Risk Dashboard stopped');
    }
    
    private startAutoRefresh(): void {
        this.refreshInterval = setInterval(async () => {
            await this.displayDashboard();
        }, this.config.refreshInterval);
    }
    
    async displayDashboard(): Promise<void> {
        this.clearScreen();
        this.lastUpdate = new Date();
        
        console.log('🛡️  COMPREHENSIVE RISK MANAGEMENT DASHBOARD');
        console.log('='.repeat(80));
        console.log(`Last Update: ${this.lastUpdate.toLocaleString()}`);
        console.log('');
        
        const dashboard = this.riskManager.getRiskDashboard();
        
        // Display current risk status
        await this.displayRiskStatus(dashboard.riskMetrics);
        
        // Display position risks
        if (this.config.displayOptions.showPositionDetails) {
            await this.displayPositionRisks(dashboard.positionRisks);
        }
        
        // Display active alerts
        if (this.config.displayOptions.showAlerts) {
            await this.displayActiveAlerts(dashboard.recentAlerts);
        }
        
        // Display emergency stop status
        await this.displayEmergencyStatus(dashboard.emergencyStopActive);
        
        // Display configuration
        await this.displayConfiguration(dashboard.thresholds);
        
        // Display controls
        this.displayControls();
    }
    
    private async displayRiskStatus(riskMetrics: any): Promise<void> {
        console.log('📊 CURRENT RISK STATUS');
        console.log('-'.repeat(40));
        
        const portfolioValue = riskMetrics.portfolioValue || 0;
        const totalExposure = riskMetrics.totalExposure || 0;
        const exposurePercent = riskMetrics.totalExposurePercent || 0;
        const cashReserves = riskMetrics.cashReserves || 0;
        const cashReservesPercent = riskMetrics.cashReservesPercent || 0;
        const drawdownPercent = riskMetrics.drawdownPercent || 0;
        const riskLevel = riskMetrics.riskLevel || 'UNKNOWN';
        
        // Portfolio Overview
        console.log(`Portfolio Value:     $${portfolioValue.toLocaleString()}`);
        console.log(`Total Exposure:      $${totalExposure.toLocaleString()} (${(exposurePercent * 100).toFixed(1)}%)`);
        console.log(`Cash Reserves:       $${cashReserves.toLocaleString()} (${(cashReservesPercent * 100).toFixed(1)}%)`);
        console.log('');
        
        // Risk Metrics
        const drawdownStatus = this.getDrawdownStatus(drawdownPercent);
        const exposureStatus = this.getExposureStatus(exposurePercent);
        
        console.log(`Current Drawdown:    ${(drawdownPercent * 100).toFixed(2)}% ${drawdownStatus}`);
        console.log(`Exposure Status:     ${(exposurePercent * 100).toFixed(1)}% ${exposureStatus}`);
        console.log(`Risk Level:          ${riskLevel} ${this.getRiskLevelEmoji(riskLevel)}`);
        console.log('');
        
        // Risk Gauges
        this.displayRiskGauge('Portfolio Exposure', exposurePercent, 0.80);
        this.displayRiskGauge('Cash Reserves', cashReservesPercent, 0.20, true);
        this.displayRiskGauge('Drawdown Risk', drawdownPercent, 0.15);
        console.log('');
    }
    
    private async displayPositionRisks(positionRisks: any[]): Promise<void> {
        if (!positionRisks || positionRisks.length === 0) {
            console.log('📈 POSITION RISKS: No active positions');
            console.log('');
            return;
        }
        
        console.log('📈 POSITION RISKS');
        console.log('-'.repeat(40));
        
        // Sort by exposure percentage (highest first)
        const sortedPositions = positionRisks.sort((a, b) => b.exposurePercent - a.exposurePercent);
        
        console.log('Symbol    Value        Exposure   P&L      Risk     Liquidity');
        console.log('-'.repeat(65));
        
        for (const position of sortedPositions) {
            const symbol = position.symbol.padEnd(8);
            const value = `$${position.value.toLocaleString()}`.padEnd(11);
            const exposure = `${(position.exposurePercent * 100).toFixed(1)}%`.padEnd(9);
            const pnl = `${position.unrealizedPnLPercent >= 0 ? '+' : ''}${(position.unrealizedPnLPercent * 100).toFixed(1)}%`.padEnd(8);
            const risk = `${(position.riskPercent * 100).toFixed(1)}%`.padEnd(8);
            const liquidity = this.getLiquidityEmoji(position.liquidityRisk);
            
            console.log(`${symbol} ${value} ${exposure} ${pnl} ${risk} ${liquidity}`);
        }
        console.log('');
    }
    
    private async displayActiveAlerts(recentAlerts: any[]): Promise<void> {
        const activeAlerts = recentAlerts.filter(alert => !alert.acknowledged);
        
        if (activeAlerts.length === 0) {
            console.log('🟢 ACTIVE ALERTS: None');
            console.log('');
            return;
        }
        
        console.log(`🚨 ACTIVE ALERTS (${activeAlerts.length})`);
        console.log('-'.repeat(40));
        
        for (const alert of activeAlerts.slice(0, 5)) { // Show top 5 alerts
            const level = this.getAlertLevelEmoji(alert.level);
            const time = new Date(alert.timestamp).toLocaleTimeString();
            console.log(`${level} [${time}] ${alert.message}`);
        }
        
        if (activeAlerts.length > 5) {
            console.log(`... and ${activeAlerts.length - 5} more alerts`);
        }
        console.log('');
    }
    
    private async displayEmergencyStatus(emergencyStopActive: boolean): Promise<void> {
        console.log('🚨 EMERGENCY STATUS');
        console.log('-'.repeat(40));
        
        if (emergencyStopActive) {
            console.log('🚨🚨🚨 EMERGENCY STOP ACTIVE 🚨🚨🚨');
            console.log('All trading operations are SUSPENDED');
            console.log('Manual intervention required to reset');
        } else {
            console.log('✅ Normal Operations - No Emergency Stop');
            console.log('All systems operational');
        }
        console.log('');
    }
    
    private async displayConfiguration(thresholds: any): Promise<void> {
        console.log('⚙️ RISK CONFIGURATION');
        console.log('-'.repeat(40));
        
        console.log(`Max Portfolio Exposure: ${(thresholds.maxPortfolioExposure * 100).toFixed(0)}%`);
        console.log(`Max Asset Exposure:     ${(thresholds.maxAssetExposure * 100).toFixed(0)}%`);
        console.log(`Min Cash Reserves:      ${(thresholds.minCashReserves * 100).toFixed(0)}%`);
        console.log(`Drawdown Warning:       ${(thresholds.drawdownWarning * 100).toFixed(0)}%`);
        console.log(`Drawdown Reduction:     ${(thresholds.drawdownReduction * 100).toFixed(0)}%`);
        console.log(`Drawdown Emergency:     ${(thresholds.drawdownEmergency * 100).toFixed(0)}%`);
        console.log('');
    }
    
    private displayControls(): void {
        console.log('🎮 CONTROLS');
        console.log('-'.repeat(40));
        console.log('Commands:');
        console.log('  Ctrl+C          - Stop dashboard');
        console.log('  E + Enter       - Trigger emergency stop');
        console.log('  R + Enter       - Reset emergency stop');
        console.log('  T + Enter       - Run risk tests');
        console.log('  S + Enter       - Show detailed statistics');
        console.log('');
        console.log('Dashboard will auto-refresh every 5 seconds...');
    }
    
    // Event Handlers
    
    private handleRiskMetricsUpdate(metrics: any): void {
        // Check for threshold breaches
        if (metrics.totalExposurePercent > this.config.alertThresholds.exposureWarning) {
            console.log(`⚠️ [${new Date().toLocaleTimeString()}] High exposure warning: ${(metrics.totalExposurePercent * 100).toFixed(1)}%`);
        }
        
        if (metrics.drawdownPercent > this.config.alertThresholds.drawdownWarning) {
            console.log(`⚠️ [${new Date().toLocaleTimeString()}] Drawdown warning: ${(metrics.drawdownPercent * 100).toFixed(2)}%`);
        }
    }
    
    private handleDrawdownAlert(level: string, data: any): void {
        const timestamp = new Date().toLocaleTimeString();
        const drawdown = (data.drawdownPercent * 100).toFixed(2);
        
        if (level === 'WARNING') {
            console.log(`🟡 [${timestamp}] DRAWDOWN WARNING: ${drawdown}%`);
        } else if (level === 'CRITICAL') {
            console.log(`🔴 [${timestamp}] DRAWDOWN CRITICAL: ${drawdown}% - Position reduction triggered`);
        }
    }
    
    private handleEmergencyStop(data: any): void {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🚨 [${timestamp}] EMERGENCY STOP ACTIVATED: ${data.emergencyStop.reason}`);
        
        // Force dashboard refresh to show emergency status
        setTimeout(() => {
            this.displayDashboard();
        }, 1000);
    }
    
    private handleExposureAlert(alert: any): void {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`⚠️ [${timestamp}] EXPOSURE ALERT: ${alert.message}`);
    }
    
    private handlePositionSizeAlert(alert: any): void {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`⚠️ [${timestamp}] POSITION SIZE ALERT: ${alert.message}`);
    }
    
    private handleCorrelationAlert(alert: any): void {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`⚠️ [${timestamp}] CORRELATION ALERT: ${alert.message}`);
    }
    
    // Utility Methods
    
    private clearScreen(): void {
        console.clear();
    }
    
    private getDrawdownStatus(drawdownPercent: number): string {
        if (drawdownPercent >= 0.15) return '🚨 EMERGENCY';
        if (drawdownPercent >= 0.10) return '🔴 CRITICAL';
        if (drawdownPercent >= 0.05) return '🟡 WARNING';
        if (drawdownPercent >= 0.02) return '🟠 ELEVATED';
        return '🟢 NORMAL';
    }
    
    private getExposureStatus(exposurePercent: number): string {
        if (exposurePercent > 0.80) return '🚨 EXCEEDED';
        if (exposurePercent > 0.75) return '🔴 HIGH';
        if (exposurePercent > 0.60) return '🟡 MEDIUM';
        return '🟢 LOW';
    }
    
    private getRiskLevelEmoji(riskLevel: string): string {
        switch (riskLevel) {
            case 'EMERGENCY': return '🚨';
            case 'CRITICAL': return '🔴';
            case 'HIGH': return '🟡';
            case 'MEDIUM': return '🟠';
            case 'LOW': return '🟢';
            default: return '❓';
        }
    }
    
    private getAlertLevelEmoji(level: string): string {
        switch (level) {
            case 'EMERGENCY': return '🚨';
            case 'CRITICAL': return '🔴';
            case 'WARNING': return '🟡';
            case 'INFO': return '🔵';
            default: return '❓';
        }
    }
    
    private getLiquidityEmoji(liquidityRisk: string): string {
        switch (liquidityRisk) {
            case 'LOW': return '🟢';
            case 'MEDIUM': return '🟡';
            case 'HIGH': return '🔴';
            default: return '❓';
        }
    }
    
    private displayRiskGauge(label: string, value: number, threshold: number, reverse: boolean = false): void {
        const percentage = value * 100;
        const thresholdPercentage = threshold * 100;
        
        let status: string;
        let emoji: string;
        
        if (reverse) {
            // For cash reserves - higher is better
            if (value >= threshold) {
                status = 'GOOD';
                emoji = '🟢';
            } else if (value >= threshold * 0.75) {
                status = 'WARNING';
                emoji = '🟡';
            } else {
                status = 'CRITICAL';
                emoji = '🔴';
            }
        } else {
            // For exposure/drawdown - lower is better
            if (value <= threshold * 0.75) {
                status = 'GOOD';
                emoji = '🟢';
            } else if (value <= threshold) {
                status = 'WARNING';
                emoji = '🟡';
            } else {
                status = 'CRITICAL';
                emoji = '🔴';
            }
        }
        
        const bar = this.createProgressBar(value, threshold, reverse);
        console.log(`${label.padEnd(18)} ${bar} ${percentage.toFixed(1)}% ${emoji} ${status}`);
    }
    
    private createProgressBar(value: number, threshold: number, reverse: boolean = false): string {
        const barLength = 20;
        const filledLength = Math.min(Math.round((value / (threshold * 1.2)) * barLength), barLength);
        
        let bar = '';
        for (let i = 0; i < barLength; i++) {
            if (i < filledLength) {
                if (reverse) {
                    bar += value >= threshold ? '█' : '▓';
                } else {
                    bar += value <= threshold * 0.75 ? '█' : value <= threshold ? '▓' : '▒';
                }
            } else {
                bar += '░';
            }
        }
        
        return `[${bar}]`;
    }
    
    // Public API Methods
    
    async triggerEmergencyStop(reason: string): Promise<void> {
        console.log(`🚨 Manual emergency stop triggered: ${reason}`);
        await this.riskManager.manualEmergencyStop(reason);
    }
    
    async resetEmergencyStop(): Promise<boolean> {
        console.log('🔄 Attempting to reset emergency stop...');
        const success = await this.riskManager.resetEmergencyStop('CONFIRM_RESET_EMERGENCY_STOP');
        
        if (success) {
            console.log('✅ Emergency stop reset successfully');
        } else {
            console.log('❌ Failed to reset emergency stop');
        }
        
        return success;
    }
    
    async runRiskTests(): Promise<void> {
        console.log('🧪 Running risk management tests...');
        
        // Import and run the test suite
        try {
            const { runRiskManagerTests } = await import('./test-risk-manager');
            await runRiskManagerTests();
        } catch (error) {
            console.error('❌ Failed to run risk tests:', error);
        }
    }
    
    getConfiguration(): DashboardConfig {
        return { ...this.config };
    }
    
    updateConfiguration(newConfig: Partial<DashboardConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Dashboard configuration updated');
    }
}

// Command line interface
async function startProductionDashboard(): Promise<void> {
    const dashboard = new ProductionRiskDashboard();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down Risk Management Dashboard...');
        await dashboard.stop();
        process.exit(0);
    });
    
    // Handle keyboard input for controls
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', async (key) => {
        const input = key.toString().toLowerCase();
        
        switch (input) {
            case '\u0003': // Ctrl+C
                console.log('\n🛑 Shutting down...');
                await dashboard.stop();
                process.exit(0);
                break;
                
            case 'e':
                await dashboard.triggerEmergencyStop('Manual emergency stop from dashboard');
                break;
                
            case 'r':
                await dashboard.resetEmergencyStop();
                break;
                
            case 't':
                await dashboard.runRiskTests();
                break;
                
            case 's':
                // Show detailed statistics
                console.log('📊 Detailed statistics feature coming soon...');
                break;
        }
    });
    
    try {
        await dashboard.start();
        
        // Keep the process running
        await new Promise(() => {}); // Run indefinitely
        
    } catch (error) {
        console.error('❌ Failed to start dashboard:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    startProductionDashboard().catch(console.error);
}

export { ProductionRiskDashboard, startProductionDashboard }; 
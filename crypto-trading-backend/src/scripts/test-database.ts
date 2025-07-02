import * as dotenv from 'dotenv';
import { SupabaseService } from '../database/supabase-client';
import { GridStateManager } from '../services/grid-management/GridStateManager';

// Load environment variables from .env file
dotenv.config();

async function testDatabaseConnection() {
    console.log('🔄 Testing Supabase Database Connection...');
    
    try {
        const supabaseService = new SupabaseService();
        
        // Test basic connection
        const connectionTest = await supabaseService.testConnection();
        if (!connectionTest) {
            throw new Error('Database connection test failed');
        }
        
        console.log('✅ Database connection successful');
        return supabaseService;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
}

async function testPositionOperations(supabaseService: SupabaseService) {
    console.log('🔄 Testing Position Operations...');
    
    try {
        // Create a test position
        const testPosition = await supabaseService.createPosition({
            trading_pair: 'USDCUSD',
            entry_price: 1.0001,
            current_price: 1.0001,
            size: 100,
            side: 'LONG',
            status: 'OPEN',
            entry_time: new Date(),
            strategy_type: 'STABLE_COIN_GRID',
            grid_level: 5,
            stop_loss: 0.9501,
            take_profit: 1.0201
        });
        
        console.log('✅ Position created:', testPosition.id);
        
        // Update the position
        const updatedPosition = await supabaseService.updatePosition(testPosition.id, {
            current_price: 1.0021,
            unrealized_pnl: 2.0
        });
        
        console.log('✅ Position updated:', updatedPosition.id);
        
        // Get active positions
        const activePositions = await supabaseService.getActivePositions('USDCUSD');
        console.log('✅ Active positions retrieved:', activePositions.length);
        
        return testPosition.id;
    } catch (error) {
        console.error('❌ Position operations failed:', error);
        throw error;
    }
}

async function testGridStateOperations(supabaseService: SupabaseService) {
    console.log('🔄 Testing Grid State Operations...');
    
    try {
        // Create grid state
        const gridState = await supabaseService.createGridState({
            trading_pair: 'USDCUSD',
            current_price: 1.0001,
            grid_upper_bound: 1.0201,
            grid_lower_bound: 0.9801,
            grid_spacing: 0.002,
            total_grid_levels: 20,
            active_buy_orders: 10,
            active_sell_orders: 10,
            total_invested: 1000,
            current_profit: 0,
            last_rebalance_time: new Date()
        });
        
        console.log('✅ Grid state created:', gridState.id);
        
        // Update grid state
        const updatedGridState = await supabaseService.updateGridState('USDCUSD', {
            current_price: 1.0011,
            current_profit: 10.5,
            active_buy_orders: 9,
            active_sell_orders: 11
        });
        
        console.log('✅ Grid state updated:', updatedGridState.id);
        
        // Get grid state
        const retrievedGridState = await supabaseService.getGridState('USDCUSD');
        console.log('✅ Grid state retrieved:', retrievedGridState?.id);
        
        return gridState.id;
    } catch (error) {
        console.error('❌ Grid state operations failed:', error);
        throw error;
    }
}

async function testTradingRulesConfig(supabaseService: SupabaseService) {
    console.log('🔄 Testing Trading Rules Configuration...');
    
    try {
        // Create trading rules config
        const config = await supabaseService.createTradingRulesConfig({
            trading_pair: 'USDCUSD',
            strategy_type: 'STABLE_COIN_GRID',
            market_condition: 'SIDEWAYS',
            max_position_size: 0.05,
            profit_threshold: 0.02,
            stop_loss_threshold: 0.05,
            reinvestment_percentage: 0.70,
            grid_levels: 20,
            grid_spacing: 0.002,
            technical_confirmation_required: false
        });
        
        console.log('✅ Trading rules config created:', config.id);
        
        // Get trading rules config
        const retrievedConfig = await supabaseService.getTradingRulesConfig(
            'USDCUSD',
            'STABLE_COIN_GRID',
            'SIDEWAYS'
        );
        
        console.log('✅ Trading rules config retrieved:', retrievedConfig?.id);
        
        return config.id;
    } catch (error) {
        console.error('❌ Trading rules config operations failed:', error);
        throw error;
    }
}

async function testPerformanceMetrics(supabaseService: SupabaseService) {
    console.log('🔄 Testing Performance Metrics...');
    
    try {
        // Record performance metrics
        const metrics = await supabaseService.recordPerformanceMetrics({
            trading_pair: 'USDCUSD',
            timestamp: new Date(),
            total_trades: 10,
            winning_trades: 7,
            losing_trades: 3,
            win_rate: 70.0,
            average_profit: 2.5,
            average_loss: -1.2,
            profit_factor: 2.08,
            max_drawdown: 5.5,
            sharpe_ratio: 1.8,
            sortino_ratio: 2.1,
            total_pnl: 15.5,
            strategy_type: 'STABLE_COIN_GRID'
        });
        
        console.log('✅ Performance metrics recorded:', metrics.id);
        
        return metrics.id;
    } catch (error) {
        console.error('❌ Performance metrics operations failed:', error);
        throw error;
    }
}

async function testMarketData(supabaseService: SupabaseService) {
    console.log('🔄 Testing Market Data Operations...');
    
    try {
        // Store market data
        const marketData = await supabaseService.storeMarketData({
            trading_pair: 'USDCUSD',
            timestamp: new Date(),
            open: 1.0000,
            high: 1.0025,
            low: 0.9985,
            close: 1.0015,
            volume: 1000000,
            vwap: 1.0010,
            rsi_14: 55.5,
            macd: 0.0005,
            macd_signal: 0.0003,
            macd_histogram: 0.0002,
            bollinger_upper: 1.0030,
            bollinger_middle: 1.0010,
            bollinger_lower: 0.9990,
            atr_14: 0.0020
        });
        
        console.log('✅ Market data stored:', marketData.id);
        
        // Get latest market data
        const latestData = await supabaseService.getLatestMarketData('USDCUSD', 5);
        console.log('✅ Latest market data retrieved:', latestData.length, 'records');
        
        return marketData.id;
    } catch (error) {
        console.error('❌ Market data operations failed:', error);
        throw error;
    }
}

async function testGridStateManager() {
    console.log('🔄 Testing Grid State Manager...');
    
    try {
        const gridManager = new GridStateManager();
        
        // Initialize grid state
        const gridState = await gridManager.initializeGridState('USDTUSD', 1.0000, {
            gridRange: 0.02,
            gridLevels: 20,
            baseOrderSize: 50
        });
        
        console.log('✅ Grid state initialized:', gridState.tradingPair);
        
        // Load grid state
        const loadedState = await gridManager.loadGridState('USDTUSD');
        console.log('✅ Grid state loaded:', loadedState?.tradingPair);
        
        // Update grid state
        await gridManager.updateGridState('USDTUSD', {
            currentPrice: 1.0010,
            totalInvested: 1000,
            currentProfit: 5.0
        });
        
        console.log('✅ Grid state updated successfully');
        
        return true;
    } catch (error) {
        console.error('❌ Grid State Manager test failed:', error);
        throw error;
    }
}

async function cleanupTestData(supabaseService: SupabaseService, testIds: {
    positionId?: string;
    gridStateId?: string;
    configId?: string;
    metricsId?: string;
    marketDataId?: string;
}) {
    console.log('🔄 Cleaning up test data...');
    
    try {
        // Note: In a real cleanup, you'd delete the test records
        // For now, we'll just log that cleanup would happen here
        console.log('✅ Test data cleanup completed (simulated)');
        console.log('Test IDs that would be cleaned:', testIds);
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    }
}

async function runDatabaseTests() {
    console.log('🚀 Starting Database Tests...\n');
    
    const testIds: any = {};
    
    try {
        // Test database connection
        const supabaseService = await testDatabaseConnection();
        console.log('');
        
        // Test position operations
        testIds.positionId = await testPositionOperations(supabaseService);
        console.log('');
        
        // Test grid state operations
        testIds.gridStateId = await testGridStateOperations(supabaseService);
        console.log('');
        
        // Test trading rules configuration
        testIds.configId = await testTradingRulesConfig(supabaseService);
        console.log('');
        
        // Test performance metrics
        testIds.metricsId = await testPerformanceMetrics(supabaseService);
        console.log('');
        
        // Test market data operations
        testIds.marketDataId = await testMarketData(supabaseService);
        console.log('');
        
        // Test Grid State Manager
        await testGridStateManager();
        console.log('');
        
        // Cleanup test data
        await cleanupTestData(supabaseService, testIds);
        console.log('');
        
        console.log('🎉 All database tests completed successfully!');
        console.log('✅ Database is ready for production use');
        
    } catch (error) {
        console.error('💥 Database tests failed:', error);
        console.log('\n❌ Database is NOT ready for production');
        console.log('Please check your Supabase configuration and try again.');
        process.exit(1);
    }
}

// Run the tests if this script is executed directly
if (require.main === module) {
    runDatabaseTests().catch(console.error);
}

export { runDatabaseTests }; 
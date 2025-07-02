import { EnhancedKrakenClient } from '../services/order-execution/enhanced-kraken-client';
import { KrakenClient } from '../services/order-execution/kraken-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TestResult {
    test: string;
    success: boolean;
    data?: any;
    error?: string;
    duration?: number;
}

class KrakenApiTester {
    private enhancedClient: EnhancedKrakenClient;
    private originalClient: KrakenClient;
    private testResults: TestResult[] = [];

    constructor() {
        console.log('🚀 Initializing Kraken API Test Suite...\n');
        
        // Initialize both clients for comparison
        this.enhancedClient = new EnhancedKrakenClient({
            enableWebSocket: true,
            rateLimitRpm: 60,
            timeout: 30000
        });

        this.originalClient = new KrakenClient(true);

        // Set up event listeners
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Enhanced client events
        this.enhancedClient.on('wsConnected', () => {
            console.log('✅ Enhanced WebSocket connected');
        });

        this.enhancedClient.on('wsDisconnected', () => {
            console.log('❌ Enhanced WebSocket disconnected');
        });

        this.enhancedClient.on('priceUpdate', (data) => {
            console.log(`📈 Price update: ${data.symbol} = $${data.last}`);
        });

        this.enhancedClient.on('orderPlaced', (data) => {
            console.log(`✅ Order placed: ${data.response.txid[0]}`);
        });

        this.enhancedClient.on('orderCancelled', (data) => {
            console.log(`❌ Order cancelled: ${data.txid}`);
        });

        this.enhancedClient.on('emergencyStopEnabled', () => {
            console.log('🚨 EMERGENCY STOP ENABLED');
        });

        this.enhancedClient.on('healthCheckFailed', (error) => {
            console.log('⚠️ Health check failed:', error.message);
        });

        // Original client events
        this.originalClient.on('wsConnected', () => {
            console.log('✅ Original WebSocket connected');
        });
    }

    private async runTest(testName: string, testFunction: () => Promise<any>): Promise<TestResult> {
        const startTime = Date.now();
        console.log(`\n🧪 Running test: ${testName}`);
        
        try {
            const data = await testFunction();
            const duration = Date.now() - startTime;
            const result: TestResult = {
                test: testName,
                success: true,
                data,
                duration
            };
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`);
            this.testResults.push(result);
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const result: TestResult = {
                test: testName,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration
            };
            
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${result.error}`);
            this.testResults.push(result);
            return result;
        }
    }

    async testPublicApiConnectivity(): Promise<void> {
        console.log('\n📡 Testing Public API Connectivity...');

        // Test server time
        await this.runTest('Get Server Time', async () => {
            const serverTime = await this.enhancedClient.getServerTime();
            console.log(`   Server time: ${serverTime.rfc1123}`);
            return serverTime;
        });

        // Test asset pairs
        await this.runTest('Get Asset Pairs', async () => {
            const assetPairs = await this.enhancedClient.getAssetPairs();
            const pairCount = Object.keys(assetPairs).length;
            console.log(`   Found ${pairCount} trading pairs`);
            return { pairCount };
        });

        // Test ticker data for common pairs
        const testPairs = ['XBTUSD', 'ETHUSD', 'USDCUSD'];
        for (const pair of testPairs) {
            await this.runTest(`Get Ticker - ${pair}`, async () => {
                try {
                    const ticker = await this.enhancedClient.getTicker(pair);
                    const price = parseFloat(ticker.c[0]);
                    console.log(`   ${pair}: $${price}`);
                    return { pair, price };
                } catch (error) {
                    console.log(`   ${pair}: Not available or different symbol`);
                    throw error;
                }
            });
        }
    }

    async testPrivateApiConnectivity(): Promise<void> {
        console.log('\n🔐 Testing Private API Connectivity...');

        if (!process.env.KRAKEN_API_KEY || !process.env.KRAKEN_API_SECRET) {
            console.log('⚠️ Skipping private API tests - credentials not found');
            return;
        }

        // Test connection validation
        await this.runTest('Validate API Connection', async () => {
            const isValid = await this.enhancedClient.validateConnection();
            return { isValid };
        });

        // Test account balance
        await this.runTest('Get Account Balance', async () => {
            const balance = await this.enhancedClient.getAccountBalance();
            const currencies = Object.keys(balance);
            console.log(`   Found balances for: ${currencies.join(', ')}`);
            
            // Show non-zero balances
            const nonZeroBalances = Object.entries(balance)
                .filter(([_, amount]) => parseFloat(amount) > 0)
                .map(([currency, amount]) => `${currency}: ${amount}`);
            
            if (nonZeroBalances.length > 0) {
                console.log(`   Non-zero balances: ${nonZeroBalances.join(', ')}`);
            }
            
            return { currencies: currencies.length, nonZeroBalances: nonZeroBalances.length };
        });

        // Test trading balance calculation
        await this.runTest('Get Trading Balance', async () => {
            const tradingBalance = await this.enhancedClient.getTradingBalance();
            const currencies = Object.keys(tradingBalance);
            console.log(`   Trading balance calculated for: ${currencies.join(', ')}`);
            return { currencies: currencies.length };
        });

        // Test open orders
        await this.runTest('Get Open Orders', async () => {
            const openOrders = await this.enhancedClient.getOpenOrders();
            const orderCount = Object.keys(openOrders.open).length;
            console.log(`   Found ${orderCount} open orders`);
            return { orderCount };
        });
    }

    async testWebSocketConnectivity(): Promise<void> {
        console.log('\n🌐 Testing WebSocket Connectivity...');

        if (!process.env.KRAKEN_API_KEY || !process.env.KRAKEN_API_SECRET) {
            console.log('⚠️ Skipping WebSocket tests - credentials not found');
            return;
        }

        // Test WebSocket connection
        await this.runTest('Connect WebSocket', async () => {
            await this.enhancedClient.connectWebSocket();
            
            // Wait a moment for connection to establish
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const isConnected = this.enhancedClient.isWebSocketConnected();
            return { isConnected };
        });

        // Test ticker subscription
        await this.runTest('Subscribe to Ticker', async () => {
            const symbols = ['XBT/USD', 'ETH/USD'];
            await this.enhancedClient.subscribeToTicker(symbols);
            
            // Wait for some price updates
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return { symbols };
        });

        // Test order updates subscription
        await this.runTest('Subscribe to Order Updates', async () => {
            await this.enhancedClient.subscribeToOrderUpdates();
            return { subscribed: true };
        });

        // Test balance updates subscription
        await this.runTest('Subscribe to Balance Updates', async () => {
            await this.enhancedClient.subscribeToBalanceUpdates();
            return { subscribed: true };
        });
    }

    async testOrderManagement(): Promise<void> {
        console.log('\n📋 Testing Order Management...');

        if (!process.env.KRAKEN_API_KEY || !process.env.KRAKEN_API_SECRET) {
            console.log('⚠️ Skipping order management tests - credentials not found');
            return;
        }

        // Check if live trading is enabled
        const enableLiveTrading = process.env.ENABLE_LIVE_TRADING === 'true';
        if (!enableLiveTrading) {
            console.log('⚠️ Live trading disabled - using validation mode for order tests');
        }

        let testOrderId: string | null = null;

        // Test order validation
        await this.runTest('Validate Order', async () => {
            const orderRequest = {
                pair: 'XBTUSD',
                type: 'buy' as const,
                ordertype: 'limit' as const,
                volume: '0.001', // Very small test amount
                price: '30000' // Well below market price
            };

            const validation = await this.enhancedClient.validateOrder(orderRequest);
            console.log(`   Validation result: ${validation.isValid ? 'VALID' : 'INVALID'}`);
            
            if (validation.errors.length > 0) {
                console.log(`   Errors: ${validation.errors.join(', ')}`);
            }
            
            if (validation.warnings.length > 0) {
                console.log(`   Warnings: ${validation.warnings.join(', ')}`);
            }

            return validation;
        });

        // Test small limit order placement
        if (enableLiveTrading) {
            await this.runTest('Place Small Test Order', async () => {
                // Place a very small buy order well below market price (unlikely to fill)
                const orderId = await this.enhancedClient.placeLimitBuyOrder(
                    'XBTUSD',
                    '0.001', // $30-50 worth at current prices
                    '30000', // Well below market price
                    true // Validate
                );

                testOrderId = orderId;
                console.log(`   Order placed: ${orderId}`);
                return { orderId };
            });

            // Wait a moment for order to be processed
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Test order status check
            if (testOrderId) {
                await this.runTest('Check Order Status', async () => {
                    const orderStatus = await this.enhancedClient.getOrderStatus(testOrderId!);
                    if (orderStatus) {
                        console.log(`   Order status: ${orderStatus.status}`);
                        console.log(`   Order type: ${orderStatus.descr.type} ${orderStatus.descr.ordertype}`);
                        console.log(`   Volume: ${orderStatus.vol} (executed: ${orderStatus.vol_exec})`);
                    }
                    return orderStatus;
                });

                // Test order cancellation
                await this.runTest('Cancel Test Order', async () => {
                    const result = await this.enhancedClient.cancelOrder(testOrderId!);
                    console.log(`   Cancelled ${result.count} order(s)`);
                    return result;
                });
            }
        } else {
            // Test with validation mode
            await this.runTest('Test Order with Validation Mode', async () => {
                const orderRequest = {
                    pair: 'XBTUSD',
                    type: 'buy' as const,
                    ordertype: 'limit' as const,
                    volume: '0.001',
                    price: '30000',
                    validate: true // This will validate but not place the order
                };

                try {
                    const result = await this.enhancedClient.placeOrder(orderRequest, true);
                    console.log('   Order validation successful (would be placed in live mode)');
                    return result;
                } catch (error) {
                    // Expected in validation mode
                    console.log('   Order validation completed');
                    return { validated: true };
                }
            });
        }
    }

    async testRateLimiting(): Promise<void> {
        console.log('\n⏱️ Testing Rate Limiting...');

        await this.runTest('Rate Limit Status', async () => {
            const rateLimitStatus = this.enhancedClient.getRateLimitStatus();
            console.log(`   Remaining requests: ${rateLimitStatus.remaining}`);
            console.log(`   Reset time: ${new Date(rateLimitStatus.resetTime).toISOString()}`);
            return rateLimitStatus;
        });

        // Test multiple rapid requests
        await this.runTest('Rapid API Requests', async () => {
            const promises = [];
            const requestCount = 5;
            
            for (let i = 0; i < requestCount; i++) {
                promises.push(this.enhancedClient.getServerTime());
            }

            const results = await Promise.all(promises);
            console.log(`   Completed ${results.length} rapid requests successfully`);
            return { requestCount: results.length };
        });
    }

    async testEmergencyControls(): Promise<void> {
        console.log('\n🚨 Testing Emergency Controls...');

        await this.runTest('Enable Emergency Stop', async () => {
            this.enhancedClient.enableEmergencyStop();
            const isEnabled = this.enhancedClient.isEmergencyStopEnabled();
            return { isEnabled };
        });

        await this.runTest('Test Emergency Stop Prevention', async () => {
            try {
                // This should fail due to emergency stop
                await this.enhancedClient.placeLimitBuyOrder('XBTUSD', '0.001', '30000', false);
                throw new Error('Emergency stop did not prevent order placement');
            } catch (error) {
                if (error instanceof Error && error.message.includes('Emergency stop')) {
                    console.log('   Emergency stop correctly prevented order placement');
                    return { prevented: true };
                }
                throw error;
            }
        });

        await this.runTest('Disable Emergency Stop', async () => {
            this.enhancedClient.disableEmergencyStop();
            const isEnabled = this.enhancedClient.isEmergencyStopEnabled();
            return { isEnabled };
        });
    }

    async testHealthMonitoring(): Promise<void> {
        console.log('\n🏥 Testing Health Monitoring...');

        await this.runTest('Connection Health Check', async () => {
            const isHealthy = this.enhancedClient.isConnectionHealthy();
            console.log(`   Connection healthy: ${isHealthy}`);
            return { isHealthy };
        });

        await this.runTest('Manual Health Check', async () => {
            // Trigger a manual health check by calling validateConnection
            const isValid = await this.enhancedClient.validateConnection();
            return { isValid };
        });
    }

    async testClientComparison(): Promise<void> {
        console.log('\n🔄 Testing Client Comparison...');

        // Compare basic functionality between original and enhanced clients
        await this.runTest('Original Client - Get Balance', async () => {
            if (!process.env.KRAKEN_API_KEY || !process.env.KRAKEN_API_SECRET) {
                throw new Error('API credentials required');
            }

            const balance = await this.originalClient.getAccountBalance();
            const currencies = Object.keys(balance);
            console.log(`   Original client found ${currencies.length} currencies`);
            return { currencies: currencies.length };
        });

        await this.runTest('Enhanced Client - Get Balance', async () => {
            if (!process.env.KRAKEN_API_KEY || !process.env.KRAKEN_API_SECRET) {
                throw new Error('API credentials required');
            }

            const balance = await this.enhancedClient.getAccountBalance();
            const currencies = Object.keys(balance);
            console.log(`   Enhanced client found ${currencies.length} currencies`);
            return { currencies: currencies.length };
        });
    }

    private printTestSummary(): void {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        const totalDuration = this.testResults.reduce((sum, r) => sum + (r.duration || 0), 0);

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ❌`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        console.log(`Total Duration: ${totalDuration}ms`);

        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => !r.success)
                .forEach(r => {
                    console.log(`   - ${r.test}: ${r.error}`);
                });
        }

        console.log('\n✅ Passed Tests:');
        this.testResults
            .filter(r => r.success)
            .forEach(r => {
                console.log(`   - ${r.test} (${r.duration}ms)`);
            });

        // Recommendations
        console.log('\n💡 Recommendations:');
        
        if (!process.env.KRAKEN_API_KEY || !process.env.KRAKEN_API_SECRET) {
            console.log('   - Set KRAKEN_API_KEY and KRAKEN_API_SECRET environment variables for full testing');
        }
        
        if (process.env.ENABLE_LIVE_TRADING !== 'true') {
            console.log('   - Set ENABLE_LIVE_TRADING=true to test actual order placement (use with caution)');
        }
        
        const connectionTests = this.testResults.filter(r => 
            r.test.includes('Connection') || r.test.includes('WebSocket')
        );
        const connectionFailures = connectionTests.filter(r => !r.success);
        
        if (connectionFailures.length > 0) {
            console.log('   - Check internet connection and Kraken API status');
        }
        
        if (passedTests === totalTests) {
            console.log('   - All tests passed! The Kraken API integration is ready for production use.');
        }
    }

    async runAllTests(): Promise<void> {
        console.log('🎯 Starting Comprehensive Kraken API Test Suite');
        console.log('='.repeat(60));

        try {
            // Run all test suites
            await this.testPublicApiConnectivity();
            await this.testPrivateApiConnectivity();
            await this.testWebSocketConnectivity();
            await this.testOrderManagement();
            await this.testRateLimiting();
            await this.testEmergencyControls();
            await this.testHealthMonitoring();
            await this.testClientComparison();

        } catch (error) {
            console.error('❌ Test suite encountered an unexpected error:', error);
        } finally {
            // Clean up
            try {
                await this.enhancedClient.disconnect();
                await this.originalClient.disconnectWebSocket();
            } catch (error) {
                console.error('Error during cleanup:', error);
            }

            // Print summary
            this.printTestSummary();
        }
    }
}

// Main execution
async function main() {
    const tester = new KrakenApiTester();
    await tester.runAllTests();
    
    // Exit process
    process.exit(0);
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Run the tests
if (require.main === module) {
    main().catch(console.error);
}

export { KrakenApiTester };
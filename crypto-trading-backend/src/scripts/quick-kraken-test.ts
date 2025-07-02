import { EnhancedKrakenClient } from '../services/order-execution/enhanced-kraken-client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function quickKrakenTest() {
    console.log('🚀 Quick Kraken API Test Starting...\n');

    // Initialize enhanced client
    const client = new EnhancedKrakenClient({
        enableWebSocket: false, // Disable WebSocket for quick test
        rateLimitRpm: 60,
        timeout: 30000
    });

    try {
        // Test 1: Public API - Server Time
        console.log('📡 Testing Public API...');
        const serverTime = await client.getServerTime();
        console.log(`✅ Server Time: ${serverTime.rfc1123}`);

        // Test 2: Public API - Asset Pairs
        const assetPairs = await client.getAssetPairs();
        const pairCount = Object.keys(assetPairs).length;
        console.log(`✅ Asset Pairs: Found ${pairCount} trading pairs`);

        // Test 3: Public API - Ticker Data
        try {
            const ticker = await client.getTicker('XBTUSD');
            const price = parseFloat(ticker.c[0]);
            console.log(`✅ BTC Price: $${price.toLocaleString()}`);
        } catch (error) {
            console.log('⚠️ BTC ticker not available with XBTUSD symbol');
        }

        // Test 4: Private API (if credentials available)
        if (process.env.KRAKEN_API_KEY && process.env.KRAKEN_API_SECRET) {
            console.log('\n🔐 Testing Private API...');
            
            // Validate connection
            const isValid = await client.validateConnection();
            console.log(`✅ API Connection Valid: ${isValid}`);

            if (isValid) {
                // Get account balance
                const balance = await client.getAccountBalance();
                const currencies = Object.keys(balance);
                console.log(`✅ Account Balance: ${currencies.length} currencies`);

                // Show non-zero balances
                const nonZeroBalances = Object.entries(balance)
                    .filter(([_, amount]) => parseFloat(amount) > 0)
                    .map(([currency, amount]) => `${currency}: ${parseFloat(amount).toFixed(8)}`);

                if (nonZeroBalances.length > 0) {
                    console.log(`💰 Non-zero balances:`);
                    nonZeroBalances.forEach(balance => console.log(`   ${balance}`));
                } else {
                    console.log('💰 No non-zero balances found');
                }

                // Get open orders
                const openOrders = await client.getOpenOrders();
                const orderCount = Object.keys(openOrders.open).length;
                console.log(`✅ Open Orders: ${orderCount} orders`);

                // Test order validation (without placing)
                console.log('\n📋 Testing Order Validation...');
                const testOrder = {
                    pair: 'XBTUSD',
                    type: 'buy' as const,
                    ordertype: 'limit' as const,
                    volume: '0.001', // Small test amount
                    price: '30000'   // Well below market
                };

                const validation = await client.validateOrder(testOrder);
                console.log(`✅ Order Validation: ${validation.isValid ? 'VALID' : 'INVALID'}`);
                
                if (validation.errors.length > 0) {
                    console.log(`   Errors: ${validation.errors.join(', ')}`);
                }
                
                if (validation.warnings.length > 0) {
                    console.log(`   Warnings: ${validation.warnings.join(', ')}`);
                }

                // Test emergency controls
                console.log('\n🚨 Testing Emergency Controls...');
                client.enableEmergencyStop();
                console.log(`✅ Emergency Stop Enabled: ${client.isEmergencyStopEnabled()}`);
                
                try {
                    await client.placeLimitBuyOrder('XBTUSD', '0.001', '30000', false);
                    console.log('❌ Emergency stop failed to prevent order');
                } catch (error) {
                    if (error instanceof Error && error.message.includes('Emergency stop')) {
                        console.log('✅ Emergency stop correctly prevented order');
                    } else {
                        console.log(`❌ Unexpected error: ${error.message}`);
                    }
                }
                
                client.disableEmergencyStop();
                console.log(`✅ Emergency Stop Disabled: ${!client.isEmergencyStopEnabled()}`);

                // Rate limit status
                const rateLimitStatus = client.getRateLimitStatus();
                console.log(`✅ Rate Limit: ${rateLimitStatus.remaining} requests remaining`);
            }
        } else {
            console.log('\n⚠️ Skipping private API tests - KRAKEN_API_KEY and KRAKEN_API_SECRET not found');
            console.log('   To test private API features, add your Kraken API credentials to .env file');
        }

        console.log('\n🎉 Quick test completed successfully!');
        
        // Recommendations
        console.log('\n💡 Next Steps:');
        console.log('   1. Add your Kraken API credentials to test private features');
        console.log('   2. Set ENABLE_LIVE_TRADING=true to test actual order placement');
        console.log('   3. Run the full test suite with: npm run test:kraken');
        console.log('   4. Start with small amounts when testing live trading');

    } catch (error) {
        console.error('❌ Test failed:', error);
        
        if (error instanceof Error) {
            if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
                console.log('💡 Check your internet connection and try again');
            } else if (error.message.includes('Invalid key')) {
                console.log('💡 Check your Kraken API credentials');
            } else if (error.message.includes('Rate limit')) {
                console.log('💡 Rate limit exceeded, wait a moment and try again');
            }
        }
    } finally {
        // Cleanup
        await client.disconnect();
    }
}

// Run the test
if (require.main === module) {
    quickKrakenTest().catch(console.error);
}

export { quickKrakenTest }; 
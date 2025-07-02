const { PaperTradingClient } = require('./dist/services/order-execution/paper-trading-client');

async function testPaperTrading() {
    console.log('🧪 Testing Paper Trading System...');
    
    const client = new PaperTradingClient({
        apiKey: 'test',
        apiSecret: 'test',
        timeout: 30000,
        enableWebSocket: false
    });
    
    console.log('\n📊 Initial Balance:');
    const initialBalance = await client.getAccountBalance();
    console.log(JSON.stringify(initialBalance, null, 2));
    
    console.log('\n🛒 Executing test BUY order...');
    try {
        const buyOrder = await client.placeOrder({
            pair: 'XBTUSD',
            type: 'buy',
            ordertype: 'market',
            volume: '0.001',
            validate: false
        });
        console.log('✅ Buy Order Result:', buyOrder);
    } catch (error) {
        console.error('❌ Buy Order Failed:', error.message);
    }
    
    console.log('\n📊 Balance After Buy:');
    const balanceAfterBuy = await client.getAccountBalance();
    console.log(JSON.stringify(balanceAfterBuy, null, 2));
    
    console.log('\n💰 Portfolio Value:');
    const portfolioValue = await client.getPaperPortfolioValue();
    console.log(`Total Portfolio Value: $${portfolioValue.toFixed(2)}`);
    
    console.log('\n📈 Trading Stats:');
    const stats = client.getPaperTradingStats();
    console.log(JSON.stringify(stats, null, 2));
}

testPaperTrading().catch(console.error);
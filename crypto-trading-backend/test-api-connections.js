require('dotenv').config();
const crypto = require('crypto');
const https = require('https');

// =====================================================
// API CONNECTION TEST SCRIPT
// =====================================================

console.log('🚀 Testing Exchange API Connections...');
console.log('='.repeat(50));

// Test Binance.US API
async function testBinanceUS() {
  console.log('\n📡 Testing Binance.US API...');
  
  const apiKey = process.env.BINANCE_US_API_KEY;
  const apiSecret = process.env.BINANCE_US_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.log('❌ Binance.US API credentials not found in .env file');
    return false;
  }
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`);
  
  try {
    // Test server time (public endpoint)
    const timeResponse = await fetch('https://api.binance.us/api/v3/time');
    const timeData = await timeResponse.json();
    console.log('✅ Binance.US server time:', new Date(timeData.serverTime).toISOString());
    
    // Test authenticated endpoint - account info
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');
    
    const accountResponse = await fetch(
      `https://api.binance.us/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey
        }
      }
    );
    
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      console.log('✅ Binance.US authentication successful');
      console.log(`🏦 Account type: ${accountData.accountType}`);
      console.log(`💰 Balances available: ${accountData.balances?.length || 0} currencies`);
      return true;
    } else {
      const errorData = await accountResponse.json();
      console.log('❌ Binance.US authentication failed:', errorData.msg || accountResponse.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ Binance.US connection error:', error.message);
    return false;
  }
}

// Test Coinbase Advanced API
async function testCoinbaseAdvanced() {
  console.log('\n📡 Testing Coinbase Advanced API...');
  
  const apiKey = process.env.COINBASE_ADVANCED_API_KEY;
  const apiSecret = process.env.COINBASE_ADVANCED_API_SECRET;
  const passphrase = process.env.COINBASE_ADVANCED_PASSPHRASE || '';
  
  if (!apiKey || !apiSecret) {
    console.log('❌ Coinbase Advanced API credentials not found in .env file');
    return false;
  }
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`);
  console.log(`🔒 Passphrase: ${passphrase ? 'Provided' : 'Not provided (may cause issues)'}`);
  
  try {
    // Test server time (public endpoint)
    const timeResponse = await fetch('https://api.exchange.coinbase.com/time');
    const timeData = await timeResponse.json();
    console.log('✅ Coinbase server time:', timeData.iso);
    
    // Test authenticated endpoint - accounts
    const timestamp = (Date.now() / 1000).toString();
    const method = 'GET';
    const requestPath = '/accounts';
    const body = '';
    
    const message = timestamp + method + requestPath + body;
    const key = Buffer.from(apiSecret, 'base64');
    const signature = crypto.createHmac('sha256', key).update(message).digest('base64');
    
    const headers = {
      'CB-ACCESS-KEY': apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    };
    
    if (passphrase) {
      headers['CB-ACCESS-PASSPHRASE'] = passphrase;
    }
    
    const accountResponse = await fetch(
      `https://api.exchange.coinbase.com${requestPath}`,
      { headers }
    );
    
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      console.log('✅ Coinbase Advanced authentication successful');
      console.log(`🏦 Accounts found: ${accountData.length}`);
      
      // Show some account info (without sensitive data)
      const nonZeroBalances = accountData.filter(acc => parseFloat(acc.balance) > 0);
      console.log(`💰 Accounts with balance: ${nonZeroBalances.length}`);
      
      if (nonZeroBalances.length > 0) {
        console.log('📊 Sample balances:');
        nonZeroBalances.slice(0, 3).forEach(acc => {
          console.log(`   ${acc.currency}: ${parseFloat(acc.balance).toFixed(8)}`);
        });
      }
      
      return true;
    } else {
      const errorData = await accountResponse.json().catch(() => ({}));
      console.log('❌ Coinbase Advanced authentication failed:', errorData.message || accountResponse.statusText);
      
      if (!passphrase) {
        console.log('💡 Tip: You may need to provide COINBASE_ADVANCED_PASSPHRASE');
      }
      
      return false;
    }
  } catch (error) {
    console.log('❌ Coinbase Advanced connection error:', error.message);
    return false;
  }
}

// Test Kraken API (if credentials exist)
async function testKraken() {
  console.log('\n📡 Testing Kraken API...');
  
  const apiKey = process.env.KRAKEN_API_KEY;
  const apiSecret = process.env.KRAKEN_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.log('ℹ️  Kraken API credentials not found (this is OK - Kraken is for stable/alt coins)');
    return true;
  }
  
  console.log(`🔑 API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`);
  
  try {
    // Test server time (public endpoint)
    const timeResponse = await fetch('https://api.kraken.com/0/public/Time');
    const timeData = await timeResponse.json();
    console.log('✅ Kraken server time:', new Date(timeData.result.unixtime * 1000).toISOString());
    
    // Test authenticated endpoint - balance
    const nonce = Date.now() * 1000;
    const postData = `nonce=${nonce}`;
    const message = '/0/private/Balance' + crypto.createHash('sha256').update(nonce + postData).digest();
    const signature = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64')).update(message, 'latin1').digest('base64');
    
    const balanceResponse = await fetch('https://api.kraken.com/0/private/Balance', {
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postData
    });
    
    const balanceData = await balanceResponse.json();
    
    if (balanceData.error && balanceData.error.length === 0) {
      console.log('✅ Kraken authentication successful');
      const balances = Object.keys(balanceData.result || {});
      console.log(`💰 Currencies available: ${balances.length}`);
      return true;
    } else {
      console.log('❌ Kraken authentication failed:', balanceData.error?.[0] || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.log('❌ Kraken connection error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log(`📅 Test started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  const results = {
    binanceUS: await testBinanceUS(),
    coinbaseAdvanced: await testCoinbaseAdvanced(),
    kraken: await testKraken()
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`✅ Binance.US: ${results.binanceUS ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Coinbase Advanced: ${results.coinbaseAdvanced ? 'PASSED' : 'FAILED'}`);
  console.log(`ℹ️  Kraken: ${results.kraken ? 'PASSED' : 'FAILED'} (optional)`);
  
  console.log(`\n🎯 Success Rate: ${passedTests}/${totalTests} exchanges working`);
  
  if (results.binanceUS && results.coinbaseAdvanced) {
    console.log('\n🚀 EXCELLENT! Both meme coin trading APIs are working!');
    console.log('🎮 You can now start paper trading with:');
    console.log('   • Binance.US for meme coins (DOGE, SHIB, etc.)');
    console.log('   • Coinbase Advanced for additional meme coins');
    console.log('   • Kraken for stable/alt coin trading');
  } else {
    console.log('\n⚠️  Some APIs need attention before starting paper trading');
  }
  
  console.log(`\n📅 Test completed at: ${new Date().toISOString()}`);
}

// Run the tests
runAllTests().catch(console.error); 
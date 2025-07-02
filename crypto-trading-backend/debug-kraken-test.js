require('dotenv').config();
const crypto = require('crypto');

console.log('🔍 DEBUGGING KRAKEN API CONNECTION...');
console.log('=' .repeat(50));

const apiKey = process.env.KRAKEN_API_KEY;
const apiSecret = process.env.KRAKEN_API_SECRET;

console.log('API Key length:', apiKey ? apiKey.length : 'undefined');
console.log('API Secret length:', apiSecret ? apiSecret.length : 'undefined');
console.log('API Key preview:', apiKey ? apiKey.substring(0, 10) + '...' : 'undefined');

async function debugKrakenAuth() {
  if (!apiKey || !apiSecret) {
    console.log('❌ Missing Kraken credentials');
    return;
  }

  try {
    // Test 1: Server Time (public endpoint)
    console.log('\n📡 Testing Kraken public endpoint...');
    const timeResponse = await fetch('https://api.kraken.com/0/public/Time');
    const timeData = await timeResponse.json();
    
    if (timeData.error && timeData.error.length === 0) {
      console.log('✅ Kraken server connection successful');
      console.log('Server time:', new Date(timeData.result.unixtime * 1000).toISOString());
    } else {
      console.log('❌ Kraken server connection failed:', timeData.error);
      return;
    }

    // Test 2: Authentication with detailed error handling
    console.log('\n🔐 Testing Kraken authentication...');
    
    const nonce = Date.now() * 1000;
    const postData = `nonce=${nonce}`;
    
    console.log('Nonce:', nonce);
    console.log('Post data:', postData);
    
    // Create signature
    const path = '/0/private/Balance';
    const hash = crypto.createHash('sha256');
    const hmac = crypto.createHmac('sha512', Buffer.from(apiSecret, 'base64'));
    
    hash.update(nonce + postData);
    hmac.update(path + hash.digest(), 'latin1');
    const signature = hmac.digest('base64');
    
    console.log('Signature length:', signature.length);
    console.log('Signature preview:', signature.substring(0, 20) + '...');
    
    const headers = {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    console.log('Request headers prepared');
    
    const response = await fetch('https://api.kraken.com/0/private/Balance', {
      method: 'POST',
      headers: headers,
      body: postData
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.error && data.error.length === 0) {
      console.log('✅ Kraken authentication successful!');
      console.log('Account balances available:', Object.keys(data.result || {}).length);
    } else {
      console.log('❌ Kraken authentication failed');
      console.log('Error details:', data.error);
      
      // Common error diagnosis
      if (data.error && data.error.includes('EAPI:Invalid key')) {
        console.log('\n💡 DIAGNOSIS: Invalid API Key');
        console.log('   - Check if API key is correct');
        console.log('   - Ensure API key has the right permissions');
        console.log('   - Verify API key is enabled');
      }
      
      if (data.error && data.error.includes('EAPI:Invalid signature')) {
        console.log('\n💡 DIAGNOSIS: Invalid Signature');
        console.log('   - Check if API secret is correct');
        console.log('   - Verify base64 encoding of secret');
      }
      
      if (data.error && data.error.includes('EAPI:Invalid nonce')) {
        console.log('\n💡 DIAGNOSIS: Invalid Nonce');
        console.log('   - Nonce must be increasing');
        console.log('   - Check system time');
      }
    }
    
  } catch (error) {
    console.log('❌ Network or connection error:', error.message);
  }
}

// Also test if we can fix Coinbase without passphrase
async function testCoinbaseWithoutPassphrase() {
  console.log('\n\n🪙 TESTING COINBASE WITHOUT PASSPHRASE...');
  console.log('=' .repeat(50));
  
  const cbApiKey = process.env.COINBASE_ADVANCED_API_KEY;
  const cbApiSecret = process.env.COINBASE_ADVANCED_API_SECRET;
  
  if (!cbApiKey || !cbApiSecret) {
    console.log('❌ Missing Coinbase credentials');
    return;
  }
  
  try {
    // Try the newer Coinbase API endpoint
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const requestPath = '/api/v3/brokerage/accounts';
    const body = '';
    
    const message = timestamp + method + requestPath + body;
    const signature = crypto.createHmac('sha256', cbApiSecret).update(message).digest('hex');
    
    const headers = {
      'CB-ACCESS-KEY': cbApiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    };
    
    console.log('Trying Coinbase Advanced Trade API v3...');
    
    const response = await fetch(`https://api.coinbase.com${requestPath}`, {
      method: method,
      headers: headers
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Coinbase authentication successful (without passphrase)!');
      console.log('Accounts found:', data.accounts ? data.accounts.length : 'Unknown');
      return true;
    } else {
      const errorData = await response.text();
      console.log('❌ Coinbase v3 API failed:', errorData);
      
      // Try original API with empty passphrase
      console.log('\nTrying original API with empty passphrase...');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Coinbase connection error:', error.message);
    return false;
  }
}

async function runDiagnostics() {
  await debugKrakenAuth();
  await testCoinbaseWithoutPassphrase();
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎯 NEXT STEPS:');
  console.log('1. Check your Kraken API key permissions');
  console.log('2. Verify your Kraken API secret is correct');
  console.log('3. If issues persist, regenerate Kraken API keys');
  console.log('4. For Coinbase, we may need to use the v3 API');
}

runDiagnostics().catch(console.error); 
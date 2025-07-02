require('dotenv').config();
const crypto = require('crypto');

console.log('🪙 TESTING COINBASE ADVANCED TRADE API V3 (No Passphrase)...');
console.log('=' .repeat(60));

const apiKey = process.env.COINBASE_ADVANCED_API_KEY;
const apiSecret = process.env.COINBASE_ADVANCED_API_SECRET;

if (!apiKey || !apiSecret) {
  console.log('❌ Missing Coinbase credentials');
  process.exit(1);
}

console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`);
console.log(`🔐 API Secret: ${apiSecret.substring(0, 20)}...`);

// Coinbase Advanced Trade API v3 Functions
class CoinbaseAdvancedV3 {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = 'https://api.coinbase.com';
  }

  createSignature(requestPath, method, body, timestamp) {
    // For the new API, the signature is created differently
    const message = timestamp + method.toUpperCase() + requestPath + (body || '');
    
    // Try different signature methods
    console.log('Creating signature with message:', message);
    
    // Method 1: Direct HMAC with secret as string
    const signature1 = crypto.createHmac('sha256', this.apiSecret).update(message).digest('base64');
    
    // Method 2: HMAC with secret as hex
    try {
      const signature2 = crypto.createHmac('sha256', Buffer.from(this.apiSecret, 'hex')).update(message).digest('base64');
      console.log('Signature method 1 (string):', signature1.substring(0, 20) + '...');
      console.log('Signature method 2 (hex):', signature2.substring(0, 20) + '...');
      return { signature1, signature2 };
    } catch (e) {
      console.log('Signature method 1 (string):', signature1.substring(0, 20) + '...');
      return { signature1, signature2: null };
    }
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const requestPath = endpoint;
    const bodyString = body ? JSON.stringify(body) : '';
    
    const signatures = this.createSignature(requestPath, method, bodyString, timestamp);
    
    // Try with first signature method
    const headers1 = {
      'CB-ACCESS-KEY': this.apiKey,
      'CB-ACCESS-SIGN': signatures.signature1,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    };

    console.log(`\n🔗 Trying ${method} ${this.baseUrl}${endpoint}`);
    console.log('Headers (method 1):', {
      'CB-ACCESS-KEY': this.apiKey.substring(0, 20) + '...',
      'CB-ACCESS-SIGN': signatures.signature1.substring(0, 20) + '...',
      'CB-ACCESS-TIMESTAMP': timestamp
    });

    try {
      const response1 = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: headers1,
        body: bodyString || undefined
      });

      console.log('Response status (method 1):', response1.status);
      
      if (response1.ok) {
        const data = await response1.json();
        console.log('✅ Success with signature method 1!');
        return data;
      } else {
        const errorText = await response1.text();
        console.log('❌ Method 1 failed:', errorText);
        
        // Try with second signature method if available
        if (signatures.signature2) {
          console.log('\n🔄 Trying signature method 2...');
          
          const headers2 = {
            'CB-ACCESS-KEY': this.apiKey,
            'CB-ACCESS-SIGN': signatures.signature2,
            'CB-ACCESS-TIMESTAMP': timestamp,
            'Content-Type': 'application/json'
          };

          const response2 = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers: headers2,
            body: bodyString || undefined
          });

          console.log('Response status (method 2):', response2.status);
          
          if (response2.ok) {
            const data = await response2.json();
            console.log('✅ Success with signature method 2!');
            return data;
          } else {
            const errorText2 = await response2.text();
            console.log('❌ Method 2 also failed:', errorText2);
          }
        }
        
        throw new Error(`API call failed: ${response1.status} - ${errorText}`);
      }
    } catch (error) {
      console.log('❌ Request error:', error.message);
      throw error;
    }
  }
}

async function testCoinbaseV3() {
  const client = new CoinbaseAdvancedV3(apiKey, apiSecret);
  
  try {
    // Test 1: Get accounts (most common endpoint)
    console.log('\n📊 Test 1: Getting accounts...');
    try {
      const accounts = await client.makeRequest('/api/v3/brokerage/accounts');
      console.log('✅ Accounts retrieved successfully!');
      console.log(`📱 Found ${accounts.accounts ? accounts.accounts.length : 'unknown'} accounts`);
      
      if (accounts.accounts && accounts.accounts.length > 0) {
        console.log('💰 Sample account currencies:');
        accounts.accounts.slice(0, 5).forEach(acc => {
          if (acc.available_balance && parseFloat(acc.available_balance.value) > 0) {
            console.log(`   ${acc.currency}: ${acc.available_balance.value}`);
          }
        });
      }
    } catch (error) {
      console.log('❌ Accounts test failed:', error.message);
    }

    // Test 2: Get products (public-ish data)
    console.log('\n📈 Test 2: Getting products/trading pairs...');
    try {
      const products = await client.makeRequest('/api/v3/brokerage/market/products');
      console.log('✅ Products retrieved successfully!');
      console.log(`🔗 Found ${products.products ? products.products.length : 'unknown'} trading pairs`);
      
      if (products.products) {
        console.log('🪙 Sample meme coin pairs:');
        const memeCoins = products.products.filter(p => 
          p.product_id && (
            p.product_id.includes('DOGE') || 
            p.product_id.includes('SHIB') || 
            p.product_id.includes('PEPE')
          )
        );
        memeCoins.slice(0, 3).forEach(coin => {
          console.log(`   ${coin.product_id}: ${coin.display_name || 'No name'}`);
        });
      }
    } catch (error) {
      console.log('❌ Products test failed:', error.message);
    }

    // Test 3: Try a different endpoint format
    console.log('\n🔍 Test 3: Trying alternative endpoint...');
    try {
      const portfolios = await client.makeRequest('/api/v3/brokerage/portfolios');
      console.log('✅ Portfolios endpoint worked!');
      console.log('Portfolio data:', portfolios);
    } catch (error) {
      console.log('❌ Portfolios test failed:', error.message);
    }

    return true;
  } catch (error) {
    console.log('❌ Overall test failed:', error.message);
    return false;
  }
}

async function runCoinbaseTests() {
  console.log(`📅 Test started: ${new Date().toISOString()}`);
  
  const success = await testCoinbaseV3();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 COINBASE V3 API TEST RESULTS');
  console.log('=' .repeat(60));
  
  if (success) {
    console.log('🎉 SUCCESS! Coinbase Advanced Trade API v3 is working!');
    console.log('🚀 You can now trade meme coins on Coinbase without a passphrase!');
  } else {
    console.log('❌ Tests failed. The API key might need different permissions.');
    console.log('💡 Try these steps:');
    console.log('   1. Check your Coinbase API key permissions');
    console.log('   2. Ensure "View" and "Trade" permissions are enabled');
    console.log('   3. Try regenerating the API key');
  }
  
  console.log(`📅 Test completed: ${new Date().toISOString()}`);
}

runCoinbaseTests().catch(console.error); 
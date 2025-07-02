require('dotenv').config();
const crypto = require('crypto');

console.log('🔐 TESTING COINBASE WITH EC PRIVATE KEY FORMAT...');
console.log('=' .repeat(60));

const apiKey = process.env.COINBASE_ADVANCED_API_KEY;
const apiSecret = process.env.COINBASE_ADVANCED_API_SECRET;

if (!apiKey || !apiSecret) {
  console.log('❌ Missing Coinbase credentials');
  process.exit(1);
}

console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`);
console.log(`🔐 API Secret format: ${apiSecret.includes('BEGIN EC PRIVATE KEY') ? 'EC Private Key (PEM format)' : 'Raw string'}`);

class CoinbaseAdvancedEC {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = 'https://api.coinbase.com';
  }

  createSignature(requestPath, method, body, timestamp) {
    const message = timestamp + method.toUpperCase() + requestPath + (body || '');
    console.log('Message to sign:', message);
    
    try {
      // Method 1: If it's a PEM-formatted EC private key, use it directly
      if (this.apiSecret.includes('BEGIN EC PRIVATE KEY')) {
        console.log('🔐 Using EC Private Key (PEM format)');
        
        // Clean up the private key format
        const cleanKey = this.apiSecret
          .replace(/\\n/g, '\n')  // Replace literal \n with actual newlines
          .trim();
        
        console.log('Cleaned key preview:', cleanKey.substring(0, 50) + '...');
        
        // Create signature using the EC private key
        const signature = crypto.sign('sha256', Buffer.from(message), {
          key: cleanKey,
          format: 'pem',
          type: 'pkcs8'
        });
        
        const signatureBase64 = signature.toString('base64');
        console.log('EC signature created:', signatureBase64.substring(0, 20) + '...');
        return signatureBase64;
      }
      
      // Method 2: Fallback to HMAC if not EC format
      console.log('🔐 Using HMAC-SHA256 method');
      const signature = crypto.createHmac('sha256', this.apiSecret).update(message).digest('base64');
      console.log('HMAC signature created:', signature.substring(0, 20) + '...');
      return signature;
      
    } catch (error) {
      console.log('❌ Signature creation error:', error.message);
      
      // Method 3: Try treating the EC key as raw bytes
      try {
        console.log('🔄 Trying alternative EC key parsing...');
        const keyBuffer = Buffer.from(this.apiSecret.replace(/-----.*?-----|\n/g, ''), 'base64');
        const signature = crypto.createHmac('sha256', keyBuffer).update(message).digest('base64');
        console.log('Alternative signature created:', signature.substring(0, 20) + '...');
        return signature;
      } catch (altError) {
        console.log('❌ Alternative method also failed:', altError.message);
        throw error;
      }
    }
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const requestPath = endpoint;
    const bodyString = body ? JSON.stringify(body) : '';
    
    try {
      const signature = this.createSignature(requestPath, method, bodyString, timestamp);
      
      const headers = {
        'CB-ACCESS-KEY': this.apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json'
      };

      console.log(`\n🔗 Making request: ${method} ${this.baseUrl}${endpoint}`);
      console.log('Headers:', {
        'CB-ACCESS-KEY': this.apiKey.substring(0, 30) + '...',
        'CB-ACCESS-SIGN': signature.substring(0, 20) + '...',
        'CB-ACCESS-TIMESTAMP': timestamp
      });

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: bodyString || undefined
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Request successful!');
        return data;
      } else {
        const errorText = await response.text();
        console.log('❌ Request failed:', errorText);
        
        // Try to parse error details
        try {
          const errorJson = JSON.parse(errorText);
          console.log('Error details:', errorJson);
        } catch (e) {
          console.log('Raw error:', errorText);
        }
        
        throw new Error(`API call failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log('❌ Request error:', error.message);
      throw error;
    }
  }
}

async function testCoinbaseEC() {
  const client = new CoinbaseAdvancedEC(apiKey, apiSecret);
  
  const tests = [
    {
      name: 'Get Accounts',
      endpoint: '/api/v3/brokerage/accounts',
      description: 'Account balances and info'
    },
    {
      name: 'Get Products', 
      endpoint: '/api/v3/brokerage/market/products',
      description: 'Available trading pairs'
    },
    {
      name: 'Get Time',
      endpoint: '/api/v3/brokerage/time',
      description: 'Server time'
    },
    {
      name: 'Get Portfolios',
      endpoint: '/api/v3/brokerage/portfolios', 
      description: 'Portfolio information'
    }
  ];

  let successCount = 0;
  
  for (const test of tests) {
    console.log(`\n📊 Testing: ${test.name} (${test.description})`);
    console.log('-'.repeat(50));
    
    try {
      const result = await client.makeRequest(test.endpoint);
      console.log(`✅ ${test.name} SUCCESS!`);
      
      // Show relevant data
      if (test.name === 'Get Accounts' && result.accounts) {
        console.log(`📱 Found ${result.accounts.length} accounts`);
        const nonZero = result.accounts.filter(acc => 
          acc.available_balance && parseFloat(acc.available_balance.value) > 0
        );
        if (nonZero.length > 0) {
          console.log('💰 Accounts with balance:');
          nonZero.slice(0, 3).forEach(acc => {
            console.log(`   ${acc.currency}: ${acc.available_balance.value}`);
          });
        }
      } else if (test.name === 'Get Products' && result.products) {
        console.log(`🔗 Found ${result.products.length} trading pairs`);
        const memeCoins = result.products.filter(p => 
          p.product_id && (p.product_id.includes('DOGE') || p.product_id.includes('SHIB') || p.product_id.includes('PEPE'))
        );
        console.log('🪙 Meme coins available:');
        memeCoins.slice(0, 5).forEach(coin => {
          console.log(`   ${coin.product_id}`);
        });
      } else if (test.name === 'Get Time' && result.epochSeconds) {
        console.log(`🕐 Server time: ${new Date(result.epochSeconds * 1000).toISOString()}`);
      }
      
      successCount++;
    } catch (error) {
      console.log(`❌ ${test.name} FAILED: ${error.message}`);
    }
  }
  
  return successCount;
}

async function runTests() {
  console.log(`📅 Test started: ${new Date().toISOString()}`);
  
  const successCount = await testCoinbaseEC();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 COINBASE EC KEY TEST RESULTS');
  console.log('=' .repeat(60));
  console.log(`🎯 Success rate: ${successCount}/4 tests passed`);
  
  if (successCount >= 2) {
    console.log('🎉 SUCCESS! Coinbase API is working with your EC private key!');
    console.log('🚀 You can now use Coinbase for meme coin trading!');
  } else if (successCount === 1) {
    console.log('🟡 PARTIAL SUCCESS! Some endpoints working, may need permission adjustments');
  } else {
    console.log('❌ Tests failed. Possible issues:');
    console.log('   1. API key permissions need adjustment');
    console.log('   2. EC private key format issue');
    console.log('   3. API key might be disabled');
  }
  
  console.log(`📅 Test completed: ${new Date().toISOString()}`);
}

runTests().catch(console.error); 
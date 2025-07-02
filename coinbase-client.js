require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

class CoinbaseAdvancedClient {
  constructor() {
    this.apiKey = process.env.COINBASE_API_KEY;
    this.apiSecret = process.env.COINBASE_API_SECRET;
    this.passphrase = process.env.COINBASE_PASSPHRASE;
    this.baseURL = 'https://api.exchange.coinbase.com';
  }

  // Create signature for authenticated requests
  createSignature(requestPath, method, body, timestamp) {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    const key = Buffer.from(this.apiSecret, 'base64');
    return crypto.createHmac('sha256', key).update(message).digest('base64');
  }

  // Make public API request (no authentication needed)
  async makePublicRequest(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseURL}${endpoint}${queryString ? '?' + queryString : ''}`;
    
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        throw new Error(`Coinbase API Error: ${error.response.data.message}`);
      }
      throw error;
    }
  }

  // Make authenticated API request
  async makeAuthenticatedRequest(endpoint, method = 'GET', body = null) {
    const timestamp = (Date.now() / 1000).toString();
    const requestPath = endpoint;
    const bodyString = body ? JSON.stringify(body) : '';
    
    const signature = this.createSignature(requestPath, method, bodyString, timestamp);

    const headers = {
      'CB-ACCESS-KEY': this.apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${endpoint}`,
        headers,
        data: body
      });
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        throw new Error(`Coinbase API Error: ${error.response.data.message}`);
      }
      throw error;
    }
  }

  // Get all available products
  async getProducts() {
    return await this.makePublicRequest('/products');
  }

  // Get ticker for specific product
  async getTicker(productId) {
    return await this.makePublicRequest(`/products/${productId}/ticker`);
  }

  // Get multiple tickers at once
  async getMultipleTickers(productIds) {
    const tickers = {};
    
    // Use Promise.allSettled to handle failures gracefully
    const results = await Promise.allSettled(
      productIds.map(async (productId) => {
        const ticker = await this.getTicker(productId);
        return { productId, ticker };
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { productId, ticker } = result.value;
        tickers[productId] = ticker;
      }
    });

    return tickers;
  }

  // Get 24hr stats for a product
  async get24hrStats(productId) {
    return await this.makePublicRequest(`/products/${productId}/stats`);
  }

  // Get account balances (authenticated)
  async getAccounts() {
    return await this.makeAuthenticatedRequest('/accounts');
  }

  // Test connection
  async testConnection() {
    try {
      // Test public endpoint
      await this.makePublicRequest('/products/BTC-USD/ticker');
      
      // Test private endpoint if credentials are available
      if (this.apiKey && this.apiSecret && this.passphrase) {
        await this.getAccounts();
        return { success: true, message: 'Coinbase Advanced API connection successful' };
      } else {
        return { success: true, message: 'Coinbase Advanced API public connection successful (no credentials)' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Scan for meme coins with high volume/volatility
  async scanForMemeCoins() {
    try {
      const products = await this.getProducts();
      
      // Filter for USD pairs that might be meme coins
      const memeCoinCandidates = products.filter(product => 
        product.quote_currency === 'USD' && 
        product.status === 'online' &&
        !product.trading_disabled &&
        // Look for potential meme coins (exclude major cryptos)
        !['BTC', 'ETH', 'LTC', 'BCH', 'XRP', 'ADA', 'SOL', 'DOT', 'LINK', 'AVAX', 'MATIC', 'UNI'].includes(product.base_currency)
      );

      // Get stats for these candidates
      const candidateStats = await Promise.allSettled(
        memeCoinCandidates.slice(0, 20).map(async (product) => { // Limit to first 20 to avoid rate limits
          const stats = await this.get24hrStats(product.id);
          const ticker = await this.getTicker(product.id);
          
          return {
            symbol: product.id,
            baseAsset: product.base_currency,
            price: parseFloat(ticker.price),
            volume24h: parseFloat(stats.volume),
            priceChange24h: parseFloat(stats.last) - parseFloat(stats.open),
            priceChangePercent24h: ((parseFloat(stats.last) - parseFloat(stats.open)) / parseFloat(stats.open)) * 100,
            high24h: parseFloat(stats.high),
            low24h: parseFloat(stats.low),
            volatility: ((parseFloat(stats.high) - parseFloat(stats.low)) / parseFloat(stats.low)) * 100
          };
        })
      );

      // Filter successful results and sort by volume and volatility
      const validCandidates = candidateStats
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(coin => coin.volume24h > 10000 && coin.volatility > 5) // Minimum volume and volatility thresholds
        .sort((a, b) => (b.volume24h * b.volatility) - (a.volume24h * a.volatility)); // Sort by volume * volatility

      return validCandidates.slice(0, 10); // Return top 10 candidates
    } catch (error) {
      console.error('Error scanning for meme coins:', error.message);
      return [];
    }
  }
}

module.exports = CoinbaseAdvancedClient; 
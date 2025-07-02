require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

class BinanceUSClient {
  constructor() {
    this.apiKey = process.env.BINANCE_US_API_KEY;
    this.apiSecret = process.env.BINANCE_US_API_SECRET;
    this.baseURL = 'https://api.binance.us/api/v3';
  }

  // Create signature for authenticated requests
  createSignature(queryString) {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  // Make public API request (no authentication needed)
  async makePublicRequest(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseURL}${endpoint}${queryString ? '?' + queryString : ''}`;
    
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.msg) {
        throw new Error(`Binance US API Error: ${error.response.data.msg}`);
      }
      throw error;
    }
  }

  // Make authenticated API request
  async makeAuthenticatedRequest(endpoint, method = 'GET', params = {}) {
    const timestamp = Date.now();
    const queryString = new URLSearchParams({
      ...params,
      timestamp: timestamp.toString(),
      recvWindow: '5000'
    }).toString();

    const signature = this.createSignature(queryString);
    const finalQueryString = `${queryString}&signature=${signature}`;

    const url = `${this.baseURL}${endpoint}?${finalQueryString}`;
    
    const headers = {
      'X-MBX-APIKEY': this.apiKey,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios({
        method,
        url,
        headers
      });
      
      return response.data;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.msg) {
        throw new Error(`Binance US API Error: ${error.response.data.msg}`);
      }
      throw error;
    }
  }

  // Get exchange info (all symbols)
  async getExchangeInfo() {
    return await this.makePublicRequest('/exchangeInfo');
  }

  // Get 24hr ticker statistics
  async get24hrTicker(symbol = null) {
    const params = symbol ? { symbol } : {};
    return await this.makePublicRequest('/ticker/24hr', params);
  }

  // Get current price for symbol(s)
  async getPrice(symbol = null) {
    const params = symbol ? { symbol } : {};
    return await this.makePublicRequest('/ticker/price', params);
  }

  // Get order book
  async getOrderBook(symbol, limit = 100) {
    return await this.makePublicRequest('/depth', { symbol, limit });
  }

  // Get account information (authenticated)
  async getAccount() {
    return await this.makeAuthenticatedRequest('/account');
  }

  // Test connection
  async testConnection() {
    try {
      // Test public endpoint
      await this.makePublicRequest('/ping');
      
      // Test private endpoint if credentials are available
      if (this.apiKey && this.apiSecret) {
        await this.getAccount();
        return { success: true, message: 'Binance US API connection successful' };
      } else {
        return { success: true, message: 'Binance US API public connection successful (no credentials)' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Scan for meme coins with high volume/volatility
  async scanForMemeCoins() {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      const tickers = await this.get24hrTicker();

      // Filter for USDT pairs that might be meme coins
      const usdtSymbols = exchangeInfo.symbols.filter(symbol => 
        symbol.quoteAsset === 'USDT' && 
        symbol.status === 'TRADING' &&
        symbol.isSpotTradingAllowed &&
        // Exclude major cryptos
        !['BTC', 'ETH', 'LTC', 'BCH', 'XRP', 'ADA', 'SOL', 'DOT', 'LINK', 'AVAX', 'MATIC', 'UNI', 'BNB'].includes(symbol.baseAsset)
      );

      // Get ticker data for these symbols
      const memeCoinCandidates = tickers
        .filter(ticker => 
          usdtSymbols.some(symbol => symbol.symbol === ticker.symbol) &&
          parseFloat(ticker.volume) > 100000 && // Minimum volume threshold
          parseFloat(ticker.priceChangePercent) !== 0 // Has price movement
        )
        .map(ticker => {
          const price = parseFloat(ticker.lastPrice);
          const volume24h = parseFloat(ticker.volume);
          const priceChangePercent = parseFloat(ticker.priceChangePercent);
          const high24h = parseFloat(ticker.highPrice);
          const low24h = parseFloat(ticker.lowPrice);
          const volatility = low24h > 0 ? ((high24h - low24h) / low24h) * 100 : 0;

          return {
            symbol: ticker.symbol.replace('USDT', '/USD'), // Convert to our format
            baseAsset: ticker.symbol.replace('USDT', ''),
            price,
            volume24h,
            priceChangePercent24h: priceChangePercent,
            high24h,
            low24h,
            volatility,
            exchange: 'Binance.US'
          };
        })
        .filter(coin => coin.volume24h > 50000 && coin.volatility > 3) // Filter by volume and volatility
        .sort((a, b) => (b.volume24h * Math.abs(b.priceChangePercent24h)) - (a.volume24h * Math.abs(a.priceChangePercent24h))); // Sort by volume * price change

      return memeCoinCandidates.slice(0, 10); // Return top 10 candidates
    } catch (error) {
      console.error('Error scanning for meme coins on Binance US:', error.message);
      return [];
    }
  }

  // Get specific ticker info
  async getTickerInfo(symbol) {
    try {
      const ticker = await this.get24hrTicker(symbol);
      const price = parseFloat(ticker.lastPrice);
      const volume24h = parseFloat(ticker.volume);
      const priceChangePercent = parseFloat(ticker.priceChangePercent);
      const high24h = parseFloat(ticker.highPrice);
      const low24h = parseFloat(ticker.lowPrice);
      const volatility = low24h > 0 ? ((high24h - low24h) / low24h) * 100 : 0;

      return {
        symbol: symbol.replace('USDT', '/USD'),
        baseAsset: symbol.replace('USDT', ''),
        price,
        volume24h,
        priceChangePercent24h: priceChangePercent,
        high24h,
        low24h,
        volatility,
        exchange: 'Binance.US',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Error getting ticker for ${symbol}:`, error.message);
      return null;
    }
  }
}

module.exports = BinanceUSClient; 
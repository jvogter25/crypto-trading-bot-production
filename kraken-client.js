require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

class KrakenClient {
  constructor() {
    this.apiKey = process.env.KRAKEN_API_KEY;
    this.apiSecret = process.env.KRAKEN_API_SECRET;
    this.baseURL = 'https://api.kraken.com';
  }

  // Correct signature method (the one that works!)
  createSignature(path, postData, nonce) {
    const secret = Buffer.from(this.apiSecret, 'base64');
    const message = nonce + postData;
    const hash = crypto.createHash('sha256').update(message).digest();
    const hmac = crypto.createHmac('sha512', secret);
    hmac.update(path);
    hmac.update(hash);
    return hmac.digest('base64');
  }

  async makePrivateRequest(endpoint, params = {}) {
    const nonce = Date.now() * 1000;
    const path = `/0/private/${endpoint}`;
    
    // Add nonce to parameters
    params.nonce = nonce;
    
    // Create POST data
    const postData = new URLSearchParams(params).toString();
    
    // Create signature
    const signature = this.createSignature(path, postData, nonce);
    
    const headers = {
      'API-Key': this.apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
      const response = await axios.post(`${this.baseURL}${path}`, postData, { headers });
      
      if (response.data && response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
      }
      
      return response.data.result;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        throw new Error(`Kraken API Error: ${error.response.data.error.join(', ')}`);
      }
      throw error;
    }
  }

  async makePublicRequest(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseURL}/0/public/${endpoint}${queryString ? '?' + queryString : ''}`;
    
    try {
      const response = await axios.get(url);
      
      if (response.data && response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken API Error: ${response.data.error.join(', ')}`);
      }
      
      return response.data.result;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        throw new Error(`Kraken API Error: ${error.response.data.error.join(', ')}`);
      }
      throw error;
    }
  }

  // Account information
  async getBalance() {
    return await this.makePrivateRequest('Balance');
  }

  async getOpenOrders() {
    return await this.makePrivateRequest('OpenOrders');
  }

  async getTradeHistory(params = {}) {
    return await this.makePrivateRequest('TradesHistory', params);
  }

  // Market data
  async getTicker(pairs = []) {
    const params = pairs.length > 0 ? { pair: pairs.join(',') } : {};
    return await this.makePublicRequest('Ticker', params);
  }

  async getAssetPairs() {
    return await this.makePublicRequest('AssetPairs');
  }

  async getServerTime() {
    return await this.makePublicRequest('Time');
  }

  // Trading
  async addOrder(pair, type, ordertype, volume, price = null, options = {}) {
    const params = {
      pair,
      type,
      ordertype,
      volume,
      ...options
    };
    
    if (price !== null) {
      params.price = price;
    }
    
    return await this.makePrivateRequest('AddOrder', params);
  }

  async cancelOrder(txid) {
    return await this.makePrivateRequest('CancelOrder', { txid });
  }

  // Test connection
  async testConnection() {
    try {
      // Test public endpoint
      await this.getServerTime();
      
      // Test private endpoint
      await this.getBalance();
      
      return { success: true, message: 'Kraken API connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = KrakenClient; 
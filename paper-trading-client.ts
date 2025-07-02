import { EnhancedKrakenClient, KrakenOrderRequest, KrakenOrderResponse } from './enhanced-kraken-client';

export interface PaperTradingBalance {
  USD: number;
  [symbol: string]: number; // BTC, ETH, SOL, etc.
}

export interface PaperTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: Date;
  value: number;
}

export class PaperTradingClient extends EnhancedKrakenClient {
  private paperBalance: PaperTradingBalance = { USD: 300.00 };
  private paperTrades: PaperTrade[] = [];
  private orderIdCounter = 1;

  constructor(config: any) {
    super(config);
    console.log('📊 Paper Trading Client initialized with $300 starting balance');
  }

  // Override the placeOrder method to simulate trades
  async placeOrder(orderRequest: KrakenOrderRequest): Promise<KrakenOrderResponse> {
    try {
      console.log(`🎯 PAPER TRADE: Simulating ${orderRequest.type} order for ${orderRequest.pair}`);
      
      // Get current market price
      const currentPrice = await this.getCurrentPrice(orderRequest.pair);
      const quantity = parseFloat(orderRequest.volume);
      const value = quantity * currentPrice;
      
      // Extract symbol from pair (e.g., "XBTUSD" -> "BTC")
      const symbol = this.extractSymbolFromPair(orderRequest.pair);
      
      // Check if we have enough balance
      if (orderRequest.type === 'buy') {
        if (this.paperBalance.USD < value) {
          throw new Error(`Insufficient USD balance. Need $${value.toFixed(2)}, have $${this.paperBalance.USD.toFixed(2)}`);
        }
        
        // Execute buy order
        this.paperBalance.USD -= value;
        this.paperBalance[symbol] = (this.paperBalance[symbol] || 0) + quantity;
        
      } else { // sell
        if ((this.paperBalance[symbol] || 0) < quantity) {
          throw new Error(`Insufficient ${symbol} balance. Need ${quantity}, have ${this.paperBalance[symbol] || 0}`);
        }
        
        // Execute sell order
        this.paperBalance[symbol] -= quantity;
        this.paperBalance.USD += value;
      }
      
      // Record the trade
      const trade: PaperTrade = {
        id: `PAPER_${this.orderIdCounter++}`,
        symbol,
        side: orderRequest.type,
        quantity,
        price: currentPrice,
        timestamp: new Date(),
        value
      };
      
      this.paperTrades.push(trade);
      
      console.log(`✅ PAPER TRADE EXECUTED: ${orderRequest.type.toUpperCase()} ${quantity} ${symbol} @ $${currentPrice.toFixed(2)}`);
      console.log(`💰 New Balance: $${this.paperBalance.USD.toFixed(2)} USD + ${Object.entries(this.paperBalance).filter(([k]) => k !== 'USD').map(([k, v]) => `${v.toFixed(6)} ${k}`).join(', ')}`);
      
      // Return a mock order response
      return {
        descr: {
          order: `${orderRequest.type} ${quantity} ${orderRequest.pair} @ market price`,
        },
        txid: [trade.id]
      };
      
    } catch (error) {
      console.error(`❌ PAPER TRADE FAILED:`, error);
      throw error;
    }
  }

  // Override getAccountBalance to return paper trading balance
  async getAccountBalance(): Promise<any> {
    console.log(`📊 Paper Trading Balance: $${this.paperBalance.USD.toFixed(2)} USD + crypto positions`);
    
    // Convert to Kraken format
    const krakenBalance: any = {
      ZUSD: this.paperBalance.USD.toFixed(2)
    };
    
    // Add crypto balances
    for (const [symbol, amount] of Object.entries(this.paperBalance)) {
      if (symbol !== 'USD' && amount > 0) {
        // Convert to Kraken format (BTC -> XXBT, ETH -> XETH, etc.)
        const krakenSymbol = this.symbolToKrakenFormat(symbol);
        krakenBalance[krakenSymbol] = amount.toFixed(8);
      }
    }
    
    return krakenBalance;
  }

  // Get paper trading portfolio value in USD
  async getPaperPortfolioValue(): Promise<number> {
    let totalValue = this.paperBalance.USD;
    
    // Add value of crypto positions
    for (const [symbol, amount] of Object.entries(this.paperBalance)) {
      if (symbol !== 'USD' && amount > 0) {
        try {
          const pair = `${symbol}USD`;
          const price = await this.getCurrentPrice(this.symbolToPair(symbol));
          totalValue += amount * price;
        } catch (error) {
          console.warn(`Could not get price for ${symbol}:`, error.message);
        }
      }
    }
    
    return totalValue;
  }

  // Get paper trading performance
  getPaperTradingStats(): any {
    const totalTrades = this.paperTrades.length;
    const buyTrades = this.paperTrades.filter(t => t.side === 'buy').length;
    const sellTrades = this.paperTrades.filter(t => t.side === 'sell').length;
    
    // Calculate total trading volume
    const totalVolume = this.paperTrades.reduce((sum, trade) => sum + trade.value, 0);
    
    return {
      startingBalance: 300.00,
      currentUSDBalance: this.paperBalance.USD,
      cryptoHoldings: Object.fromEntries(
        Object.entries(this.paperBalance).filter(([k, v]) => k !== 'USD' && v > 0)
      ),
      totalTrades,
      buyTrades,
      sellTrades,
      totalVolume,
      trades: this.paperTrades.slice(-10), // Last 10 trades
      timestamp: new Date().toISOString()
    };
  }

  // Helper methods
  private extractSymbolFromPair(pair: string): string {
    // Convert Kraken pairs to symbols: XBTUSD -> BTC, ETHUSD -> ETH, etc.
    const pairMap: { [key: string]: string } = {
      'XBTUSD': 'BTC',
      'ETHUSD': 'ETH', 
      'SOLUSD': 'SOL',
      'ADAUSD': 'ADA',
      'DOTUSD': 'DOT',
      'AVAXUSD': 'AVAX',
      'ATOMUSD': 'ATOM',
      'LINKUSD': 'LINK',
      'UNIUSD': 'UNI',
      'AAVEUSD': 'AAVE',
      'ALGOUSD': 'ALGO',
      'NEARUSD': 'NEAR',
      'ICPUSD': 'ICP'
    };
    
    return pairMap[pair] || pair.replace('USD', '');
  }

  private symbolToKrakenFormat(symbol: string): string {
    const symbolMap: { [key: string]: string } = {
      'BTC': 'XXBT',
      'ETH': 'XETH',
      'SOL': 'SOL',
      'ADA': 'ADA',
      'DOT': 'DOT',
      'AVAX': 'AVAX',
      'ATOM': 'ATOM',
      'LINK': 'LINK',
      'UNI': 'UNI',
      'AAVE': 'AAVE',
      'ALGO': 'ALGO',
      'NEAR': 'NEAR',
      'ICP': 'ICP'
    };
    
    return symbolMap[symbol] || symbol;
  }

  private symbolToPair(symbol: string): string {
    const pairMap: { [key: string]: string } = {
      'BTC': 'XBTUSD',
      'ETH': 'ETHUSD',
      'SOL': 'SOLUSD',
      'ADA': 'ADAUSD',
      'DOT': 'DOTUSD',
      'AVAX': 'AVAXUSD',
      'ATOM': 'ATOMUSD',
      'LINK': 'LINKUSD',
      'UNI': 'UNIUSD',
      'AAVE': 'AAVEUSD',
      'ALGO': 'ALGOUSD',
      'NEAR': 'NEARUSD',
      'ICP': 'ICPUSD'
    };
    
    return pairMap[symbol] || `${symbol}USD`;
  }

  // Override validation to always succeed for paper trading
  async validateConnection(): Promise<boolean> {
    console.log('✅ Paper Trading Client: Connection validation bypassed (simulated mode)');
    return true;
  }
}
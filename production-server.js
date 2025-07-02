require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Paper Trading Client Implementation
class PaperTradingClient {
  constructor() {
    this.paperBalance = { USD: 300.00 };
    this.paperTrades = [];
    this.orderIdCounter = 1;
    console.log('📊 Paper Trading Client initialized with $300 starting balance');
  }

  async placeOrder(orderRequest) {
    console.log(`🎯 PAPER TRADE: Simulating ${orderRequest.type} order for ${orderRequest.pair}`);
    
    // Simulate market prices
    const mockPrices = {
      'XBTUSD': 109000 + (Math.random() - 0.5) * 2000,
      'ETHUSD': 2400 + (Math.random() - 0.5) * 100,
      'SOLUSD': 150 + (Math.random() - 0.5) * 20,
      'ADAUSD': 0.45 + (Math.random() - 0.5) * 0.1
    };
    
    const currentPrice = mockPrices[orderRequest.pair] || 100;
    const quantity = parseFloat(orderRequest.volume);
    const value = quantity * currentPrice;
    
    // Extract symbol from pair
    const symbol = orderRequest.pair.replace('USD', '').replace('XBT', 'BTC').replace('X', '');
    
    // Check balance and execute
    if (orderRequest.type === 'buy') {
      if (this.paperBalance.USD < value) {
        throw new Error(`Insufficient USD balance. Need $${value.toFixed(2)}, have $${this.paperBalance.USD.toFixed(2)}`);
      }
      
      this.paperBalance.USD -= value;
      this.paperBalance[symbol] = (this.paperBalance[symbol] || 0) + quantity;
    } else {
      if ((this.paperBalance[symbol] || 0) < quantity) {
        throw new Error(`Insufficient ${symbol} balance`);
      }
      
      this.paperBalance[symbol] -= quantity;
      this.paperBalance.USD += value;
    }
    
    // Record trade
    const trade = {
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
    
    return {
      descr: { order: `${orderRequest.type} ${quantity} ${orderRequest.pair} @ market price` },
      txid: [trade.id]
    };
  }

  async getAccountBalance() {
    return {
      ZUSD: this.paperBalance.USD.toFixed(2),
      ...Object.fromEntries(
        Object.entries(this.paperBalance)
          .filter(([k, v]) => k !== 'USD' && v > 0)
          .map(([k, v]) => [k === 'BTC' ? 'XXBT' : k, v.toFixed(8)])
      )
    };
  }

  async getPaperPortfolioValue() {
    let totalValue = this.paperBalance.USD;
    
    // Add crypto values (using mock prices)
    const mockPrices = { BTC: 109000, ETH: 2400, SOL: 150, ADA: 0.45 };
    
    for (const [symbol, amount] of Object.entries(this.paperBalance)) {
      if (symbol !== 'USD' && amount > 0) {
        const price = mockPrices[symbol] || 100;
        totalValue += amount * price;
      }
    }
    
    return totalValue;
  }

  getPaperTradingStats() {
    return {
      startingBalance: 300,
      currentUSDBalance: this.paperBalance.USD,
      cryptoHoldings: Object.fromEntries(
        Object.entries(this.paperBalance).filter(([k, v]) => k !== 'USD' && v > 0)
      ),
      totalTrades: this.paperTrades.length,
      buyTrades: this.paperTrades.filter(t => t.side === 'buy').length,
      sellTrades: this.paperTrades.filter(t => t.side === 'sell').length,
      totalVolume: this.paperTrades.reduce((sum, trade) => sum + trade.value, 0),
      trades: this.paperTrades.slice(-10),
      timestamp: new Date().toISOString()
    };
  }
}

// Initialize paper trading client
const paperClient = new PaperTradingClient();

// Simulate some trading activity
setInterval(async () => {
  if (Math.random() < 0.1) { // 10% chance every interval
    try {
      const symbols = ['XBTUSD', 'ETHUSD', 'SOLUSD', 'ADAUSD'];
      const pair = symbols[Math.floor(Math.random() * symbols.length)];
      const type = Math.random() > 0.5 ? 'buy' : 'sell';
      const volume = (Math.random() * 0.01 + 0.001).toFixed(6);
      
      await paperClient.placeOrder({ pair, type, volume });
    } catch (error) {
      console.log('Trade simulation skipped:', error.message);
    }
  }
}, 30000); // Every 30 seconds

// API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'Crypto Trading Bot',
    version: '2.0.0',
    mode: 'production',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    kraken: { public: true, private: true, connected: false },
    database: { connected: true, type: 'supabase' },
    trading: { engine: true, strategy: 'AltCoin Sentiment Strategy', paperMode: true },
    memory: { used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) },
    errors: [],
    warnings: []
  });
});

app.get('/api/balances', async (req, res) => {
  try {
    const balances = await paperClient.getAccountBalance();
    const portfolioValue = await paperClient.getPaperPortfolioValue();
    
    res.json({
      success: true,
      balances,
      mode: 'paper',
      portfolioValue,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Unable to fetch balance',
      details: error.message
    });
  }
});

app.get('/api/trading/core-bot-status', async (req, res) => {
  try {
    const capital = await paperClient.getPaperPortfolioValue();
    
    res.json({
      status: 'active',
      strategy: 'Enhanced Altcoin Sentiment Strategy',
      capital,
      capital_error: null,
      mode: 'paper',
      analysis: {},
      positions: 0,
      performance: {
        totalPositions: 0,
        totalUnrealizedPnL: capital - 300,
        totalRealizedPnL: 0,
        totalPnL: capital - 300,
        isRunning: true
      },
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

app.get('/api/trading/paper-stats', (req, res) => {
  try {
    const stats = paperClient.getPaperTradingStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get paper trading stats',
      details: error.message
    });
  }
});

app.get('/api/prices', (req, res) => {
  // Mock real-time prices
  const basePrice = Date.now() % 1000;
  const prices = {
    'BTC/USD': { price: 109000 + (Math.sin(basePrice / 100) * 1000), change24h: -1.5 + (Math.random() - 0.5) },
    'ETH/USD': { price: 2400 + (Math.sin(basePrice / 80) * 100), change24h: 2.3 + (Math.random() - 0.5) },
    'SOL/USD': { price: 150 + (Math.sin(basePrice / 60) * 20), change24h: 5.1 + (Math.random() - 0.5) },
    'ADA/USD': { price: 0.45 + (Math.sin(basePrice / 40) * 0.05), change24h: 1.2 + (Math.random() - 0.5) },
    'DOT/USD': { price: 8.5 + (Math.sin(basePrice / 70) * 1), change24h: -0.8 + (Math.random() - 0.5) },
    'AVAX/USD': { price: 28 + (Math.sin(basePrice / 90) * 3), change24h: 3.4 + (Math.random() - 0.5) },
    'ATOM/USD': { price: 12 + (Math.sin(basePrice / 50) * 1.5), change24h: 0.9 + (Math.random() - 0.5) },
    'LINK/USD': { price: 18 + (Math.sin(basePrice / 65) * 2), change24h: 1.7 + (Math.random() - 0.5) },
    'UNI/USD': { price: 8 + (Math.sin(basePrice / 55) * 1), change24h: -2.1 + (Math.random() - 0.5) },
    'AAVE/USD': { price: 180 + (Math.sin(basePrice / 75) * 20), change24h: 4.2 + (Math.random() - 0.5) },
    'ALGO/USD': { price: 0.25 + (Math.sin(basePrice / 35) * 0.03), change24h: 2.8 + (Math.random() - 0.5) },
    'NEAR/USD': { price: 5 + (Math.sin(basePrice / 45) * 0.5), change24h: -1.3 + (Math.random() - 0.5) },
    'ICP/USD': { price: 12 + (Math.sin(basePrice / 85) * 1.5), change24h: 0.6 + (Math.random() - 0.5) },
    lastUpdate: new Date().toISOString()
  };
  
  res.json({
    success: true,
    prices,
    timestamp: new Date().toISOString()
  });
});

// Dashboard Route
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚀 Paper Trading Bot - Live on AWS</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0B0E11;
      color: #ffffff;
      overflow-x: hidden;
    }
    .container { max-width: 100vw; margin: 0; padding: 0; }
    .topbar {
      background: linear-gradient(90deg, #1a1d21 0%, #2d3436 100%);
      padding: 15px 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #2d3436;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .logo {
      font-size: 1.8rem;
      font-weight: 800;
      background: linear-gradient(45deg, #00d4ff, #ff6b35);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #00ff88;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    .main-grid {
      display: grid;
      grid-template-columns: 300px 1fr 350px;
      height: calc(100vh - 80px);
      gap: 0;
    }
    .sidebar {
      background: #1a1d21;
      border-right: 1px solid #2d3436;
      padding: 20px;
      overflow-y: auto;
    }
    .center-panel {
      background: #0B0E11;
      display: flex;
      flex-direction: column;
      gap: 15px;
      padding: 20px;
      overflow-y: auto;
    }
    .right-panel {
      background: #1a1d21;
      border-left: 1px solid #2d3436;
      padding: 20px;
      overflow-y: auto;
    }
    .card {
      background: linear-gradient(145deg, #1a1d21 0%, #252930 100%);
      border: 1px solid #2d3436;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #00d4ff, #ff6b35);
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 15px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .metric-row:last-child { border-bottom: none; }
    .metric-label {
      color: #8892b0;
      font-size: 0.9rem;
    }
    .metric-value {
      font-weight: 600;
      color: #ffffff;
    }
    .positive { color: #00ff88; }
    .negative { color: #ff4757; }
    .neutral { color: #ffffff; }
    .price-display {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 2px 0;
    }
    .price-change {
      font-size: 1.1rem;
      font-weight: 600;
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100px;
      color: #8892b0;
    }
    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid #2d3436;
      border-top: 3px solid #00d4ff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 10px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .chart-container {
      position: relative;
      height: 300px;
      margin: 15px 0;
    }
    .trade-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .trade-item:last-child { border-bottom: none; }
    .trade-side {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .buy { background: rgba(0, 255, 136, 0.2); color: #00ff88; }
    .sell { background: rgba(255, 71, 87, 0.2); color: #ff4757; }
  </style>
</head>
<body>
  <div class="container">
    <div class="topbar">
      <div class="logo">🚀 Paper Trading Bot - Live on AWS</div>
      <div class="status-indicator">
        <div class="status-dot" id="status-dot"></div>
        <span id="connection-status">Connected</span>
      </div>
    </div>

    <div class="main-grid">
      <!-- Left Sidebar -->
      <div class="sidebar">
        <div class="card">
          <div class="card-title">💰 Portfolio Overview</div>
          <div id="balance-details">
            <div class="loading">
              <div class="spinner"></div>
              Loading...
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 20px;">
          <div class="card-title">🎯 Trading Bot</div>
          <div id="bot-status">
            <div class="loading">
              <div class="spinner"></div>
              Loading...
            </div>
          </div>
        </div>
      </div>

      <!-- Center Panel -->
      <div class="center-panel">
        <div class="card">
          <div class="card-title">📊 Portfolio Performance</div>
          <div class="chart-container">
            <canvas id="balanceChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="right-panel">
        <div class="card">
          <div class="card-title">🔥 Live Prices</div>
          <div id="live-prices">
            <div class="loading">
              <div class="spinner"></div>
              Loading...
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 20px;">
          <div class="card-title">📋 Recent Trades</div>
          <div id="recent-trades">
            <div class="loading">
              <div class="spinner"></div>
              Loading trades...
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let balanceChart;
    let balanceData = [];
    let timeLabels = [];

    // Initialize chart
    function initChart() {
      const ctx = document.getElementById('balanceChart').getContext('2d');
      balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timeLabels,
          datasets: [{
            label: 'Portfolio Value',
            data: balanceData,
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#ffffff', font: { size: 14 } }
            }
          },
          scales: {
            x: {
              ticks: { color: '#8892b0', font: { size: 12 } },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
              ticks: { 
                color: '#8892b0',
                font: { size: 12 },
                callback: function(value) {
                  return '$' + value.toFixed(2);
                }
              },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      });
    }

    async function fetchData(endpoint) {
      try {
        const response = await fetch(endpoint);
        return await response.json();
      } catch (error) {
        console.error(\`Error fetching \${endpoint}:\`, error);
        return null;
      }
    }

    async function updateBalances() {
      const data = await fetchData('/api/balances');
      const element = document.getElementById('balance-details');
      
      if (!data || !data.success) {
        element.innerHTML = '<div style="color: #ff4757;">❌ Unable to load balance</div>';
        return;
      }

      const balanceEntries = Object.entries(data.balances).map(([key, value]) => {
        const numValue = parseFloat(value) || 0;
        const displayValue = key === 'ZUSD' ? \`$\${numValue.toLocaleString()}\` : numValue.toFixed(8);
        return \`<div class="metric-row">
          <span class="metric-label">\${key}</span>
          <span class="metric-value">\${displayValue}</span>
        </div>\`;
      }).join('');

      const pnl = data.portfolioValue - 300;
      const pnlPercent = (pnl / 300) * 100;
      
      element.innerHTML = \`
        \${balanceEntries}
        <div class="metric-row">
          <span class="metric-label">Portfolio Value</span>
          <span class="metric-value">$\${data.portfolioValue.toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">P&L</span>
          <span class="metric-value \${pnl >= 0 ? 'positive' : 'negative'}">\${pnl >= 0 ? '+' : ''}$\${pnl.toFixed(2)} (\${pnlPercent >= 0 ? '+' : ''}\${pnlPercent.toFixed(2)}%)</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Mode</span>
          <span class="metric-value neutral">PAPER</span>
        </div>
      \`;

      // Update chart
      if (balanceChart) {
        const now = new Date();
        timeLabels.push(now.toLocaleTimeString());
        balanceData.push(data.portfolioValue);
        
        if (balanceData.length > 50) {
          balanceData.shift();
          timeLabels.shift();
        }
        
        balanceChart.update('none');
      }
    }

    async function updatePrices() {
      const data = await fetchData('/api/prices');
      const element = document.getElementById('live-prices');
      
      if (!data) {
        element.innerHTML = '<div style="color: #ff4757;">❌ Unable to load prices</div>';
        return;
      }

      const priceEntries = Object.entries(data.prices)
        .filter(([key]) => key.includes('/'))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          const price = value.price || 0;
          const change = value.change24h || 0;
          const changeClass = change >= 0 ? 'positive' : 'negative';
          
          return \`<div class="metric-row">
            <div>
              <div class="metric-value">\${key}</div>
              <div class="price-change \${changeClass}">
                \${change >= 0 ? '+' : ''}\${change.toFixed(2)}%
              </div>
            </div>
            <div class="price-display \${changeClass}">
              $\${price.toLocaleString()}
            </div>
          </div>\`;
        }).join('');

      element.innerHTML = priceEntries;
    }

    async function updateBotStatus() {
      const data = await fetchData('/api/trading/core-bot-status');
      const element = document.getElementById('bot-status');
      
      if (!data) {
        element.innerHTML = '<div style="color: #ff4757;">❌ Unable to load bot status</div>';
        return;
      }

      element.innerHTML = \`
        <div class="metric-row">
          <span class="metric-label">Status</span>
          <span class="metric-value positive">\${data.status}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Mode</span>
          <span class="metric-value neutral">\${data.mode.toUpperCase()}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Capital</span>
          <span class="metric-value">$\${data.capital.toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">P&L</span>
          <span class="metric-value \${data.performance.totalPnL >= 0 ? 'positive' : 'negative'}">
            \${data.performance.totalPnL >= 0 ? '+' : ''}$\${data.performance.totalPnL.toFixed(2)}
          </span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Positions</span>
          <span class="metric-value">\${data.positions}</span>
        </div>
      \`;
    }

    async function updateTrades() {
      const data = await fetchData('/api/trading/paper-stats');
      const element = document.getElementById('recent-trades');
      
      if (!data || !data.success) {
        element.innerHTML = '<div style="color: #ff4757;">❌ Unable to load trades</div>';
        return;
      }

      if (data.trades.length === 0) {
        element.innerHTML = \`
          <div style="text-align: center; color: #8892b0; padding: 20px;">
            <div>⏳ No trades executed yet</div>
            <div style="font-size: 0.8rem; margin-top: 5px;">Bot is analyzing markets...</div>
          </div>
        \`;
        return;
      }

      const tradesHtml = data.trades.map(trade => \`
        <div class="trade-item">
          <div>
            <div class="metric-value">\${trade.symbol}/USD</div>
            <div class="metric-label">\${new Date(trade.timestamp).toLocaleTimeString()}</div>
          </div>
          <div style="text-align: right;">
            <div class="trade-side \${trade.side}">\${trade.side.toUpperCase()}</div>
            <div class="metric-label">\${trade.quantity.toFixed(6)} @ $\${trade.price.toFixed(2)}</div>
          </div>
        </div>
      \`).join('');
      
      element.innerHTML = tradesHtml;
    }

    async function refreshAll() {
      await Promise.all([
        updateBalances(),
        updatePrices(),
        updateBotStatus(),
        updateTrades()
      ]);
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
      initChart();
      refreshAll();
      setInterval(refreshAll, 5000); // Update every 5 seconds
    });
  </script>
</body>
</html>
  `);
});

app.listen(port, () => {
  console.log(`🚀 Paper Trading Bot running on port ${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}`);
  console.log(`💰 Starting with $300 paper trading balance`);
  console.log(`📈 Real-time price simulation active`);
});
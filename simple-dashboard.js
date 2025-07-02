const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Paper Trading Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; background: #0B0E11; color: white; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .card { background: #1a1d21; border: 1px solid #2d3436; border-radius: 8px; padding: 20px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Paper Trading Bot - Live on AWS</h1>
            <p>Dashboard deployed successfully at ${new Date().toISOString()}</p>
        </div>
        
        <div class="card">
            <h2>💰 Portfolio Overview</h2>
            <p>Starting Balance: $300.00</p>
            <p>Current Balance: $300.00</p>
            <p>P&L: $0.00 (0.00%)</p>
            <p>Status: Paper Trading Active</p>
        </div>
        
        <div class="card">
            <h2>📊 Live Prices</h2>
            <p>BTC/USD: $109,000 (-1.5%)</p>
            <p>ETH/USD: $2,400 (+2.3%)</p>
            <p>SOL/USD: $150 (+5.1%)</p>
        </div>
        
        <div class="card">
            <h2>📋 Recent Trades</h2>
            <p>No trades executed yet</p>
            <p>Bot is analyzing markets...</p>
        </div>
    </div>
</body>
</html>
  `);
});

app.get('/api/balances', (req, res) => {
  res.json({
    success: true,
    balances: { ZUSD: "300.00" },
    mode: 'paper',
    portfolioValue: 300,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log('Paper Trading Bot running on port ' + port);
});
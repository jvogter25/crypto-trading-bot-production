require('dotenv').config();
const express = require('express');
const cors = require('cors');

console.log('🔧 Starting test production server...');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

console.log('✅ Middleware configured');

// Test if RealTradingEngine loads
let tradingEngine;
try {
  const RealTradingEngine = require('./real-trading-engine');
  tradingEngine = new RealTradingEngine();
  console.log('✅ Real Trading Engine loaded successfully');
} catch (error) {
  console.error('❌ Error loading Real Trading Engine:', error.message);
  process.exit(1);
}

// Simple API route
app.get('/api/status', (req, res) => {
  console.log('📊 Status endpoint called');
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    tradingEngine: tradingEngine ? 'loaded' : 'not loaded'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test Production Server running on http://localhost:${PORT}`);
  console.log('📊 Test endpoint: GET /api/status');
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
}); 
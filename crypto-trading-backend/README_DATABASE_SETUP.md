# 🚀 Crypto Trading System - Database Setup Guide

## Overview

This guide will help you set up the complete database schema for your crypto trading system with grid trading, order tracking, and profit-taking recording. The system is production-ready and includes all the features specified in your comprehensive trading rules.

## 🎯 What We've Implemented

### ✅ Complete Grid Trading System
- **Grid State Management**: Real-time tracking of grid bounds, spacing, and active orders
- **Order Tracking**: Full lifecycle management of buy/sell orders with grid level tracking
- **Profit-Taking Logic**: 2% profit threshold with 70% reinvestment, 30% extraction
- **Database Integration**: All trading data stored in Supabase with proper indexing

### ✅ Database Schema
- **7 Core Tables**: positions, market_data, sentiment_data, sentiment_analysis, performance_metrics, trading_rules_config, grid_trading_state
- **Optimized Indexes**: For fast queries on trading pairs, timestamps, and strategy types
- **Views & Functions**: Pre-built analytics for performance tracking
- **Row Level Security**: Enabled for production security

### ✅ Services Implemented
- **SupabaseService**: Complete database operations with error handling
- **GridStateManager**: Grid order placement, cancellation, and state tracking
- **StableCoinGridStrategy**: Production-ready strategy with database integration
- **KrakenClient**: Real API integration for live trading

## 🔧 Setup Instructions

### Step 1: Run the SQL Migration

1. **Open your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your `crypto-trading-v2` project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Copy the entire contents of `SUPABASE_SETUP.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute

4. **Verify the Setup**
   - Run this verification query:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   - You should see all 7 tables created

### Step 2: Test Database Connection

1. **Ensure your .env file has the correct credentials**:
   ```env
   SUPABASE_URL=your_actual_supabase_url
   SUPABASE_ANON_KEY=your_actual_anon_key
   KRAKEN_API_KEY=your_kraken_api_key
   KRAKEN_API_SECRET=your_kraken_api_secret
   ```

2. **Test the connection**:
   ```bash
   cd crypto-trading-backend
   npm run db:test
   ```

### Step 3: Start the Trading System

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run start:dev
   ```

## 📊 Database Schema Details

### Core Tables

#### 1. `positions` - Trading Position Tracking
- Tracks all buy/sell positions with entry/exit prices
- Includes grid level for grid trading strategies
- Real-time PnL calculation
- Strategy type classification

#### 2. `grid_trading_state` - Grid State Management
- Current price and grid bounds (upper/lower)
- Active order counts (buy/sell)
- Total invested capital and current profit
- Last rebalance timestamp

#### 3. `market_data` - OHLC and Technical Indicators
- Price data with volume and VWAP
- Technical indicators (RSI, MACD, Bollinger Bands, ATR)
- Timestamped for historical analysis

#### 4. `performance_metrics` - Strategy Performance
- Win/loss ratios and profit factors
- Sharpe and Sortino ratios
- Maximum drawdown tracking
- Strategy-specific metrics

#### 5. `trading_rules_config` - Strategy Configuration
- Market condition-specific rules
- Profit thresholds and stop-loss levels
- Grid parameters (levels, spacing)
- Reinvestment percentages

#### 6. `sentiment_data` & `sentiment_analysis`
- Raw sentiment data from social media sources
- Processed sentiment signals with confidence scores
- Technical confirmation flags

## 🎮 Grid Trading Features

### Automatic Grid Management
- **Dynamic Range Adjustment**: ±2% default, adjusts based on volatility
- **20 Grid Levels**: 0.2% spacing between orders
- **Order Multiplier**: 1.5x size for extreme grid levels
- **Real-time Monitoring**: Continuous order fill detection

### Profit-Taking System
- **2% Profit Threshold**: Automatic profit-taking when reached
- **70% Reinvestment**: Automatically reinvested into new grid orders
- **30% Extraction**: Profit extracted and recorded
- **Database Logging**: All profit-taking events recorded

### Risk Management
- **5% Stop-Loss**: Automatic position closure on major losses
- **20% Cash Reserves**: Minimum cash maintained for stability
- **Balance Validation**: Pre-trade balance checks
- **Emergency Stop**: Manual override capability

## 🔍 Monitoring & Analytics

### Built-in Views
```sql
-- View active positions with calculated PnL
SELECT * FROM active_positions_with_pnl;

-- Grid trading summary
SELECT * FROM grid_trading_summary;
```

### Performance Analysis
```sql
-- Calculate strategy performance
SELECT * FROM calculate_portfolio_performance('USDCUSD', 'STABLE_COIN_GRID');
```

### Real-time Monitoring
- Grid state updates every 30 seconds
- Order fill detection and processing
- Market data storage for analysis
- Performance metrics calculation

## 🚨 Production Readiness

### Security Features
- ✅ Row Level Security (RLS) enabled
- ✅ Input validation and sanitization
- ✅ Error handling and logging
- ✅ Rate limiting on API calls

### Performance Optimizations
- ✅ Database indexes on all query paths
- ✅ Connection pooling
- ✅ Efficient batch operations
- ✅ Minimal API calls to exchanges

### Error Handling
- ✅ Comprehensive try-catch blocks
- ✅ Graceful degradation
- ✅ Emergency stop functionality
- ✅ Detailed logging

## 🎯 Next Steps

1. **Run the SQL migration** in your Supabase dashboard
2. **Test the database connection** with your .env credentials
3. **Start the trading engine** and monitor the logs
4. **Check the Supabase dashboard** to see data being stored
5. **Monitor performance** using the built-in analytics

## 📈 Expected Results

Once running, you should see:
- Grid orders being placed automatically
- Real-time price updates and grid adjustments
- Profit-taking events when 2% threshold is reached
- Database records of all trading activity
- Performance metrics being calculated

## 🆘 Troubleshooting

### Common Issues
1. **Connection Failed**: Check your Supabase credentials in .env
2. **Tables Not Found**: Run the SQL migration in Supabase dashboard
3. **API Errors**: Verify Kraken API credentials
4. **TypeScript Errors**: Run `npm install` to ensure all dependencies

### Support
- Check the logs for detailed error messages
- Verify all environment variables are set
- Ensure Supabase project is active and accessible
- Test individual components using the test scripts

---

**🎉 Your crypto trading system is now ready for production use!**

The system implements all the specifications from your comprehensive trading rules document and is designed for immediate deployment with real trading capabilities. 
-- =====================================================
-- CRYPTO TRADING SYSTEM - SUPABASE DATABASE SETUP
-- =====================================================
-- Run this SQL in your Supabase SQL Editor to create all required tables
-- This will set up the complete database schema for the crypto trading system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- POSITIONS TABLE - Track all trading positions
-- =====================================================
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8) NOT NULL,
    size DECIMAL(20, 8) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('LONG', 'SHORT', 'BUY', 'SELL')),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMPTZ,
    realized_pnl DECIMAL(20, 8) DEFAULT 0,
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
    strategy_type VARCHAR(50) NOT NULL,
    grid_level INTEGER,
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- MARKET DATA TABLE - Store OHLC and technical indicators
-- =====================================================
CREATE TABLE IF NOT EXISTS market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    vwap DECIMAL(20, 8),
    rsi_14 DECIMAL(10, 4),
    macd DECIMAL(20, 8),
    macd_signal DECIMAL(20, 8),
    macd_histogram DECIMAL(20, 8),
    bollinger_upper DECIMAL(20, 8),
    bollinger_middle DECIMAL(20, 8),
    bollinger_lower DECIMAL(20, 8),
    atr_14 DECIMAL(20, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SENTIMENT DATA TABLE - Raw sentiment data from sources
-- =====================================================
CREATE TABLE IF NOT EXISTS sentiment_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) NOT NULL,
    raw_text TEXT,
    compound_score DECIMAL(5, 4),
    positive_score DECIMAL(5, 4),
    negative_score DECIMAL(5, 4),
    neutral_score DECIMAL(5, 4),
    volume_mentions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SENTIMENT ANALYSIS TABLE - Processed sentiment signals
-- =====================================================
CREATE TABLE IF NOT EXISTS sentiment_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    overall_sentiment DECIMAL(5, 4) NOT NULL,
    confidence_score DECIMAL(5, 4) NOT NULL,
    signal_strength VARCHAR(20) CHECK (signal_strength IN ('WEAK', 'MODERATE', 'STRONG')),
    technical_confirmation BOOLEAN DEFAULT FALSE,
    recommendation VARCHAR(20) CHECK (recommendation IN ('BUY', 'SELL', 'HOLD', 'NEUTRAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PERFORMANCE METRICS TABLE - Track strategy performance
-- =====================================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    total_trades INTEGER NOT NULL DEFAULT 0,
    winning_trades INTEGER NOT NULL DEFAULT 0,
    losing_trades INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    average_profit DECIMAL(20, 8) NOT NULL DEFAULT 0,
    average_loss DECIMAL(20, 8) NOT NULL DEFAULT 0,
    profit_factor DECIMAL(10, 4) NOT NULL DEFAULT 0,
    max_drawdown DECIMAL(5, 2) NOT NULL DEFAULT 0,
    sharpe_ratio DECIMAL(10, 4),
    sortino_ratio DECIMAL(10, 4),
    total_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    strategy_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TRADING RULES CONFIG TABLE - Strategy configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS trading_rules_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,
    market_condition VARCHAR(20) NOT NULL CHECK (market_condition IN ('BULL', 'BEAR', 'SIDEWAYS')),
    max_position_size DECIMAL(5, 4) NOT NULL,
    profit_threshold DECIMAL(5, 4) NOT NULL,
    stop_loss_threshold DECIMAL(5, 4) NOT NULL,
    reinvestment_percentage DECIMAL(5, 4) NOT NULL,
    grid_levels INTEGER,
    grid_spacing DECIMAL(10, 6),
    sentiment_threshold DECIMAL(5, 4),
    technical_confirmation_required BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- GRID TRADING STATE TABLE - Grid trading state management
-- =====================================================
CREATE TABLE IF NOT EXISTS grid_trading_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL UNIQUE,
    current_price DECIMAL(20, 8) NOT NULL,
    grid_upper_bound DECIMAL(20, 8) NOT NULL,
    grid_lower_bound DECIMAL(20, 8) NOT NULL,
    grid_spacing DECIMAL(10, 6) NOT NULL,
    total_grid_levels INTEGER NOT NULL,
    active_buy_orders INTEGER NOT NULL DEFAULT 0,
    active_sell_orders INTEGER NOT NULL DEFAULT 0,
    total_invested DECIMAL(20, 8) NOT NULL DEFAULT 0,
    current_profit DECIMAL(20, 8) NOT NULL DEFAULT 0,
    last_rebalance_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_positions_trading_pair ON positions(trading_pair);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_strategy_type ON positions(strategy_type);
CREATE INDEX IF NOT EXISTS idx_positions_grid_level ON positions(grid_level);
CREATE INDEX IF NOT EXISTS idx_positions_entry_time ON positions(entry_time);

CREATE INDEX IF NOT EXISTS idx_market_data_trading_pair ON market_data(trading_pair);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_pair_timestamp ON market_data(trading_pair, timestamp);

CREATE INDEX IF NOT EXISTS idx_sentiment_data_trading_pair ON sentiment_data(trading_pair);
CREATE INDEX IF NOT EXISTS idx_sentiment_data_timestamp ON sentiment_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_sentiment_data_source ON sentiment_data(source);

CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_trading_pair ON sentiment_analysis(trading_pair);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_timestamp ON sentiment_analysis(timestamp);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_trading_pair ON performance_metrics(trading_pair);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_strategy_type ON performance_metrics(strategy_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_trading_rules_config_pair_strategy ON trading_rules_config(trading_pair, strategy_type);
CREATE INDEX IF NOT EXISTS idx_trading_rules_config_market_condition ON trading_rules_config(market_condition);
CREATE INDEX IF NOT EXISTS idx_trading_rules_config_is_active ON trading_rules_config(is_active);

CREATE INDEX IF NOT EXISTS idx_grid_trading_state_trading_pair ON grid_trading_state(trading_pair);

-- =====================================================
-- CREATE TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_rules_config_updated_at BEFORE UPDATE ON trading_rules_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grid_trading_state_updated_at BEFORE UPDATE ON grid_trading_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_rules_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_trading_state ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE BASIC POLICIES (ALLOW ALL FOR NOW)
-- =====================================================
CREATE POLICY "Allow all operations on positions" ON positions FOR ALL USING (true);
CREATE POLICY "Allow all operations on market_data" ON market_data FOR ALL USING (true);
CREATE POLICY "Allow all operations on sentiment_data" ON sentiment_data FOR ALL USING (true);
CREATE POLICY "Allow all operations on sentiment_analysis" ON sentiment_analysis FOR ALL USING (true);
CREATE POLICY "Allow all operations on performance_metrics" ON performance_metrics FOR ALL USING (true);
CREATE POLICY "Allow all operations on trading_rules_config" ON trading_rules_config FOR ALL USING (true);
CREATE POLICY "Allow all operations on grid_trading_state" ON grid_trading_state FOR ALL USING (true);

-- =====================================================
-- INSERT DEFAULT CONFIGURATION DATA
-- =====================================================
INSERT INTO trading_rules_config (
    trading_pair,
    strategy_type,
    market_condition,
    max_position_size,
    profit_threshold,
    stop_loss_threshold,
    reinvestment_percentage,
    grid_levels,
    grid_spacing,
    technical_confirmation_required
) VALUES 
(
    'USDCUSD',
    'STABLE_COIN_GRID',
    'SIDEWAYS',
    0.05,
    0.02,
    0.05,
    0.70,
    20,
    0.002,
    false
),
(
    'USDTUSD',
    'STABLE_COIN_GRID',
    'SIDEWAYS',
    0.05,
    0.02,
    0.05,
    0.70,
    20,
    0.002,
    false
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- CREATE USEFUL VIEWS
-- =====================================================

-- View for active positions with calculated PnL
CREATE OR REPLACE VIEW active_positions_with_pnl AS
SELECT 
    p.*,
    CASE 
        WHEN p.side IN ('LONG', 'BUY') THEN (p.current_price - p.entry_price) * p.size
        WHEN p.side IN ('SHORT', 'SELL') THEN (p.entry_price - p.current_price) * p.size
        ELSE 0
    END as calculated_unrealized_pnl
FROM positions p
WHERE p.status = 'OPEN';

-- View for grid trading summary
CREATE OR REPLACE VIEW grid_trading_summary AS
SELECT 
    gts.trading_pair,
    gts.current_price,
    gts.total_invested,
    gts.current_profit,
    gts.active_buy_orders,
    gts.active_sell_orders,
    gts.last_rebalance_time,
    COUNT(p.id) as total_positions,
    SUM(CASE WHEN p.side IN ('LONG', 'BUY') THEN 1 ELSE 0 END) as long_positions,
    SUM(CASE WHEN p.side IN ('SHORT', 'SELL') THEN 1 ELSE 0 END) as short_positions,
    AVG(p.entry_price) as avg_entry_price,
    SUM(p.realized_pnl) as total_realized_pnl
FROM grid_trading_state gts
LEFT JOIN positions p ON gts.trading_pair = p.trading_pair 
    AND p.strategy_type = 'STABLE_COIN_GRID' 
    AND p.status = 'OPEN'
GROUP BY gts.id, gts.trading_pair, gts.current_price, gts.total_invested, 
         gts.current_profit, gts.active_buy_orders, gts.active_sell_orders, 
         gts.last_rebalance_time;

-- =====================================================
-- CREATE PERFORMANCE CALCULATION FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_portfolio_performance(
    p_trading_pair VARCHAR(20),
    p_strategy_type VARCHAR(50),
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_trades INTEGER,
    winning_trades INTEGER,
    losing_trades INTEGER,
    win_rate DECIMAL(5,2),
    total_pnl DECIMAL(20,8),
    avg_profit DECIMAL(20,8),
    avg_loss DECIMAL(20,8),
    profit_factor DECIMAL(10,4),
    max_drawdown DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_trades,
        COUNT(CASE WHEN realized_pnl > 0 THEN 1 END)::INTEGER as winning_trades,
        COUNT(CASE WHEN realized_pnl < 0 THEN 1 END)::INTEGER as losing_trades,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(CASE WHEN realized_pnl > 0 THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100, 2)
            ELSE 0
        END as win_rate,
        COALESCE(SUM(realized_pnl), 0) as total_pnl,
        COALESCE(AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl END), 0) as avg_profit,
        COALESCE(AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl END), 0) as avg_loss,
        CASE 
            WHEN ABS(AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl END)) > 0 THEN
                ABS(AVG(CASE WHEN realized_pnl > 0 THEN realized_pnl END) / AVG(CASE WHEN realized_pnl < 0 THEN realized_pnl END))
            ELSE 0
        END as profit_factor,
        0.00 as max_drawdown -- Simplified for now
    FROM positions
    WHERE trading_pair = p_trading_pair
        AND strategy_type = p_strategy_type
        AND status = 'CLOSED'
        AND exit_time BETWEEN p_start_date AND p_end_date
        AND realized_pnl IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these queries after the setup to verify everything is working:

-- 1. Check all tables were created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- 2. Check trading rules configuration
-- SELECT * FROM trading_rules_config;

-- 3. Test the performance calculation function
-- SELECT * FROM calculate_portfolio_performance('USDCUSD', 'STABLE_COIN_GRID');

-- 4. Check views
-- SELECT * FROM grid_trading_summary;

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Your crypto trading database is now ready for production use.
-- All tables, indexes, triggers, views, and functions have been created.
-- 
-- Next steps:
-- 1. Verify the setup by running the verification queries above
-- 2. Test the connection from your application
-- 3. Start the trading engine
-- ===================================================== 
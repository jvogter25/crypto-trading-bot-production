-- Volatile Asset Trading Database Schema
-- Supports sentiment-driven trading for BTC, ETH, and major altcoins

-- Table for volatile asset positions
CREATE TABLE IF NOT EXISTS volatile_asset_positions (
    id VARCHAR(50) PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    size DECIMAL(20,8) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8) NOT NULL,
    unrealized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
    unrealized_pnl_percent DECIMAL(10,6) NOT NULL DEFAULT 0,
    realized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
    stop_loss DECIMAL(20,8) NOT NULL,
    trailing_stop DECIMAL(20,8) NOT NULL,
    profit_target DECIMAL(20,8) NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL,
    last_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    market_condition VARCHAR(10) NOT NULL CHECK (market_condition IN ('BULL', 'BEAR', 'SIDEWAYS')),
    sentiment_score DECIMAL(5,2) NOT NULL, -- 0-100 scale
    confidence DECIMAL(5,2) NOT NULL, -- 0-100 scale
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'STOPPED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for trading signals
CREATE TABLE IF NOT EXISTS trading_signals (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD', 'CLOSE')),
    strength DECIMAL(5,2) NOT NULL, -- 0-100 scale
    confidence DECIMAL(5,2) NOT NULL, -- 0-100 scale
    reasoning TEXT,
    position_size DECIMAL(5,4) NOT NULL, -- Percentage of portfolio
    profit_target DECIMAL(20,8) NOT NULL,
    stop_loss DECIMAL(20,8) NOT NULL,
    sentiment_score DECIMAL(5,2) NOT NULL, -- 0-100 scale
    technical_score DECIMAL(5,2) NOT NULL, -- 0-100 scale
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for trade executions
CREATE TABLE IF NOT EXISTS trade_executions (
    id VARCHAR(50) PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL')),
    size DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    total_value DECIMAL(20,8) NOT NULL,
    sentiment_score DECIMAL(5,2) NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    market_condition VARCHAR(10) NOT NULL,
    profit_target DECIMAL(20,8) NOT NULL,
    stop_loss DECIMAL(20,8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    order_id VARCHAR(50),
    fees DECIMAL(20,8) DEFAULT 0,
    slippage DECIMAL(6,4) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for technical indicators
CREATE TABLE IF NOT EXISTS technical_indicators_history (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    rsi_value DECIMAL(5,2) NOT NULL,
    rsi_signal VARCHAR(15) NOT NULL,
    macd_value DECIMAL(10,6) NOT NULL,
    macd_signal DECIMAL(10,6) NOT NULL,
    macd_histogram DECIMAL(10,6) NOT NULL,
    macd_crossover VARCHAR(10) NOT NULL,
    macd_trend VARCHAR(10) NOT NULL,
    sma_20 DECIMAL(20,8) NOT NULL,
    sma_50 DECIMAL(20,8) NOT NULL,
    ema_12 DECIMAL(20,8) NOT NULL,
    ema_26 DECIMAL(20,8) NOT NULL,
    ma_trend VARCHAR(10) NOT NULL,
    atr_value DECIMAL(20,8) NOT NULL,
    volume_current DECIMAL(20,2) NOT NULL,
    volume_average DECIMAL(20,2) NOT NULL,
    volume_ratio DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for market conditions
CREATE TABLE IF NOT EXISTS market_conditions_history (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    condition VARCHAR(10) NOT NULL CHECK (condition IN ('BULL', 'BEAR', 'SIDEWAYS')),
    confidence DECIMAL(5,3) NOT NULL,
    sentiment_indicator DECIMAL(6,4) NOT NULL,
    rsi_indicator DECIMAL(5,2) NOT NULL,
    macd_indicator DECIMAL(10,6) NOT NULL,
    volume_indicator DECIMAL(5,2) NOT NULL,
    trend_indicator VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for performance tracking
CREATE TABLE IF NOT EXISTS volatile_asset_performance (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_trades INTEGER NOT NULL DEFAULT 0,
    winning_trades INTEGER NOT NULL DEFAULT 0,
    losing_trades INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(5,3) NOT NULL DEFAULT 0,
    total_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
    realized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
    unrealized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
    max_drawdown DECIMAL(5,3) NOT NULL DEFAULT 0,
    sharpe_ratio DECIMAL(6,3),
    profit_factor DECIMAL(6,3),
    average_win DECIMAL(20,8) DEFAULT 0,
    average_loss DECIMAL(20,8) DEFAULT 0,
    largest_win DECIMAL(20,8) DEFAULT 0,
    largest_loss DECIMAL(20,8) DEFAULT 0,
    bull_market_pnl DECIMAL(20,8) DEFAULT 0,
    bear_market_pnl DECIMAL(20,8) DEFAULT 0,
    sideways_market_pnl DECIMAL(20,8) DEFAULT 0,
    sentiment_accuracy DECIMAL(5,3) DEFAULT 0,
    technical_accuracy DECIMAL(5,3) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for sentiment vs technical correlation
CREATE TABLE IF NOT EXISTS sentiment_technical_correlation (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    analysis_date DATE NOT NULL,
    sentiment_signals INTEGER NOT NULL DEFAULT 0,
    technical_signals INTEGER NOT NULL DEFAULT 0,
    aligned_signals INTEGER NOT NULL DEFAULT 0,
    alignment_rate DECIMAL(5,3) NOT NULL DEFAULT 0,
    sentiment_accuracy DECIMAL(5,3) NOT NULL DEFAULT 0,
    technical_accuracy DECIMAL(5,3) NOT NULL DEFAULT 0,
    combined_accuracy DECIMAL(5,3) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(symbol, analysis_date)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_volatile_positions_symbol_status ON volatile_asset_positions(symbol, status);
CREATE INDEX IF NOT EXISTS idx_volatile_positions_status ON volatile_asset_positions(status);
CREATE INDEX IF NOT EXISTS idx_volatile_positions_entry_time ON volatile_asset_positions(entry_time DESC);

CREATE INDEX IF NOT EXISTS idx_trading_signals_symbol_timestamp ON trading_signals(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trading_signals_action ON trading_signals(action);
CREATE INDEX IF NOT EXISTS idx_trading_signals_strength ON trading_signals(strength DESC);

CREATE INDEX IF NOT EXISTS idx_trade_executions_symbol_timestamp ON trade_executions(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trade_executions_action ON trade_executions(action);

CREATE INDEX IF NOT EXISTS idx_technical_indicators_symbol_timestamp ON technical_indicators_history(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_conditions_symbol_timestamp ON market_conditions_history(symbol, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_performance_symbol_period ON volatile_asset_performance(symbol, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sentiment_technical_symbol_date ON sentiment_technical_correlation(symbol, analysis_date DESC);

-- Views for easy data access

-- Current active positions with performance metrics
CREATE OR REPLACE VIEW active_volatile_positions AS
SELECT 
    p.*,
    (p.current_price - p.entry_price) / p.entry_price * 100 as pnl_percentage,
    CASE 
        WHEN p.current_price >= p.profit_target THEN 'PROFIT_TARGET'
        WHEN p.current_price <= p.stop_loss THEN 'STOP_LOSS'
        WHEN p.current_price <= p.trailing_stop THEN 'TRAILING_STOP'
        ELSE 'ACTIVE'
    END as position_status,
    EXTRACT(EPOCH FROM (NOW() - p.entry_time))/3600 as hours_held,
    CASE 
        WHEN p.market_condition = 'BULL' THEN 0.08
        WHEN p.market_condition = 'BEAR' THEN 0.015
        ELSE 0.03
    END as target_profit_threshold
FROM volatile_asset_positions p
WHERE p.status = 'ACTIVE'
ORDER BY p.entry_time DESC;

-- Latest technical indicators for each symbol
CREATE OR REPLACE VIEW latest_technical_indicators AS
SELECT DISTINCT ON (symbol)
    symbol,
    timestamp,
    price,
    rsi_value,
    rsi_signal,
    macd_trend,
    ma_trend,
    atr_value,
    volume_ratio
FROM technical_indicators_history
ORDER BY symbol, timestamp DESC;

-- Latest market conditions for each symbol
CREATE OR REPLACE VIEW latest_market_conditions AS
SELECT DISTINCT ON (symbol)
    symbol,
    condition,
    confidence,
    sentiment_indicator,
    rsi_indicator,
    macd_indicator,
    volume_indicator,
    trend_indicator,
    timestamp
FROM market_conditions_history
ORDER BY symbol, timestamp DESC;

-- Trading performance summary by symbol
CREATE OR REPLACE VIEW volatile_trading_summary AS
SELECT 
    symbol,
    COUNT(*) as total_signals,
    COUNT(CASE WHEN action = 'BUY' THEN 1 END) as buy_signals,
    COUNT(CASE WHEN action = 'CLOSE' THEN 1 END) as close_signals,
    AVG(strength) as avg_strength,
    AVG(confidence) as avg_confidence,
    AVG(sentiment_score) as avg_sentiment_score,
    AVG(technical_score) as avg_technical_score,
    MAX(timestamp) as last_signal_time
FROM trading_signals
GROUP BY symbol
ORDER BY total_signals DESC;

-- Daily sentiment vs technical alignment
CREATE OR REPLACE VIEW daily_signal_alignment AS
SELECT 
    symbol,
    DATE(timestamp) as signal_date,
    COUNT(*) as total_signals,
    COUNT(CASE WHEN action IN ('BUY', 'CLOSE') THEN 1 END) as actionable_signals,
    AVG(sentiment_score) as avg_sentiment,
    AVG(technical_score) as avg_technical,
    COUNT(CASE WHEN ABS(sentiment_score - technical_score) <= 20 THEN 1 END) as aligned_signals,
    COUNT(CASE WHEN ABS(sentiment_score - technical_score) <= 20 THEN 1 END)::DECIMAL / COUNT(*) as alignment_rate
FROM trading_signals
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY symbol, DATE(timestamp)
ORDER BY symbol, signal_date DESC;

-- Profit target achievement analysis
CREATE OR REPLACE VIEW profit_target_analysis AS
SELECT 
    te.symbol,
    te.market_condition,
    COUNT(*) as total_trades,
    AVG(te.price) as avg_entry_price,
    AVG(te.profit_target) as avg_profit_target,
    AVG((te.profit_target - te.price) / te.price * 100) as avg_target_percent,
    COUNT(CASE WHEN te.action = 'BUY' THEN 1 END) as buy_trades,
    COUNT(CASE WHEN te.action = 'SELL' THEN 1 END) as sell_trades
FROM trade_executions te
WHERE te.timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY te.symbol, te.market_condition
ORDER BY te.symbol, total_trades DESC;

-- Functions for trading analysis

-- Function to calculate position PnL
CREATE OR REPLACE FUNCTION calculate_volatile_position_pnl(
    entry_price DECIMAL(20,8),
    current_price DECIMAL(20,8),
    position_size DECIMAL(20,8)
)
RETURNS TABLE(
    pnl_amount DECIMAL(20,8),
    pnl_percent DECIMAL(10,6)
) AS $$
BEGIN
    RETURN QUERY SELECT 
        (current_price - entry_price) * position_size,
        (current_price - entry_price) / entry_price;
END;
$$ LANGUAGE plpgsql;

-- Function to determine if position should be closed
CREATE OR REPLACE FUNCTION should_close_volatile_position(
    symbol_param VARCHAR(10),
    current_price DECIMAL(20,8)
)
RETURNS TABLE(
    should_close BOOLEAN,
    reason VARCHAR(50),
    action_type VARCHAR(20)
) AS $$
DECLARE
    pos RECORD;
    profit_threshold DECIMAL(5,3);
BEGIN
    SELECT * INTO pos FROM volatile_asset_positions 
    WHERE symbol = symbol_param AND status = 'ACTIVE'
    ORDER BY entry_time DESC LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'NO_POSITION', 'NONE';
        RETURN;
    END IF;
    
    -- Determine profit threshold based on market condition
    profit_threshold := CASE 
        WHEN pos.market_condition = 'BULL' THEN 0.08
        WHEN pos.market_condition = 'BEAR' THEN 0.015
        ELSE 0.03
    END;
    
    -- Check profit target
    IF current_price >= pos.profit_target THEN
        RETURN QUERY SELECT TRUE, 'PROFIT_TARGET', 'TAKE_PROFIT';
        RETURN;
    END IF;
    
    -- Check dynamic profit threshold
    IF (current_price - pos.entry_price) / pos.entry_price >= profit_threshold THEN
        RETURN QUERY SELECT TRUE, 'PROFIT_THRESHOLD', 'TAKE_PROFIT';
        RETURN;
    END IF;
    
    -- Check stop loss
    IF current_price <= pos.stop_loss THEN
        RETURN QUERY SELECT TRUE, 'STOP_LOSS', 'STOP_LOSS';
        RETURN;
    END IF;
    
    -- Check trailing stop
    IF current_price <= pos.trailing_stop THEN
        RETURN QUERY SELECT TRUE, 'TRAILING_STOP', 'TRAILING_STOP';
        RETURN;
    END IF;
    
    RETURN QUERY SELECT FALSE, 'HOLD', 'HOLD';
END;
$$ LANGUAGE plpgsql;

-- Function to update position with current price and trailing stop
CREATE OR REPLACE FUNCTION update_volatile_position_price(
    symbol_param VARCHAR(10),
    new_price DECIMAL(20,8)
)
RETURNS BOOLEAN AS $$
DECLARE
    pos RECORD;
    new_trailing_stop DECIMAL(20,8);
    pnl_percent DECIMAL(10,6);
BEGIN
    SELECT * INTO pos FROM volatile_asset_positions 
    WHERE symbol = symbol_param AND status = 'ACTIVE'
    ORDER BY entry_time DESC LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate PnL percentage
    pnl_percent := (new_price - pos.entry_price) / pos.entry_price;
    
    -- Update trailing stop if in profit (start trailing after 1% profit)
    new_trailing_stop := pos.trailing_stop;
    IF pnl_percent > 0.01 THEN
        new_trailing_stop := GREATEST(pos.trailing_stop, new_price * 0.98); -- 2% trailing stop
    END IF;
    
    -- Update position
    UPDATE volatile_asset_positions SET
        current_price = new_price,
        unrealized_pnl = (new_price - entry_price) * size,
        unrealized_pnl_percent = pnl_percent,
        trailing_stop = new_trailing_stop,
        last_update = NOW(),
        updated_at = NOW()
    WHERE symbol = symbol_param AND status = 'ACTIVE';
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze sentiment vs technical alignment
CREATE OR REPLACE FUNCTION analyze_sentiment_technical_alignment(
    symbol_param VARCHAR(10),
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE(
    total_signals INTEGER,
    aligned_signals INTEGER,
    alignment_rate DECIMAL(5,3),
    avg_sentiment DECIMAL(5,2),
    avg_technical DECIMAL(5,2),
    sentiment_accuracy DECIMAL(5,3)
) AS $$
DECLARE
    start_date TIMESTAMPTZ;
BEGIN
    start_date := NOW() - (days_back || ' days')::INTERVAL;
    
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_signals,
        COUNT(CASE WHEN ABS(ts.sentiment_score - ts.technical_score) <= 20 THEN 1 END)::INTEGER as aligned_signals,
        (COUNT(CASE WHEN ABS(ts.sentiment_score - ts.technical_score) <= 20 THEN 1 END)::DECIMAL / COUNT(*)) as alignment_rate,
        AVG(ts.sentiment_score) as avg_sentiment,
        AVG(ts.technical_score) as avg_technical,
        -- Calculate sentiment accuracy based on profitable trades
        COALESCE(
            (SELECT COUNT(CASE WHEN te.action = 'SELL' AND te.total_value > te.size * (
                SELECT te2.price FROM trade_executions te2 
                WHERE te2.symbol = te.symbol AND te2.action = 'BUY' 
                AND te2.timestamp < te.timestamp 
                ORDER BY te2.timestamp DESC LIMIT 1
            ) THEN 1 END)::DECIMAL / NULLIF(COUNT(CASE WHEN te.action = 'SELL' THEN 1 END), 0)
            FROM trade_executions te 
            WHERE te.symbol = symbol_param AND te.timestamp >= start_date), 0
        ) as sentiment_accuracy
    FROM trading_signals ts
    WHERE ts.symbol = symbol_param 
    AND ts.timestamp >= start_date;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update position timestamps
CREATE OR REPLACE FUNCTION update_volatile_position_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_volatile_position_timestamp ON volatile_asset_positions;
CREATE TRIGGER update_volatile_position_timestamp
    BEFORE UPDATE ON volatile_asset_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_volatile_position_timestamp();

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON volatile_asset_positions TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON trading_signals TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON trade_executions TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON technical_indicators_history TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON market_conditions_history TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON volatile_asset_performance TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON sentiment_technical_correlation TO trading_bot;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO trading_bot; 
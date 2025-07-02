-- AltCoin Sentiment Trading Database Schema
-- Stores positions, trades, and performance data for sentiment-driven strategy

-- Table for active altcoin positions
CREATE TABLE IF NOT EXISTS altcoin_positions (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    size DECIMAL(20,8) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8) NOT NULL,
    unrealized_pnl DECIMAL(10,6) NOT NULL DEFAULT 0,
    realized_pnl DECIMAL(20,8) NOT NULL DEFAULT 0,
    stop_loss DECIMAL(20,8) NOT NULL,
    trailing_stop DECIMAL(20,8) NOT NULL,
    profit_target DECIMAL(20,8) NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL,
    last_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pyramid_level INTEGER NOT NULL DEFAULT 1,
    max_pyramid_level INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'STOPPED')),
    market_condition VARCHAR(10) NOT NULL DEFAULT 'NEUTRAL' CHECK (market_condition IN ('BULL', 'BEAR', 'SIDEWAYS', 'NEUTRAL')),
    entry_sentiment DECIMAL(6,4),
    entry_confidence DECIMAL(5,3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for altcoin trade executions
CREATE TABLE IF NOT EXISTS altcoin_trades (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL', 'PYRAMID', 'CLOSE')),
    order_id VARCHAR(50),
    size DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    total_value DECIMAL(20,8) NOT NULL,
    confidence DECIMAL(5,3) NOT NULL,
    reasoning TEXT,
    sentiment_score DECIMAL(6,4),
    rsi_value DECIMAL(5,2),
    macd_signal VARCHAR(20),
    bollinger_position VARCHAR(10),
    market_condition VARCHAR(10),
    profit_threshold DECIMAL(5,3),
    position_size_percent DECIMAL(5,3),
    fees DECIMAL(20,8) DEFAULT 0,
    slippage DECIMAL(6,4) DEFAULT 0,
    execution_time TIMESTAMPTZ NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for market condition analysis
CREATE TABLE IF NOT EXISTS market_conditions (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    condition_type VARCHAR(10) NOT NULL CHECK (condition_type IN ('BULL', 'BEAR', 'SIDEWAYS')),
    confidence DECIMAL(5,3) NOT NULL,
    sentiment_score DECIMAL(6,4) NOT NULL,
    rsi_value DECIMAL(5,2) NOT NULL,
    macd_histogram DECIMAL(10,6) NOT NULL,
    bollinger_position VARCHAR(10) NOT NULL,
    volume_ratio DECIMAL(5,2) NOT NULL,
    trend_strength DECIMAL(5,3) NOT NULL,
    analysis_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for technical indicators history
CREATE TABLE IF NOT EXISTS technical_indicators (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    rsi_value DECIMAL(5,2) NOT NULL,
    rsi_signal VARCHAR(15) NOT NULL,
    macd_value DECIMAL(10,6) NOT NULL,
    macd_signal_value DECIMAL(10,6) NOT NULL,
    macd_histogram DECIMAL(10,6) NOT NULL,
    macd_signal_type VARCHAR(20) NOT NULL,
    bollinger_upper DECIMAL(20,8) NOT NULL,
    bollinger_middle DECIMAL(20,8) NOT NULL,
    bollinger_lower DECIMAL(20,8) NOT NULL,
    bollinger_position VARCHAR(10) NOT NULL,
    bollinger_squeeze BOOLEAN NOT NULL DEFAULT FALSE,
    atr_value DECIMAL(20,8) NOT NULL,
    atr_volatility VARCHAR(10) NOT NULL,
    volume_current DECIMAL(20,2) NOT NULL,
    volume_average DECIMAL(20,2) NOT NULL,
    volume_ratio DECIMAL(5,2) NOT NULL,
    volume_trend VARCHAR(15) NOT NULL,
    overall_trend VARCHAR(10) NOT NULL,
    trend_strength DECIMAL(5,3) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for strategy performance tracking
CREATE TABLE IF NOT EXISTS altcoin_performance (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for profit distribution tracking (70% reinvestment rule)
CREATE TABLE IF NOT EXISTS profit_distributions (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    trade_id BIGINT REFERENCES altcoin_trades(id),
    total_profit DECIMAL(20,8) NOT NULL,
    reinvested_amount DECIMAL(20,8) NOT NULL,
    withdrawn_amount DECIMAL(20,8) NOT NULL,
    reinvestment_percentage DECIMAL(5,3) NOT NULL DEFAULT 0.70,
    distribution_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_altcoin_positions_symbol_status ON altcoin_positions(symbol, status);
CREATE INDEX IF NOT EXISTS idx_altcoin_positions_status ON altcoin_positions(status);
CREATE INDEX IF NOT EXISTS idx_altcoin_positions_entry_time ON altcoin_positions(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_altcoin_positions_last_update ON altcoin_positions(last_update DESC);

CREATE INDEX IF NOT EXISTS idx_altcoin_trades_symbol_timestamp ON altcoin_trades(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_altcoin_trades_action ON altcoin_trades(action);
CREATE INDEX IF NOT EXISTS idx_altcoin_trades_execution_time ON altcoin_trades(execution_time DESC);

CREATE INDEX IF NOT EXISTS idx_market_conditions_symbol_timestamp ON market_conditions(symbol, analysis_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_conditions_type ON market_conditions(condition_type);

CREATE INDEX IF NOT EXISTS idx_technical_indicators_symbol_timestamp ON technical_indicators(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_technical_indicators_timestamp ON technical_indicators(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_altcoin_performance_symbol_period ON altcoin_performance(symbol, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_profit_distributions_symbol_timestamp ON profit_distributions(symbol, distribution_timestamp DESC);

-- Views for easy data access

-- Current active positions with performance
CREATE OR REPLACE VIEW active_altcoin_positions AS
SELECT 
    p.*,
    (p.current_price - p.entry_price) / p.entry_price * 100 as pnl_percentage,
    CASE 
        WHEN p.current_price >= p.profit_target THEN 'PROFIT_TARGET'
        WHEN p.current_price <= p.stop_loss THEN 'STOP_LOSS'
        WHEN p.current_price <= p.trailing_stop THEN 'TRAILING_STOP'
        ELSE 'ACTIVE'
    END as position_status,
    EXTRACT(EPOCH FROM (NOW() - p.entry_time))/3600 as hours_held
FROM altcoin_positions p
WHERE p.status = 'ACTIVE'
ORDER BY p.entry_time DESC;

-- Latest market conditions for each symbol
CREATE OR REPLACE VIEW latest_market_conditions AS
SELECT DISTINCT ON (symbol)
    symbol,
    condition_type,
    confidence,
    sentiment_score,
    rsi_value,
    macd_histogram,
    bollinger_position,
    volume_ratio,
    trend_strength,
    analysis_timestamp
FROM market_conditions
ORDER BY symbol, analysis_timestamp DESC;

-- Trading performance summary by symbol
CREATE OR REPLACE VIEW altcoin_trading_summary AS
SELECT 
    symbol,
    COUNT(*) as total_trades,
    COUNT(CASE WHEN action IN ('CLOSE', 'SELL') AND size > 0 THEN 1 END) as completed_trades,
    SUM(CASE WHEN action = 'BUY' THEN total_value ELSE -total_value END) as net_investment,
    AVG(confidence) as avg_confidence,
    COUNT(CASE WHEN reasoning LIKE '%profit%' THEN 1 END) as profit_exits,
    COUNT(CASE WHEN reasoning LIKE '%stop%' THEN 1 END) as stop_exits,
    MAX(timestamp) as last_trade_time
FROM altcoin_trades
GROUP BY symbol
ORDER BY total_trades DESC;

-- Sentiment vs performance correlation
CREATE OR REPLACE VIEW sentiment_performance_correlation AS
SELECT 
    t.symbol,
    DATE_TRUNC('day', t.timestamp) as trade_date,
    AVG(t.sentiment_score) as avg_sentiment,
    SUM(CASE WHEN t.action = 'CLOSE' THEN 
        (t.price - LAG(t.price) OVER (PARTITION BY t.symbol ORDER BY t.timestamp)) / LAG(t.price) OVER (PARTITION BY t.symbol ORDER BY t.timestamp) * 100
        ELSE 0 END) as daily_pnl_percent,
    COUNT(*) as trades_count
FROM altcoin_trades t
WHERE t.sentiment_score IS NOT NULL
GROUP BY t.symbol, DATE_TRUNC('day', t.timestamp)
HAVING COUNT(*) > 0
ORDER BY t.symbol, trade_date DESC;

-- Market condition effectiveness
CREATE OR REPLACE VIEW market_condition_effectiveness AS
SELECT 
    mc.condition_type,
    COUNT(t.id) as trades_in_condition,
    AVG(CASE WHEN t.action = 'CLOSE' THEN 
        (t.price - LAG(t.price) OVER (PARTITION BY t.symbol ORDER BY t.timestamp)) / LAG(t.price) OVER (PARTITION BY t.symbol ORDER BY t.timestamp) * 100
        ELSE NULL END) as avg_pnl_percent,
    AVG(mc.confidence) as avg_condition_confidence,
    COUNT(CASE WHEN t.reasoning LIKE '%profit%' THEN 1 END) as profitable_exits
FROM market_conditions mc
LEFT JOIN altcoin_trades t ON mc.symbol = t.symbol 
    AND t.timestamp BETWEEN mc.analysis_timestamp - INTERVAL '30 minutes' 
    AND mc.analysis_timestamp + INTERVAL '30 minutes'
GROUP BY mc.condition_type
ORDER BY avg_pnl_percent DESC NULLS LAST;

-- Functions for strategy management

-- Function to calculate position PnL
CREATE OR REPLACE FUNCTION calculate_position_pnl(
    entry_price DECIMAL(20,8),
    current_price DECIMAL(20,8),
    position_size DECIMAL(20,8)
)
RETURNS DECIMAL(20,8) AS $$
BEGIN
    RETURN (current_price - entry_price) * position_size;
END;
$$ LANGUAGE plpgsql;

-- Function to determine if position should be closed
CREATE OR REPLACE FUNCTION should_close_position(
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
BEGIN
    SELECT * INTO pos FROM altcoin_positions 
    WHERE symbol = symbol_param AND status = 'ACTIVE'
    ORDER BY entry_time DESC LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'NO_POSITION', 'NONE';
        RETURN;
    END IF;
    
    -- Check profit target
    IF current_price >= pos.profit_target THEN
        RETURN QUERY SELECT TRUE, 'PROFIT_TARGET', 'TAKE_PROFIT';
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

-- Function to update position with current price
CREATE OR REPLACE FUNCTION update_position_price(
    symbol_param VARCHAR(10),
    new_price DECIMAL(20,8)
)
RETURNS BOOLEAN AS $$
DECLARE
    pos RECORD;
    new_trailing_stop DECIMAL(20,8);
    pnl_percent DECIMAL(10,6);
BEGIN
    SELECT * INTO pos FROM altcoin_positions 
    WHERE symbol = symbol_param AND status = 'ACTIVE'
    ORDER BY entry_time DESC LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate PnL percentage
    pnl_percent := (new_price - pos.entry_price) / pos.entry_price;
    
    -- Update trailing stop if in profit
    new_trailing_stop := pos.trailing_stop;
    IF pnl_percent > 0.01 THEN -- Start trailing after 1% profit
        new_trailing_stop := GREATEST(pos.trailing_stop, new_price * 0.98); -- 2% trailing stop
    END IF;
    
    -- Update position
    UPDATE altcoin_positions SET
        current_price = new_price,
        unrealized_pnl = pnl_percent,
        trailing_stop = new_trailing_stop,
        last_update = NOW(),
        updated_at = NOW()
    WHERE symbol = symbol_param AND status = 'ACTIVE';
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to close position and calculate final PnL
CREATE OR REPLACE FUNCTION close_position(
    symbol_param VARCHAR(10),
    exit_price DECIMAL(20,8),
    exit_reason VARCHAR(50)
)
RETURNS TABLE(
    realized_pnl DECIMAL(20,8),
    pnl_percent DECIMAL(10,6),
    reinvest_amount DECIMAL(20,8)
) AS $$
DECLARE
    pos RECORD;
    final_pnl DECIMAL(20,8);
    final_pnl_percent DECIMAL(10,6);
    reinvest_amt DECIMAL(20,8);
BEGIN
    SELECT * INTO pos FROM altcoin_positions 
    WHERE symbol = symbol_param AND status = 'ACTIVE'
    ORDER BY entry_time DESC LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0::DECIMAL(20,8), 0::DECIMAL(10,6), 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    -- Calculate final PnL
    final_pnl := (exit_price - pos.entry_price) * pos.size;
    final_pnl_percent := (exit_price - pos.entry_price) / pos.entry_price;
    
    -- Calculate reinvestment amount (70% of profit)
    reinvest_amt := 0;
    IF final_pnl > 0 THEN
        reinvest_amt := final_pnl * 0.70;
        
        -- Record profit distribution
        INSERT INTO profit_distributions (
            symbol, total_profit, reinvested_amount, withdrawn_amount, reinvestment_percentage
        ) VALUES (
            symbol_param, final_pnl, reinvest_amt, final_pnl - reinvest_amt, 0.70
        );
    END IF;
    
    -- Close position
    UPDATE altcoin_positions SET
        status = 'CLOSED',
        current_price = exit_price,
        realized_pnl = final_pnl,
        unrealized_pnl = 0,
        updated_at = NOW()
    WHERE symbol = symbol_param AND status = 'ACTIVE';
    
    RETURN QUERY SELECT final_pnl, final_pnl_percent, reinvest_amt;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update position timestamps
CREATE OR REPLACE FUNCTION update_position_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_altcoin_position_timestamp ON altcoin_positions;
CREATE TRIGGER update_altcoin_position_timestamp
    BEFORE UPDATE ON altcoin_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_position_timestamp();

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON altcoin_positions TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON altcoin_trades TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON market_conditions TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON technical_indicators TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON altcoin_performance TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON profit_distributions TO trading_bot;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO trading_bot; 
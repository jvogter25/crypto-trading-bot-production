-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create positions table
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8) NOT NULL,
    size DECIMAL(20, 8) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
    entry_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMPTZ,
    realized_pnl DECIMAL(20, 8),
    unrealized_pnl DECIMAL(20, 8),
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    strategy_type VARCHAR(50) NOT NULL,
    grid_level INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create market_data table
CREATE TABLE market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(30, 8) NOT NULL,
    vwap DECIMAL(20, 8),
    rsi_14 DECIMAL(10, 4),
    macd DECIMAL(20, 8),
    macd_signal DECIMAL(20, 8),
    macd_histogram DECIMAL(20, 8),
    bollinger_upper DECIMAL(20, 8),
    bollinger_middle DECIMAL(20, 8),
    bollinger_lower DECIMAL(20, 8),
    atr_14 DECIMAL(20, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create sentiment_data table
CREATE TABLE sentiment_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) NOT NULL,
    raw_text TEXT NOT NULL,
    compound_score DECIMAL(4, 3) NOT NULL,
    positive_score DECIMAL(4, 3) NOT NULL,
    negative_score DECIMAL(4, 3) NOT NULL,
    neutral_score DECIMAL(4, 3) NOT NULL,
    volume INTEGER NOT NULL,
    engagement_score DECIMAL(10, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create sentiment_analysis table
CREATE TABLE sentiment_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    sentiment_score DECIMAL(4, 3) NOT NULL,
    sentiment_trend VARCHAR(20) NOT NULL CHECK (sentiment_trend IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    confidence_score DECIMAL(4, 3) NOT NULL,
    volume_weight DECIMAL(4, 3) NOT NULL,
    signal_strength DECIMAL(4, 3) NOT NULL,
    technical_confirmation BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create performance_metrics table
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    total_trades INTEGER NOT NULL,
    winning_trades INTEGER NOT NULL,
    losing_trades INTEGER NOT NULL,
    win_rate DECIMAL(5, 2) NOT NULL,
    average_profit DECIMAL(10, 4) NOT NULL,
    average_loss DECIMAL(10, 4) NOT NULL,
    profit_factor DECIMAL(10, 4) NOT NULL,
    max_drawdown DECIMAL(10, 4) NOT NULL,
    sharpe_ratio DECIMAL(10, 4),
    sortino_ratio DECIMAL(10, 4),
    total_pnl DECIMAL(20, 8) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trading_rules_config table
CREATE TABLE trading_rules_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL,
    market_condition VARCHAR(20) NOT NULL CHECK (market_condition IN ('BULL', 'BEAR', 'SIDEWAYS')),
    max_position_size DECIMAL(5, 2) NOT NULL,
    profit_threshold DECIMAL(5, 2) NOT NULL,
    stop_loss_threshold DECIMAL(5, 2) NOT NULL,
    reinvestment_percentage DECIMAL(5, 2) NOT NULL,
    grid_levels INTEGER,
    grid_spacing DECIMAL(5, 2),
    sentiment_threshold DECIMAL(4, 3),
    technical_confirmation_required BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create grid_trading_state table
CREATE TABLE grid_trading_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair VARCHAR(20) NOT NULL,
    current_price DECIMAL(20, 8) NOT NULL,
    grid_upper_bound DECIMAL(20, 8) NOT NULL,
    grid_lower_bound DECIMAL(20, 8) NOT NULL,
    grid_spacing DECIMAL(5, 2) NOT NULL,
    total_grid_levels INTEGER NOT NULL,
    active_buy_orders INTEGER NOT NULL,
    active_sell_orders INTEGER NOT NULL,
    total_invested DECIMAL(20, 8) NOT NULL,
    current_profit DECIMAL(20, 8) NOT NULL,
    last_rebalance_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_positions_trading_pair ON positions(trading_pair);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_entry_time ON positions(entry_time);
CREATE INDEX idx_market_data_trading_pair ON market_data(trading_pair);
CREATE INDEX idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX idx_sentiment_data_trading_pair ON sentiment_data(trading_pair);
CREATE INDEX idx_sentiment_data_timestamp ON sentiment_data(timestamp);
CREATE INDEX idx_sentiment_data_source ON sentiment_data(source);
CREATE INDEX idx_sentiment_analysis_trading_pair ON sentiment_analysis(trading_pair);
CREATE INDEX idx_sentiment_analysis_timestamp ON sentiment_analysis(timestamp);
CREATE INDEX idx_sentiment_analysis_trend ON sentiment_analysis(sentiment_trend);
CREATE INDEX idx_performance_metrics_trading_pair ON performance_metrics(trading_pair);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX idx_performance_metrics_strategy ON performance_metrics(strategy_type);
CREATE INDEX idx_trading_rules_config_trading_pair ON trading_rules_config(trading_pair);
CREATE INDEX idx_trading_rules_config_strategy ON trading_rules_config(strategy_type);
CREATE INDEX idx_trading_rules_config_market ON trading_rules_config(market_condition);
CREATE INDEX idx_grid_trading_state_trading_pair ON grid_trading_state(trading_pair);

-- Create triggers for updated_at columns
CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_rules_config_updated_at
    BEFORE UPDATE ON trading_rules_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grid_trading_state_updated_at
    BEFORE UPDATE ON grid_trading_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_rules_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_trading_state ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust according to your authentication needs)
CREATE POLICY "Enable read access for all users" ON positions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON market_data FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON sentiment_data FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON sentiment_analysis FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON performance_metrics FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON trading_rules_config FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON grid_trading_state FOR SELECT USING (true); 
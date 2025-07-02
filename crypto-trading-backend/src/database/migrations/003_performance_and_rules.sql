-- Create performance_metrics table
CREATE TABLE performance_metrics (
    id SERIAL PRIMARY KEY,
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trading_rules_config table
CREATE TABLE trading_rules_config (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create grid_trading_state table
CREATE TABLE grid_trading_state (
    id SERIAL PRIMARY KEY,
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
    last_rebalance_time TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_performance_metrics_trading_pair ON performance_metrics(trading_pair);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX idx_performance_metrics_strategy ON performance_metrics(strategy_type);
CREATE INDEX idx_trading_rules_config_trading_pair ON trading_rules_config(trading_pair);
CREATE INDEX idx_trading_rules_config_strategy ON trading_rules_config(strategy_type);
CREATE INDEX idx_trading_rules_config_market ON trading_rules_config(market_condition);
CREATE INDEX idx_grid_trading_state_trading_pair ON grid_trading_state(trading_pair);

-- Create trigger for trading_rules_config table
CREATE TRIGGER update_trading_rules_config_updated_at
    BEFORE UPDATE ON trading_rules_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for grid_trading_state table
CREATE TRIGGER update_grid_trading_state_updated_at
    BEFORE UPDATE ON grid_trading_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 
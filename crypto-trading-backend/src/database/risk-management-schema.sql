-- Comprehensive Risk Management Database Schema
-- Based on exact specifications from Comprehensive Auto-Trading Rules Specification.md

-- Risk Metrics History Table
CREATE TABLE IF NOT EXISTS risk_metrics_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    portfolio_value DECIMAL(15,2) NOT NULL,
    total_exposure DECIMAL(15,2) NOT NULL,
    total_exposure_percent DECIMAL(5,4) NOT NULL,
    cash_reserves DECIMAL(15,2) NOT NULL,
    cash_reserves_percent DECIMAL(5,4) NOT NULL,
    current_drawdown DECIMAL(15,2) NOT NULL DEFAULT 0,
    drawdown_percent DECIMAL(5,4) NOT NULL DEFAULT 0,
    portfolio_high DECIMAL(15,2) NOT NULL,
    max_drawdown DECIMAL(15,2) NOT NULL DEFAULT 0,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY')),
    emergency_stop_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Position Risk Tracking Table
CREATE TABLE IF NOT EXISTS position_risks (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol VARCHAR(20) NOT NULL,
    position_size DECIMAL(20,8) NOT NULL,
    position_value DECIMAL(15,2) NOT NULL,
    exposure_percent DECIMAL(5,4) NOT NULL,
    unrealized_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
    unrealized_pnl_percent DECIMAL(5,4) NOT NULL DEFAULT 0,
    stop_loss DECIMAL(15,8),
    risk_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    risk_percent DECIMAL(5,4) NOT NULL DEFAULT 0,
    liquidity_risk VARCHAR(10) NOT NULL CHECK (liquidity_risk IN ('LOW', 'MEDIUM', 'HIGH')),
    correlation_risk DECIMAL(3,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk Events Log Table
CREATE TABLE IF NOT EXISTS risk_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    event_level VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (event_level IN ('INFO', 'WARNING', 'CRITICAL', 'EMERGENCY')),
    message TEXT NOT NULL,
    data JSONB,
    portfolio_value DECIMAL(15,2),
    drawdown_percent DECIMAL(5,4),
    emergency_stop_active BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drawdown Events Table
CREATE TABLE IF NOT EXISTS drawdown_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) NOT NULL UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    drawdown_percent DECIMAL(5,4) NOT NULL,
    portfolio_value DECIMAL(15,2) NOT NULL,
    portfolio_high DECIMAL(15,2) NOT NULL,
    trigger_level VARCHAR(20) NOT NULL CHECK (trigger_level IN ('WARNING', 'REDUCTION', 'EMERGENCY')),
    action_taken TEXT NOT NULL,
    positions_affected JSONB,
    recovery_started_at TIMESTAMPTZ,
    recovery_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk Alerts Table
CREATE TABLE IF NOT EXISTS risk_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(100) NOT NULL UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('INFO', 'WARNING', 'CRITICAL', 'EMERGENCY')),
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('EXPOSURE', 'DRAWDOWN', 'CORRELATION', 'LIQUIDITY', 'SYSTEM')),
    message TEXT NOT NULL,
    data JSONB,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(100),
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emergency Stops Table
CREATE TABLE IF NOT EXISTS emergency_stops (
    id SERIAL PRIMARY KEY,
    stop_id VARCHAR(100) NOT NULL UNIQUE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    triggered_by VARCHAR(20) NOT NULL CHECK (triggered_by IN ('DRAWDOWN', 'EXPOSURE', 'CORRELATION', 'MANUAL', 'SYSTEM')),
    portfolio_state JSONB NOT NULL,
    actions_executed JSONB NOT NULL,
    recovery_required BOOLEAN NOT NULL DEFAULT TRUE,
    reset_at TIMESTAMPTZ,
    reset_by VARCHAR(100),
    reset_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolio High Tracking Table
CREATE TABLE IF NOT EXISTS portfolio_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    portfolio_value DECIMAL(15,2) NOT NULL,
    is_new_high BOOLEAN NOT NULL DEFAULT FALSE,
    previous_high DECIMAL(15,2),
    drawdown_from_high DECIMAL(15,2) NOT NULL DEFAULT 0,
    drawdown_percent DECIMAL(5,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk Configuration Table
CREATE TABLE IF NOT EXISTS risk_configuration (
    id SERIAL PRIMARY KEY,
    config_name VARCHAR(100) NOT NULL UNIQUE,
    config_value DECIMAL(10,6) NOT NULL,
    config_description TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Correlation Matrix Table
CREATE TABLE IF NOT EXISTS asset_correlations (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol1 VARCHAR(20) NOT NULL,
    symbol2 VARCHAR(20) NOT NULL,
    correlation DECIMAL(3,2) NOT NULL,
    period_days INTEGER NOT NULL DEFAULT 30,
    calculation_method VARCHAR(50) NOT NULL DEFAULT 'PEARSON',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(symbol1, symbol2, timestamp)
);

-- Liquidity Assessment Table
CREATE TABLE IF NOT EXISTS liquidity_assessments (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol VARCHAR(20) NOT NULL,
    daily_volume DECIMAL(15,2) NOT NULL,
    bid_ask_spread DECIMAL(8,6),
    order_book_depth DECIMAL(15,2),
    liquidity_score DECIMAL(3,2) NOT NULL,
    liquidity_risk VARCHAR(10) NOT NULL CHECK (liquidity_risk IN ('LOW', 'MEDIUM', 'HIGH')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk Performance Metrics Table
CREATE TABLE IF NOT EXISTS risk_performance (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    max_drawdown DECIMAL(5,4) NOT NULL,
    avg_exposure DECIMAL(5,4) NOT NULL,
    max_exposure DECIMAL(5,4) NOT NULL,
    risk_adjusted_return DECIMAL(8,4),
    sharpe_ratio DECIMAL(6,4),
    sortino_ratio DECIMAL(6,4),
    var_95 DECIMAL(15,2), -- Value at Risk 95%
    cvar_95 DECIMAL(15,2), -- Conditional Value at Risk 95%
    alerts_triggered INTEGER NOT NULL DEFAULT 0,
    emergency_stops INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(date)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_risk_metrics_timestamp ON risk_metrics_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_risk_metrics_risk_level ON risk_metrics_history(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_metrics_emergency_stop ON risk_metrics_history(emergency_stop_active);

CREATE INDEX IF NOT EXISTS idx_position_risks_timestamp ON position_risks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_position_risks_symbol ON position_risks(symbol);
CREATE INDEX IF NOT EXISTS idx_position_risks_exposure ON position_risks(exposure_percent DESC);

CREATE INDEX IF NOT EXISTS idx_risk_events_timestamp ON risk_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_type ON risk_events(event_type);
CREATE INDEX IF NOT EXISTS idx_risk_events_level ON risk_events(event_level);
CREATE INDEX IF NOT EXISTS idx_risk_events_acknowledged ON risk_events(acknowledged);

CREATE INDEX IF NOT EXISTS idx_drawdown_events_timestamp ON drawdown_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_drawdown_events_trigger_level ON drawdown_events(trigger_level);
CREATE INDEX IF NOT EXISTS idx_drawdown_events_recovery ON drawdown_events(recovery_completed_at);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_timestamp ON risk_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_level ON risk_alerts(alert_level);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_type ON risk_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_acknowledged ON risk_alerts(acknowledged);

CREATE INDEX IF NOT EXISTS idx_emergency_stops_timestamp ON emergency_stops(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_stops_triggered_by ON emergency_stops(triggered_by);
CREATE INDEX IF NOT EXISTS idx_emergency_stops_reset ON emergency_stops(reset_at);

CREATE INDEX IF NOT EXISTS idx_portfolio_history_timestamp ON portfolio_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_new_high ON portfolio_history(is_new_high);

CREATE INDEX IF NOT EXISTS idx_asset_correlations_timestamp ON asset_correlations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_asset_correlations_symbols ON asset_correlations(symbol1, symbol2);

CREATE INDEX IF NOT EXISTS idx_liquidity_assessments_timestamp ON liquidity_assessments(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_assessments_symbol ON liquidity_assessments(symbol);

CREATE INDEX IF NOT EXISTS idx_risk_performance_date ON risk_performance(date DESC);

-- Views for Risk Dashboard

-- Current Risk Status View
CREATE OR REPLACE VIEW current_risk_status AS
SELECT 
    rm.portfolio_value,
    rm.total_exposure,
    rm.total_exposure_percent,
    rm.cash_reserves_percent,
    rm.current_drawdown,
    rm.drawdown_percent,
    rm.portfolio_high,
    rm.risk_level,
    rm.emergency_stop_active,
    rm.timestamp as last_update,
    CASE 
        WHEN rm.drawdown_percent >= 0.15 THEN 'EMERGENCY'
        WHEN rm.drawdown_percent >= 0.10 THEN 'CRITICAL'
        WHEN rm.drawdown_percent >= 0.05 THEN 'WARNING'
        ELSE 'NORMAL'
    END as drawdown_status,
    CASE 
        WHEN rm.total_exposure_percent > 0.80 THEN 'EXCEEDED'
        WHEN rm.total_exposure_percent > 0.75 THEN 'HIGH'
        WHEN rm.total_exposure_percent > 0.60 THEN 'MEDIUM'
        ELSE 'LOW'
    END as exposure_status
FROM risk_metrics_history rm
WHERE rm.timestamp = (SELECT MAX(timestamp) FROM risk_metrics_history);

-- Active Risk Alerts View
CREATE OR REPLACE VIEW active_risk_alerts AS
SELECT 
    alert_id,
    timestamp,
    alert_level,
    alert_type,
    message,
    data,
    EXTRACT(EPOCH FROM (NOW() - timestamp))/3600 as hours_since_alert
FROM risk_alerts
WHERE acknowledged = FALSE
ORDER BY timestamp DESC;

-- Recent Drawdown Events View
CREATE OR REPLACE VIEW recent_drawdown_events AS
SELECT 
    event_id,
    timestamp,
    drawdown_percent,
    portfolio_value,
    trigger_level,
    action_taken,
    CASE 
        WHEN recovery_completed_at IS NOT NULL THEN 'RECOVERED'
        WHEN recovery_started_at IS NOT NULL THEN 'RECOVERING'
        ELSE 'ACTIVE'
    END as recovery_status,
    EXTRACT(EPOCH FROM (COALESCE(recovery_completed_at, NOW()) - timestamp))/3600 as duration_hours
FROM drawdown_events
WHERE timestamp >= NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;

-- Position Risk Summary View
CREATE OR REPLACE VIEW position_risk_summary AS
SELECT 
    pr.symbol,
    pr.position_value,
    pr.exposure_percent,
    pr.unrealized_pnl_percent,
    pr.risk_percent,
    pr.liquidity_risk,
    pr.correlation_risk,
    pr.timestamp,
    CASE 
        WHEN pr.exposure_percent > 0.05 THEN 'EXCEEDED'
        WHEN pr.exposure_percent > 0.04 THEN 'HIGH'
        WHEN pr.exposure_percent > 0.03 THEN 'MEDIUM'
        ELSE 'LOW'
    END as exposure_status,
    ROW_NUMBER() OVER (PARTITION BY pr.symbol ORDER BY pr.timestamp DESC) as rn
FROM position_risks pr
WHERE pr.timestamp >= NOW() - INTERVAL '1 hour';

-- Risk Performance Summary View
CREATE OR REPLACE VIEW risk_performance_summary AS
SELECT 
    date,
    max_drawdown,
    avg_exposure,
    max_exposure,
    risk_adjusted_return,
    sharpe_ratio,
    alerts_triggered,
    emergency_stops,
    CASE 
        WHEN max_drawdown > 0.15 THEN 'POOR'
        WHEN max_drawdown > 0.10 THEN 'FAIR'
        WHEN max_drawdown > 0.05 THEN 'GOOD'
        ELSE 'EXCELLENT'
    END as risk_grade
FROM risk_performance
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- Functions for Risk Calculations

-- Function to calculate current portfolio drawdown
CREATE OR REPLACE FUNCTION calculate_current_drawdown()
RETURNS TABLE(
    current_value DECIMAL(15,2),
    portfolio_high DECIMAL(15,2),
    drawdown_amount DECIMAL(15,2),
    drawdown_percent DECIMAL(5,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rm.portfolio_value as current_value,
        rm.portfolio_high,
        GREATEST(0, rm.portfolio_high - rm.portfolio_value) as drawdown_amount,
        CASE 
            WHEN rm.portfolio_high > 0 THEN 
                GREATEST(0, rm.portfolio_high - rm.portfolio_value) / rm.portfolio_high
            ELSE 0
        END as drawdown_percent
    FROM risk_metrics_history rm
    WHERE rm.timestamp = (SELECT MAX(timestamp) FROM risk_metrics_history);
END;
$$ LANGUAGE plpgsql;

-- Function to check if emergency stop should be triggered
CREATE OR REPLACE FUNCTION should_trigger_emergency_stop()
RETURNS TABLE(
    should_trigger BOOLEAN,
    reason TEXT,
    drawdown_percent DECIMAL(5,4),
    exposure_percent DECIMAL(5,4)
) AS $$
DECLARE
    current_drawdown DECIMAL(5,4);
    current_exposure DECIMAL(5,4);
    trigger_reason TEXT := '';
    should_stop BOOLEAN := FALSE;
BEGIN
    -- Get current metrics
    SELECT 
        rm.drawdown_percent,
        rm.total_exposure_percent
    INTO current_drawdown, current_exposure
    FROM risk_metrics_history rm
    WHERE rm.timestamp = (SELECT MAX(timestamp) FROM risk_metrics_history);
    
    -- Check drawdown threshold (15% emergency)
    IF current_drawdown >= 0.15 THEN
        should_stop := TRUE;
        trigger_reason := 'Portfolio drawdown exceeds 15% emergency threshold';
    END IF;
    
    -- Check exposure threshold (90% critical)
    IF current_exposure >= 0.90 THEN
        should_stop := TRUE;
        IF trigger_reason != '' THEN
            trigger_reason := trigger_reason || ' AND ';
        END IF;
        trigger_reason := trigger_reason || 'Portfolio exposure exceeds 90% critical threshold';
    END IF;
    
    RETURN QUERY SELECT should_stop, trigger_reason, current_drawdown, current_exposure;
END;
$$ LANGUAGE plpgsql;

-- Function to get risk dashboard data
CREATE OR REPLACE FUNCTION get_risk_dashboard()
RETURNS JSONB AS $$
DECLARE
    dashboard_data JSONB;
BEGIN
    SELECT jsonb_build_object(
        'currentRisk', (
            SELECT row_to_json(crs) FROM current_risk_status crs
        ),
        'activeAlerts', (
            SELECT COALESCE(jsonb_agg(row_to_json(ara)), '[]'::jsonb) 
            FROM active_risk_alerts ara
        ),
        'recentDrawdowns', (
            SELECT COALESCE(jsonb_agg(row_to_json(rde)), '[]'::jsonb) 
            FROM recent_drawdown_events rde 
            LIMIT 5
        ),
        'positionRisks', (
            SELECT COALESCE(jsonb_agg(row_to_json(prs)), '[]'::jsonb) 
            FROM position_risk_summary prs 
            WHERE rn = 1
        ),
        'emergencyStopActive', (
            SELECT COALESCE(emergency_stop_active, FALSE) 
            FROM risk_metrics_history 
            WHERE timestamp = (SELECT MAX(timestamp) FROM risk_metrics_history)
        ),
        'lastUpdate', (
            SELECT MAX(timestamp) FROM risk_metrics_history
        )
    ) INTO dashboard_data;
    
    RETURN dashboard_data;
END;
$$ LANGUAGE plpgsql;

-- Triggers for Automatic Risk Monitoring

-- Trigger to update portfolio high
CREATE OR REPLACE FUNCTION update_portfolio_high()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is a new portfolio high
    IF NEW.portfolio_value > (
        SELECT COALESCE(MAX(portfolio_high), 0) 
        FROM risk_metrics_history 
        WHERE timestamp < NEW.timestamp
    ) THEN
        -- Insert portfolio history record
        INSERT INTO portfolio_history (
            timestamp,
            portfolio_value,
            is_new_high,
            previous_high,
            drawdown_from_high,
            drawdown_percent
        ) VALUES (
            NEW.timestamp,
            NEW.portfolio_value,
            TRUE,
            NEW.portfolio_high,
            0,
            0
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_portfolio_high
    AFTER INSERT ON risk_metrics_history
    FOR EACH ROW
    EXECUTE FUNCTION update_portfolio_high();

-- Trigger to auto-acknowledge old alerts
CREATE OR REPLACE FUNCTION auto_acknowledge_old_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-acknowledge INFO level alerts older than 24 hours
    UPDATE risk_alerts 
    SET 
        acknowledged = TRUE,
        acknowledged_at = NOW(),
        acknowledged_by = 'SYSTEM_AUTO'
    WHERE 
        alert_level = 'INFO' 
        AND acknowledged = FALSE 
        AND timestamp < NOW() - INTERVAL '24 hours';
    
    -- Auto-acknowledge WARNING level alerts older than 7 days
    UPDATE risk_alerts 
    SET 
        acknowledged = TRUE,
        acknowledged_at = NOW(),
        acknowledged_by = 'SYSTEM_AUTO'
    WHERE 
        alert_level = 'WARNING' 
        AND acknowledged = FALSE 
        AND timestamp < NOW() - INTERVAL '7 days';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_acknowledge_alerts
    AFTER INSERT ON risk_alerts
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_acknowledge_old_alerts();

-- Insert default risk configuration values
INSERT INTO risk_configuration (config_name, config_value, config_description) VALUES
('MAX_PORTFOLIO_EXPOSURE', 0.80, 'Maximum total portfolio exposure (80%)'),
('MAX_ASSET_EXPOSURE', 0.05, 'Maximum single asset exposure (5%)'),
('MAX_SECTOR_EXPOSURE', 0.30, 'Maximum sector exposure (30%)'),
('MIN_CASH_RESERVES', 0.20, 'Minimum cash reserves (20%)'),
('DRAWDOWN_WARNING_THRESHOLD', 0.05, 'Drawdown warning threshold (5%)'),
('DRAWDOWN_REDUCTION_THRESHOLD', 0.10, 'Drawdown position reduction threshold (10%)'),
('DRAWDOWN_EMERGENCY_THRESHOLD', 0.15, 'Drawdown emergency stop threshold (15%)'),
('POSITION_REDUCTION_10PCT', 0.25, 'Position size reduction at 10% drawdown (25%)'),
('POSITION_REDUCTION_15PCT', 0.50, 'Position size reduction at 15% drawdown (50%)'),
('POSITION_REDUCTION_20PCT', 0.75, 'Position size reduction at 20% drawdown (75%)'),
('MAX_CORRELATION', 0.80, 'Maximum allowed correlation between positions (80%)'),
('MIN_DAILY_VOLUME', 1000000, 'Minimum daily volume for trading ($1M)'),
('MAX_ORDER_VOLUME_PCT', 0.05, 'Maximum order size as % of daily volume (5%)')
ON CONFLICT (config_name) DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO trading_bot;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading_bot;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO trading_bot;

COMMENT ON TABLE risk_metrics_history IS 'Historical risk metrics for portfolio monitoring';
COMMENT ON TABLE position_risks IS 'Individual position risk assessments';
COMMENT ON TABLE risk_events IS 'Log of all risk-related events and alerts';
COMMENT ON TABLE drawdown_events IS 'Specific drawdown events and recovery tracking';
COMMENT ON TABLE risk_alerts IS 'Active and historical risk alerts';
COMMENT ON TABLE emergency_stops IS 'Emergency stop events and recovery';
COMMENT ON TABLE portfolio_history IS 'Portfolio value history and high watermarks';
COMMENT ON TABLE risk_configuration IS 'Configurable risk management parameters';
COMMENT ON TABLE asset_correlations IS 'Asset correlation matrix for risk assessment';
COMMENT ON TABLE liquidity_assessments IS 'Liquidity risk assessments for assets';
COMMENT ON TABLE risk_performance IS 'Daily risk performance metrics';

COMMENT ON VIEW current_risk_status IS 'Current portfolio risk status dashboard';
COMMENT ON VIEW active_risk_alerts IS 'Currently active risk alerts requiring attention';
COMMENT ON VIEW recent_drawdown_events IS 'Recent drawdown events and recovery status';
COMMENT ON VIEW position_risk_summary IS 'Summary of position-level risks';
COMMENT ON VIEW risk_performance_summary IS 'Historical risk performance summary';

COMMENT ON FUNCTION calculate_current_drawdown() IS 'Calculate current portfolio drawdown metrics';
COMMENT ON FUNCTION should_trigger_emergency_stop() IS 'Check if emergency stop should be triggered';
COMMENT ON FUNCTION get_risk_dashboard() IS 'Get complete risk dashboard data as JSON'; 
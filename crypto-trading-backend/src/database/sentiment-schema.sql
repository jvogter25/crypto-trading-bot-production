-- Sentiment Analysis Database Schema
-- Stores real-time sentiment data and trading signals

-- Table for raw sentiment data from individual analysis runs
CREATE TABLE IF NOT EXISTS sentiment_data (
    id BIGSERIAL PRIMARY KEY,
    asset_symbol VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    compound_score DECIMAL(6,4) NOT NULL,
    adjusted_compound_score DECIMAL(6,4) NOT NULL,
    positive_score DECIMAL(6,4) NOT NULL,
    negative_score DECIMAL(6,4) NOT NULL,
    neutral_score DECIMAL(6,4) NOT NULL,
    tweet_count INTEGER NOT NULL DEFAULT 0,
    trading_signal VARCHAR(10) NOT NULL CHECK (trading_signal IN ('BUY', 'SELL', 'NEUTRAL')),
    confidence DECIMAL(5,3) NOT NULL DEFAULT 0,
    volume_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    raw_tweets_analyzed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for aggregated sentiment analysis (hourly trends)
CREATE TABLE IF NOT EXISTS sentiment_analysis (
    id BIGSERIAL PRIMARY KEY,
    asset_symbol VARCHAR(10) NOT NULL,
    analysis_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_period VARCHAR(20) NOT NULL CHECK (time_period IN ('HOURLY', 'DAILY', 'WEEKLY')),
    average_sentiment DECIMAL(6,4) NOT NULL,
    total_tweets INTEGER NOT NULL DEFAULT 0,
    average_confidence DECIMAL(5,3) NOT NULL DEFAULT 0,
    trend_direction VARCHAR(10) NOT NULL CHECK (trend_direction IN ('POSITIVE', 'NEGATIVE', 'STABLE')),
    data_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for sentiment-based trading signals
CREATE TABLE IF NOT EXISTS sentiment_signals (
    id BIGSERIAL PRIMARY KEY,
    asset_symbol VARCHAR(10) NOT NULL,
    signal_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signal_type VARCHAR(10) NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'NEUTRAL')),
    signal_strength DECIMAL(5,3) NOT NULL DEFAULT 0,
    confidence DECIMAL(5,3) NOT NULL DEFAULT 0,
    sentiment_score DECIMAL(6,4) NOT NULL,
    tweet_volume INTEGER NOT NULL DEFAULT 0,
    previous_signal VARCHAR(10),
    signal_changed BOOLEAN NOT NULL DEFAULT FALSE,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_sentiment_data_symbol_timestamp ON sentiment_data(asset_symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_data_timestamp ON sentiment_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_data_trading_signal ON sentiment_data(trading_signal);

CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_symbol_timestamp ON sentiment_analysis(asset_symbol, analysis_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_time_period ON sentiment_analysis(time_period);

CREATE INDEX IF NOT EXISTS idx_sentiment_signals_symbol_timestamp ON sentiment_signals(asset_symbol, signal_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_signals_type ON sentiment_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_sentiment_signals_processed ON sentiment_signals(processed);
CREATE INDEX IF NOT EXISTS idx_sentiment_signals_changed ON sentiment_signals(signal_changed);

-- Views for easy data access

-- Latest sentiment for each symbol
CREATE OR REPLACE VIEW latest_sentiment AS
SELECT DISTINCT ON (asset_symbol)
    asset_symbol,
    timestamp,
    compound_score,
    adjusted_compound_score,
    trading_signal,
    confidence,
    tweet_count,
    volume_multiplier
FROM sentiment_data
ORDER BY asset_symbol, timestamp DESC;

-- Hourly sentiment trends
CREATE OR REPLACE VIEW hourly_sentiment_trends AS
SELECT 
    asset_symbol,
    DATE_TRUNC('hour', timestamp) as hour,
    AVG(adjusted_compound_score) as avg_sentiment,
    COUNT(*) as data_points,
    SUM(tweet_count) as total_tweets,
    AVG(confidence) as avg_confidence,
    CASE 
        WHEN AVG(adjusted_compound_score) > 0.06 THEN 'BULLISH'
        WHEN AVG(adjusted_compound_score) < 0.04 THEN 'BEARISH'
        ELSE 'NEUTRAL'
    END as market_sentiment
FROM sentiment_data
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY asset_symbol, DATE_TRUNC('hour', timestamp)
ORDER BY asset_symbol, hour DESC;

-- Active trading signals
CREATE OR REPLACE VIEW active_sentiment_signals AS
SELECT DISTINCT ON (asset_symbol)
    asset_symbol,
    signal_timestamp,
    signal_type,
    signal_strength,
    confidence,
    sentiment_score,
    tweet_volume,
    signal_changed
FROM sentiment_signals
WHERE processed = FALSE
ORDER BY asset_symbol, signal_timestamp DESC;

-- Sentiment signal history with performance metrics
CREATE OR REPLACE VIEW sentiment_signal_performance AS
SELECT 
    asset_symbol,
    signal_type,
    COUNT(*) as signal_count,
    AVG(signal_strength) as avg_strength,
    AVG(confidence) as avg_confidence,
    AVG(tweet_volume) as avg_tweet_volume,
    DATE_TRUNC('day', signal_timestamp) as signal_date
FROM sentiment_signals
WHERE signal_changed = TRUE
GROUP BY asset_symbol, signal_type, DATE_TRUNC('day', signal_timestamp)
ORDER BY asset_symbol, signal_date DESC;

-- Functions for data management

-- Function to clean old sentiment data (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_sentiment_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sentiment_data 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get sentiment summary for a symbol
CREATE OR REPLACE FUNCTION get_sentiment_summary(symbol_param VARCHAR(10))
RETURNS TABLE(
    current_signal VARCHAR(10),
    current_score DECIMAL(6,4),
    confidence DECIMAL(5,3),
    tweet_count INTEGER,
    last_updated TIMESTAMPTZ,
    hourly_trend VARCHAR(10),
    signal_changes_today INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH latest AS (
        SELECT * FROM sentiment_data 
        WHERE asset_symbol = symbol_param 
        ORDER BY timestamp DESC 
        LIMIT 1
    ),
    hourly AS (
        SELECT 
            CASE 
                WHEN AVG(adjusted_compound_score) > LAG(AVG(adjusted_compound_score)) OVER (ORDER BY DATE_TRUNC('hour', timestamp)) THEN 'RISING'
                WHEN AVG(adjusted_compound_score) < LAG(AVG(adjusted_compound_score)) OVER (ORDER BY DATE_TRUNC('hour', timestamp)) THEN 'FALLING'
                ELSE 'STABLE'
            END as trend
        FROM sentiment_data 
        WHERE asset_symbol = symbol_param 
        AND timestamp >= NOW() - INTERVAL '2 hours'
        GROUP BY DATE_TRUNC('hour', timestamp)
        ORDER BY DATE_TRUNC('hour', timestamp) DESC
        LIMIT 1
    ),
    daily_changes AS (
        SELECT COUNT(*) as changes
        FROM sentiment_signals 
        WHERE asset_symbol = symbol_param 
        AND signal_changed = TRUE
        AND signal_timestamp >= CURRENT_DATE
    )
    SELECT 
        l.trading_signal,
        l.adjusted_compound_score,
        l.confidence,
        l.tweet_count,
        l.timestamp,
        COALESCE(h.trend, 'UNKNOWN'),
        COALESCE(dc.changes::INTEGER, 0)
    FROM latest l
    CROSS JOIN hourly h
    CROSS JOIN daily_changes dc;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create sentiment signals when new data is inserted
CREATE OR REPLACE FUNCTION create_sentiment_signal()
RETURNS TRIGGER AS $$
DECLARE
    prev_signal VARCHAR(10);
    signal_changed_flag BOOLEAN := FALSE;
BEGIN
    -- Get the previous signal for this symbol
    SELECT trading_signal INTO prev_signal
    FROM sentiment_data 
    WHERE asset_symbol = NEW.asset_symbol 
    AND timestamp < NEW.timestamp
    ORDER BY timestamp DESC 
    LIMIT 1;
    
    -- Check if signal changed
    IF prev_signal IS NULL OR prev_signal != NEW.trading_signal THEN
        signal_changed_flag := TRUE;
    END IF;
    
    -- Insert sentiment signal record
    INSERT INTO sentiment_signals (
        asset_symbol,
        signal_timestamp,
        signal_type,
        signal_strength,
        confidence,
        sentiment_score,
        tweet_volume,
        previous_signal,
        signal_changed
    ) VALUES (
        NEW.asset_symbol,
        NEW.timestamp,
        NEW.trading_signal,
        CASE 
            WHEN NEW.adjusted_compound_score > 0.06 THEN 
                LEAST(1.0, (NEW.adjusted_compound_score - 0.06) / (1.0 - 0.06))
            WHEN NEW.adjusted_compound_score < 0.04 THEN 
                LEAST(1.0, (0.04 - NEW.adjusted_compound_score) / (0.04 + 1.0))
            ELSE 0.0
        END,
        NEW.confidence,
        NEW.adjusted_compound_score,
        NEW.tweet_count,
        prev_signal,
        signal_changed_flag
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS sentiment_signal_trigger ON sentiment_data;
CREATE TRIGGER sentiment_signal_trigger
    AFTER INSERT ON sentiment_data
    FOR EACH ROW
    EXECUTE FUNCTION create_sentiment_signal();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON sentiment_data TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON sentiment_analysis TO trading_bot;
-- GRANT SELECT, INSERT, UPDATE ON sentiment_signals TO trading_bot;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO trading_bot; 
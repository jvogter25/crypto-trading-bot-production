-- Create sentiment_data table
CREATE TABLE sentiment_data (
    id SERIAL PRIMARY KEY,
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    source VARCHAR(50) NOT NULL,
    raw_text TEXT NOT NULL,
    compound_score DECIMAL(4, 3) NOT NULL,
    positive_score DECIMAL(4, 3) NOT NULL,
    negative_score DECIMAL(4, 3) NOT NULL,
    neutral_score DECIMAL(4, 3) NOT NULL,
    volume INTEGER NOT NULL,
    engagement_score DECIMAL(10, 4),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create sentiment_analysis table
CREATE TABLE sentiment_analysis (
    id SERIAL PRIMARY KEY,
    trading_pair VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    sentiment_score DECIMAL(4, 3) NOT NULL,
    sentiment_trend VARCHAR(20) NOT NULL CHECK (sentiment_trend IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    confidence_score DECIMAL(4, 3) NOT NULL,
    volume_weight DECIMAL(4, 3) NOT NULL,
    signal_strength DECIMAL(4, 3) NOT NULL,
    technical_confirmation BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_sentiment_data_trading_pair ON sentiment_data(trading_pair);
CREATE INDEX idx_sentiment_data_timestamp ON sentiment_data(timestamp);
CREATE INDEX idx_sentiment_data_source ON sentiment_data(source);
CREATE INDEX idx_sentiment_analysis_trading_pair ON sentiment_analysis(trading_pair);
CREATE INDEX idx_sentiment_analysis_timestamp ON sentiment_analysis(timestamp);
CREATE INDEX idx_sentiment_analysis_trend ON sentiment_analysis(sentiment_trend); 
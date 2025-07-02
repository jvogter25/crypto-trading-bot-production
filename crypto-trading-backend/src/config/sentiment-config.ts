/**
 * Sentiment Analysis Configuration
 * Based on comprehensive trading rules specification
 */

export interface SentimentConfig {
    // Exact thresholds from comprehensive trading rules
    buyThreshold: number;
    sellThreshold: number;
    neutralZone: [number, number];
    
    // Analysis intervals
    analysisInterval: number; // milliseconds
    hourlyAggregation: boolean;
    
    // Volume thresholds for weight adjustment
    highVolumeThreshold: number; // tweets/hour
    lowVolumeThreshold: number; // tweets/hour
    highVolumeMultiplier: number;
    lowVolumeMultiplier: number;
    
    // Twitter API settings
    twitterEnabled: boolean;
    maxTweetsPerRequest: number;
    tweetSearchTimeframe: number; // hours
    
    // Supported symbols
    supportedSymbols: string[];
    
    // Database settings
    dataRetentionDays: number;
    enableHistoricalTracking: boolean;
    
    // Performance settings
    cacheExpiryMinutes: number;
    maxConcurrentAnalysis: number;
}

export const SENTIMENT_CONFIG: SentimentConfig = {
    // Exact thresholds from comprehensive trading rules document
    buyThreshold: 0.06,
    sellThreshold: 0.04,
    neutralZone: [0.04, 0.06],
    
    // Analysis runs every 15 minutes as specified
    analysisInterval: 15 * 60 * 1000, // 15 minutes
    hourlyAggregation: true,
    
    // Volume-based weight adjustment thresholds
    highVolumeThreshold: 500, // tweets/hour
    lowVolumeThreshold: 100,  // tweets/hour
    highVolumeMultiplier: 1.5,
    lowVolumeMultiplier: 0.5,
    
    // Twitter API configuration
    twitterEnabled: true,
    maxTweetsPerRequest: 200,
    tweetSearchTimeframe: 1, // 1 hour lookback
    
    // Cryptocurrency symbols to analyze
    supportedSymbols: ['BTC', 'ETH', 'USDC', 'USDT'],
    
    // Data management
    dataRetentionDays: 30,
    enableHistoricalTracking: true,
    
    // Performance optimization
    cacheExpiryMinutes: 5,
    maxConcurrentAnalysis: 4
};

export interface TwitterCredentials {
    apiKey: string;
    apiSecret: string;
    bearerToken: string;
    accessToken: string;
    accessTokenSecret: string;
}

export function getTwitterCredentials(): TwitterCredentials {
    return {
        apiKey: process.env.TWITTER_API_KEY || '',
        apiSecret: process.env.TWITTER_API_SECRET || '',
        bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
        accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
        accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET || ''
    };
}

export function validateTwitterCredentials(credentials: TwitterCredentials): boolean {
    return !!(
        credentials.bearerToken || 
        (credentials.apiKey && credentials.apiSecret)
    );
}

export function getSentimentThresholds() {
    return {
        buy: SENTIMENT_CONFIG.buyThreshold,
        sell: SENTIMENT_CONFIG.sellThreshold,
        neutral: SENTIMENT_CONFIG.neutralZone
    };
}

export function getVolumeMultipliers() {
    return {
        highThreshold: SENTIMENT_CONFIG.highVolumeThreshold,
        lowThreshold: SENTIMENT_CONFIG.lowVolumeThreshold,
        highMultiplier: SENTIMENT_CONFIG.highVolumeMultiplier,
        lowMultiplier: SENTIMENT_CONFIG.lowVolumeMultiplier
    };
}

// Environment variable overrides
export function loadSentimentConfigFromEnv(): Partial<SentimentConfig> {
    const envConfig: Partial<SentimentConfig> = {};
    
    if (process.env.SENTIMENT_BUY_THRESHOLD) {
        envConfig.buyThreshold = parseFloat(process.env.SENTIMENT_BUY_THRESHOLD);
    }
    
    if (process.env.SENTIMENT_SELL_THRESHOLD) {
        envConfig.sellThreshold = parseFloat(process.env.SENTIMENT_SELL_THRESHOLD);
    }
    
    if (process.env.SENTIMENT_ANALYSIS_INTERVAL) {
        envConfig.analysisInterval = parseInt(process.env.SENTIMENT_ANALYSIS_INTERVAL) * 60 * 1000;
    }
    
    if (process.env.SENTIMENT_TWEET_VOLUME_HIGH) {
        envConfig.highVolumeThreshold = parseInt(process.env.SENTIMENT_TWEET_VOLUME_HIGH);
    }
    
    if (process.env.SENTIMENT_TWEET_VOLUME_LOW) {
        envConfig.lowVolumeThreshold = parseInt(process.env.SENTIMENT_TWEET_VOLUME_LOW);
    }
    
    if (process.env.SENTIMENT_ANALYSIS_ENABLED === 'false') {
        envConfig.twitterEnabled = false;
    }
    
    return envConfig;
}

export function getMergedSentimentConfig(): SentimentConfig {
    const envOverrides = loadSentimentConfigFromEnv();
    return { ...SENTIMENT_CONFIG, ...envOverrides };
} 
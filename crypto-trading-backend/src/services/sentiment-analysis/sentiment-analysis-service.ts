import { EventEmitter } from 'events';
import { PythonShell } from 'python-shell';
import * as cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

export interface SentimentScores {
    compound: number;
    adjusted_compound: number;
    positive: number;
    negative: number;
    neutral: number;
}

export interface SentimentAnalysisResult {
    symbol: string;
    timestamp: string;
    sentiment_scores: SentimentScores;
    trading_signal: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    tweet_count: number;
    volume_multiplier: number;
    thresholds: {
        buy_threshold: number;
        sell_threshold: number;
        neutral_zone: [number, number];
    };
    raw_tweets_analyzed: number;
    error?: string;
}

export interface SentimentSignal {
    symbol: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    strength: number; // 0-1 scale
    confidence: number;
    timestamp: Date;
    sentiment_score: number;
    tweet_volume: number;
    previous_signal?: 'BUY' | 'SELL' | 'NEUTRAL';
    signal_changed: boolean;
}

export class SentimentAnalysisService extends EventEmitter {
    private supabase: any;
    private serviceRunning = false;
    private analysisInterval: NodeJS.Timeout | null = null;
    private cronJob: cron.ScheduledTask | null = null;
    private lastAnalysisResults: Map<string, SentimentAnalysisResult> = new Map();
    private lastSignals: Map<string, SentimentSignal> = new Map();
    
    // Optimized configuration for aggressive trading
    private readonly BUY_THRESHOLD = 0.03;  // 3% (more sensitive)
    private readonly SELL_THRESHOLD = 0.02; // 2% (more sensitive)
    private readonly NEUTRAL_ZONE: [number, number] = [0.02, 0.03];
    private readonly ANALYSIS_INTERVAL = 5 * 60 * 1000; // 5 minutes for faster sentiment updates
    
    // Supported Layer 1 cryptocurrency symbols (expanded for comprehensive monitoring)
    private readonly SUPPORTED_SYMBOLS = [
        'BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'AVAX', 'ATOM', 'ALGO', 
        'XTZ', 'NEAR', 'FTM', 'MATIC', 'BNB', 'TRX', 'XLM', 'XRP',
        'LTC', 'BCH', 'ETC', 'DOGE', 'SHIB', 'UNI', 'LINK', 'AAVE'
    ];
    
    constructor() {
        super();
        
        // Initialize Supabase client (optional)
        try {
            if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
                this.supabase = createClient(
                    process.env.SUPABASE_URL,
                    process.env.SUPABASE_ANON_KEY
                );
                console.log('✅ Sentiment service: Supabase initialized');
            } else {
                console.log('⚠️ Sentiment service: No database - running with mock data');
                this.supabase = null;
            }
        } catch (error) {
            console.warn('⚠️ Sentiment service: Database unavailable - using mock data');
            this.supabase = null;
        }
        
        console.log('🧠 Sentiment Analysis Service initialized');
        console.log(`📊 Using thresholds: BUY > ${this.BUY_THRESHOLD}, SELL < ${this.SELL_THRESHOLD}`);
        console.log(`⏱️ Analysis interval: ${this.ANALYSIS_INTERVAL / 1000 / 60} minutes`);
    }
    
    async start(): Promise<void> {
        if (this.serviceRunning) {
            console.log('⚠️ Sentiment analysis service is already running');
            return;
        }
        
        console.log('🚀 Starting sentiment analysis service...');
        
        try {
            // Test Python sentiment analyzer
            await this.testSentimentAnalyzer();
            
            // Start periodic analysis
            this.startPeriodicAnalysis();
            
            // Schedule hourly analysis as specified in trading rules
            this.scheduleHourlyAnalysis();
            
            this.serviceRunning = true;
            console.log('✅ Sentiment analysis service started successfully');
            this.emit('serviceStarted');
            
        } catch (error) {
            console.error('❌ Failed to start sentiment analysis service:', error);
            throw error;
        }
    }
    
    async stop(): Promise<void> {
        if (!this.serviceRunning) {
            return;
        }
        
        console.log('🛑 Stopping sentiment analysis service...');
        
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        
        this.serviceRunning = false;
        console.log('✅ Sentiment analysis service stopped');
        this.emit('serviceStopped');
    }
    
    private async testSentimentAnalyzer(): Promise<void> {
        console.log('🧪 Testing Python sentiment analyzer...');
        
        try {
            const result = await this.runPythonAnalysis(['BTC']);
            
            if (result && result.symbol && result.trading_signal && result.sentiment_scores) {
                console.log('✅ Python sentiment analyzer test successful');
                console.log(`   ${result.symbol} sentiment: ${result.trading_signal} (${result.sentiment_scores.adjusted_compound.toFixed(4)})`);
            } else {
                throw new Error('Invalid response from Python sentiment analyzer');
            }
            
        } catch (error) {
            console.error('❌ Python sentiment analyzer test failed:', error);
            throw new Error(`Sentiment analyzer test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    private startPeriodicAnalysis(): void {
        // Run initial analysis
        this.runAnalysisForAllSymbols();
        
        // Schedule periodic analysis every 15 minutes
        this.analysisInterval = setInterval(() => {
            this.runAnalysisForAllSymbols();
        }, this.ANALYSIS_INTERVAL);
        
        console.log(`⏰ Periodic analysis scheduled every ${this.ANALYSIS_INTERVAL / 1000 / 60} minutes`);
    }
    
    private scheduleHourlyAnalysis(): void {
        // Schedule hourly sentiment trend aggregation as specified in trading rules
        this.cronJob = cron.schedule('0 * * * *', () => {
            console.log('📈 Running hourly sentiment trend analysis...');
            this.aggregateHourlySentimentTrends();
        });
        
        console.log('📅 Hourly sentiment trend analysis scheduled');
    }
    
    private async runAnalysisForAllSymbols(): Promise<void> {
        try {
            console.log('🔍 Running sentiment analysis for all symbols...');
            
            const results = await this.runPythonAnalysis(this.SUPPORTED_SYMBOLS);
            
            if (results) {
                // Handle single symbol result
                if (results.symbol && results.trading_signal) {
                    await this.processSentimentResult(results);
                }
                // Handle multiple symbol results
                else if (results.results) {
                    for (const symbol of this.SUPPORTED_SYMBOLS) {
                        const symbolResult = results.results[symbol];
                        if (symbolResult) {
                            await this.processSentimentResult(symbolResult);
                        }
                    }
                }
            }
            
            this.emit('analysisCompleted', {
                timestamp: new Date(),
                symbols: this.SUPPORTED_SYMBOLS,
                results: results?.results
            });
            
        } catch (error) {
            console.error('❌ Error running sentiment analysis:', error);
            this.emit('analysisError', error);
        }
    }
    
    private async runPythonAnalysis(symbols: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../../scripts/sentiment_analyzer.py');
            
            const options = {
                mode: 'text' as const,
                pythonPath: 'python3',
                pythonOptions: ['-u'],
                scriptPath: path.dirname(scriptPath),
                args: symbols
            };
            
            const pyshell = new PythonShell('sentiment_analyzer.py', options);
            let results: string[] = [];
            
            pyshell.on('message', (message) => {
                results.push(message);
            });
            
            pyshell.end((err) => {
                if (err) {
                    console.error('Python script error:', err);
                    reject(err);
                    return;
                }
                
                if (!results || results.length === 0) {
                    reject(new Error('No results from Python script'));
                    return;
                }
                
                try {
                    // Join all results and find the JSON part (skip NLTK download messages)
                    const fullOutput = results.join('\n');
                    const jsonStart = fullOutput.indexOf('{');
                    const jsonEnd = fullOutput.lastIndexOf('}') + 1;
                    
                    if (jsonStart === -1 || jsonEnd === 0) {
                        throw new Error('No JSON found in Python script output');
                    }
                    
                    const jsonOutput = fullOutput.substring(jsonStart, jsonEnd);
                    const jsonResult = JSON.parse(jsonOutput);
                    resolve(jsonResult);
                } catch (parseError) {
                    console.error('Error parsing Python script output:', parseError);
                    console.error('Raw output:', results);
                    reject(parseError);
                }
            });
        });
    }
    
    private async processSentimentResult(result: SentimentAnalysisResult): Promise<void> {
        try {
            const symbol = result.symbol;
            const previousResult = this.lastAnalysisResults.get(symbol);
            const previousSignal = this.lastSignals.get(symbol);
            
            // Store the latest result
            this.lastAnalysisResults.set(symbol, result);
            
            // Generate trading signal
            const signal = this.generateTradingSignal(result);
            
            // Store the signal
            this.lastSignals.set(symbol, signal);
            
            // Save to database
            await this.saveSentimentData(result);
            
            // Emit events for signal changes
            if (signal.signal_changed) {
                console.log(`📊 ${symbol} sentiment signal changed: ${previousSignal?.signal || 'NONE'} → ${signal.signal}`);
                console.log(`   Score: ${result.sentiment_scores.adjusted_compound.toFixed(4)} | Confidence: ${signal.confidence} | Tweets: ${result.tweet_count}`);
                
                this.emit('signalChanged', signal);
                
                // Emit specific signal events
                if (signal.signal === 'BUY') {
                    this.emit('buySignal', signal);
                } else if (signal.signal === 'SELL') {
                    this.emit('sellSignal', signal);
                }
            }
            
            // Always emit sentiment update
            this.emit('sentimentUpdate', {
                symbol,
                result,
                signal,
                previousResult
            });
            
        } catch (error) {
            console.error(`Error processing sentiment result for ${result.symbol}:`, error);
        }
    }
    
    private generateTradingSignal(result: SentimentAnalysisResult): SentimentSignal {
        const symbol = result.symbol;
        const previousSignal = this.lastSignals.get(symbol);
        const adjustedScore = result.sentiment_scores.adjusted_compound;
        
        // Calculate signal strength (0-1 scale)
        let strength = 0;
        if (adjustedScore > this.BUY_THRESHOLD) {
            // Positive signal strength
            strength = Math.min(1, (adjustedScore - this.BUY_THRESHOLD) / (1 - this.BUY_THRESHOLD));
        } else if (adjustedScore < this.SELL_THRESHOLD) {
            // Negative signal strength
            strength = Math.min(1, (this.SELL_THRESHOLD - adjustedScore) / (this.SELL_THRESHOLD + 1));
        } else {
            // Neutral zone
            strength = 0;
        }
        
        const signal: SentimentSignal = {
            symbol,
            signal: result.trading_signal,
            strength,
            confidence: result.confidence,
            timestamp: new Date(result.timestamp),
            sentiment_score: adjustedScore,
            tweet_volume: result.tweet_count,
            previous_signal: previousSignal?.signal,
            signal_changed: !previousSignal || previousSignal.signal !== result.trading_signal
        };
        
        return signal;
    }
    
    private async saveSentimentData(result: SentimentAnalysisResult): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('sentiment_data')
                .insert({
                    asset_symbol: result.symbol,
                    timestamp: result.timestamp,
                    compound_score: result.sentiment_scores.compound,
                    adjusted_compound_score: result.sentiment_scores.adjusted_compound,
                    positive_score: result.sentiment_scores.positive,
                    negative_score: result.sentiment_scores.negative,
                    neutral_score: result.sentiment_scores.neutral,
                    tweet_count: result.tweet_count,
                    trading_signal: result.trading_signal,
                    confidence: result.confidence,
                    volume_multiplier: result.volume_multiplier,
                    raw_tweets_analyzed: result.raw_tweets_analyzed,
                    error_message: result.error
                });
            
            if (error) {
                console.error('Error saving sentiment data:', error);
            }
            
        } catch (error) {
            console.error('Error saving sentiment data to database:', error);
        }
    }
    
    private async aggregateHourlySentimentTrends(): Promise<void> {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            
            for (const symbol of this.SUPPORTED_SYMBOLS) {
                // Get sentiment data from the last hour
                const { data, error } = await this.supabase
                    .from('sentiment_data')
                    .select('*')
                    .eq('asset_symbol', symbol)
                    .gte('timestamp', oneHourAgo.toISOString())
                    .order('timestamp', { ascending: true });
                
                if (error) {
                    console.error(`Error fetching hourly data for ${symbol}:`, error);
                    continue;
                }
                
                if (!data || data.length === 0) {
                    console.log(`No sentiment data found for ${symbol} in the last hour`);
                    continue;
                }
                
                // Calculate hourly aggregates
                const avgCompound = data.reduce((sum, item) => sum + item.adjusted_compound_score, 0) / data.length;
                const totalTweets = data.reduce((sum, item) => sum + item.tweet_count, 0);
                const avgConfidence = data.reduce((sum, item) => sum + item.confidence, 0) / data.length;
                
                // Determine trend direction
                const firstScore = data[0].adjusted_compound_score;
                const lastScore = data[data.length - 1].adjusted_compound_score;
                const trend = lastScore > firstScore ? 'POSITIVE' : lastScore < firstScore ? 'NEGATIVE' : 'STABLE';
                
                // Save hourly aggregate
                await this.supabase
                    .from('sentiment_analysis')
                    .insert({
                        asset_symbol: symbol,
                        analysis_timestamp: new Date().toISOString(),
                        time_period: 'HOURLY',
                        average_sentiment: avgCompound,
                        total_tweets: totalTweets,
                        average_confidence: avgConfidence,
                        trend_direction: trend,
                        data_points: data.length
                    });
                
                console.log(`📈 ${symbol} hourly trend: ${trend} (avg: ${avgCompound.toFixed(4)}, tweets: ${totalTweets})`);
            }
            
        } catch (error) {
            console.error('Error aggregating hourly sentiment trends:', error);
        }
    }
    
    // Public API methods
    
    async analyzeSingleSymbol(symbol: string): Promise<SentimentAnalysisResult | null> {
        try {
            console.log(`🔍 Analyzing sentiment for ${symbol}...`);
            
            const result = await this.runPythonAnalysis([symbol]);
            
            // Handle single symbol result (when only one symbol is analyzed)
            if (result && result.symbol && result.trading_signal) {
                await this.processSentimentResult(result);
                return result;
            }
            // Handle multiple symbol results
            else if (result && result.results && result.results[symbol]) {
                const symbolResult = result.results[symbol];
                await this.processSentimentResult(symbolResult);
                return symbolResult;
            }
            
            return null;
            
        } catch (error) {
            console.error(`Error analyzing sentiment for ${symbol}:`, error);
            return null;
        }
    }
    
    getLatestSentiment(symbol: string): SentimentAnalysisResult | null {
        return this.lastAnalysisResults.get(symbol) || null;
    }
    
    getLatestSignal(symbol: string): SentimentSignal | null {
        return this.lastSignals.get(symbol) || null;
    }
    
    getAllLatestSentiments(): Map<string, SentimentAnalysisResult> {
        return new Map(this.lastAnalysisResults);
    }
    
    getAllLatestSignals(): Map<string, SentimentSignal> {
        return new Map(this.lastSignals);
    }
    
    async getSentimentHistory(symbol: string, hours: number = 24): Promise<any[]> {
        try {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
            
            const { data, error } = await this.supabase
                .from('sentiment_data')
                .select('*')
                .eq('asset_symbol', symbol)
                .gte('timestamp', startTime.toISOString())
                .order('timestamp', { ascending: true });
            
            if (error) {
                console.error(`Error fetching sentiment history for ${symbol}:`, error);
                return [];
            }
            
            return data || [];
            
        } catch (error) {
            console.error(`Error getting sentiment history for ${symbol}:`, error);
            return [];
        }
    }
    
    // Configuration methods
    
    getSupportedSymbols(): string[] {
        return [...this.SUPPORTED_SYMBOLS];
    }
    
    getThresholds(): { buy: number; sell: number; neutral: [number, number] } {
        return {
            buy: this.BUY_THRESHOLD,
            sell: this.SELL_THRESHOLD,
            neutral: this.NEUTRAL_ZONE
        };
    }
    
    isRunning(): boolean {
        return this.serviceRunning;
    }
    
    getStatus(): {
        running: boolean;
        lastAnalysis: Date | null;
        symbolsTracked: number;
        analysisInterval: number;
    } {
        const lastAnalysisTimes = Array.from(this.lastAnalysisResults.values())
            .map(result => new Date(result.timestamp))
            .sort((a, b) => b.getTime() - a.getTime());
        
        return {
            running: this.serviceRunning,
            lastAnalysis: lastAnalysisTimes[0] || null,
            symbolsTracked: this.SUPPORTED_SYMBOLS.length,
            analysisInterval: this.ANALYSIS_INTERVAL
        };
    }
}
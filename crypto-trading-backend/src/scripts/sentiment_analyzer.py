#!/usr/bin/env python3
"""
Sentiment Analysis Engine for Cryptocurrency Trading
Uses NLTK Vader Sentiment Analyzer with exact thresholds from comprehensive trading rules:
- Buy signal: compound score > 0.06
- Sell signal: compound score < 0.04  
- Neutral zone: 0.04 to 0.06
"""

import sys
import json
import os
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import re

# Try to import required packages, install if missing
try:
    import nltk
    from nltk.sentiment import SentimentIntensityAnalyzer
except ImportError:
    print("Installing NLTK...")
    os.system("pip install nltk")
    import nltk
    from nltk.sentiment import SentimentIntensityAnalyzer

try:
    import tweepy
except ImportError:
    print("Installing tweepy...")
    os.system("pip install tweepy")
    import tweepy

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system("pip install requests")
    import requests

# Download required NLTK data
try:
    nltk.data.find('vader_lexicon')
except LookupError:
    print("Downloading NLTK Vader lexicon...")
    nltk.download('vader_lexicon', quiet=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CryptoSentimentAnalyzer:
    """
    Cryptocurrency sentiment analyzer using NLTK Vader with Twitter/X integration
    Implements exact thresholds from comprehensive trading rules specification
    """
    
    # Exact thresholds from comprehensive trading rules
    BUY_THRESHOLD = 0.06    # Positive sentiment threshold
    SELL_THRESHOLD = 0.04   # Negative sentiment threshold
    NEUTRAL_ZONE = (0.04, 0.06)  # No action zone
    
    # Volume thresholds for weight adjustment
    HIGH_VOLUME_THRESHOLD = 500  # tweets/hour
    LOW_VOLUME_THRESHOLD = 100   # tweets/hour
    HIGH_VOLUME_MULTIPLIER = 1.5
    LOW_VOLUME_MULTIPLIER = 0.5
    
    def __init__(self):
        """Initialize the sentiment analyzer with NLTK Vader and Twitter API"""
        
        # Initialize NLTK Vader Sentiment Analyzer
        self.sia = SentimentIntensityAnalyzer()
        
        # Twitter API credentials from environment
        self.twitter_api_key = os.getenv('TWITTER_API_KEY', '')
        self.twitter_api_secret = os.getenv('TWITTER_API_SECRET', '')
        self.twitter_bearer_token = os.getenv('TWITTER_BEARER_TOKEN', '')
        self.twitter_access_token = os.getenv('TWITTER_ACCESS_TOKEN', '')
        self.twitter_access_token_secret = os.getenv('TWITTER_ACCESS_TOKEN_SECRET', '')
        
        # Initialize Twitter API client
        self.twitter_client = None
        self.twitter_api_v1 = None
        
        if self.twitter_bearer_token:
            try:
                self.twitter_client = tweepy.Client(
                    bearer_token=self.twitter_bearer_token,
                    consumer_key=self.twitter_api_key,
                    consumer_secret=self.twitter_api_secret,
                    access_token=self.twitter_access_token,
                    access_token_secret=self.twitter_access_token_secret,
                    wait_on_rate_limit=True
                )
                logger.info("Twitter API client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Twitter API: {e}")
        else:
            logger.warning("Twitter API credentials not found - using mock data mode")
        
        # Cryptocurrency symbols and keywords
        self.crypto_symbols = {
            'BTC': ['bitcoin', 'btc', '$btc', '#bitcoin', '#btc'],
            'ETH': ['ethereum', 'eth', '$eth', '#ethereum', '#eth'],
            'USDC': ['usdc', '$usdc', '#usdc', 'usd coin'],
            'USDT': ['usdt', '$usdt', '#usdt', 'tether']
        }
        
        # Sentiment cache for performance
        self.sentiment_cache = {}
        self.cache_expiry = 300  # 5 minutes
        
        logger.info("Crypto Sentiment Analyzer initialized")
    
    def preprocess_tweet(self, text: str) -> str:
        """
        Preprocess tweet text for sentiment analysis
        Removes URLs, mentions, and normalizes text
        """
        # Remove URLs
        text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
        
        # Remove user mentions but keep the context
        text = re.sub(r'@\w+', '', text)
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Convert to lowercase for consistency
        text = text.lower()
        
        return text
    
    def is_crypto_related(self, text: str, symbol: str) -> bool:
        """
        Check if tweet is related to specific cryptocurrency
        """
        text_lower = text.lower()
        keywords = self.crypto_symbols.get(symbol, [])
        
        return any(keyword in text_lower for keyword in keywords)
    
    def analyze_text_sentiment(self, text: str) -> Dict:
        """
        Analyze sentiment of a single text using NLTK Vader
        Returns compound score and component scores
        """
        try:
            # Preprocess text
            processed_text = self.preprocess_tweet(text)
            
            # Get sentiment scores from Vader
            scores = self.sia.polarity_scores(processed_text)
            
            return {
                'compound': scores['compound'],
                'positive': scores['pos'],
                'negative': scores['neg'],
                'neutral': scores['neu'],
                'processed_text': processed_text
            }
        except Exception as e:
            logger.error(f"Error analyzing text sentiment: {e}")
            return {
                'compound': 0.0,
                'positive': 0.0,
                'negative': 0.0,
                'neutral': 1.0,
                'processed_text': text
            }
    
    def fetch_twitter_data(self, symbol: str, max_results: int = 100) -> List[Dict]:
        """
        Fetch recent tweets related to cryptocurrency symbol
        """
        if not self.twitter_client:
            logger.warning("Twitter API not available, using mock data")
            return self.generate_mock_tweets(symbol, max_results)
        
        try:
            # Build search query for cryptocurrency
            keywords = self.crypto_symbols.get(symbol, [symbol.lower()])
            query = ' OR '.join(keywords)
            query += ' -is:retweet lang:en'  # Exclude retweets, English only
            
            # Search for recent tweets
            tweets = tweepy.Paginator(
                self.twitter_client.search_recent_tweets,
                query=query,
                max_results=min(max_results, 100),  # Twitter API limit
                tweet_fields=['created_at', 'public_metrics', 'context_annotations']
            ).flatten(limit=max_results)
            
            tweet_data = []
            for tweet in tweets:
                tweet_data.append({
                    'id': tweet.id,
                    'text': tweet.text,
                    'created_at': tweet.created_at.isoformat(),
                    'retweet_count': tweet.public_metrics.get('retweet_count', 0),
                    'like_count': tweet.public_metrics.get('like_count', 0),
                    'reply_count': tweet.public_metrics.get('reply_count', 0)
                })
            
            logger.info(f"Fetched {len(tweet_data)} tweets for {symbol}")
            return tweet_data
            
        except Exception as e:
            logger.error(f"Error fetching Twitter data for {symbol}: {e}")
            return self.generate_mock_tweets(symbol, max_results)
    
    def generate_mock_tweets(self, symbol: str, count: int = 100) -> List[Dict]:
        """
        Generate mock tweet data for testing when Twitter API is unavailable
        """
        import random
        
        mock_tweets = []
        base_time = datetime.now()
        
        # Sample tweet templates with varying sentiment
        positive_templates = [
            f"{symbol} is looking bullish! Great momentum building 🚀",
            f"Just bought more {symbol}, this dip won't last long",
            f"{symbol} breaking resistance levels, moon incoming! 📈",
            f"Love the fundamentals of {symbol}, holding long term",
            f"{symbol} adoption is growing rapidly, very bullish"
        ]
        
        negative_templates = [
            f"{symbol} is dumping hard, might be time to sell",
            f"Not feeling good about {symbol} right now, bearish signals",
            f"{symbol} breaking support, this could get ugly 📉",
            f"Regulatory concerns around {symbol} are worrying",
            f"{symbol} looking weak, might exit my position"
        ]
        
        neutral_templates = [
            f"{symbol} consolidating in this range, waiting for breakout",
            f"Watching {symbol} closely, could go either way",
            f"{symbol} volume is low, not much happening",
            f"Technical analysis on {symbol} shows mixed signals",
            f"{symbol} holding steady, no major moves today"
        ]
        
        for i in range(count):
            # Random sentiment distribution (40% positive, 30% negative, 30% neutral)
            rand = random.random()
            if rand < 0.4:
                text = random.choice(positive_templates)
            elif rand < 0.7:
                text = random.choice(negative_templates)
            else:
                text = random.choice(neutral_templates)
            
            mock_tweets.append({
                'id': f"mock_{i}",
                'text': text,
                'created_at': (base_time - timedelta(minutes=random.randint(0, 60))).isoformat(),
                'retweet_count': random.randint(0, 50),
                'like_count': random.randint(0, 200),
                'reply_count': random.randint(0, 20)
            })
        
        logger.info(f"Generated {len(mock_tweets)} mock tweets for {symbol}")
        return mock_tweets
    
    def calculate_engagement_weight(self, tweet: Dict) -> float:
        """
        Calculate engagement weight based on retweets, likes, and replies
        """
        retweets = tweet.get('retweet_count', 0)
        likes = tweet.get('like_count', 0)
        replies = tweet.get('reply_count', 0)
        
        # Weighted engagement score
        engagement_score = (retweets * 3) + (likes * 1) + (replies * 2)
        
        # Normalize to weight between 0.5 and 2.0
        if engagement_score == 0:
            return 1.0
        elif engagement_score < 10:
            return 0.8
        elif engagement_score < 50:
            return 1.2
        else:
            return 1.5
    
    def analyze_symbol_sentiment(self, symbol: str, hours_back: int = 1) -> Dict:
        """
        Analyze sentiment for a specific cryptocurrency symbol
        Returns aggregated sentiment with trading signals
        """
        try:
            # Fetch recent tweets
            tweets = self.fetch_twitter_data(symbol, max_results=200)
            
            if not tweets:
                logger.warning(f"No tweets found for {symbol}")
                return self.get_neutral_sentiment_result(symbol)
            
            # Filter tweets by time window
            cutoff_time = datetime.now() - timedelta(hours=hours_back)
            recent_tweets = []
            
            for tweet in tweets:
                try:
                    tweet_time = datetime.fromisoformat(tweet['created_at'].replace('Z', '+00:00'))
                    if tweet_time.replace(tzinfo=None) > cutoff_time:
                        recent_tweets.append(tweet)
                except Exception as e:
                    logger.warning(f"Error parsing tweet timestamp: {e}")
                    recent_tweets.append(tweet)  # Include tweet if timestamp parsing fails
            
            if not recent_tweets:
                logger.warning(f"No recent tweets found for {symbol}")
                return self.get_neutral_sentiment_result(symbol)
            
            # Analyze sentiment for each tweet
            sentiment_scores = []
            total_engagement_weight = 0
            
            for tweet in recent_tweets:
                if self.is_crypto_related(tweet['text'], symbol):
                    sentiment = self.analyze_text_sentiment(tweet['text'])
                    engagement_weight = self.calculate_engagement_weight(tweet)
                    
                    sentiment_scores.append({
                        'compound': sentiment['compound'],
                        'positive': sentiment['positive'],
                        'negative': sentiment['negative'],
                        'neutral': sentiment['neutral'],
                        'weight': engagement_weight,
                        'tweet_id': tweet['id']
                    })
                    total_engagement_weight += engagement_weight
            
            if not sentiment_scores:
                logger.warning(f"No relevant tweets found for {symbol}")
                return self.get_neutral_sentiment_result(symbol)
            
            # Calculate weighted average sentiment
            weighted_compound = sum(s['compound'] * s['weight'] for s in sentiment_scores) / total_engagement_weight
            weighted_positive = sum(s['positive'] * s['weight'] for s in sentiment_scores) / total_engagement_weight
            weighted_negative = sum(s['negative'] * s['weight'] for s in sentiment_scores) / total_engagement_weight
            weighted_neutral = sum(s['neutral'] * s['weight'] for s in sentiment_scores) / total_engagement_weight
            
            # Apply volume-based weight adjustment
            tweet_count = len(sentiment_scores)
            volume_multiplier = self.get_volume_multiplier(tweet_count)
            adjusted_compound = weighted_compound * volume_multiplier
            
            # Generate trading signal based on thresholds
            trading_signal = self.generate_trading_signal(adjusted_compound)
            
            # Calculate confidence based on score distribution and volume
            confidence = self.calculate_confidence(sentiment_scores, tweet_count)
            
            result = {
                'symbol': symbol,
                'timestamp': datetime.now().isoformat(),
                'sentiment_scores': {
                    'compound': weighted_compound,
                    'adjusted_compound': adjusted_compound,
                    'positive': weighted_positive,
                    'negative': weighted_negative,
                    'neutral': weighted_neutral
                },
                'trading_signal': trading_signal,
                'confidence': confidence,
                'tweet_count': tweet_count,
                'volume_multiplier': volume_multiplier,
                'thresholds': {
                    'buy_threshold': self.BUY_THRESHOLD,
                    'sell_threshold': self.SELL_THRESHOLD,
                    'neutral_zone': self.NEUTRAL_ZONE
                },
                'raw_tweets_analyzed': len(sentiment_scores)
            }
            
            logger.info(f"Sentiment analysis for {symbol}: {trading_signal} (score: {adjusted_compound:.4f})")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing sentiment for {symbol}: {e}")
            return self.get_neutral_sentiment_result(symbol, error=str(e))
    
    def get_volume_multiplier(self, tweet_count: int) -> float:
        """
        Get volume-based multiplier according to comprehensive trading rules
        """
        if tweet_count > self.HIGH_VOLUME_THRESHOLD:
            return self.HIGH_VOLUME_MULTIPLIER
        elif tweet_count < self.LOW_VOLUME_THRESHOLD:
            return self.LOW_VOLUME_MULTIPLIER
        else:
            return 1.0
    
    def generate_trading_signal(self, compound_score: float) -> str:
        """
        Generate trading signal based on exact thresholds from comprehensive trading rules
        """
        if compound_score > self.BUY_THRESHOLD:
            return 'BUY'
        elif compound_score < self.SELL_THRESHOLD:
            return 'SELL'
        else:
            return 'NEUTRAL'
    
    def calculate_confidence(self, sentiment_scores: List[Dict], tweet_count: int) -> float:
        """
        Calculate confidence score based on sentiment consistency and volume
        """
        if not sentiment_scores:
            return 0.0
        
        # Calculate standard deviation of compound scores
        compounds = [s['compound'] for s in sentiment_scores]
        mean_compound = sum(compounds) / len(compounds)
        variance = sum((x - mean_compound) ** 2 for x in compounds) / len(compounds)
        std_dev = variance ** 0.5
        
        # Lower standard deviation = higher confidence
        consistency_score = max(0, 1 - (std_dev * 2))
        
        # Higher tweet count = higher confidence (up to a point)
        volume_score = min(1.0, tweet_count / 100)
        
        # Combined confidence score
        confidence = (consistency_score * 0.7) + (volume_score * 0.3)
        
        return round(confidence, 3)
    
    def get_neutral_sentiment_result(self, symbol: str, error: str = None) -> Dict:
        """
        Return neutral sentiment result when no data is available
        """
        return {
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'sentiment_scores': {
                'compound': 0.0,
                'adjusted_compound': 0.0,
                'positive': 0.0,
                'negative': 0.0,
                'neutral': 1.0
            },
            'trading_signal': 'NEUTRAL',
            'confidence': 0.0,
            'tweet_count': 0,
            'volume_multiplier': 1.0,
            'thresholds': {
                'buy_threshold': self.BUY_THRESHOLD,
                'sell_threshold': self.SELL_THRESHOLD,
                'neutral_zone': self.NEUTRAL_ZONE
            },
            'raw_tweets_analyzed': 0,
            'error': error
        }
    
    def analyze_multiple_symbols(self, symbols: List[str]) -> Dict:
        """
        Analyze sentiment for multiple cryptocurrency symbols
        """
        results = {}
        
        for symbol in symbols:
            try:
                results[symbol] = self.analyze_symbol_sentiment(symbol)
            except Exception as e:
                logger.error(f"Error analyzing {symbol}: {e}")
                results[symbol] = self.get_neutral_sentiment_result(symbol, error=str(e))
        
        return {
            'timestamp': datetime.now().isoformat(),
            'symbols_analyzed': len(symbols),
            'results': results
        }

def main():
    """
    Main function for command-line usage
    """
    if len(sys.argv) < 2:
        print("Usage: python sentiment_analyzer.py <symbol> [symbol2] [symbol3] ...")
        print("Example: python sentiment_analyzer.py BTC ETH")
        sys.exit(1)
    
    symbols = sys.argv[1:]
    
    # Initialize analyzer
    analyzer = CryptoSentimentAnalyzer()
    
    # Analyze sentiment
    if len(symbols) == 1:
        result = analyzer.analyze_symbol_sentiment(symbols[0])
    else:
        result = analyzer.analyze_multiple_symbols(symbols)
    
    # Output JSON result
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
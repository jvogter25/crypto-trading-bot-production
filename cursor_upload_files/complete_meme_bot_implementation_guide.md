# Complete Meme Bot Implementation Guide

Starting from Prompt 9 - Enhanced with Binance.US + Coinbase Advanced Integration

---

## Core Bot Completion (Continue from where you are)

### Prompt 9: Market Condition Detection

```text
Using ONLY the "comprehensive_trading_rules.md" document, specifically the "Market Condition Adaptation" sections in both stable coin and alt coin strategies, implement the market condition detection system. Create the algorithms to classify bull/bear/sideways markets and automatically adjust strategy parameters based on detected conditions.

IMPORTANT: This system must accurately detect market conditions to prevent the bot from using inappropriate strategies during different market phases. The bot needs to dynamically adjust profit targets, position sizing, and risk parameters based on whether the market is in a bull, bear, or sideways trend.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Historical market data classification across different periods
- Real-time market condition detection and parameter adjustment
- Strategy parameter changes based on detected conditions
- Stability of classification (no rapid switching between conditions)

✅ **What to Look For:**
- Accurate classification of market conditions (bull, bear, sideways)
- Strategy parameters (alt coin profit targets, grid spacing) dynamically adjust according to detected market condition
- Bull market: Higher profit targets (8%), more aggressive position sizing
- Bear market: Lower profit targets (1.5%), more conservative approach
- Sideways market: Standard grid trading parameters (3% targets)
- No erratic behavior or constant switching between market conditions

✅ **Success Criteria:**
- Market condition detection accuracy >80% when tested against known historical periods
- Parameter adjustments occur smoothly within 5 minutes of condition change
- Classification remains stable for at least 4 hours before switching
- All condition changes logged with timestamps and reasoning

**Notes Section:** ________________
```

---

### Prompt 10: Kraken API Integration

```text
Using ONLY the "crypto_trading_app_specs.md" document (the original architecture plan) and the API integration details from "comprehensive_trading_rules.md", implement the complete Kraken API integration for both REST and WebSocket connections. Include order management, market data feeds, and account balance tracking.

IMPORTANT: This is the bot's lifeline to the market. Any failures here will prevent all trading operations. The integration must handle connection drops, rate limits, and provide real-time data with minimal latency. This is critical for the core trading engine's stability.

TESTING REQUIREMENTS:
✅ **What to Test:**
- REST API connection and authentication
- WebSocket connection stability and real-time data streaming
- Order placement, modification, and cancellation
- Account balance queries and updates
- Error handling and connection recovery

✅ **What to Look For:**
- Real-time price updates received without significant delay (<1 second)
- Test orders placed, modified, and canceled successfully on the exchange
- Account balances accurately retrieved and updated after trades
- Proper error handling for API rate limits or connection issues
- WebSocket connection remains stable for extended periods (>1 hour)
- Order book data received and processed correctly
- Automatic reconnection after network interruptions

✅ **Success Criteria:**
- WebSocket connection uptime >99% over 24-hour period
- Order execution success rate >95% for test orders
- Price data latency <500ms from exchange to bot
- All API rate limits respected without errors
- Connection recovery within 30 seconds of network interruption

**Notes Section:** ________________
```

---

### Prompt 11: External Logging Integration

```text
Using the Google Sheets API integration requirements from the original architecture documents and the logging specifications in "comprehensive_trading_rules.md", implement the external logging system for trade tracking and performance reporting. Log all trades, profit-taking events, and performance metrics to the configured Google Sheet.

AUDIT TRAIL: This needs to log every trade and decision made by the bot today. Implement real-time logging with proper error handling.

IMPORTANT: This creates your audit trail for tax purposes and performance analysis. Every trade must be logged immediately with complete details. This is legally required for tax reporting and essential for performance optimization.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Google Sheets API connection and authentication
- Real-time logging of trades and decisions
- Data formatting and column structure
- Error handling when Google Sheets is unavailable
- Batch logging for high-frequency periods

✅ **What to Look For:**
- New rows appear in Google Sheet for each trade executed (buy/sell), profit-taking event, and significant decision
- Data points logged: timestamp, asset, quantity, price, profit/loss, strategy used, market condition
- No errors or delays in logging (should appear within 5 seconds of trade)
- Proper formatting of numerical data (prices, quantities, P&L)
- Error handling when Google Sheets API is temporarily unavailable
- Batch logging capability for high-frequency trading periods
- Complete audit trail with no missing trades

✅ **Success Criteria:**
- 100% of trades logged successfully within 5 seconds
- Google Sheets accessible and readable by external tools
- Data format consistent and machine-readable
- No data loss during API outages (queued and sent when reconnected)
- Complete trade attribution with strategy and reasoning

**Notes Section:** ________________
```

---

### Prompt 11.5: DaisyUI Frontend Setup

```text
When setting up the React frontend, include DaisyUI configuration:

1. Install DaisyUI: npm install -D tailwindcss daisyui
2. Update tailwind.config.js:
   module.exports = {
     content: ["./src/**/*.{js,jsx,ts,tsx}"],
     plugins: [require("daisyui")],
     daisyui: {
       themes: [
         {
           "trading-dark": {
             "primary": "#8B5CF6",
             "secondary": "#EC4899", 
             "accent": "#14B8A6",
             "neutral": "#1F2937",
             "base-100": "#111827",
             "base-200": "#1F2937",
             "base-300": "#374151",
             "info": "#3ABFF8",
             "success": "#36D399",
             "warning": "#FBBD23",
             "error": "#F87272",
           }
         }
       ]
     }
   }
3. Set data-theme="trading-dark" on html element

IMPORTANT: This sets up the professional trading interface foundation that all dashboard components will use. The dark theme is essential for extended trading sessions and the color scheme provides clear visual hierarchy for profits, losses, and alerts.

TESTING REQUIREMENTS:
✅ **What to Test:**
- DaisyUI installation and Tailwind CSS integration
- Custom theme application and color scheme
- Basic component rendering with theme
- Responsive design across screen sizes
- Theme consistency across all components

✅ **What to Look For:**
- DaisyUI successfully installed and recognized by Tailwind CSS
- Custom "trading-dark" theme applied, showing specified colors (dark backgrounds, purple primary, teal accent, etc.)
- Basic DaisyUI components (button, card) render correctly with theme
- Color scheme professional and easy on eyes for extended trading sessions
- All theme colors properly applied across different component states
- No styling conflicts or missing styles

✅ **Success Criteria:**
- All DaisyUI components render with consistent dark theme
- Color hierarchy clear: green for profits, red for losses, yellow for warnings
- Theme loads correctly on page refresh
- Responsive design works on mobile, tablet, and desktop
- Professional appearance suitable for financial application

**Notes Section:** ________________
```

---

### Prompt 12: Trading Dashboard Implementation

```text
Using ONLY the "crypto_action_plan.md" document, specifically Step 27 (Frontend Trading Rules Dashboard), implement the complete trading dashboard using DaisyUI components with a custom dark trading theme.

DAISYUI COMPONENTS TO USE:
- card, card-body, card-title for data containers
- btn, btn-primary, btn-error for actions and emergency stop
- badge, badge-success, badge-error for status indicators
- table, table-zebra for trade history
- progress, radial-progress for portfolio metrics
- alert, alert-warning, alert-error for risk notifications
- modal for emergency stop confirmation
- stats, stat for key performance numbers
- indicator for real-time status dots

DESIGN REQUIREMENTS:
- Use dark theme for professional trading interface
- Implement responsive grid layout with DaisyUI's grid system
- Add real-time data updates with smooth transitions
- Include prominent emergency stop button (btn-error btn-lg)
- Use color coding: success class for profits, error class for losses, warning for alerts
- Add loading skeletons for data fetching states

LIVE MONITORING: Connect to all backend services and display live data with DaisyUI's beautiful, professional components.

IMPORTANT: This is your primary interface for monitoring and controlling the bot. It must provide clear, accurate, real-time information with no delays or inaccuracies. The emergency stop must be immediately accessible and the interface must handle high-frequency updates smoothly.

TESTING REQUIREMENTS:
✅ **What to Test:**
- All dashboard components rendering and styling
- Real-time data updates and WebSocket connections
- Emergency stop functionality and confirmation modal
- Responsive design across different screen sizes
- Performance with high-frequency data updates

✅ **What to Look For:**
- All specified dashboard components (TradingRulesOverview, GridTradingMonitor, SentimentDashboard, RiskManagementControls, TradingPerformanceAnalytics) rendered
- Data from backend (portfolio value, open trades, sentiment scores) displayed accurately and updates in real-time
- Emergency stop button prominent and triggers confirmation modal
- Color coding (green for profit, red for loss, yellow for warnings) applied correctly
- Dashboard responsive across different screen sizes (desktop, tablet, mobile)
- Real-time updates occur smoothly without flickering or layout shifts
- Loading states handled gracefully with skeletons

✅ **Success Criteria:**
- Dashboard loads completely within 3 seconds
- Real-time updates with <1 second latency from backend
- Emergency stop accessible within 2 clicks maximum
- All data accurate and matches backend state
- No UI freezing or performance issues during high-frequency updates
- Professional appearance suitable for financial monitoring

**Notes Section:** ________________
```

---

### Prompt 13: Comprehensive Paper Trading

```text
Implement a comprehensive paper trading mode starting with a $300 virtual portfolio. This should simulate all trading logic without executing real trades, using real market data for accurate testing.

PAPER TRADING CONFIGURATION:
- Starting virtual balance: $300 USD
- Maximum position size: $15 (5% of portfolio)
- Enable both grid trading (stable coins) and sentiment trading (alt coins)
- Track all trades, profits, and portfolio changes in database
- Log everything to Google Sheets for external monitoring

VIRTUAL TRADING LOGIC:
- Use real Kraken price feeds for accurate simulation
- Simulate order execution with realistic slippage (0.1-0.2%)
- Track virtual positions and balances in separate database tables
- Calculate profits/losses using real market movements
- Apply all risk management rules as if trading real money

MONITORING REQUIREMENTS:
- Real-time portfolio value updates on dashboard
- Track daily/weekly performance metrics
- Monitor trade frequency and success rates
- Validate profit-taking and reinvestment logic
- Test all emergency stop and risk management triggers

VALIDATION TARGETS:
- Run for minimum 7 days (168 hours) continuously
- Target: 50+ simulated trades for statistical significance
- Expected: 2-5% weekly returns with <10% maximum drawdown
- Monitor: Grid trading should generate 60-80% of trades
- Verify: Sentiment trading captures larger moves (20-40% of profits)

IMPORTANT: This is your most critical validation step before live trading. Do NOT proceed to live trading until your bot consistently meets the paper trading validation targets for at least a week. This phase validates all trading logic, risk management, and performance expectations.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Virtual portfolio initialization and balance tracking
- Simulated order execution with realistic slippage
- All trading strategies (grid and sentiment) in paper mode
- Risk management triggers and position limits
- Performance metrics calculation and reporting

✅ **What to Look For:**
- Virtual portfolio balance starts at $300 and changes according to simulated trades
- At least 50 simulated trades occur over the week (7-10 trades per day average)
- Bot generates positive returns (ideally 2-5% weekly, minimum break-even)
- Maximum drawdown remains below 10% ($30 loss from peak)
- Grid trading accounts for majority of trades (60-80%), sentiment trading captures larger moves
- All risk management rules (5% max exposure, drawdown triggers) function correctly in simulation
- Profit-taking (2% gain) and reinvestment (70%) logic works as expected
- Emergency stop functionality works in paper trading mode

✅ **Success Criteria:**
- 7 consecutive days of stable operation with no crashes
- Weekly return between 2-5% with maximum 10% drawdown
- 50+ trades executed with >60% win rate
- All risk management rules enforced 100% of time
- Complete audit trail in Google Sheets
- Dashboard accurately reflects all paper trading activity

**Notes Section:** ________________
```

---

### Prompt 14: Backtesting Implementation

```text
Using ONLY the "comprehensive_trading_rules.md" document, specifically the "Performance Optimization and Testing" section, implement the backtesting framework with historical data simulation, walk-forward analysis, and Monte Carlo testing capabilities.

IMPORTANT: Backtesting helps confirm the strategy's historical robustness and provides confidence in the approach. This validates that your trading rules would have been profitable in various market conditions and helps optimize parameters.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Historical data loading and processing
- Strategy simulation across different time periods
- Walk-forward analysis with rolling windows
- Monte Carlo simulations with random scenarios
- Performance metrics calculation and reporting

✅ **What to Look For:**
- Backtesting framework accurately simulates past market conditions and bot behavior
- Performance metrics (profit/loss, drawdown, Sharpe ratio, win rate) generated
- Walk-forward analysis shows consistent performance across different data segments
- Monte Carlo simulations provide range of possible outcomes, indicating robustness
- Backtests show positive returns across different market conditions (bull, bear, sideways)
- Maximum drawdown in backtests aligns with paper trading results

✅ **Success Criteria:**
- Backtests show positive returns in >70% of tested periods
- Maximum drawdown <15% across all tested scenarios
- Sharpe ratio >1.0 indicating good risk-adjusted returns
- Walk-forward analysis shows consistent performance
- Monte Carlo results indicate <5% probability of >20% drawdown

**Notes Section:** ________________
```

---

### Prompt 15: Live Trading Activation

```text
Create a simple configuration switch to enable live trading mode. Include final safety checks, position size validation, and emergency stop mechanisms. Start with minimal position sizes for initial live testing.

GO LIVE: Once paper trading validates the system, enable live trading with small amounts to verify everything works in production.

IMPORTANT: Start extremely small. Only increase capital once you have several days of proven live performance with minimal issues. This is the transition from simulation to real money - every safety mechanism must be tested and working.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Live trading mode activation and configuration
- Real order execution on Kraken exchange
- Position size validation and limits
- Emergency stop mechanisms in live environment
- Real-time monitoring and alerting

✅ **What to Look For:**
- Bot successfully places and manages real orders on Kraken
- Real profits/losses accurately reflected in your Kraken account and dashboard
- All risk management and emergency stop mechanisms active and responsive
- No unexpected errors or disconnections during live trading
- Order execution matches paper trading behavior
- Profit-taking and reinvestment logic works with real money
- Google Sheets logging continues to work with live trades

✅ **Success Criteria:**
- First 24 hours of live trading with no critical errors
- Real trades match paper trading patterns and performance
- All safety mechanisms tested and functional
- Position sizes remain within configured limits
- Emergency stop tested and working correctly

**Notes Section:** ________________
```

---

## Meme Coin Bot Integration

### Prompt 16: Meme Coin Database Schema Extension

```text
Extend the existing database schema to support meme coin trading. Create new tables for:
- meme_coin_positions: Tracks active meme coin holdings, entry price, quantity, platform (Binance.US/Coinbase Advanced).
- meme_coin_signals: Stores generated moonshot signals (timestamp, coin, platform, confidence score, source).
- meme_coin_learning_data: Logs AI model's predictions, actual outcomes, and feedback for continuous learning.
- meme_coin_config: Stores specific configuration for the meme coin module (e.g., max daily trades, max exposure).

Ensure proper relationships with existing user and portfolio tables.

IMPORTANT: A robust database schema is fundamental for tracking and learning from meme coin trades. The schema must support high-frequency signal generation, position tracking across multiple exchanges, and machine learning feedback loops.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Database table creation and structure validation
- Foreign key relationships and constraints
- Data insertion and retrieval operations
- Index performance for frequent queries
- Data integrity and validation rules

✅ **What to Look For:**
- meme_coin_positions, meme_coin_signals, meme_coin_learning_data, and meme_coin_config tables present
- Columns match specified requirements (coin, platform, confidence_score, entry_price, quantity)
- Foreign key relationships correctly established with existing tables
- Dummy data can be inserted and retrieved without errors
- Proper indexing on frequently queried columns (timestamp, coin, platform)
- Data types appropriate for expected data ranges

✅ **Success Criteria:**
- All tables created with correct schema and relationships
- Data operations perform efficiently (<100ms for typical queries)
- Referential integrity maintained across all operations
- Schema supports all planned meme coin trading operations
- Backup and recovery procedures tested

**Notes Section:** ________________
```

---

### Prompt 17: Binance.US & Coinbase Advanced API Integration

```text
Implement API integrations for Binance.US and Coinbase Advanced. For each platform:
- Establish secure REST and WebSocket connections.
- Implement functions for:
    - Retrieving real-time market data (price, volume, order book).
    - Placing, modifying, and canceling spot orders.
    - Querying account balances specific to each platform.
- Ensure robust error handling and rate limit management.

SETUP NOTE: Use the API keys and secrets obtained from your Binance.US and Coinbase Advanced accounts.

IMPORTANT: Essential for interacting with the meme coin markets. Both exchanges must be integrated reliably since meme coins may be available on one platform but not the other. The integration must handle the differences in API formats and rate limits between platforms.

TESTING REQUIREMENTS:
✅ **What to Test:**
- API authentication and connection establishment
- Real-time market data streaming from both exchanges
- Order placement, modification, and cancellation
- Account balance queries and updates
- Error handling and rate limit management

✅ **What to Look For:**
- Stable WebSocket connections for real-time data from both Binance.US and Coinbase Advanced
- Test orders successfully executed on both platforms
- Account balances accurately retrieved for each exchange
- API rate limits handled gracefully without crashing
- Error handling works for network interruptions and API downtime
- Order book data received and processed correctly from both exchanges
- Price feeds update in real-time with minimal latency

✅ **Success Criteria:**
- Both exchanges connected and authenticated successfully
- Real-time data streams stable for >1 hour continuous operation
- Test orders execute with >95% success rate
- Rate limits respected with no API errors
- Cross-exchange arbitrage opportunities detected when available

**Notes Section:** ________________
```

---

### Prompt 18: Meme Coin AI Signal Generation

```text
Develop the AI-powered signal generation module for meme coins. This module should:
- Integrate with social media APIs (e.g., Twitter/X, Reddit, Telegram via third-party aggregators if direct API is complex).
- Analyze social media momentum (trending topics, sentiment spikes, follower growth).
- Incorporate technical analysis (volume spikes, breakout patterns, whale activity detection).
- Perform fundamental screening (contract verification, liquidity locks, team doxx).
- Generate a "moonshot confidence score" for potential meme coins.
- Limit signal generation to one per 24-hour trading window.
- Focus on meme coins available on Binance.US and Coinbase Advanced (DOGE, SHIB, PEPE, and newly listed meme coins).

IMPORTANT: This is the core of your moonshot strategy. The AI must generate high-quality signals while strictly adhering to the one-per-day limit. The confidence scoring must be calibrated to identify genuine opportunities while avoiding false positives.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Social media data integration and sentiment analysis
- Technical analysis calculations and signal generation
- Fundamental screening and risk assessment
- Confidence score calibration and validation
- Signal frequency limiting (one per 24 hours)

✅ **What to Look For:**
- AI module processes social media data, technical indicators, and fundamental checks
- "Moonshot confidence score" (0-100) generated for potential meme coins
- Only one signal generated within 24-hour period, regardless of opportunities
- Module correctly identifies high-volume, high-sentiment coins
- Social media sentiment analysis produces reasonable scores
- Technical analysis correctly identifies volume spikes and breakout patterns
- Fundamental screening flags suspicious contracts or missing team information
- Confidence scores correlate with quality of signals (higher scores for better opportunities)
- Focus on coins available on Binance.US and Coinbase Advanced

✅ **Success Criteria:**
- Signal generation limited to exactly one per 24-hour period
- Confidence scores correlate with actual price movements >70% of time
- Social media sentiment accuracy >60% for predicting short-term moves
- Technical analysis identifies volume spikes with <5% false positive rate
- All signals focus on coins available on target exchanges

**Notes Section:** ________________
```

---

### Prompt 19: Meme Coin Rug Pull Detection

```text
Implement an AI-powered rug pull detection algorithm. This module should:
- Analyze smart contract code for suspicious functions (e.g., minting, blacklisting, hidden fees).
- Monitor liquidity pool changes (sudden withdrawals, low liquidity).
- Detect social media red flags (sudden account deletions, suspicious community behavior).
- Integrate with blockchain explorers for real-time transaction analysis.
- Provide a "rug pull risk score" and trigger alerts if high.
- Focus on meme coins available on Binance.US and Coinbase Advanced for enhanced safety.

IMPORTANT: This is paramount for protecting your capital in the volatile meme coin market. The detection system must be highly sensitive to avoid rug pulls while not being so restrictive that it blocks legitimate opportunities.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Smart contract analysis and suspicious function detection
- Liquidity pool monitoring and change detection
- Social media red flag identification
- Blockchain transaction analysis and pattern recognition
- Risk score calculation and alert generation

✅ **What to Look For:**
- Module accurately identifies known rug pull patterns
- "Rug pull risk score" (0-100) generated for each potential meme coin
- High-risk alerts (score >70) triggered when suspicious activity detected
- Bot avoids trading coins with high rug pull risk
- Contract analysis identifies suspicious functions (unlimited minting, owner-only functions)
- Liquidity monitoring detects sudden large withdrawals
- Social media monitoring flags account deletions or suspicious behavior
- Real-time transaction analysis identifies whale dumps or unusual patterns
- Enhanced safety for coins on major exchanges (Binance.US/Coinbase Advanced)

✅ **Success Criteria:**
- Known rug pulls detected with >90% accuracy in historical testing
- False positive rate <10% for legitimate projects
- Risk scores update in real-time as conditions change
- Integration with major exchanges provides additional safety layer
- Alert system prevents trading on high-risk coins

**Notes Section:** ________________
```

---

### Prompt 20: Meme Coin Trading Engine

```text
Develop the meme coin trading engine. This engine should:
- Execute trades based on the AI's moonshot signals, adhering to the "1 moonshot per 24 hours" rule.
- Implement strict position sizing: maximum 2% of total portfolio per meme coin.
- Apply a hard stop-loss at -50% for each meme coin position.
- Implement dynamic take-profit levels (e.g., sell 25% at 100% gain, another 25% at 300% gain, etc.).
- Select the appropriate exchange (Binance.US or Coinbase Advanced) based on coin availability and liquidity.
- Prioritize Coinbase Advanced for established meme coins (DOGE, SHIB, PEPE) and Binance.US for newer listings.

IMPORTANT: This ensures your meme coin strategy adheres to strict risk management and profit-taking rules. The engine must be disciplined about position sizing and stop-losses while maximizing profits through staged take-profit levels.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Signal-based trade execution and timing
- Position sizing calculations and limits
- Stop-loss and take-profit level implementation
- Exchange selection logic and order routing
- Risk management rule enforcement

✅ **What to Look For:**
- Only one meme coin trade attempted within 24-hour window
- Position size never exceeds 2% of total portfolio (e.g., $6 on $300 portfolio)
- Hard stop-loss at -50% correctly triggered and executed
- Take-profit levels triggered at specified gains (100%, 300%, 500%, 1000%)
- Partial sales occur at each take-profit level (25% of position each time)
- Correct exchange chosen for trade based on availability and liquidity
- Order execution handles slippage and partial fills correctly
- Position tracking accurately reflects current holdings and P&L
- Exchange selection logic prioritizes Coinbase Advanced for established coins

✅ **Success Criteria:**
- 24-hour trading limit strictly enforced with no exceptions
- Position sizing never exceeds 2% limit under any circumstances
- Stop-losses execute within 1% of target price
- Take-profit levels execute automatically at target prices
- Exchange selection optimizes for liquidity and availability

**Notes Section:** ________________
```

---

### Prompt 21: Meme Coin Learning & Adaptation Module

```text
Implement a learning and adaptation module for the meme coin bot. This module should:
- Track the outcome of each moonshot trade (profit/loss, actual gain vs. target).
- Use these outcomes to refine the AI signal generation model over time (e.g., adjust confidence score thresholds, weight social media metrics).
- Identify patterns in successful vs. unsuccessful moonshots.
- Continuously improve the rug pull detection algorithm based on new data.
- Learn from the performance differences between Binance.US and Coinbase Advanced listings.

IMPORTANT: This module ensures your bot gets smarter over time. The learning mechanism must be active and making logical adjustments without becoming overly aggressive or risky. It should improve signal quality while maintaining strict risk controls.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Trade outcome tracking and data collection
- AI model refinement and parameter adjustment
- Pattern recognition in successful vs. failed trades
- Rug pull detection algorithm improvement
- Exchange performance analysis and optimization

✅ **What to Look For:**
- Module logs trade outcomes and feeds them back into AI model
- Over time, moonshot confidence scores become more accurate (higher scores correlate with better outcomes)
- Rug pull detection improves its accuracy in identifying scams
- Bot's performance on meme coins shows signs of improvement (higher win rate, better average gains)
- Pattern recognition identifies characteristics of successful vs. failed moonshots
- Model weights adjust based on historical performance
- Learning rate appropriate (not too fast to cause instability, not too slow to be ineffective)
- Exchange performance analysis helps optimize platform selection

✅ **Success Criteria:**
- Signal accuracy improves by >10% over first month of operation
- Rug pull detection false positive rate decreases over time
- Exchange selection optimization shows measurable performance improvement
- Learning algorithm maintains risk controls while improving performance
- Pattern recognition identifies actionable insights for strategy improvement

**Notes Section:** ________________
```

---

### Prompt 22: Meme Coin Dashboard Integration

```text
Integrate the meme coin trading module's data into the main dashboard. Add new sections or components to display:
- Meme coin portfolio value and P&L.
- Recent moonshot signals and their outcomes.
- Active meme coin positions with entry/current price, gain/loss.
- Rug pull risk alerts.
- Overall meme coin strategy performance metrics.
- Exchange performance comparison (Binance.US vs Coinbase Advanced).

Use DaisyUI components to maintain a consistent, professional look.

IMPORTANT: The dashboard provides crucial visibility into your meme coin strategy. All relevant data must be displayed clearly and in real-time. The interface should make it easy to monitor high-risk meme coin positions and quickly identify any issues.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Meme coin dashboard component integration
- Real-time data updates and display accuracy
- Alert system functionality and visibility
- Performance metrics calculation and presentation
- Exchange comparison features

✅ **What to Look For:**
- New sections/components for meme coin data appear on dashboard
- Meme coin portfolio value, P&L, and active positions displayed accurately
- Moonshot signals and their outcomes visible with timestamps and confidence scores
- Rug pull risk alerts prominently displayed when triggered
- All new components use DaisyUI styling and integrate seamlessly with existing dashboard
- Real-time updates work correctly for meme coin data
- Performance metrics show win rate, average gain/loss, and total return
- Position details include entry price, current price, gain/loss percentage, and time held
- Exchange performance comparison shows which platform performs better

✅ **Success Criteria:**
- Dashboard provides complete visibility into meme coin operations
- All alerts and warnings clearly visible and actionable
- Real-time updates with <1 second latency
- Professional appearance consistent with main dashboard
- Exchange performance data helps optimize future trades

**Notes Section:** ________________
```

---

### Prompt 23: Meme Coin Paper Trading Validation

```text
Implement a dedicated paper trading mode for the meme coin bot, starting with a $60 virtual allocation. This should simulate all meme coin trading logic without executing real trades, using real market data.

PAPER TRADING CONFIGURATION:
- Starting virtual balance: $60 USD (separate from core bot's $300)
- Max position size: $1.20 (2% of $60)
- Track all meme coin trades, profits, and portfolio changes in database.
- Log everything to Google Sheets for external monitoring.
- Focus on meme coins available on Binance.US and Coinbase Advanced.

VALIDATION TARGETS:
- Run for minimum 7 days (168 hours) continuously.
- Target: At least 1 successful moonshot (e.g., 5x+ gain) within the week.
- Expected: Overall positive return for the meme coin portfolio, despite potential losses on other attempts.
- Verify: All risk management (2% position, -50% stop-loss) and take-profit rules function correctly.

IMPORTANT: This is crucial for validating the high-risk meme coin strategy. The paper trading must demonstrate that the strategy can be profitable while maintaining strict risk controls. Do NOT proceed to live trading until you see promising results.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Meme coin paper trading initialization and operation
- Signal generation and trade execution simulation
- Risk management rule enforcement
- Take-profit and stop-loss level testing
- Performance tracking and analysis

✅ **What to Look For:**
- Virtual meme coin portfolio balance starts at $60 and changes according to simulated trades
- Bot attempts approximately one moonshot trade per day (7 total over week)
- At least one simulated moonshot trade results in significant gain (5x+ or $6+ profit)
- Overall, meme coin portfolio shows net positive return or controlled losses (not more than 20% loss)
- All risk management rules (2% max exposure, -50% stop-loss) function correctly in simulation
- Rug pull detection prevents trades on high-risk coins
- Take-profit levels trigger correctly during simulated price surges
- Learning algorithm shows signs of improvement over the week
- Exchange selection logic works correctly for available coins

✅ **Success Criteria:**
- 7 days continuous operation with no system failures
- At least one 5x+ moonshot success during the week
- Overall portfolio performance positive or limited losses (<20%)
- All risk management rules enforced 100% of time
- Complete audit trail of all simulated trades

**Notes Section:** ________________
```

---

### Prompt 24: Meme Coin Live Trading Activation

```text
Create a separate configuration switch to enable live trading mode specifically for the meme coin bot. Include final safety checks, position size validation, and emergency stop mechanisms tailored for meme coins. Start with minimal real capital (e.g., $10-20 total allocation) for initial live testing.

GO LIVE: Once meme coin paper trading validates the system, enable live trading with small amounts to verify everything works in production.

IMPORTANT: Start extremely small. Only increase capital once you have several days of proven live performance with minimal issues. Be ready to hit the emergency stop at any moment. This is real money in a highly volatile market.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Live meme coin trading activation and configuration
- Real order execution on both exchanges
- Position size validation and risk controls
- Emergency stop mechanisms for meme coin trades
- Real-time monitoring and alerting systems

✅ **What to Look For:**
- Bot successfully places and manages real meme coin orders on Binance.US/Coinbase Advanced
- Real profits/losses accurately reflected in your exchange accounts and dashboard
- All meme coin specific risk management and emergency stop mechanisms active and responsive
- No unexpected errors or disconnections during live meme coin trading
- Position sizing remains strictly at 2% or less ($0.20-0.40 per trade with $10-20 capital)
- Stop-losses and take-profits execute correctly with real orders
- Rug pull detection continues to work in live environment
- Google Sheets logging captures all live meme coin trades
- Exchange selection works correctly for live trading

✅ **Success Criteria:**
- First 48 hours of live meme coin trading with no critical errors
- All safety mechanisms tested and functional in live environment
- Position limits strictly enforced with real money
- Emergency stop tested and working correctly
- Real trading performance matches paper trading expectations

**Notes Section:** ________________
```

---

## AWS Deployment (After Live Testing Success)

### Prompt 25: Docker Containerization

```text
Create Docker configuration for the complete trading bot system:
- Dockerfile for NestJS backend with all dependencies
- Docker-compose for local development and testing
- Environment variable management for production deployment
- Health check endpoints for monitoring
- Multi-stage build for optimized production images

IMPORTANT: Proper containerization ensures consistent deployment and easy scaling. The container must include all dependencies and be optimized for production use with proper health checks and monitoring.

TESTING REQUIREMENTS:
✅ **What to Test:**
- Docker image building and optimization
- Container startup and dependency loading
- Environment variable configuration
- Health check endpoint functionality
- Production deployment simulation

✅ **What to Look For:**
- All dependencies properly installed in container
- Environment variables correctly passed through
- Health check endpoints respond correctly
- All trading functionality works within container
- Container starts and stops cleanly
- Logs properly accessible

✅ **Success Criteria:**
- Container builds successfully with optimized size
- All functionality works identically to local development
- Health checks pass consistently
- Container startup time <30 seconds
- Production-ready configuration validated

**Notes Section:** ________________
```

---

### Prompt 26: AWS App Runner Deployment

```text
Deploy the trading bot to AWS App Runner for 24/7 operation:
- Configure App Runner service with proper CPU/memory allocation
- Set up environment variables securely
- Configure auto-scaling and health monitoring
- Implement logging and alerting through CloudWatch
- Set up proper networking and security groups

IMPORTANT: 24/7 operation is essential for capturing trading opportunities and continuous learning. The deployment must be stable, secure, and monitored with proper alerting for any issues.

TESTING REQUIREMENTS:
✅ **What to Test:**
- AWS App Runner service deployment and configuration
- Environment variable security and access
- Auto-scaling and health monitoring
- CloudWatch logging and alerting
- Network connectivity and security

✅ **What to Look For:**
- Service deploys successfully and starts running
- All API connections (Kraken, Binance.US, Coinbase Advanced) work from AWS
- Environment variables properly configured and secure
- Health checks pass consistently
- Logging works correctly in CloudWatch
- Auto-scaling responds appropriately to load
- Trading continues uninterrupted for extended periods
- Dashboard remains accessible and functional

✅ **Success Criteria:**
- 48+ hours continuous operation without issues
- All trading functionality works from cloud deployment
- Monitoring and alerting properly configured
- Security best practices implemented
- Performance matches local development environment

**Notes Section:** ________________
```

---

## Success Criteria Summary

### Core Bot (Prompts 9-15):
- ✅ 7 days successful paper trading with 2-5% weekly returns
- ✅ 50+ trades with <10% maximum drawdown
- ✅ All risk management systems functioning perfectly
- ✅ Real-time dashboard displaying accurate data
- ✅ Complete audit trail in Google Sheets
- ✅ Successful transition to live trading with small amounts

### Meme Bot (Prompts 16-24):
- ✅ 7 days successful paper trading with $60 virtual allocation
- ✅ At least 1 successful 5x+ moonshot trade
- ✅ Rug pull detection preventing high-risk trades
- ✅ All safety mechanisms working correctly (2% position limit, -50% stop-loss)
- ✅ AI learning system showing improvement over time
- ✅ Successful transition to live trading with $10-20 allocation
- ✅ Effective use of Binance.US and Coinbase Advanced platforms

### Production Deployment (Prompts 25-26):
- ✅ 24/7 operation on AWS App Runner
- ✅ Real-time monitoring and alerting
- ✅ Secure API key management
- ✅ Automated logging and reporting
- ✅ Stable performance for 48+ hours continuously

### Final Validation:
- ✅ Combined system (core + meme bot) operating profitably
- ✅ All risk management systems active and tested
- ✅ Complete audit trail for tax purposes
- ✅ Dashboard providing full visibility and control
- ✅ Emergency stop mechanisms tested and functional


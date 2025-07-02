# API Research Findings

## Kraken API Capabilities

### WebSocket API v2
- **Endpoint**: wss://ws.kraken.com/v2
- **Real-time Market Data**: Ticker channel provides level 1 market data (best bid/offer and recent trade data)
- **Update Triggers**: Can be configured for 'bbo' (best-bid-offer changes) or 'trades' (every trade)
- **Data Fields**: ask, ask_qty, bid, bid_qty, change, change_pct, high, last, low, symbol, volume, vwap
- **Subscription**: Supports multiple currency pairs in single subscription
- **Snapshot Support**: Can request initial snapshot after subscribing

### Order Management
- **Order Types**: market, limit, iceberg, stop-loss, stop-loss-limit, take-profit, take-profit-limit, trailing-stop, trailing-stop-limit, settle-position
- **Authentication**: Required for trading operations (wss://ws-auth.kraken.com/v2)
- **Order Execution**: Real-time order placement, amendment, and cancellation
- **Advanced Features**: One-Triggers-Other (OTO) orders, batch operations

### Rate Limiting and Reliability
- **Uptime**: More than 99% uptime claimed
- **Connection Management**: Supports heartbeat and ping/pong for connection health
- **Error Handling**: Comprehensive error responses and status messages

## Next APIs to Research
- Supabase capabilities and limitations
- Google Sheets API integration
- AWS deployment options
- Twitter/X API for sentiment analysis
- AI/ML APIs (Claude, OpenAI)


## Supabase Capabilities

### Real-time Features
- **Postgres Changes**: Listen to database changes (INSERT, UPDATE, DELETE) in real-time
- **Broadcast**: Send low-latency messages between clients using WebSockets
- **Presence**: Track and synchronize shared state between users
- **Global Distribution**: Globally distributed realtime service

### Database Features
- **PostgreSQL**: Full PostgreSQL database with ACID compliance
- **Row Level Security**: Built-in security for data access control
- **Real-time Subscriptions**: Can listen to specific schemas, tables, or filtered changes
- **Event Filtering**: Support for eq, neq, lt, lte, gt, gte, in filters
- **Publications**: Control which tables are available for real-time subscriptions

### Integration
- **JavaScript Client**: @supabase/supabase-js for easy integration
- **Authentication**: Built-in auth system with JWT tokens
- **REST API**: Automatic REST API generation from database schema
- **Scaling**: Read replicas and connection pooling available

### Limitations to Consider
- **Quotas**: Has usage quotas that need to be checked for high-frequency trading
- **Pricing**: Need to evaluate pricing for real-time usage at scale
- **Latency**: Need to test actual latency for trading applications


## Google Sheets API (gspread)

### Features
- **Google Sheets API v4**: Latest version with full functionality
- **Authentication**: Service account and OAuth client ID support
- **Operations**: Read, write, format cell ranges, batch updates
- **Access Control**: Sharing and permission management
- **Integration**: Works well with pandas and NumPy for data processing

### Capabilities for Trading Application
- **Real-time Logging**: Can append trade data in real-time
- **Multiple Worksheets**: Support for master sheet + monthly sub-sheets
- **Batch Operations**: Efficient for bulk data updates
- **Formatting**: Can format headers, highlight profitable trades, etc.
- **Data Validation**: Can add validation rules for data integrity

### Limitations
- **Rate Limits**: Google Sheets API has quotas (100 requests per 100 seconds per user)
- **Cell Limits**: Maximum 10 million cells per spreadsheet
- **Concurrent Access**: Limited concurrent write operations

## AWS Deployment Options

### AWS Lambda
- **Best For**: Event-driven functions, short-running tasks
- **Pros**: Pay-per-execution, automatic scaling, no server management
- **Cons**: 15-minute execution limit, cold starts, stateless
- **Use Case**: Good for periodic tasks, webhooks, but not ideal for persistent WebSocket connections

### AWS App Runner
- **Best For**: Containerized web applications, long-running services
- **Pros**: Fully managed, automatic scaling, supports persistent connections
- **Cons**: More expensive than Lambda for infrequent usage
- **Use Case**: Ideal for the trading engine that needs persistent WebSocket connections

### Recommendation for Trading Application
- **Trading Engine**: AWS App Runner (needs persistent WebSocket connections)
- **Periodic Tasks**: AWS Lambda (for data cleanup, reporting)
- **Dashboard**: AWS App Runner or static hosting for React frontend


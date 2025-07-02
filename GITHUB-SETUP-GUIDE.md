# 🚀 Complete Setup Guide: GitHub + AWS App Runner

## Step 1: Create GitHub Repository (2 minutes)

1. **Go to GitHub**: https://github.com/new
2. **Repository settings**:
   - Name: `crypto-trading-bot-production`
   - Description: `24/7 Crypto Trading Bot with AI-powered strategies`
   - Visibility: **Private** (recommended for trading bots)
   - ❌ Don't initialize with README (we have our own files)
3. **Click "Create repository"**

## Step 2: Push Your Code to GitHub (2 minutes)

Open terminal and run these commands:

```bash
# Navigate to your bot directory
cd crypto-trading-bot-production

# Initialize git repository
git init

# Add all files
git add .

# Commit your code
git commit -m "Initial crypto trading bot for 24/7 deployment"

# Set main branch
git branch -M main

# Add your GitHub repository (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/crypto-trading-bot-production.git

# Push to GitHub
git push -u origin main
```

## Step 3: Deploy via AWS App Runner (5 minutes)

1. **Go to AWS App Runner Console**: https://console.aws.amazon.com/apprunner/

2. **Create Service**:
   - Click "Create service"
   - Source: **"Source code repository"**
   - Repository type: **"GitHub"**

3. **Connect to GitHub**:
   - Click "Add new"
   - Authorize AWS to access your GitHub
   - Select your repository: `crypto-trading-bot-production`
   - Branch: `main`
   - Configuration source: **"Use a configuration file"** (apprunner.yaml)

4. **Service Settings**:
   - Service name: `crypto-trading-bot`
   - Virtual CPU: `0.25 vCPU` (cost-effective)
   - Virtual memory: `0.5 GB`

5. **Environment Variables** (Add these):
   ```
   PORT=3005
   NODE_ENV=production
   TRADING_MODE=paper
   CORE_BOT_CAPITAL=300
   MEME_BOT_CAPITAL=300
   ```

6. **Review and Create**:
   - Auto scaling: Default (1-5 instances)
   - Health check: Default
   - Click "Create & deploy"

## Step 4: Monitor Deployment (5-10 minutes)

1. **Watch the build logs** in AWS console
2. **Wait for "Running" status**
3. **Get your public URL**: `https://xxxxx.us-east-1.awsapprunner.com`

## Step 5: Verify 24/7 Operation

### Test Your Bot:
```bash
# Health check
curl https://YOUR-APP-URL.us-east-1.awsapprunner.com/health

# Trading status
curl https://YOUR-APP-URL.us-east-1.awsapprunner.com/api/status

# Live market data
curl https://YOUR-APP-URL.us-east-1.awsapprunner.com/api/prices
```

### Expected Results:
✅ **Health check returns**: `{"status":"healthy","timestamp":...}`
✅ **Trading status shows**: Paper trading active with $300 capital
✅ **Market data shows**: Real BTC, ETH prices from exchanges

## 🎯 What Happens Next?

Your bot will now run 24/7:
- ✅ **Real market data** from Kraken, Binance.US, Coinbase
- ✅ **Paper trading** with $300 virtual capital per bot
- ✅ **AI-powered signals** for both core and meme coin strategies
- ✅ **Auto-restart** if anything goes wrong
- ✅ **CloudWatch monitoring** for performance tracking

## 💰 Cost Estimate

- **App Runner**: ~$25-45/month (0.25 vCPU, 0.5GB RAM)
- **CloudWatch**: ~$1-3/month (logging and monitoring)
- **Total**: ~$26-48/month for 24/7 operation

## 🔧 Adding Live Trading (When Ready)

To switch from paper trading to live trading:

1. **Add API Keys** in AWS App Runner environment variables:
   ```
   KRAKEN_API_KEY=your_kraken_key
   KRAKEN_API_SECRET=your_kraken_secret
   BINANCE_US_API_KEY=your_binance_key
   BINANCE_US_API_SECRET=your_binance_secret
   COINBASE_API_KEY=your_coinbase_key
   COINBASE_API_SECRET=your_coinbase_secret
   ```

2. **Change trading mode**:
   ```
   TRADING_MODE=live
   ```

3. **Restart the service** to apply changes

## 🚨 Important Notes

- ✅ **Start with paper trading** to validate strategies
- ✅ **Monitor performance** for at least 48 hours
- ✅ **Check logs regularly** via CloudWatch
- ✅ **Keep API keys secure** (use AWS environment variables)
- ✅ **Test thoroughly** before enabling live trading

---

## 🎉 Congratulations!

Your crypto trading bot is now running 24/7 in the cloud with:
- Real market data
- AI-powered trading strategies  
- Automatic scaling and monitoring
- Professional cloud infrastructure

**Your bot will continue trading even when your computer is off!** 🚀 
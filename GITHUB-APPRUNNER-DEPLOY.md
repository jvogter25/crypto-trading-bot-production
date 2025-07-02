# 🚀 Deploy Crypto Trading Bot via GitHub to AWS App Runner

## Why GitHub Instead of ECR?
- ✅ **No authentication issues** - GitHub integration is simpler
- ✅ **Automatic deployments** - Push to deploy
- ✅ **Better debugging** - Clear build logs
- ✅ **Cost effective** - No ECR storage costs

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and create a new repository:
   - Name: `crypto-trading-bot-production`
   - Visibility: Private (recommended for trading bots)
   - Initialize with README: No

2. Clone the repository locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/crypto-trading-bot-production.git
   cd crypto-trading-bot-production
   ```

## Step 2: Prepare Files for GitHub

Copy these files to your GitHub repository:

### Required Files:
- ✅ `production-backend-server.js` (your main server)
- ✅ `package.json` (dependencies)
- ✅ `apprunner.yaml` (App Runner configuration)

### Commands to copy files:
```bash
# From your current directory
cp production-backend-server.js /path/to/crypto-trading-bot-production/
cp package.json /path/to/crypto-trading-bot-production/
cp apprunner.yaml /path/to/crypto-trading-bot-production/

# Add .gitignore
echo "node_modules/
.env
*.log
.DS_Store
npm-debug.log*" > /path/to/crypto-trading-bot-production/.gitignore
```

## Step 3: Push to GitHub

```bash
cd /path/to/crypto-trading-bot-production
git add .
git commit -m "Initial crypto trading bot deployment"
git push origin main
```

## Step 4: Deploy via AWS App Runner Console

1. **Go to AWS App Runner Console**: https://console.aws.amazon.com/apprunner/
2. **Create Service**:
   - Source: **Source code repository**
   - Repository type: **GitHub**
   - Connect to GitHub (authorize AWS)
   - Select your repository: `crypto-trading-bot-production`
   - Branch: `main`
   - Configuration source: **Use a configuration file**

3. **Service Settings**:
   - Service name: `crypto-trading-bot`
   - Virtual CPU: `0.25 vCPU`
   - Virtual memory: `0.5 GB`

4. **Environment Variables** (Add in console):
   ```
   PORT=3005
   NODE_ENV=production
   TRADING_MODE=paper
   CORE_BOT_CAPITAL=300
   MEME_BOT_CAPITAL=300
   
   # Add your API keys when ready for live trading:
   # KRAKEN_API_KEY=your_key
   # KRAKEN_API_SECRET=your_secret
   # BINANCE_US_API_KEY=your_key
   # BINANCE_US_API_SECRET=your_secret
   # COINBASE_API_KEY=your_key
   # COINBASE_API_SECRET=your_secret
   ```

5. **Auto Scaling**: Leave default (1-5 instances)

6. **Health Check**: Default (`/` endpoint)

7. **Create Service**

## Step 5: Monitor Deployment

The deployment will:
1. ✅ Clone your GitHub repository
2. ✅ Run `npm install` (from apprunner.yaml)
3. ✅ Start `node production-backend-server.js`
4. ✅ Expose on port 3005
5. ✅ Provide a public URL

## Expected Result

✅ **Working Service**:
- Public URL: `https://xxxxx.us-east-1.awsapprunner.com`
- Health check: `https://xxxxx.us-east-1.awsapprunner.com/health`
- API endpoints working 24/7

✅ **Paper Trading Active**:
- Real market data from Kraken, Binance.US, Coinbase
- Simulated trades with $300 virtual capital each bot
- Performance tracking and analytics

## Troubleshooting

### If Build Fails:
- Check build logs in App Runner console
- Verify `package.json` dependencies
- Ensure `production-backend-server.js` exists

### If Health Check Fails:
- Verify server starts on port from `PORT` environment variable
- Check `/health` endpoint returns 200 status
- Review application logs

### If Trading Data Missing:
- Add API keys as environment variables
- Restart service after adding keys
- Check logs for authentication errors

## Cost Estimate

**GitHub Source Deployment**:
- App Runner: ~$25-45/month (0.25 vCPU, 0.5GB RAM)
- No ECR storage costs
- No data transfer costs for GitHub

## Next Steps After Deployment

1. **Verify Paper Trading**: Check logs show real market data
2. **Add API Keys**: For live trading (when ready)
3. **Monitor Performance**: Use CloudWatch dashboards
4. **Set Up Alerts**: For trading anomalies
5. **Scale if Needed**: Increase resources based on performance

---

**This approach is much more reliable than ECR!** 🎯 
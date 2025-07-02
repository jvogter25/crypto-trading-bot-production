# AWS Deployment Guide - Crypto Trading Bot

This guide will help you deploy your crypto trading bot to AWS for 24/7 operation with real trading logic.

## 🚀 Architecture Overview

- **AWS ECS Fargate**: Serverless container hosting
- **Application Load Balancer**: Public access with health checks
- **AWS Secrets Manager**: Secure API key storage
- **CloudWatch**: Logging and monitoring
- **Real Trading Engine**: Live market data + sentiment analysis

## 📋 Prerequisites

### 1. AWS Account Setup
- AWS account with appropriate permissions
- AWS CLI installed and configured
- Docker installed and running

### 2. API Keys Required
- **Kraken**: API key + secret (for core bot trading)
- **Binance.US**: API key + secret (for meme coin trading)
- **Coinbase Advanced**: API key + secret + passphrase
- **Twitter API**: For social sentiment analysis (optional)

### 3. Local Environment
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
```

## 🔧 Deployment Steps

### Step 1: Prepare Your Environment

1. **Clone and navigate to your project**:
```bash
cd /path/to/your/crypto-bot-project
```

2. **Update your API keys in secrets template**:
```bash
cp secrets-template.json secrets.json
# Edit secrets.json with your real API keys
```

3. **Make deployment script executable**:
```bash
chmod +x deploy-to-aws.sh
```

### Step 2: Deploy to AWS

Run the automated deployment script:
```bash
./deploy-to-aws.sh
```

This script will:
- ✅ Create ECR repository
- ✅ Build and push Docker image
- ✅ Deploy CloudFormation stack
- ✅ Set up ECS Fargate service
- ✅ Configure load balancer
- ✅ Set up monitoring

### Step 3: Update API Keys

After deployment, update your secrets in AWS:
```bash
aws secretsmanager update-secret \
    --secret-id crypto-trading-bot-stack-secrets \
    --secret-string file://secrets.json \
    --region us-east-1
```

### Step 4: Verify Deployment

1. **Check service status**:
```bash
aws ecs describe-services \
    --cluster crypto-trading-bot-stack-cluster \
    --services crypto-trading-bot-stack-service \
    --region us-east-1
```

2. **View application logs**:
```bash
aws logs tail /ecs/crypto-trading-bot-stack --follow --region us-east-1
```

3. **Access your trading dashboard**:
The deployment script will output your load balancer URL.

## 📊 What Gets Deployed

### Real Trading Engine Features
- **Core Bot**: Sentiment + technical analysis on BTC, ETH, ADA, DOT, LINK
- **Meme Bot**: Social momentum detection on DOGE, SHIB, PEPE, FLOKI, BONK
- **Live Market Data**: Real prices from Kraken API
- **Sentiment Analysis**: Simulated social media monitoring
- **Risk Management**: Position sizing, stop losses, profit targets
- **Paper Trading Mode**: Safe testing with $300 virtual capital each bot

### API Endpoints Available
- `GET /api/status` - System status
- `GET /api/trading/core-bot-status` - Core bot performance
- `GET /api/trading/meme-bot-status` - Meme bot performance
- `GET /api/trading/analytics` - Combined performance metrics
- `GET /api/trading/risk` - Risk management data
- `GET /api/balances` - Real + paper trading balances
- `GET /api/prices` - Live market prices
- `GET /api/meme-coins` - Meme coin social signals
- `GET /api/exchanges/test` - Exchange connectivity tests

### Infrastructure Components
- **ECS Cluster**: Managed container orchestration
- **Fargate Tasks**: 1 vCPU, 2GB RAM (cost-optimized)
- **Application Load Balancer**: Public HTTP access
- **Security Groups**: Restricted network access
- **IAM Roles**: Least privilege access
- **CloudWatch Logs**: 7-day retention
- **Secrets Manager**: Encrypted API key storage

## 💰 Cost Estimation

### Monthly AWS Costs (approximate)
- **ECS Fargate**: ~$15-25/month (1 vCPU, 2GB RAM, 24/7)
- **Application Load Balancer**: ~$16/month
- **CloudWatch Logs**: ~$1-3/month
- **Secrets Manager**: ~$0.40/month
- **Data Transfer**: ~$1-5/month

**Total: ~$33-50/month**

## 🔍 Monitoring & Management

### Real-Time Monitoring
```bash
# View live logs
aws logs tail /ecs/crypto-trading-bot-stack --follow --region us-east-1

# Check service health
curl http://your-load-balancer-url/health

# Monitor trading performance
curl http://your-load-balancer-url/api/trading/analytics
```

### Key Metrics to Watch
- **Trading Performance**: Win rate, P&L, total trades
- **System Health**: CPU/memory usage, error rates
- **Exchange Connectivity**: API response times, rate limits
- **Market Data**: Price accuracy, update frequency

## 🛡️ Security Best Practices

### API Key Security
- ✅ All keys stored in AWS Secrets Manager (encrypted)
- ✅ No keys in code or environment variables
- ✅ Automatic key rotation supported
- ✅ IAM roles with minimal permissions

### Network Security
- ✅ Private subnets for ECS tasks
- ✅ Security groups restrict access
- ✅ Load balancer in public subnets only
- ✅ No direct internet access to containers

### Application Security
- ✅ Non-root container user
- ✅ Read-only file system
- ✅ Health checks and auto-restart
- ✅ Graceful shutdown handling

## 🚨 Troubleshooting

### Common Issues

1. **Deployment fails with permissions error**:
```bash
# Ensure your AWS user has these permissions:
# - ECS, ECR, CloudFormation, IAM, EC2, Secrets Manager
aws iam attach-user-policy --user-name YOUR_USERNAME --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

2. **Container won't start**:
```bash
# Check ECS service events
aws ecs describe-services --cluster crypto-trading-bot-stack-cluster --services crypto-trading-bot-stack-service --region us-east-1

# Check task logs
aws logs describe-log-streams --log-group-name /ecs/crypto-trading-bot-stack --region us-east-1
```

3. **API keys not working**:
```bash
# Verify secrets are updated
aws secretsmanager get-secret-value --secret-id crypto-trading-bot-stack-secrets --region us-east-1

# Test exchange connectivity
curl http://your-load-balancer-url/api/exchanges/test
```

## 🔄 Updates & Maintenance

### Deploying Updates
```bash
# Simply run the deployment script again
./deploy-to-aws.sh
# ECS will perform rolling updates with zero downtime
```

### Scaling
```bash
# Increase task count for higher availability
aws ecs update-service \
    --cluster crypto-trading-bot-stack-cluster \
    --service crypto-trading-bot-stack-service \
    --desired-count 2 \
    --region us-east-1
```

### Backup Strategy
- **Code**: Stored in version control
- **Trading Data**: Exported via API endpoints
- **Configuration**: CloudFormation templates
- **Secrets**: AWS Secrets Manager automatic backup

## 📈 Performance Optimization

### For High-Frequency Trading
1. **Increase resources**:
   - Update CloudFormation template
   - Change CPU to 2048, Memory to 4096
   - Use Fargate Spot for cost savings

2. **Add caching**:
   - Deploy Redis cluster
   - Cache market data and sentiment

3. **Multiple regions**:
   - Deploy to multiple AWS regions
   - Use Route 53 for failover

## ⚠️ Important Notes

### Paper Trading Mode
- **Default**: Bot runs in paper trading mode (no real money)
- **Safe Testing**: $300 virtual capital per bot
- **Real Market Data**: Uses live prices and sentiment
- **Performance Tracking**: Real metrics and analytics

### Going Live with Real Money
1. **Thoroughly test** paper trading performance
2. **Verify** all exchange API connections
3. **Set** appropriate position sizes and risk limits
4. **Update** environment variable: `PAPER_TRADING_MODE=false`
5. **Monitor** closely during initial live trading

## 🎯 Success Metrics

### What to Expect
- **Core Bot**: 2-5 trades per day, 3-8% profit targets
- **Meme Bot**: 1-3 trades per day, 15% profit targets
- **Uptime**: 99.9% availability
- **Response Time**: <200ms API responses
- **Data Freshness**: Market data updated every 60 seconds

## 🆘 Support

### Getting Help
1. **Check logs**: `aws logs tail /ecs/crypto-trading-bot-stack --follow`
2. **Verify health**: `curl http://your-url/health`
3. **Test exchanges**: `curl http://your-url/api/exchanges/test`
4. **Monitor metrics**: CloudWatch dashboard

### Emergency Procedures
```bash
# Stop trading immediately
aws ecs update-service \
    --cluster crypto-trading-bot-stack-cluster \
    --service crypto-trading-bot-stack-service \
    --desired-count 0 \
    --region us-east-1

# Restart service
aws ecs update-service \
    --cluster crypto-trading-bot-stack-cluster \
    --service crypto-trading-bot-stack-service \
    --desired-count 1 \
    --region us-east-1
```

---

## 🚀 Ready to Deploy?

Your crypto trading bot is ready for 24/7 AWS deployment with:
- ✅ Real market data integration
- ✅ Sophisticated trading algorithms
- ✅ Comprehensive risk management
- ✅ Production-grade infrastructure
- ✅ Complete monitoring and alerting

Run `./deploy-to-aws.sh` to get started! 
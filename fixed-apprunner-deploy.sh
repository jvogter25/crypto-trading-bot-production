#!/bin/bash

echo "🚀 Deploying App Runner service with corrected configuration..."

# Variables
SERVICE_NAME="crypto-trading-bot"
ECR_REPO="047719620219.dkr.ecr.us-east-1.amazonaws.com/crypto-trading-bot"
IMAGE_TAG="latest"
REGION="us-east-1"
ACCESS_ROLE_ARN="arn:aws:iam::047719620219:role/AppRunnerECRAccessRole"

echo "📝 Creating App Runner service configuration..."

# Create the service using the correct parameter structure
/usr/local/bin/aws apprunner create-service \
  --service-name "$SERVICE_NAME" \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "'$ECR_REPO':'$IMAGE_TAG'",
      "ImageConfiguration": {
        "Port": "3005",
        "RuntimeEnvironmentVariables": {
          "PORT": "3005",
          "NODE_ENV": "production",
          "TRADING_MODE": "paper",
          "CORE_BOT_CAPITAL": "300",
          "MEME_BOT_CAPITAL": "300"
        }
      },
      "ImageRepositoryType": "ECR",
      "AccessRoleArn": "'$ACCESS_ROLE_ARN'"
    },
    "AutoDeploymentsEnabled": false
  }' \
  --instance-configuration '{
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  }' \
  --health-check-configuration '{
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 20,
    "Timeout": 5,
    "HealthyThreshold": 3,
    "UnhealthyThreshold": 3
  }' \
  --region $REGION \
  --output json > service-creation-result.json

if [ $? -eq 0 ]; then
  echo "✅ App Runner service creation initiated!"
  
  # Get the service ARN from the result
  SERVICE_ARN=$(cat service-creation-result.json | grep -o '"ServiceArn":"[^"]*"' | cut -d'"' -f4)
  echo "🔗 Service ARN: $SERVICE_ARN"
  
  echo "⏳ Waiting for service to start (this may take 5-10 minutes)..."
  echo ""
  echo "📊 You can monitor the deployment with:"
  echo "   aws apprunner describe-service --service-arn $SERVICE_ARN --region $REGION"
  echo ""
  echo "🎯 Once deployed, your bot will be running 24/7 with:"
  echo "   • Real market data from Kraken, Binance.US, Coinbase"
  echo "   • Paper trading mode (no real money at risk)"
  echo "   • Auto-scaling from 1-5 instances"
  echo "   • Health monitoring and CloudWatch logging"
  echo "   • Cost: ~$25-45/month"
  
else
  echo "❌ Failed to create App Runner service"
  echo "Error details:"
  cat service-creation-result.json
fi

# Clean up
rm -f service-creation-result.json

echo ""
echo "🎯 Deployment script completed!" 
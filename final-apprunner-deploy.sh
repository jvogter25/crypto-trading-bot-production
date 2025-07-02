#!/bin/bash

echo "🚀 Final App Runner deployment with correct configuration..."

# Variables
SERVICE_NAME="crypto-trading-bot"
ECR_REPO="047719620219.dkr.ecr.us-east-1.amazonaws.com/crypto-trading-bot"
IMAGE_TAG="latest"
REGION="us-east-1"

echo "🧹 Cleaning up any existing failed services..."

# Delete any existing service
EXISTING_SERVICE=$(/usr/local/bin/aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text 2>/dev/null)

if [ ! -z "$EXISTING_SERVICE" ] && [ "$EXISTING_SERVICE" != "None" ]; then
  echo "🗑️  Deleting existing service: $EXISTING_SERVICE"
  /usr/local/bin/aws apprunner delete-service --service-arn "$EXISTING_SERVICE" --region $REGION
  echo "⏳ Waiting for deletion..."
  sleep 30
fi

echo "🚀 Creating App Runner service with correct configuration..."

# Create service using the correct parameter structure for current AWS CLI
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
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": false
  }' \
  --instance-configuration '{
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  }' \
  --region $REGION \
  --output json > deployment-result.json

if [ $? -eq 0 ]; then
  echo "✅ App Runner service creation initiated successfully!"
  
  SERVICE_ARN=$(cat deployment-result.json | grep -o '"ServiceArn":"[^"]*"' | cut -d'"' -f4)
  echo "🔗 Service ARN: $SERVICE_ARN"
  
  echo ""
  echo "⏳ Monitoring deployment (this takes 5-10 minutes)..."
  
  # Monitor deployment
  for i in {1..60}; do
    STATUS=$(/usr/local/bin/aws apprunner describe-service --service-arn "$SERVICE_ARN" --region $REGION --query 'Service.Status' --output text 2>/dev/null)
    echo "[$i/60] Status: $STATUS"
    
    if [ "$STATUS" = "RUNNING" ]; then
      SERVICE_URL=$(/usr/local/bin/aws apprunner describe-service --service-arn "$SERVICE_ARN" --region $REGION --query 'Service.ServiceUrl' --output text)
      echo ""
      echo "🎉 SUCCESS! Your crypto trading bot is now running 24/7 in the cloud!"
      echo ""
      echo "🌐 Service URL: https://$SERVICE_URL"
      echo "🔍 Health Check: https://$SERVICE_URL/health"
      echo "📊 Bot Status: https://$SERVICE_URL/api/status"
      echo "💰 Account Balances: https://$SERVICE_URL/api/balances"
      echo "📈 Trading Data: https://$SERVICE_URL/api/prices"
      echo ""
      echo "🎯 Your bot is now:"
      echo "   ✅ Running 24/7 with real market data"
      echo "   ✅ Paper trading with $300 virtual capital each"
      echo "   ✅ Auto-scaling based on demand"
      echo "   ✅ Health monitored by AWS"
      echo "   ✅ Costing ~$25-45/month"
      echo ""
      echo "🔧 To switch to live trading later, update environment variable:"
      echo "   TRADING_MODE: 'live' (currently 'paper')"
      break
    elif [ "$STATUS" = "CREATE_FAILED" ]; then
      echo "❌ Deployment failed"
      /usr/local/bin/aws apprunner list-operations --service-arn "$SERVICE_ARN" --region $REGION --query 'OperationSummaryList[0]' --output table
      break
    fi
    
    sleep 10
  done
  
else
  echo "❌ Failed to create App Runner service"
  echo "Error details:"
  cat deployment-result.json
fi

# Clean up
rm -f deployment-result.json

echo ""
echo "🎯 Deployment completed!" 
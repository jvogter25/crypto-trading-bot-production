#!/bin/bash

echo "🔧 Complete App Runner troubleshooting and deployment..."

# Variables
SERVICE_NAME="crypto-trading-bot"
ECR_REPO="047719620219.dkr.ecr.us-east-1.amazonaws.com/crypto-trading-bot"
IMAGE_TAG="latest"
REGION="us-east-1"
ACCESS_ROLE_ARN="arn:aws:iam::047719620219:role/AppRunnerECRAccessRole"

echo "📋 Step 1: Checking for existing services..."

# Check if service exists and delete if needed
EXISTING_SERVICE=$(/usr/local/bin/aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text 2>/dev/null)

if [ ! -z "$EXISTING_SERVICE" ] && [ "$EXISTING_SERVICE" != "None" ]; then
  echo "🗑️  Found existing service: $EXISTING_SERVICE"
  echo "Deleting existing service..."
  /usr/local/bin/aws apprunner delete-service --service-arn "$EXISTING_SERVICE" --region $REGION
  echo "⏳ Waiting for service deletion..."
  sleep 30
fi

echo "📋 Step 2: Verifying Docker image exists in ECR..."
/usr/local/bin/aws ecr describe-images --repository-name crypto-trading-bot --region $REGION --query 'imageDetails[0].imageTags' 2>/dev/null || {
  echo "❌ Docker image not found in ECR. Need to rebuild and push image first."
  echo "Run: ./deploy-to-app-runner.sh to rebuild the image"
  exit 1
}

echo "📋 Step 3: Verifying IAM role exists..."
/usr/local/bin/aws iam get-role --role-name AppRunnerECRAccessRole 2>/dev/null || {
  echo "❌ IAM role not found. Creating AppRunnerECRAccessRole..."
  
  # Create trust policy
  cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "build.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  # Create the role
  /usr/local/bin/aws iam create-role \
    --role-name AppRunnerECRAccessRole \
    --assume-role-policy-document file://trust-policy.json
  
  # Attach ECR policy
  /usr/local/bin/aws iam attach-role-policy \
    --role-name AppRunnerECRAccessRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
  
  rm trust-policy.json
  echo "✅ IAM role created"
  sleep 10
}

echo "📋 Step 4: Creating App Runner service with minimal configuration..."

# Create service with the most basic configuration first
cat > service-config.json << EOF
{
  "ServiceName": "$SERVICE_NAME",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "$ECR_REPO:$IMAGE_TAG",
      "ImageConfiguration": {
        "Port": "3005",
        "RuntimeEnvironmentVariables": {
          "PORT": "3005",
          "NODE_ENV": "production",
          "TRADING_MODE": "paper"
        }
      },
      "ImageRepositoryType": "ECR",
      "AccessRoleArn": "$ACCESS_ROLE_ARN"
    },
    "AutoDeploymentsEnabled": false
  },
  "InstanceConfiguration": {
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  }
}
EOF

echo "🚀 Creating App Runner service..."
/usr/local/bin/aws apprunner create-service \
  --cli-input-json file://service-config.json \
  --region $REGION \
  --output json > service-result.json

if [ $? -eq 0 ]; then
  echo "✅ App Runner service creation initiated!"
  
  SERVICE_ARN=$(cat service-result.json | grep -o '"ServiceArn":"[^"]*"' | cut -d'"' -f4)
  echo "🔗 Service ARN: $SERVICE_ARN"
  
  echo "⏳ Monitoring deployment status..."
  
  # Monitor deployment for 10 minutes
  for i in {1..60}; do
    STATUS=$(/usr/local/bin/aws apprunner describe-service --service-arn "$SERVICE_ARN" --region $REGION --query 'Service.Status' --output text 2>/dev/null)
    echo "Status check $i/60: $STATUS"
    
    if [ "$STATUS" = "RUNNING" ]; then
      SERVICE_URL=$(/usr/local/bin/aws apprunner describe-service --service-arn "$SERVICE_ARN" --region $REGION --query 'Service.ServiceUrl' --output text)
      echo ""
      echo "🎉 SUCCESS! Your crypto trading bot is now running 24/7!"
      echo "🌐 Service URL: https://$SERVICE_URL"
      echo "🔍 Health Check: https://$SERVICE_URL/health"
      echo "📊 Status: https://$SERVICE_URL/api/status"
      echo ""
      echo "💰 Your bot is now trading with:"
      echo "   • Real market data from Kraken, Binance.US, Coinbase"
      echo "   • Paper trading mode (no real money at risk)"
      echo "   • $300 virtual capital for Core Bot"
      echo "   • $300 virtual capital for Meme Bot"
      echo "   • Auto-scaling and health monitoring"
      break
    elif [ "$STATUS" = "CREATE_FAILED" ] || [ "$STATUS" = "OPERATION_IN_PROGRESS" ]; then
      if [ $i -eq 60 ]; then
        echo "❌ Deployment timed out or failed"
        echo "Checking logs..."
        /usr/local/bin/aws apprunner list-operations --service-arn "$SERVICE_ARN" --region $REGION --query 'OperationSummaryList[0]' --output table
      fi
    fi
    
    sleep 10
  done
  
else
  echo "❌ Failed to create App Runner service"
  echo "Error details:"
  cat service-result.json
  
  # Common fixes
  echo ""
  echo "🔧 Troubleshooting suggestions:"
  echo "1. Check if ECR repository exists and has the image"
  echo "2. Verify IAM role permissions"
  echo "3. Try with a different service name"
  echo "4. Check AWS account limits"
fi

# Clean up
rm -f service-config.json service-result.json

echo ""
echo "🎯 Deployment script completed!" 
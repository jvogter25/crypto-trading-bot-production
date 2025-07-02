#!/bin/bash

echo "🚀 Redeploying App Runner service with fixes..."

# Variables
SERVICE_NAME="crypto-trading-bot"
ECR_REPO="047719620219.dkr.ecr.us-east-1.amazonaws.com/crypto-trading-bot"
IMAGE_TAG="latest"
REGION="us-east-1"

# Step 1: Create a new apprunner.yaml with fixed configuration
echo "📝 Creating fixed apprunner.yaml..."
cat > apprunner.yaml << 'EOF'
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - echo "Build completed"
run:
  runtime-version: 18
  command: node production-backend-server.js
  network:
    port: 3005
    env: PORT
  env:
    - name: PORT
      value: "3005"
    - name: NODE_ENV
      value: "production"
    - name: TRADING_MODE
      value: "paper"
    - name: CORE_BOT_CAPITAL
      value: "300"
    - name: MEME_BOT_CAPITAL
      value: "300"
EOF

echo "✅ Fixed apprunner.yaml created"

# Step 2: Create App Runner service with simplified configuration
echo "🚀 Creating App Runner service..."

SERVICE_CONFIG='{
  "ServiceName": "'$SERVICE_NAME'",
  "SourceConfiguration": {
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
  },
  "InstanceConfiguration": {
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 20,
    "Timeout": 5,
    "HealthyThreshold": 3,
    "UnhealthyThreshold": 3
  },
  "AuthenticationConfiguration": {
    "AccessRoleArn": "arn:aws:iam::047719620219:role/AppRunnerECRAccessRole"
  }
}'

echo "Creating service with configuration..."
echo "$SERVICE_CONFIG" > service-config.json

# Create the service
/usr/local/bin/aws apprunner create-service \
  --cli-input-json file://service-config.json \
  --region $REGION \
  --output json > service-creation-result.json

if [ $? -eq 0 ]; then
  echo "✅ App Runner service creation initiated!"
  
  # Extract service ARN
  SERVICE_ARN=$(/usr/local/bin/aws apprunner list-services --region $REGION --query 'ServiceSummaryList[?ServiceName==`'$SERVICE_NAME'`].ServiceArn' --output text)
  echo "🔗 Service ARN: $SERVICE_ARN"
  
  echo "⏳ Waiting for service to start (this may take 5-10 minutes)..."
  echo "You can check status with: aws apprunner describe-service --service-arn $SERVICE_ARN --region $REGION"
  
else
  echo "❌ Failed to create App Runner service"
  echo "Error details:"
  cat service-creation-result.json
fi

# Clean up
rm -f service-config.json service-creation-result.json

echo "🎯 Deployment script completed!" 
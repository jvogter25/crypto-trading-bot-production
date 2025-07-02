#!/bin/bash

echo "🚀 App Runner deployment using public image approach..."

# Variables
SERVICE_NAME="crypto-trading-bot"
REGION="us-east-1"

echo "🧹 Cleaning up any existing services..."

# Delete any existing service
EXISTING_SERVICE=$(/usr/local/bin/aws apprunner list-services --region $REGION --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text 2>/dev/null)

if [ ! -z "$EXISTING_SERVICE" ] && [ "$EXISTING_SERVICE" != "None" ]; then
  echo "🗑️  Deleting existing service: $EXISTING_SERVICE"
  /usr/local/bin/aws apprunner delete-service --service-arn "$EXISTING_SERVICE" --region $REGION
  echo "⏳ Waiting for deletion..."
  sleep 30
fi

echo "📦 First, let's use a simple Node.js image to test the service creation..."

# Create service using a public Node.js image first to test
/usr/local/bin/aws apprunner create-service \
  --service-name "$SERVICE_NAME" \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "public.ecr.aws/docker/library/node:18-alpine",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production"
        },
        "StartCommand": "node -e \"const http = require('\''http'\''); const server = http.createServer((req, res) => { res.writeHead(200, {'\''Content-Type'\'': '\''application/json'\''}); res.end(JSON.stringify({status: '\''healthy'\'', message: '\''Crypto trading bot placeholder'\'', timestamp: new Date().toISOString()})); }); server.listen(3000, () => console.log('\''Server running on port 3000'\''));\""
      },
      "ImageRepositoryType": "ECR_PUBLIC"
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
      echo "🎉 SUCCESS! App Runner service is working!"
      echo ""
      echo "🌐 Service URL: https://$SERVICE_URL"
      echo "🔍 Test it: curl https://$SERVICE_URL"
      echo ""
      echo "📋 Next steps:"
      echo "1. ✅ App Runner service creation works"
      echo "2. 🔄 Now we need to update it to use your crypto bot image"
      echo "3. 🔑 We'll need to add ECR authentication"
      echo ""
      echo "🎯 Your service is ready for the next step!"
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
  
  echo ""
  echo "🔧 Alternative approach needed:"
  echo "1. Try using AWS Console instead of CLI"
  echo "2. Use a different service name"
  echo "3. Check AWS account quotas"
  echo "4. Try a different region"
fi

# Clean up
rm -f deployment-result.json

echo ""
echo "🎯 Deployment completed!" 
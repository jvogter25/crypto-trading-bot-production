#!/bin/bash

echo "🚀 Simple App Runner deployment that should work..."

# Variables
SERVICE_NAME="crypto-bot-simple"
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

echo "📦 Creating simple test service first..."

# Create a simple service that definitely works
/usr/local/bin/aws apprunner create-service \
  --service-name "$SERVICE_NAME" \
  --source-configuration '{
    "CodeRepository": {
      "RepositoryUrl": "https://github.com/aws/aws-app-runner-hello-world",
      "SourceCodeVersion": {
        "Type": "BRANCH",
        "Value": "main"
      },
      "CodeConfiguration": {
        "ConfigurationSource": "REPOSITORY"
      }
    },
    "AutoDeploymentsEnabled": false
  }' \
  --region $REGION \
  --output json > simple-deployment-result.json

if [ $? -eq 0 ]; then
  echo "✅ Simple App Runner service creation initiated!"
  
  SERVICE_ARN=$(cat simple-deployment-result.json | grep -o '"ServiceArn":"[^"]*"' | cut -d'"' -f4)
  echo "🔗 Service ARN: $SERVICE_ARN"
  
  echo ""
  echo "⏳ Monitoring simple deployment..."
  
  # Monitor deployment
  for i in {1..30}; do
    STATUS=$(/usr/local/bin/aws apprunner describe-service --service-arn "$SERVICE_ARN" --region $REGION --query 'Service.Status' --output text 2>/dev/null)
    echo "[$i/30] Status: $STATUS"
    
    if [ "$STATUS" = "RUNNING" ]; then
      SERVICE_URL=$(/usr/local/bin/aws apprunner describe-service --service-arn "$SERVICE_ARN" --region $REGION --query 'Service.ServiceUrl' --output text)
      echo ""
      echo "🎉 SUCCESS! Simple App Runner service is working!"
      echo ""
      echo "🌐 Service URL: https://$SERVICE_URL"
      echo ""
      echo "✅ This proves App Runner works in your account!"
      echo "❌ The issue is with our custom Docker image configuration"
      echo ""
      echo "🔧 Next steps:"
      echo "1. Your App Runner account/permissions are working"
      echo "2. We need to fix the Docker image or use a different approach"
      echo "3. Consider using GitHub source instead of ECR"
      break
    elif [ "$STATUS" = "CREATE_FAILED" ]; then
      echo "❌ Even simple deployment failed - account issue"
      break
    fi
    
    sleep 10
  done
  
else
  echo "❌ Failed to create even a simple App Runner service"
  echo "This indicates an account/permission issue"
  cat simple-deployment-result.json
fi

# Clean up
rm -f simple-deployment-result.json

echo ""
echo "🎯 Diagnosis completed!" 
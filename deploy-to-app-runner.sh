#!/bin/bash

# AWS App Runner Deployment Script for Crypto Trading Bot
# This script deploys the trading bot to AWS App Runner for 24/7 operation

set -e

# Configuration
AWS_REGION="us-east-1"
SERVICE_NAME="crypto-trading-bot"
GITHUB_REPO_URL="https://github.com/your-username/crypto-bot-v2"  # Update this
BRANCH_NAME="main"
BUILD_COMMAND="npm ci && npm run build"
START_COMMAND="node production-backend-server.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting AWS App Runner deployment for Crypto Trading Bot...${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to get AWS account ID. Please check your AWS credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"

# Step 1: Create IAM role for App Runner if it doesn't exist
echo -e "${YELLOW}🔐 Setting up IAM roles...${NC}"

# Create App Runner service role
cat > app-runner-service-role-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the service role
aws iam create-role \
    --role-name AppRunnerServiceRole \
    --assume-role-policy-document file://app-runner-service-role-trust-policy.json \
    --region $AWS_REGION 2>/dev/null || echo "Role already exists"

# Attach managed policy for App Runner
aws iam attach-role-policy \
    --role-name AppRunnerServiceRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess \
    --region $AWS_REGION 2>/dev/null || echo "Policy already attached"

# Create access role for ECR
cat > app-runner-access-role-trust-policy.json << EOF
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

# Create the access role
aws iam create-role \
    --role-name AppRunnerECRAccessRole \
    --assume-role-policy-document file://app-runner-access-role-trust-policy.json \
    --region $AWS_REGION 2>/dev/null || echo "Access role already exists"

# Attach ECR read policy
aws iam attach-role-policy \
    --role-name AppRunnerECRAccessRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess \
    --region $AWS_REGION 2>/dev/null || echo "ECR policy already attached"

# Step 2: Build and push Docker image
echo -e "${YELLOW}🐳 Building and pushing Docker image...${NC}"

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names crypto-trading-bot --region $AWS_REGION &> /dev/null || \
aws ecr create-repository --repository-name crypto-trading-bot --region $AWS_REGION

# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
docker build -f Dockerfile.production -t crypto-trading-bot .

# Tag image for ECR
docker tag crypto-trading-bot:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-trading-bot:latest

# Push image to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/crypto-trading-bot:latest

echo -e "${GREEN}✅ Docker image pushed to ECR successfully!${NC}"

# Step 3: Create App Runner service configuration
echo -e "${YELLOW}📝 Creating App Runner service configuration...${NC}"

cat > app-runner-config.json << EOF
{
  "ServiceName": "${SERVICE_NAME}",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/crypto-trading-bot:latest",
      "ImageConfiguration": {
        "Port": "3005",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3005",
          "PAPER_TRADING_MODE": "true",
          "INITIAL_CAPITAL_CORE_BOT": "300",
          "INITIAL_CAPITAL_MEME_BOT": "300",
          "ENABLE_REAL_TIME_TRADING": "false",
          "RISK_MANAGEMENT_ENABLED": "true",
          "MAX_DAILY_LOSS_PERCENTAGE": "5",
          "POSITION_SIZE_LIMIT": "5",
          "LOG_LEVEL": "info",
          "HEALTH_CHECK_ENABLED": "true"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": false,
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/AppRunnerECRAccessRole"
    }
  },
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB",
    "InstanceRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/AppRunnerServiceRole"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 20,
    "Timeout": 5,
    "HealthyThreshold": 2,
    "UnhealthyThreshold": 3
  }
}
EOF

# Step 3: Auto Scaling (using default configuration)
echo -e "${YELLOW}📈 Using default auto-scaling configuration...${NC}"

# Step 4: Create or update App Runner service
echo -e "${YELLOW}🏗️  Creating App Runner service...${NC}"

# Check if service already exists
SERVICE_EXISTS=$(aws apprunner list-services --region $AWS_REGION --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceName" --output text)

if [ -z "$SERVICE_EXISTS" ]; then
    echo -e "${BLUE}🆕 Creating new App Runner service...${NC}"
    
    # Create the service
    SERVICE_ARN=$(aws apprunner create-service \
        --cli-input-json file://app-runner-config.json \
        --region $AWS_REGION \
        --query "Service.ServiceArn" \
        --output text)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ App Runner service created successfully!${NC}"
        echo -e "${BLUE}Service ARN: ${SERVICE_ARN}${NC}"
    else
        echo -e "${RED}❌ Failed to create App Runner service!${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}🔄 Service already exists. Use AWS Console to update if needed.${NC}"
    SERVICE_ARN=$(aws apprunner list-services --region $AWS_REGION --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn" --output text)
fi

# Step 5: Wait for service to be running
echo -e "${BLUE}⏳ Waiting for service to be running...${NC}"

while true; do
    STATUS=$(aws apprunner describe-service \
        --service-arn $SERVICE_ARN \
        --region $AWS_REGION \
        --query "Service.Status" \
        --output text)
    
    echo -e "${YELLOW}Current status: ${STATUS}${NC}"
    
    if [ "$STATUS" = "RUNNING" ]; then
        echo -e "${GREEN}✅ Service is now running!${NC}"
        break
    elif [ "$STATUS" = "CREATE_FAILED" ] || [ "$STATUS" = "UPDATE_FAILED" ]; then
        echo -e "${RED}❌ Service deployment failed!${NC}"
        exit 1
    fi
    
    sleep 30
done

# Step 6: Get service URL
SERVICE_URL=$(aws apprunner describe-service \
    --service-arn $SERVICE_ARN \
    --region $AWS_REGION \
    --query "Service.ServiceUrl" \
    --output text)

# Step 7: Set up CloudWatch monitoring
echo -e "${YELLOW}📊 Setting up CloudWatch monitoring...${NC}"

# Create CloudWatch dashboard
cat > dashboard-config.json << EOF
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/AppRunner", "RequestCount", "ServiceName", "${SERVICE_NAME}"],
          ["AWS/AppRunner", "ResponseTime", "ServiceName", "${SERVICE_NAME}"],
          ["AWS/AppRunner", "4xxStatusResponses", "ServiceName", "${SERVICE_NAME}"],
          ["AWS/AppRunner", "5xxStatusResponses", "ServiceName", "${SERVICE_NAME}"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "${AWS_REGION}",
        "title": "Crypto Trading Bot - App Runner Metrics"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
    --dashboard-name "CryptoTradingBot-AppRunner" \
    --dashboard-body file://dashboard-config.json \
    --region $AWS_REGION

# Step 8: Create CloudWatch alarms
echo -e "${YELLOW}🚨 Setting up CloudWatch alarms...${NC}"

# High error rate alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "CryptoBot-HighErrorRate" \
    --alarm-description "Alert when error rate is high" \
    --metric-name "5xxStatusResponses" \
    --namespace "AWS/AppRunner" \
    --statistic "Sum" \
    --period 300 \
    --threshold 10 \
    --comparison-operator "GreaterThanThreshold" \
    --evaluation-periods 2 \
    --dimensions Name=ServiceName,Value=${SERVICE_NAME} \
    --region $AWS_REGION

# High response time alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "CryptoBot-HighResponseTime" \
    --alarm-description "Alert when response time is high" \
    --metric-name "ResponseTime" \
    --namespace "AWS/AppRunner" \
    --statistic "Average" \
    --period 300 \
    --threshold 5000 \
    --comparison-operator "GreaterThanThreshold" \
    --evaluation-periods 2 \
    --dimensions Name=ServiceName,Value=${SERVICE_NAME} \
    --region $AWS_REGION

# Clean up temporary files
rm -f app-runner-service-role-trust-policy.json app-runner-access-role-trust-policy.json app-runner-config.json dashboard-config.json

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}📊 Your crypto trading bot is now running 24/7 at: https://${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "1. Set your API keys as environment variables in App Runner console"
echo -e "2. Monitor the application in CloudWatch dashboard"
echo -e "3. Access the trading dashboard at the URL above"
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo -e "View service status: aws apprunner describe-service --service-arn ${SERVICE_ARN} --region ${AWS_REGION}"
echo -e "View logs: aws logs tail /aws/apprunner/${SERVICE_NAME} --follow --region ${AWS_REGION}"
echo -e "Update environment variables: Use AWS Console > App Runner > ${SERVICE_NAME} > Configuration"
echo ""
echo -e "${GREEN}✨ Your bot is now trading 24/7! 🚀${NC}"
echo ""
echo -e "${YELLOW}🔗 Important URLs:${NC}"
echo -e "Trading Dashboard: https://${SERVICE_URL}"
echo -e "Health Check: https://${SERVICE_URL}/health"
echo -e "API Status: https://${SERVICE_URL}/api/status"
echo -e "Core Bot Status: https://${SERVICE_URL}/api/trading/core-bot-status"
echo -e "Meme Bot Status: https://${SERVICE_URL}/api/trading/meme-bot-status"
echo -e "CloudWatch Dashboard: https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=CryptoTradingBot-AppRunner" 
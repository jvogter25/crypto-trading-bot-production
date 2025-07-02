#!/bin/bash

# AWS Deployment Script for Crypto Trading Bot
# This script builds and deploys the trading bot to AWS ECS Fargate

set -e

# Configuration
AWS_REGION="us-east-1"
ECR_REPOSITORY="crypto-trading-bot"
CLUSTER_NAME="crypto-trading-cluster"
SERVICE_NAME="crypto-trading-service"
TASK_FAMILY="crypto-trading-task"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting AWS deployment for Crypto Trading Bot...${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to get AWS account ID. Please check your AWS credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"

# Step 1: Create ECR repository if it doesn't exist
echo -e "${YELLOW}📦 Creating ECR repository...${NC}"
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION &> /dev/null || \
aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION

# Step 2: Get ECR login token
echo -e "${YELLOW}🔐 Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Step 3: Build Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t $ECR_REPOSITORY .

# Step 4: Tag image for ECR
echo -e "${YELLOW}🏷️  Tagging Docker image...${NC}"
docker tag $ECR_REPOSITORY:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

# Step 5: Push image to ECR
echo -e "${YELLOW}📤 Pushing image to ECR...${NC}"
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

# Step 6: Deploy CloudFormation stack
echo -e "${YELLOW}☁️  Deploying CloudFormation stack...${NC}"
STACK_NAME="crypto-trading-bot-stack"

# Check if we need to create or update the stack
aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION &> /dev/null
if [ $? -eq 0 ]; then
    echo -e "${BLUE}🔄 Updating existing CloudFormation stack...${NC}"
    aws cloudformation update-stack \
        --stack-name $STACK_NAME \
        --template-body file://aws-deployment.yml \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION \
        --parameters \
            ParameterKey=VpcId,ParameterValue=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region $AWS_REGION) \
            ParameterKey=SubnetIds,ParameterValue=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region $AWS_REGION)" --query "Subnets[?AvailabilityZone!='${AWS_REGION}a'].SubnetId" --output text --region $AWS_REGION | tr '\t' ',') \
            ParameterKey=PublicSubnetIds,ParameterValue=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region $AWS_REGION)" --query "Subnets[].SubnetId" --output text --region $AWS_REGION | tr '\t' ',')
else
    echo -e "${BLUE}🆕 Creating new CloudFormation stack...${NC}"
    aws cloudformation create-stack \
        --stack-name $STACK_NAME \
        --template-body file://aws-deployment.yml \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION \
        --parameters \
            ParameterKey=VpcId,ParameterValue=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region $AWS_REGION) \
            ParameterKey=SubnetIds,ParameterValue=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region $AWS_REGION)" --query "Subnets[?AvailabilityZone!='${AWS_REGION}a'].SubnetId" --output text --region $AWS_REGION | tr '\t' ',') \
            ParameterKey=PublicSubnetIds,ParameterValue=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region $AWS_REGION)" --query "Subnets[].SubnetId" --output text --region $AWS_REGION | tr '\t' ',')
fi

# Step 7: Wait for stack deployment to complete
echo -e "${BLUE}⏳ Waiting for stack deployment to complete...${NC}"
aws cloudformation wait stack-create-complete --stack-name $STACK_NAME --region $AWS_REGION 2>/dev/null || \
aws cloudformation wait stack-update-complete --stack-name $STACK_NAME --region $AWS_REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ CloudFormation stack deployed successfully!${NC}"
else
    echo -e "${RED}❌ CloudFormation stack deployment failed!${NC}"
    exit 1
fi

# Step 8: Get the load balancer URL
LB_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerURL'].OutputValue" --output text)

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}📊 Your crypto trading bot is now running at: ${LB_URL}${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "1. Update your API keys in AWS Secrets Manager"
echo -e "2. Monitor the application logs in CloudWatch"
echo -e "3. Access the trading dashboard at the URL above"
echo ""
echo -e "${BLUE}🔧 Useful commands:${NC}"
echo -e "View logs: aws logs tail /ecs/${STACK_NAME} --follow --region ${AWS_REGION}"
echo -e "Update secrets: aws secretsmanager update-secret --secret-id ${STACK_NAME}-secrets --secret-string file://secrets.json --region ${AWS_REGION}"
echo ""
echo -e "${GREEN}✨ Happy trading! 🚀${NC}" 
#!/bin/bash

echo "🔍 Checking AWS Configuration..."

echo "=== AWS Identity ==="
/usr/local/bin/aws sts get-caller-identity --output json

echo ""
echo "=== AWS Configuration ==="
/usr/local/bin/aws configure list

echo ""
echo "=== App Runner Service Limits ==="
/usr/local/bin/aws service-quotas get-service-quota --service-code apprunner --quota-code L-6B453EE1 --region us-east-1 2>/dev/null || echo "Could not check service limits"

echo ""
echo "=== Available Regions for App Runner ==="
/usr/local/bin/aws apprunner list-services --region us-east-1 --output json 2>&1 | head -5

echo ""
echo "=== IAM User Permissions Check ==="
/usr/local/bin/aws iam get-user --output json 2>/dev/null || echo "Cannot access IAM user info"

echo ""
echo "=== Check if App Runner is available in region ==="
/usr/local/bin/aws apprunner describe-service --service-arn "arn:aws:apprunner:us-east-1:047719620219:service/test/test" --region us-east-1 2>&1 | grep -i "not found\|invalid\|unsupported" || echo "App Runner seems available in us-east-1" 
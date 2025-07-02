#!/bin/bash

# Check App Runner service status
echo "Checking App Runner service status..."

SERVICE_ARN="arn:aws:apprunner:us-east-1:047719620219:service/crypto-trading-bot/f09286b2729c4a5db1108029e61ea7b2"

# Get service status
echo "=== Service Status ==="
/usr/local/bin/aws apprunner describe-service --service-arn "$SERVICE_ARN" --region us-east-1 --query 'Service.Status' --output text

echo ""
echo "=== Service Details ==="
/usr/local/bin/aws apprunner describe-service --service-arn "$SERVICE_ARN" --region us-east-1 --query 'Service.{Status:Status,ServiceUrl:ServiceUrl,CreatedAt:CreatedAt,UpdatedAt:UpdatedAt}' --output table

echo ""
echo "=== Recent Operations ==="
/usr/local/bin/aws apprunner list-operations --service-arn "$SERVICE_ARN" --region us-east-1 --query 'OperationSummaryList[0:3].{Type:Type,Status:Status,StartedAt:StartedAt,EndedAt:EndedAt}' --output table

echo ""
echo "=== All Services ==="
/usr/local/bin/aws apprunner list-services --region us-east-1 --query 'ServiceSummaryList[].{ServiceName:ServiceName,Status:Status,ServiceArn:ServiceArn}' --output table 
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import * as path from "path";

export class LotusStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------
    // DynamoDB Table — single-table design for conversation persistence
    // ---------------------------------------------------------------
    const conversationsTable = new dynamodb.Table(this, "ConversationsTable", {
      tableName: "lotus-conversations",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    // ---------------------------------------------------------------
    // Lambda Web Adapter layer — runs FastAPI inside Lambda
    // ---------------------------------------------------------------
    const webAdapterLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "WebAdapterLayer",
      `arn:aws:lambda:${this.region}:753240598075:layer:LambdaAdapterLayerArm64:24`,
    );

    // ---------------------------------------------------------------
    // Lambda Function — Python 3.12 with FastAPI backend
    // ---------------------------------------------------------------
    const backendPath = path.join(__dirname, "../../backend/chat");

    const chatFunction = new lambda.Function(this, "ChatFunction", {
      functionName: "lotus-chat",
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      handler: "run.sh",
      code: lambda.Code.fromAsset(backendPath, {
        assetHash: "v9-" + Date.now().toString(),
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            "bash",
            "-c",
            [
              "pip install --no-cache-dir -r requirements.txt -t /asset-output",
              "cp -r *.py run.sh /asset-output",
              "chmod +x /asset-output/run.sh",
            ].join(" && "),
          ],
        },
      }),
      layers: [webAdapterLayer],
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        AWS_LWA_INVOKE_MODE: "response_stream",
        AWS_LWA_PORT: "8000",
        AWS_LWA_READINESS_CHECK_PATH: "/health",
        AWS_LWA_ASYNC_INIT: "true",
        STARTUP_COMMAND: "uvicorn index:app --host 0.0.0.0 --port 8000",
        CONVERSATIONS_TABLE: conversationsTable.tableName,
        BEDROCK_MODEL_ID: "us.anthropic.claude-opus-4-6-v1",
        BEDROCK_REGION: "us-east-1",
        DEPLOY_VERSION: "8",
      },
    });

    // ---------------------------------------------------------------
    // Lambda Function URL — streaming enabled, public access
    // ---------------------------------------------------------------
    const functionUrl = chatFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ["Content-Type"],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // ---------------------------------------------------------------
    // IAM Permissions
    // ---------------------------------------------------------------

    // DynamoDB read/write
    conversationsTable.grantReadWriteData(chatFunction);

    // Bedrock invoke with streaming
    chatFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:InvokeModel",
          "bedrock:ConverseStream",
          "bedrock:Converse",
        ],
        resources: ["*"],
      }),
    );

    // ---------------------------------------------------------------
    // S3 Bucket — Static frontend hosting
    // ---------------------------------------------------------------
    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `lotus-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ---------------------------------------------------------------
    // SSL Certificate — Must be in us-east-1 for CloudFront
    // Since DNS is on DigitalOcean, we use DNS validation (manual)
    // ---------------------------------------------------------------
    const certificate = new acm.Certificate(this, "LotusCertificate", {
      domainName: "lotus.benleach.com",
      validation: acm.CertificateValidation.fromDns(),
    });

    // ---------------------------------------------------------------
    // CloudFront Distribution — CDN for frontend + custom domain
    // ---------------------------------------------------------------
    const distribution = new cloudfront.Distribution(
      this,
      "FrontendDistribution",
      {
        defaultBehavior: {
          origin:
            origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        domainNames: ["lotus.benleach.com"],
        certificate: certificate,
        defaultRootObject: "index.html",
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
            ttl: cdk.Duration.minutes(5),
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
            ttl: cdk.Duration.minutes(5),
          },
        ],
      },
    );

    // ---------------------------------------------------------------
    // S3 Deployment — Upload frontend build to S3
    // ---------------------------------------------------------------
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist")),
      ],
      destinationBucket: frontendBucket,
      distribution: distribution,
      distributionPaths: ["/*"],
    });

    // ---------------------------------------------------------------
    // Stack Outputs
    // ---------------------------------------------------------------
    new cdk.CfnOutput(this, "FunctionUrl", {
      value: functionUrl.url,
      description: "Lambda Function URL for the chat backend",
    });

    new cdk.CfnOutput(this, "TableName", {
      value: conversationsTable.tableName,
      description: "DynamoDB table for conversation persistence",
    });

    new cdk.CfnOutput(this, "FunctionName", {
      value: chatFunction.functionName,
      description: "Lambda function name",
    });

    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront distribution URL",
    });

    new cdk.CfnOutput(this, "CustomDomain", {
      value: "https://lotus.benleach.com",
      description: "Custom domain (after DNS setup)",
    });

    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: distribution.distributionId,
      description: "CloudFront distribution ID for cache invalidation",
    });
  }
}

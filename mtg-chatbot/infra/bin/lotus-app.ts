#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { LotusStack } from "../lib/lotus-stack";

const app = new cdk.App();
new LotusStack(app, "LotusStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  description: "Lotus MTG Chatbot - AWS Backend",
});

# Lotus

A serverless AI chatbot that talks Magic: The Gathering — answering rules questions, looking up cards, and rebuilding Commander decks — with responses streamed token-by-token straight from Amazon Bedrock.

Live: **[lotus.benleach.com](https://lotus.benleach.com)**

## What it does

Lotus is a themed assistant for Magic: The Gathering. You can chat with it about strategy and rules, drop in `[[card name]]` references for accurate card data, or paste a full decklist and have it analyze synergies, suggest cuts, and recommend additions within a budget.

Card data is pulled live from the [Scryfall](https://scryfall.com) API so answers stay grounded in real, current card information rather than relying on the model's memory. In chat mode the model calls Scryfall as a tool on its own; in deck-builder mode the backend runs a three-pass pipeline (analyze → search & decide → format) so the final response is built from validated cards and real prices.

## Architecture

The whole thing runs serverless, with the streaming response as the core design constraint.

```
Browser (React/Vite, CloudFront + S3)
        │  POST /chat
        ▼
Lambda Function URL  ── RESPONSE_STREAM ──┐
        │                                 │ token-by-token
        ▼                                 │ text/plain stream
Lambda (Python 3.12, FastAPI)             │
   via AWS Lambda Web Adapter             ▼
        │                            Browser renders
        ├─► Amazon Bedrock (Claude, streaming)
        ├─► Scryfall API (card lookups)
        └─► DynamoDB (conversation history)
```

- **Streaming.** The Lambda Function URL is configured with `RESPONSE_STREAM` invoke mode, so tokens from Bedrock flow back to the browser as they're generated instead of buffering the full reply. The frontend reads the response body as a stream and appends each chunk.
- **FastAPI on Lambda.** The backend is an ordinary FastAPI app. The [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter) (attached as a layer) translates Function URL events into HTTP requests, so the same `uvicorn index:app` runs unchanged locally and in Lambda.
- **Persistence.** Conversations are stored in a single DynamoDB table (`PK`/`SK` single-table design, pay-per-request, TTL on old records). Persistence degrades gracefully — if no table is configured the app still runs.
- **Frontend delivery.** The built Vite app is served from a private S3 bucket behind CloudFront with a custom domain and ACM certificate.
- **Infrastructure as code.** Everything above is defined in a single AWS CDK stack (`LotusStack`) — table, function, function URL, IAM, bucket, distribution, and the frontend deployment.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, react-markdown |
| Backend | Python 3.12, FastAPI, Lambda Web Adapter |
| AI | Amazon Bedrock (Claude) |
| Data | DynamoDB, Scryfall API |
| Hosting | Lambda Function URL, S3, CloudFront, ACM |
| IaC | AWS CDK (TypeScript) |

## Project structure

```
.
├── frontend/      # React + Vite single-page app
├── backend/       # FastAPI app (runs on Lambda)
│   └── chat/      # routes, Bedrock client, Scryfall client, deck parser, DynamoDB store
├── mock-server/   # standalone FastAPI mock with canned responses for UI work
└── infra/         # AWS CDK stack
```

## Local development

### Backend

```bash
cd backend/chat
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn index:app --reload --port 8000
```

The backend calls Amazon Bedrock, so you need AWS credentials available in your environment (e.g. via `aws configure` or `AWS_PROFILE`) and Bedrock model access in your region. Model and region default to the values in `bedrock_client.py` and can be overridden with `BEDROCK_MODEL_ID` and `BEDROCK_REGION`. Set `CONVERSATIONS_TABLE` if you want DynamoDB persistence locally.

If you only want to work on the UI without AWS access, run the mock server instead — it returns canned streaming responses:

```bash
cd mock-server
pip install -r requirements.txt
python server.py        # http://localhost:8000
```

### Frontend

```bash
cd frontend
cp .env.example .env     # point VITE_API_URL at your backend
npm install
npm run dev              # http://localhost:5173
```

## Deploying

The CDK stack provisions the backend, frontend hosting, and CDN. Build the frontend first (the stack uploads `frontend/dist`), then deploy:

```bash
cd frontend && npm run build && cd ../infra
npm install
npx cdk bootstrap        # first time per account/region
npx cdk deploy
```

The stack targets `us-east-1` (required for the CloudFront certificate) and uses `CDK_DEFAULT_ACCOUNT` for the target account. The ACM certificate uses DNS validation; the custom domain (`lotus.benleach.com`) is managed externally, so add the validation and CNAME records with your DNS provider after the first deploy. Stack outputs include the Function URL, CloudFront URL, and distribution ID.

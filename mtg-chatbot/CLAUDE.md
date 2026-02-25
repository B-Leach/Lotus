# Lotus - MTG AI Chatbot

## Project Overview

Lotus is a Magic: The Gathering themed AI chatbot powered by Claude (via AWS Bedrock). Named after Black Lotus, it helps users with MTG questions, deck building, rules clarifications, and general conversation.

**Live at:** https://lotus.benleach.com

## Architecture

```
User → CloudFront (CDN) → S3 (React frontend)
                       ↘
                        Lambda (FastAPI backend) → Bedrock (Claude Opus)
                                                → DynamoDB (conversation storage)
                                                → Scryfall API (card data)
```

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Python FastAPI on AWS Lambda (via Lambda Web Adapter)
- **AI Model:** Claude Opus 4.6 via AWS Bedrock
- **Infrastructure:** AWS CDK (TypeScript)
- **Hosting:** S3 + CloudFront with custom domain
- **Database:** DynamoDB (conversation persistence - partially implemented)

## Key Features

### Three-Pass Deck Builder
When a user submits a deck list (10+ cards), it triggers a specialized three-pass analysis:

1. **Pass 1 (Analysis):** Analyzes synergies, combos, weak cards, identifies gaps. Outputs JSON with Scryfall search queries.
2. **Scryfall Searches:** Executes searches from Pass 1 to find real card suggestions.
3. **Pass 2 (Decisions):** Selects cuts and additions based on analysis + search results.
4. **Pass 3 (Format):** Produces polished, user-facing response.

Key design decisions:
- No extended thinking (removed for speed)
- All card suggestions come from Scryfall (no hallucinated cards)
- Budget-aware (calculates deck value, respects price tiers)
- Won't cut lands unless specifically asked about mana base
- Detects symmetry-breaking combos (e.g., Kudo + Elesh Norn + Nature's Revolt)

### Card Detection
- Extracts `[[card names]]` from messages
- Fetches card data from Scryfall API
- Provides accurate oracle text to Claude for reasoning

### Themes
MTG-inspired color themes based on the five mana colors plus a "Magic" theme sampled from the actual card back:
- Default (Magic card back): Rich browns, amber, teal-blue accents
- White, Blue, Black, Red, Green mana themes

## Project Structure

```
mtg-chatbot/
├── frontend/
│   ├── src/
│   │   ├── api.ts              # API client
│   │   ├── App.tsx             # Main app
│   │   ├── index.css           # Theme definitions
│   │   └── components/
│   ├── .env.production         # Lambda URL config
│   └── dist/                   # Built files (deployed to S3)
├── backend/chat/
│   ├── index.py                # FastAPI app, request handlers
│   ├── bedrock_client.py       # Claude API streaming
│   ├── scryfall_client.py      # Scryfall API (search, fetch, validate)
│   ├── deck_parser.py          # Deck list parsing, budget calculation
│   ├── system_prompt.py        # All prompts (base, pass 1/2/3)
│   └── conversation_store.py   # DynamoDB integration
└── infra/
    └── lib/lotus-stack.ts      # CDK stack (Lambda, S3, CloudFront, DynamoDB)
```

## Deployment

Single command deployment:
```bash
cd infra
cdk deploy
```

This deploys:
- Lambda function with FastAPI backend
- S3 bucket with frontend build
- CloudFront distribution with SSL
- DynamoDB table
- All IAM roles and permissions

### Custom Domain
- Domain: lotus.benleach.com
- DNS: DigitalOcean
- SSL: AWS Certificate Manager (DNS validation)
- CDN: CloudFront

## Configuration

### Environment Variables (Lambda)
- `BEDROCK_MODEL_ID`: us.anthropic.claude-opus-4-6-v1
- `BEDROCK_REGION`: us-east-1
- `CONVERSATIONS_TABLE`: lotus-conversations

### Frontend Environment
- `VITE_API_URL`: Lambda Function URL (in .env.production)

## Cost Estimate
~$5-25/month, primarily Bedrock usage. Infrastructure costs are pennies.

## Development History

### Major Decisions
1. **Removed extended thinking** - Was causing 5000 token thinking budget on every request, even simple "hi". Now disabled for all requests.
2. **Three-pass architecture** - Replaced two-pass system for better separation of concerns and faster responses.
3. **Mana base protection** - Model won't suggest cutting lands unless explicitly asked.
4. **Real card validation** - All suggestions come from Scryfall searches to prevent hallucination.

### Theme Development
The "Magic" theme was created by sampling the actual MTG card back image:
- Primary background: Rich brown (#784818) - dominant 50% of card
- Accent: Teal-blue (#5a8a9c) - from decorative text
- User bubbles: Amber (#906030)
- Bot bubbles: Dark brown (#5a3810)
- Includes subtle noise texture overlay and optional vignette effect

### Known Issues / Future Work
- DynamoDB conversation persistence is wired up but may not be fully integrated on frontend
- Could add card swap suggestions ("Replace X with Y for $Z difference")
- Could add mana curve visualization
- Could add category breakdown (creature/instant/sorcery distribution)

## Useful Commands

```bash
# Deploy everything
cd infra && cdk deploy

# Build frontend only
cd frontend && npm run build

# Test backend locally
cd backend/chat && uvicorn index:app --port 8000

# View Lambda logs
aws logs tail /aws/lambda/lotus-chat --follow

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
```

## API Endpoints

- `POST /chat` - Main chat endpoint (streaming response)
- `GET /health` - Health check
- `POST /debug` - Debug endpoint (shows extracted card context)

## Contact

Project by Ben Leach

# MTG Chatbot

An AI chatbot that naturally steers every conversation toward Magic: The Gathering.

## Project Structure

```
mtg-chatbot/
├── frontend/          # React + TypeScript + Vite
├── mock-server/       # FastAPI mock server for development
└── backend/           # AWS Lambda functions (coming soon)
```

## Quick Start

### 1. Start the Mock Server

```bash
cd mock-server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

The server runs at http://localhost:8000

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at http://localhost:5173

## Development

The mock server provides canned responses that demonstrate the MTG pivot behavior. When we integrate AWS Bedrock, the AI will generate dynamic, contextual responses.

## Coming Soon

- AWS Lambda backend
- AWS Bedrock (Claude) integration
- DynamoDB conversation persistence
- Deployment to AWS

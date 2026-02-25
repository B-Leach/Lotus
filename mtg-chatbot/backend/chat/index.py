"""
Lotus Chat Backend -- FastAPI app running on Lambda via Web Adapter.

The Lambda Web Adapter (AWS-provided Lambda Extension) translates
Lambda Function URL events into standard HTTP requests, allowing
this FastAPI app to run unchanged in both local dev and Lambda.

Local:   uvicorn index:app --port 8000
Lambda:  Runs via Lambda Web Adapter extension layer
"""

import json
import logging
import os
import re

from bedrock_client import stream_bedrock_response
from conversation_store import ConversationStore
from deck_parser import (
    calculate_deck_budget,
    format_deck_context,
    get_unique_card_names,
    parse_deck_list,
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from scryfall_client import (
    fetch_card_fuzzy,
    fetch_cards_collection,
    format_card_for_context,
    search_cards,
    validate_cards,
)
from system_prompt import (
    get_base_system_prompt,
    get_deckbuilder_pass1_prompt,
    get_deckbuilder_pass2_prompt,
    get_deckbuilder_pass3_prompt,
    get_system_prompt,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

app = FastAPI(title="Lotus Chat Backend")

# Only add CORS middleware for local development.
# In Lambda, the Function URL handles CORS and adding it here causes duplicate headers.
if not os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Initialize DynamoDB store (no-ops gracefully if table not configured)
conversation_store = ConversationStore(
    table_name=os.environ.get("CONVERSATIONS_TABLE", "")
)


class MessageHistory(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversationHistory: list[MessageHistory] = []
    conversationId: str | None = None
    mode: str = "chat"  # "chat" | "deckbuilder"
    deckList: str | None = None


def extract_card_names(text: str) -> list[str]:
    """
    Extract potential MTG card names from user messages.
    Looks for [[card name]] syntax and quoted card names.
    Also detects common card name patterns.
    """
    card_names = []

    # Extract [[card name]] syntax
    bracket_matches = re.findall(r"\[\[([^\]]+)\]\]", text)
    card_names.extend(bracket_matches)

    # Extract "quoted card names" that look like card names
    quote_matches = re.findall(r'"([^"]+)"', text)
    for match in quote_matches:
        # Filter to likely card names (2-5 words, title case)
        words = match.split()
        if 1 <= len(words) <= 6:
            card_names.append(match)

    return list(set(card_names))  # Deduplicate


def extract_commander(text: str) -> str | None:
    """
    Extract the commander card name from a deck list.
    Looks for common patterns like "Commander" or "Commander:" followed by a card name.
    """
    # Pattern: "Commander" on its own line, followed by "1 Card Name" or just "Card Name"
    commander_section = re.search(
        r"(?:^|\n)\s*[Cc]ommander[s]?\s*[\n:]+"
        r"\s*(?:1\s+)?([A-Z][^\n]+?)(?:\n|$)",
        text,
    )
    if commander_section:
        return commander_section.group(1).strip()

    # Pattern: "Commander: Card Name" on same line
    inline_commander = re.search(
        r"[Cc]ommander[s]?\s*[:\-]\s*(?:1\s+)?([A-Z][^\n]+?)(?:\n|$)", text
    )
    if inline_commander:
        return inline_commander.group(1).strip()

    return None


def fetch_card_context(card_names: list[str], commander_name: str | None = None) -> str:
    """
    Fetch card data from Scryfall and format as context for Claude.
    Commander is fetched first and separately labeled.
    """
    sections = []

    # Fetch commander first if provided
    if commander_name:
        commander_card = fetch_card_fuzzy(commander_name)
        if commander_card:
            sections.append(
                "**COMMANDER (build around this card):**\n\n"
                + format_card_for_context(commander_card)
            )

    # Fetch other mentioned cards
    if card_names:
        card_contexts = []
        for name in card_names[:5]:  # Limit to 5 cards to avoid slow responses
            # Skip if it's the commander (already fetched)
            if commander_name and name.lower() == commander_name.lower():
                continue
            card = fetch_card_fuzzy(name)
            if card:
                card_contexts.append(format_card_for_context(card))

        if card_contexts:
            sections.append(
                "**Card Reference Data (from Scryfall):**\n\n"
                + "\n\n".join(card_contexts)
            )

    if not sections:
        return ""

    return "\n\n---\n" + "\n\n".join(sections) + "\n---\n"


def parse_pass1_json(response: str) -> dict:
    """
    Extract JSON from Pass 1 response.
    Pass 1 outputs JSON wrapped in ```json ... ``` blocks.
    Falls back to empty dict if parsing fails.
    """
    json_match = re.search(r"```json\s*(.*?)\s*```", response, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse Pass 1 JSON: {e}")

    # Try parsing the entire response as JSON (in case no code block)
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    return {}


async def handle_deckbuilder_request(request: ChatRequest):
    """
    Handle deck builder mode requests with three-pass architecture:
    - Pass 1: Analysis (JSON output, not shown to user)
    - Pass 2: Decisions based on analysis + Scryfall searches (not shown)
    - Pass 3: Format final response (streamed to user)
    """
    deck_text = request.deckList or ""

    # If no deck list provided, check if user included it in the message
    if not deck_text and request.message:
        if re.search(r"^\d+\s+\w", request.message, re.MULTILINE):
            deck_text = request.message

    async def generate():
        full_response = ""

        try:
            # === STEP 1: Parse deck and fetch card data ===
            if not deck_text:
                yield "*No deck list provided. Please share your deck list for analysis.*\n\n"
                return

            yield "**Reading your deck list...**\n"
            parsed_deck = parse_deck_list(deck_text)
            card_names = get_unique_card_names(parsed_deck)

            yield f"Found **{parsed_deck['card_count']} cards** ({len(card_names)} unique)\n\n"

            yield "**Fetching card data from Scryfall...**\n"
            cards, not_found = fetch_cards_collection(card_names)

            if not_found:
                not_found_preview = not_found[:5]
                if len(not_found) > 5:
                    not_found_preview.append(f"...and {len(not_found) - 5} more")
                yield f"*Could not find: {', '.join(not_found_preview)}*\n"

            # Calculate budget from card prices
            budget = calculate_deck_budget(cards)
            yield f"Deck value: **~${budget['total_price']:.0f}** ({budget['budget_tier']} tier)\n\n"

            # Format deck context
            deck_context = format_deck_context(parsed_deck, cards)

            # === PASS 1: Analysis (internal, outputs JSON) ===
            yield "**Analyzing synergies and strategy...**\n"

            pass1_prompt = get_deckbuilder_pass1_prompt()
            pass1_messages = [
                {
                    "role": "user",
                    "content": f"{deck_context}\n\n---\n\n**User Request:** {request.message}",
                }
            ]

            pass1_response = ""
            for chunk in stream_bedrock_response(pass1_prompt, pass1_messages):
                pass1_response += chunk
                # Don't stream Pass 1 to user

            logger.info(f"Pass 1 complete. Response length: {len(pass1_response)}")

            # Parse Pass 1 JSON
            pass1_data = parse_pass1_json(pass1_response)
            if not pass1_data:
                logger.warning("Pass 1 JSON parse failed, using empty analysis")
                pass1_data = {
                    "weak_cards": [],
                    "gaps": [],
                    "synergies": [],
                    "combos": [],
                }

            # === Execute Scryfall searches based on Pass 1 gaps ===
            search_results = {}
            gaps = pass1_data.get("gaps", [])[:5]  # Cap at 5 categories

            if gaps:
                yield "**Searching for cards to fill gaps...**\n"
                search_categories = []
                for gap in gaps:
                    category = gap.get("category", "unknown")
                    query = gap.get("scryfall_query", "")
                    if query:
                        # Format category name nicely (replace underscores, title case)
                        nice_category = category.replace("_", " ").title()
                        search_categories.append(nice_category)
                        results = search_cards(
                            query, limit=30, budget_cap=budget["price_cap"]
                        )
                        if results:
                            search_results[category] = results
                            logger.info(
                                f"Search '{category}': found {len(results)} cards"
                            )

                if search_categories:
                    yield f"*Searched: {', '.join(search_categories)}*\n"

            # Validate specific cards if requested
            validate_list = pass1_data.get("validate", [])
            if validate_list:
                validated = validate_cards(validate_list)
                if validated:
                    search_results["validated_cards"] = validated

            # === PASS 2: Decisions (internal) ===
            yield "\n**Selecting cuts and additions...**\n"

            pass2_prompt = get_deckbuilder_pass2_prompt()
            pass2_context = {
                "analysis": pass1_data,
                "search_results": search_results,
                "budget": budget,
                "user_request": request.message,
                "deck_card_count": parsed_deck["card_count"],
            }
            pass2_messages = [
                {"role": "user", "content": json.dumps(pass2_context, indent=2)}
            ]

            pass2_response = ""
            for chunk in stream_bedrock_response(pass2_prompt, pass2_messages):
                pass2_response += chunk
                # Don't stream Pass 2 to user

            logger.info(f"Pass 2 complete. Response length: {len(pass2_response)}")

            # === PASS 3: Format final response (streamed to user) ===
            yield "\n---\n\n"

            pass3_prompt = get_deckbuilder_pass3_prompt()
            pass3_context = {
                "decisions": pass2_response,
                "commander": parsed_deck.get("commander"),
                "user_request": request.message,
            }
            pass3_messages = [
                {"role": "user", "content": json.dumps(pass3_context, indent=2)}
            ]

            for chunk in stream_bedrock_response(pass3_prompt, pass3_messages):
                full_response += chunk
                yield chunk

            logger.info(f"Pass 3 complete. Response length: {len(full_response)}")

        except Exception as e:
            import traceback

            error_details = traceback.format_exc()
            logger.error(f"Deck builder error: {e}")
            logger.error(f"Traceback: {error_details}")
            error_msg = f"Forgive me, planeswalker -- I encountered an error analyzing your deck: {str(e)}"
            yield error_msg
            full_response = error_msg

        # Persist to DynamoDB if enabled
        if request.conversationId and conversation_store.is_enabled():
            try:
                conversation_store.save_message(
                    request.conversationId, "user", request.message
                )
                conversation_store.save_message(
                    request.conversationId, "assistant", full_response
                )
            except Exception as e:
                logger.error(f"DynamoDB save error: {e}", exc_info=True)

    return StreamingResponse(generate(), media_type="text/plain")


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Handle chat requests by streaming Claude's response from Bedrock.

    Receives the user message + conversation history, prepends the
    MTG system prompt, invokes Bedrock with streaming, and returns
    a text/plain streaming response token-by-token.

    When card names are detected in the user's message, we fetch
    accurate card data from Scryfall and include it in the context.

    If mode="deckbuilder", routes to the specialized deck builder handler.
    """
    # Auto-detect deck builder mode based on content
    # A deck list typically has many lines starting with a number (quantity) followed by card name
    deck_lines = re.findall(r"^\d+\s+[A-Z]", request.message, re.MULTILINE)
    is_deck_list = len(deck_lines) >= 10  # At least 10 cards to be considered a deck

    logger.info(
        f"Request mode: {request.mode}, deckList length: {len(request.deckList) if request.deckList else 0}, detected deck lines: {len(deck_lines)}"
    )

    # Route to deck builder if explicitly requested OR if we detect a deck list
    if request.mode == "deckbuilder" or is_deck_list:
        logger.info(
            f"Routing to deck builder handler (explicit: {request.mode == 'deckbuilder'}, auto-detected: {is_deck_list})"
        )
        # If deck list is in message but not in deckList field, use message
        if not request.deckList and is_deck_list:
            request.deckList = request.message
        return await handle_deckbuilder_request(request)

    system_prompt = get_system_prompt(mode="chat")

    # Extract card names and commander from user message, fetch from Scryfall
    card_names = extract_card_names(request.message)
    commander_name = extract_commander(request.message)
    card_context = fetch_card_context(card_names, commander_name)

    # Log what we extracted for debugging
    logger.info(f"Extracted commander: {commander_name}")
    logger.info(f"Extracted card names: {card_names}")
    logger.info(f"Card context length: {len(card_context)} chars")

    # Build messages for Bedrock's Messages API
    messages = []
    for msg in request.conversationHistory:
        messages.append({"role": msg.role, "content": msg.content})

    # Prepend card context to the user's message so it's seen first
    user_message = request.message
    if card_context:
        user_message = card_context + "\n\n" + request.message

    messages.append({"role": "user", "content": user_message})

    async def generate():
        full_response = ""
        try:
            for chunk in stream_bedrock_response(system_prompt, messages):
                full_response += chunk
                yield chunk
        except Exception as e:
            logger.error(f"Bedrock streaming error: {e}", exc_info=True)
            error_msg = (
                "Forgive me, planeswalker -- I seem to have lost my connection "
                "to the Blind Eternities. Please try again."
            )
            yield error_msg
            full_response = error_msg

        # After streaming completes, persist to DynamoDB if enabled
        if request.conversationId and conversation_store.is_enabled():
            try:
                conversation_store.save_message(
                    request.conversationId, "user", request.message
                )
                conversation_store.save_message(
                    request.conversationId, "assistant", full_response
                )
            except Exception as e:
                logger.error(f"DynamoDB save error: {e}", exc_info=True)

    return StreamingResponse(generate(), media_type="text/plain")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "lotus-backend",
        "message": "Lotus is ready to enlighten you about Magic: The Gathering!",
    }


@app.post("/debug")
async def debug_context(request: ChatRequest):
    """Debug endpoint to see what context would be built for a message."""
    card_names = extract_card_names(request.message)
    commander_name = extract_commander(request.message)
    card_context = fetch_card_context(card_names, commander_name)

    return {
        "extracted_commander": commander_name,
        "extracted_card_names": card_names,
        "card_context": card_context,
        "context_length": len(card_context),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

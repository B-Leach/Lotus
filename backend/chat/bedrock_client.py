"""
Amazon Bedrock client for invoking Claude models with streaming responses.

Uses the Bedrock Runtime's InvokeModelWithResponseStream API with
Anthropic's native message format. Supports tool use for Scryfall lookups.
"""

import json
import logging
import os

import boto3
from botocore.config import Config
from scryfall_client import fetch_card_fuzzy, format_card_for_context, search_cards

logger = logging.getLogger(__name__)

_bedrock_client = None

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-opus-4-6-v1")

MAX_TOOL_ROUNDS = 3

# Increase read timeout for long-running model invocations
BEDROCK_CONFIG = Config(
    read_timeout=300,  # 5 minutes
    connect_timeout=10,
    retries={"max_attempts": 2},
)

# Tool definitions for Scryfall card lookups
SCRYFALL_TOOLS = [
    {
        "name": "lookup_card",
        "description": (
            "Look up a Magic: The Gathering card by name using Scryfall. "
            "Returns the card's full oracle text, mana cost, type line, and other details. "
            "Use this to verify a card exists and get accurate information before mentioning it."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "card_name": {
                    "type": "string",
                    "description": "The card name to look up (fuzzy matching supported)",
                }
            },
            "required": ["card_name"],
        },
    },
    {
        "name": "search_cards",
        "description": (
            "Search for Magic: The Gathering cards using Scryfall query syntax. "
            "Results are sorted by EDHREC popularity. "
            "Query examples: 'o:\"fish token\" f:commander' (cards that create fish tokens), "
            "'t:fish f:commander' (fish creatures), "
            "'c:blue o:draw t:instant f:commander' (blue instant card draw). "
            "See Scryfall syntax docs for full query language."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Scryfall search query string",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results to return (default 10, max 20)",
                },
            },
            "required": ["query"],
        },
    },
]


def execute_tool(tool_name: str, tool_input: dict) -> str:
    """
    Execute a tool call and return the result as a string.

    Args:
        tool_name: Name of the tool to execute.
        tool_input: Input parameters for the tool.

    Returns:
        String result to send back to Claude.
    """
    if tool_name == "lookup_card":
        card_name = tool_input.get("card_name", "")
        card = fetch_card_fuzzy(card_name)
        if card:
            return format_card_for_context(card)
        return f"Card not found: '{card_name}'. It may not exist or the name may be misspelled."

    if tool_name == "search_cards":
        query = tool_input.get("query", "")
        limit = min(tool_input.get("limit", 10), 20)
        results = search_cards(query, limit=limit)
        if results:
            formatted = []
            for card in results:
                entry = format_card_for_context(card)
                if card.get("usd"):
                    entry += f"\nPrice: ${card['usd']}"
                formatted.append(entry)
            return f"Found {len(results)} cards:\n\n" + "\n\n---\n\n".join(formatted)
        return f"No cards found for query: '{query}'. Try broadening your search."

    return f"Unknown tool: {tool_name}"


def _get_client():
    """Lazy-initialize the Bedrock Runtime client."""
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client(
            "bedrock-runtime",
            region_name=os.environ.get("BEDROCK_REGION", "us-east-1"),
            config=BEDROCK_CONFIG,
        )
    return _bedrock_client


def _format_messages(messages: list[dict]) -> list[dict]:
    """
    Convert messages to Anthropic's native format.
    Content must be an array of content blocks.
    Messages with content already as a list are passed through unchanged.
    """
    formatted = []
    for msg in messages:
        content = msg["content"]
        if isinstance(content, str):
            formatted.append(
                {"role": msg["role"], "content": [{"type": "text", "text": content}]}
            )
        else:
            formatted.append(msg)
    return formatted


def _stream_single_request(request_body: dict):
    """
    Make a single streaming request to Bedrock and yield events.

    Yields tuples of (event_type, data):
        ("text", str)           - Text chunk to display
        ("tool_use_start", dict) - Tool use block started {id, name}
        ("tool_input_delta", str) - Partial JSON for tool input
        ("tool_use_end", None)  - Tool use block finished
        ("stop", str)           - Message ended, value is stop_reason
    """
    client = _get_client()

    response = client.invoke_model_with_response_stream(
        modelId=MODEL_ID,
        body=json.dumps(request_body),
        contentType="application/json",
        accept="application/json",
    )

    for event in response["body"]:
        chunk = event.get("chunk")
        if not chunk:
            continue

        chunk_data = json.loads(chunk["bytes"].decode("utf-8"))
        event_type = chunk_data.get("type")

        if event_type == "content_block_start":
            block = chunk_data.get("content_block", {})
            if block.get("type") == "tool_use":
                yield ("tool_use_start", {"id": block["id"], "name": block["name"]})

        elif event_type == "content_block_delta":
            delta = chunk_data.get("delta", {})
            delta_type = delta.get("type")
            if delta_type == "text_delta":
                text = delta.get("text", "")
                if text:
                    yield ("text", text)
            elif delta_type == "input_json_delta":
                partial = delta.get("partial_json", "")
                if partial:
                    yield ("tool_input_delta", partial)

        elif event_type == "message_delta":
            stop_reason = chunk_data.get("delta", {}).get("stop_reason")
            usage = chunk_data.get("usage", {})
            if usage:
                logger.info(f"Bedrock usage: {usage}")
            if stop_reason:
                yield ("stop", stop_reason)

        elif event_type == "message_stop":
            pass


def stream_bedrock_response(
    system_prompt: str, messages: list[dict], tools: list[dict] | None = None
) -> iter:
    """
    Invoke Claude on Bedrock with streaming. Handles tool use loops automatically.

    When tools are provided, Claude may call them mid-response. The tool execution
    happens server-side and results are sent back to Claude for continuation.
    The caller only sees text chunks — tool use is transparent.

    Args:
        system_prompt: The system prompt.
        messages: List of {"role": "user"|"assistant", "content": "..."} dicts.
        tools: Optional list of tool definitions. Pass None to disable tool use.

    Yields:
        str: Text chunks as they arrive from the model.
    """
    working_messages = _format_messages(messages)

    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 16000,
        "system": [{"type": "text", "text": system_prompt}],
        "messages": working_messages,
    }

    if tools:
        request_body["tools"] = tools

    logger.info(
        f"Invoking Bedrock model {MODEL_ID} with {len(messages)} messages, "
        f"tools={'enabled' if tools else 'disabled'}"
    )

    try:
        for _round in range(MAX_TOOL_ROUNDS + 1):
            # Track content blocks for this response
            text_chunks = []
            tool_use_blocks = []
            current_tool = None
            current_tool_input_json = ""
            stop_reason = "end_turn"

            for event_type, data in _stream_single_request(request_body):
                if event_type == "text":
                    text_chunks.append(data)
                    yield data

                elif event_type == "tool_use_start":
                    current_tool = data  # {id, name}
                    current_tool_input_json = ""

                elif event_type == "tool_input_delta":
                    current_tool_input_json += data

                elif event_type == "tool_use_end":
                    # Shouldn't normally get here — handled via stop event
                    pass

                elif event_type == "stop":
                    stop_reason = data

            # Finalize any pending tool_use block
            if current_tool:
                try:
                    tool_input = (
                        json.loads(current_tool_input_json)
                        if current_tool_input_json
                        else {}
                    )
                except json.JSONDecodeError:
                    logger.warning(
                        f"Failed to parse tool input JSON: {current_tool_input_json}"
                    )
                    tool_input = {}
                tool_use_blocks.append(
                    {
                        "type": "tool_use",
                        "id": current_tool["id"],
                        "name": current_tool["name"],
                        "input": tool_input,
                    }
                )

            # If no tool use, we're done
            if stop_reason != "tool_use" or not tool_use_blocks:
                break

            # Execute tools and continue the conversation
            logger.info(
                f"Tool round {_round + 1}: executing {len(tool_use_blocks)} tool(s)"
            )

            # Build the assistant message with all content blocks from this turn
            assistant_content = []
            if text_chunks:
                assistant_content.append({"type": "text", "text": "".join(text_chunks)})
            assistant_content.extend(tool_use_blocks)

            working_messages.append({"role": "assistant", "content": assistant_content})

            # Execute each tool and build the tool results
            tool_results = []
            status_parts = []
            for tool_block in tool_use_blocks:
                tool_name = tool_block["name"]
                tool_input = tool_block["input"]
                logger.info(f"Executing tool: {tool_name}({tool_input})")

                if tool_name == "lookup_card":
                    status_parts.append(
                        f"looking up {tool_input.get('card_name', 'card')}"
                    )
                elif tool_name == "search_cards":
                    status_parts.append("searching Scryfall")

                result = execute_tool(tool_name, tool_input)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_block["id"],
                        "content": result,
                    }
                )

            # Yield a status message so the user knows something is happening
            status = ", ".join(status_parts)
            yield f"\n\n*{status.capitalize()}...*\n\n"

            # Add tool results as a user message (Anthropic format)
            working_messages.append({"role": "user", "content": tool_results})

            # Update request body for the next round
            request_body["messages"] = working_messages

            # Reset for next round
            tool_use_blocks = []
            current_tool = None

    except Exception as e:
        logger.error(f"Bedrock invocation error: {e}", exc_info=True)
        raise

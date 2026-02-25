"""
Amazon Bedrock client for invoking Claude models with streaming responses.

Uses the Bedrock Runtime's InvokeModelWithResponseStream API with
Anthropic's native message format.
"""

import json
import logging
import os

import boto3
from botocore.config import Config

logger = logging.getLogger(__name__)

_bedrock_client = None

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-opus-4-6-v1")

# Increase read timeout for long-running model invocations
BEDROCK_CONFIG = Config(
    read_timeout=300,  # 5 minutes
    connect_timeout=10,
    retries={"max_attempts": 2},
)


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


def stream_bedrock_response(system_prompt: str, messages: list[dict]) -> iter:
    """
    Invoke Claude on Bedrock with streaming via the InvokeModelWithResponseStream API.

    Args:
        system_prompt: The MTG personality system prompt.
        messages: List of {"role": "user"|"assistant", "content": "..."} dicts.

    Yields:
        str: Text chunks as they arrive from the model.
    """
    client = _get_client()

    # Convert messages to Anthropic's native format
    # Content must be an array of content blocks
    formatted_messages = []
    for msg in messages:
        content = msg["content"]
        # If content is a string, wrap it in the proper format
        if isinstance(content, str):
            formatted_messages.append(
                {"role": msg["role"], "content": [{"type": "text", "text": content}]}
            )
        else:
            formatted_messages.append(msg)

    # Build request body
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 16000,
        "system": [{"type": "text", "text": system_prompt}],
        "messages": formatted_messages,
    }

    logger.info(f"Invoking Bedrock model {MODEL_ID} with {len(messages)} messages")

    try:
        response = client.invoke_model_with_response_stream(
            modelId=MODEL_ID,
            body=json.dumps(request_body),
            contentType="application/json",
            accept="application/json",
        )

        # Parse the streaming response
        for event in response["body"]:
            chunk = event.get("chunk")
            if chunk:
                chunk_data = json.loads(chunk["bytes"].decode("utf-8"))
                event_type = chunk_data.get("type")

                if event_type == "content_block_delta":
                    delta = chunk_data.get("delta", {})
                    delta_type = delta.get("type")

                    if delta_type == "text_delta":
                        text = delta.get("text", "")
                        if text:
                            yield text

                elif event_type == "message_stop":
                    # End of message
                    pass

                elif event_type == "message_delta":
                    # Contains usage info at the end
                    usage = chunk_data.get("usage", {})
                    if usage:
                        logger.info(f"Bedrock usage: {usage}")

    except Exception as e:
        logger.error(f"Bedrock invocation error: {e}", exc_info=True)
        raise

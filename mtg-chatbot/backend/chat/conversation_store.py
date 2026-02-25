"""
DynamoDB conversation persistence for the Lotus chatbot.

Uses single-table design with composite keys:
  PK = CONV#<conversationId>
  SK = META              (conversation metadata)
  SK = MSG#<iso-ts>#<id> (individual messages, sorted chronologically)

Gracefully no-ops if the table is not configured, allowing the backend
to run without DynamoDB for local development.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

CONVERSATION_TTL_DAYS = 30


class ConversationStore:
    """DynamoDB-backed conversation storage."""

    def __init__(self, table_name: str = ""):
        self.table_name = table_name or os.environ.get("CONVERSATIONS_TABLE", "")
        self._table = None

    def is_enabled(self) -> bool:
        """Check if DynamoDB persistence is configured."""
        return bool(self.table_name)

    @property
    def table(self):
        """Lazy-initialize the DynamoDB table resource."""
        if self._table is None:
            dynamodb = boto3.resource("dynamodb")
            self._table = dynamodb.Table(self.table_name)
        return self._table

    def save_message(self, conversation_id: str, role: str, content: str) -> None:
        """Save a single message to a conversation."""
        if not self.is_enabled():
            return

        now = datetime.now(timezone.utc)
        message_id = str(uuid.uuid4())[:8]
        ttl = int((now + timedelta(days=CONVERSATION_TTL_DAYS)).timestamp())

        try:
            self.table.put_item(
                Item={
                    "PK": f"CONV#{conversation_id}",
                    "SK": f"MSG#{now.isoformat()}#{message_id}",
                    "role": role,
                    "content": content,
                    "timestamp": now.isoformat(),
                    "ttl": ttl,
                }
            )
        except ClientError as e:
            logger.error(f"Failed to save message: {e}")
            raise

    def save_conversation_meta(self, conversation_id: str, title: str) -> None:
        """Create or update conversation metadata."""
        if not self.is_enabled():
            return

        now = datetime.now(timezone.utc)
        ttl = int((now + timedelta(days=CONVERSATION_TTL_DAYS)).timestamp())

        try:
            self.table.put_item(
                Item={
                    "PK": f"CONV#{conversation_id}",
                    "SK": "META",
                    "title": title,
                    "createdAt": now.isoformat(),
                    "updatedAt": now.isoformat(),
                    "ttl": ttl,
                }
            )
        except ClientError as e:
            logger.error(f"Failed to save conversation meta: {e}")
            raise

    def get_conversation(self, conversation_id: str) -> dict | None:
        """
        Retrieve a full conversation (metadata + all messages).

        Returns dict with 'meta' and 'messages' keys, or None if not found.
        """
        if not self.is_enabled():
            return None

        try:
            response = self.table.query(
                KeyConditionExpression="PK = :pk",
                ExpressionAttributeValues={":pk": f"CONV#{conversation_id}"},
                ScanIndexForward=True,
            )

            items = response.get("Items", [])
            if not items:
                return None

            meta = None
            messages = []
            for item in items:
                if item["SK"] == "META":
                    meta = item
                elif item["SK"].startswith("MSG#"):
                    messages.append(
                        {
                            "role": item["role"],
                            "content": item["content"],
                            "timestamp": item["timestamp"],
                        }
                    )

            return {"meta": meta, "messages": messages}

        except ClientError as e:
            logger.error(f"Failed to get conversation: {e}")
            raise

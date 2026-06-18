import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Copy,
  Check,
  Share2,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { MessageBody } from "./MessageBody";
import type { Message } from "../types";
import styles from "./ChatMessage.module.css";

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

interface ChatMessageProps {
  message: Message;
  onReaction?: (messageId: string, reaction: "up" | "down" | null) => void;
  onRegenerate?: () => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
}

export function ChatMessage({
  message,
  onReaction,
  onRegenerate,
  onEditMessage,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const timeoutRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    // Prevent action if already in copied state
    if (copied) return;

    try {
      await navigator.clipboard.writeText(message.content);

      // Clear any existing timeout
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      setCopied(true);
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [copied, message.content]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: message.content,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to share:", err);
        }
      }
    } else {
      handleCopy();
    }
  }, [handleCopy, message.content]);

  const handleReaction = useCallback(
    (reaction: "up" | "down") => {
      if (!onReaction) return;
      // Toggle off if same reaction, otherwise set new reaction
      if (message.reaction === reaction) {
        onReaction(message.id, null);
      } else {
        onReaction(message.id, reaction);
      }
    },
    [onReaction, message.id, message.reaction],
  );

  const handleStartEdit = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
    // Focus textarea after render
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 0);
  }, [message.content]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  const handleSubmitEdit = useCallback(() => {
    if (editContent.trim() && onEditMessage) {
      onEditMessage(message.id, editContent.trim());
      setIsEditing(false);
    }
  }, [editContent, onEditMessage, message.id]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmitEdit();
      }
      if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleSubmitEdit, handleCancelEdit],
  );

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editContent]);

  return (
    <div
      className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}
    >
      <div className={styles.content}>
        <div className={styles.text}>
          {isUser ? (
            isEditing ? (
              <div className={styles.editContainer}>
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className={styles.editTextarea}
                  rows={1}
                />
                <div className={styles.editActions}>
                  <button
                    onClick={handleCancelEdit}
                    className={styles.editCancelButton}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitEdit}
                    className={styles.editSubmitButton}
                    disabled={!editContent.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <p className={styles.userText}>{message.content}</p>
            )
          ) : (
            <MessageBody content={message.content} />
          )}
        </div>
        {isUser && !isEditing && (
          <div className={styles.userActions}>
            <button
              onClick={handleCopy}
              className={`${styles.actionButton} ${copied ? styles.copied : ""}`}
              title={copied ? "Copied!" : "Copy message"}
              disabled={copied}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {onEditMessage && (
              <button
                onClick={handleStartEdit}
                className={styles.actionButton}
                title="Edit message"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
        {!isUser && (
          <div className={styles.footer}>
            <span
              className={styles.time}
              title={message.timestamp.toLocaleString()}
            >
              {getRelativeTime(message.timestamp)}
            </span>
            <div className={styles.actions}>
              <button
                onClick={() => handleReaction("up")}
                className={`${styles.actionButton} ${message.reaction === "up" ? styles.reactionActive : ""}`}
                title="Good response"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={() => handleReaction("down")}
                className={`${styles.actionButton} ${message.reaction === "down" ? styles.reactionActive : ""}`}
                title="Poor response"
              >
                <ThumbsDown size={14} />
              </button>
              <button
                onClick={handleCopy}
                className={`${styles.actionButton} ${copied ? styles.copied : ""}`}
                title={copied ? "Copied!" : "Copy message"}
                disabled={copied}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button
                onClick={handleShare}
                className={styles.actionButton}
                title="Share message"
              >
                <Share2 size={14} />
              </button>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className={styles.actionButton}
                  title="Regenerate response"
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

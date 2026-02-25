import { useEffect, useRef, useState, useCallback } from "react";
import { Menu, MessageSquarePlus, ArrowDown } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { StreamingMessage } from "./StreamingMessage";
import { ChatInput } from "./ChatInput";
import type { Message } from "../types";
import styles from "./ChatArea.module.css";

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  onSendMessage: (message: string) => void;
  onMenuClick: () => void;
  hasConversations: boolean;
  onNewChat: () => void;
  onRegenerate: () => void;
  onReaction: (messageId: string, reaction: "up" | "down" | null) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
}

const MESSAGES_PER_PAGE = 50;

export function ChatArea({
  messages,
  isLoading,
  streamingContent,
  onSendMessage,
  onMenuClick,
  hasConversations,
  onNewChat,
  onRegenerate,
  onReaction,
  onEditMessage,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MESSAGES_PER_PAGE);
  const isAutoScrolling = useRef(false);

  // Reset visible count when switching conversations
  useEffect(() => {
    setVisibleCount(MESSAGES_PER_PAGE);
  }, [messages.length === 0]);

  const hasMore = messages.length > visibleCount;
  const visibleMessages = hasMore
    ? messages.slice(messages.length - visibleCount)
    : messages;

  const scrollToBottom = useCallback(() => {
    isAutoScrolling.current = true;
    setShowScrollButton(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Reset auto-scrolling flag after animation completes
    setTimeout(() => {
      isAutoScrolling.current = false;
    }, 500);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const checkScrollPosition = () => {
      // Don't update during auto-scroll animation
      if (isAutoScrolling.current) {
        return;
      }
      const { scrollTop } = container;
      // Due to flex-end layout: scrollTop=0 is at bottom, negative means scrolled up
      setShowScrollButton(scrollTop < -200);
    };

    container.addEventListener("scroll", checkScrollPosition);
    return () => container.removeEventListener("scroll", checkScrollPosition);
  }, []);

  // Empty state when all conversations are deleted
  if (!hasConversations) {
    return (
      <div className={styles.chatArea}>
        <div className={styles.mobileHeader}>
          <button
            onClick={onMenuClick}
            className={styles.menuButton}
            title="Open menu"
          >
            <Menu size={24} />
          </button>
          <span className={styles.mobileTitle}>Lotus</span>
          <div className={styles.menuButtonPlaceholder} />
        </div>
        <div className={styles.messages}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <MessageSquarePlus size={48} />
            </div>
            <h2>No conversations yet</h2>
            <p>
              Start a new conversation and discover how everything connects to
              Magic: The Gathering!
            </p>
            <button className={styles.newChatButton} onClick={onNewChat}>
              <MessageSquarePlus size={20} />
              New Conversation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatArea}>
      <div className={styles.mobileHeader}>
        <button
          onClick={onMenuClick}
          className={styles.menuButton}
          title="Open menu"
        >
          <Menu size={24} />
        </button>
        <span className={styles.mobileTitle}>Lotus</span>
        <div className={styles.menuButtonPlaceholder} />
      </div>
      <div className={styles.messages} ref={messagesContainerRef}>
        {messages.length === 0 && !isLoading ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>
              <div className={styles.logoImage} role="img" aria-label="Lotus" />
            </div>
            <h2>Welcome to Lotus</h2>
            <p>
              Ask me anything about Magic: The Gathering, or paste a deck list
              for analysis.
            </p>
            <div className={styles.suggestions}>
              <button
                onClick={() => onSendMessage("What's the weather like today?")}
              >
                What's the weather like today?
              </button>
              <button onClick={() => onSendMessage("Tell me about your day")}>
                Tell me about your day
              </button>
              <button
                onClick={() => onSendMessage("Help me build a Commander deck")}
              >
                Help me build a Commander deck
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.messagesContent}>
            {hasMore && (
              <div className={styles.loadMore}>
                <button
                  className={styles.loadMoreButton}
                  onClick={() =>
                    setVisibleCount((prev) => prev + MESSAGES_PER_PAGE)
                  }
                >
                  Load{" "}
                  {Math.min(MESSAGES_PER_PAGE, messages.length - visibleCount)}{" "}
                  earlier messages
                </button>
              </div>
            )}
            {visibleMessages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onReaction={onReaction}
                onRegenerate={
                  msg.role === "assistant" &&
                  msg.id === messages[messages.length - 1]?.id &&
                  !isLoading
                    ? onRegenerate
                    : undefined
                }
                onEditMessage={
                  msg.role === "user" && !isLoading ? onEditMessage : undefined
                }
              />
            ))}
            {isLoading && streamingContent && (
              <StreamingMessage content={streamingContent} />
            )}
            {isLoading && !streamingContent && (
              <div className={styles.loading}>
                <div className={styles.typingIndicator}>
                  <span className={styles.typingText}>Lotus is thinking</span>
                  <div className={styles.typingDots}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <button
        className={`${styles.scrollToBottom} ${showScrollButton ? styles.visible : ""}`}
        onClick={scrollToBottom}
        title="Scroll to bottom"
      >
        <ArrowDown size={18} />
      </button>

      <ChatInput onSend={onSendMessage} disabled={isLoading} />
    </div>
  );
}

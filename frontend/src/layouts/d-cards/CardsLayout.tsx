import { useState, useEffect } from "react";
import { Plus, RefreshCw, Maximize2, X } from "lucide-react";
import { MessageBody } from "../../components/MessageBody";
import { ChatInput } from "../../components/ChatInput";
import { StreamingMessage } from "../../components/StreamingMessage";
import type { LayoutProps } from "../types";
import type { Message } from "../../types";
import styles from "./styles.module.css";

const PREVIEW_LEN = 280;

function CardMessage({
  message,
  isLast,
  onRegenerate,
  onExpand,
}: {
  message: Message;
  isLast: boolean;
  onRegenerate?: () => void;
  onExpand: (m: Message) => void;
}) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className={styles.tokenRow}>
        <div className={styles.token}>{message.content}</div>
      </div>
    );
  }
  const long = message.content.length > PREVIEW_LEN;
  return (
    <div className={styles.cardRow}>
      <article className={styles.card}>
        <header className={styles.cardHeader}>
          <span className={styles.cardTitle}>Lotus</span>
          <span className={styles.cardType}>Sorcery — Advice</span>
        </header>
        <div className={styles.cardArt} aria-hidden="true" />
        <div className={styles.cardText}>
          {/* Preview truncates raw source; markdown may be cut mid-construct (acceptable — full text is in the overlay). */}
          <MessageBody
            content={long ? message.content.slice(0, PREVIEW_LEN) + "…" : message.content}
          />
        </div>
        <footer className={styles.cardFooter}>
          {long && (
            <button className={styles.cardBtn} onClick={() => onExpand(message)} aria-label="Read full response">
              <Maximize2 size={14} aria-hidden="true" /> Read
            </button>
          )}
          {isLast && onRegenerate && (
            <button className={styles.cardBtn} onClick={onRegenerate}>
              <RefreshCw size={14} /> Redraw
            </button>
          )}
        </footer>
      </article>
    </div>
  );
}

export function CardsLayout({ chat }: LayoutProps) {
  const [expanded, setExpanded] = useState<Message | null>(null);
  const messages = chat.activeConversation?.messages ?? [];

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded]);
  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className={styles.root}>
      <aside className={styles.library}>
        <button
          className={styles.newSpine}
          onClick={() => chat.createNewConversation()}
          title="New conversation"
        >
          <Plus size={16} />
        </button>
        <div className={styles.spines}>
          {chat.conversations.map((c) => (
            <button
              key={c.id}
              className={`${styles.spine} ${c.id === chat.activeConversationId ? styles.spineActive : ""}`}
              onClick={() => chat.handleSelectConversation(c.id)}
              title={c.title}
            >
              <span className={styles.spineLabel}>{c.title}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className={styles.table}>
        <div className={styles.hand}>
          {messages.length === 0 && !chat.isLoading && (
            <div className={styles.empty}>
              <h2>Draw your first card</h2>
              <p>Ask anything about Magic: The Gathering.</p>
            </div>
          )}
          {messages.map((m) => (
            <CardMessage
              key={m.id}
              message={m}
              isLast={m.id === lastId}
              onRegenerate={
                m.role === "assistant" && m.id === lastId && !chat.isLoading
                  ? chat.handleRegenerate
                  : undefined
              }
              onExpand={setExpanded}
            />
          ))}
          {chat.isLoading && chat.streamingContent && (
            <div className={styles.cardRow}>
              <article className={styles.card}>
                <div className={styles.cardText}>
                  <StreamingMessage content={chat.streamingContent} />
                </div>
              </article>
            </div>
          )}
          {chat.isLoading && !chat.streamingContent && (
            <div className={styles.drawing}>Drawing a card…</div>
          )}
        </div>
        <div className={styles.inputDock}>
          <ChatInput onSend={chat.handleSendMessage} disabled={chat.isLoading} />
        </div>
      </main>

      {expanded && (
        <div className={styles.overlay} onClick={() => setExpanded(null)}>
          <div className={styles.expandedCard} onClick={(e) => e.stopPropagation()}>
            <button className={styles.overlayClose} onClick={() => setExpanded(null)} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
            <MessageBody content={expanded.content} />
          </div>
        </div>
      )}
    </div>
  );
}

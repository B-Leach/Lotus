import { Plus, RefreshCw, ScrollText } from "lucide-react";
import { MessageBody } from "../../components/MessageBody";
import { ChatInput } from "../../components/ChatInput";
import { StreamingMessage } from "../../components/StreamingMessage";
import type { LayoutProps } from "../types";
import styles from "./styles.module.css";

export function TavernLayout({ chat }: LayoutProps) {
  const messages = chat.activeConversation?.messages ?? [];
  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className={styles.frame}>
      <div className={styles.inner}>
        <aside className={styles.board}>
          <div className={styles.sign}>
            <ScrollText size={18} />
            <span>The Keeper's Ledger</span>
          </div>
          <button className={styles.newBtn} onClick={() => chat.createNewConversation()}>
            <Plus size={14} /> New tale
          </button>
          <nav className={styles.tales}>
            {chat.conversations.map((c) => (
              <button
                key={c.id}
                className={`${styles.tale} ${c.id === chat.activeConversationId ? styles.taleActive : ""}`}
                onClick={() => chat.handleSelectConversation(c.id)}
              >
                {c.title}
              </button>
            ))}
          </nav>
        </aside>

        <main className={styles.stall}>
          <header className={styles.keeperBar}>
            <div className={styles.keeperAvatar} aria-hidden="true" />
            <div>
              <div className={styles.keeperName}>The Keeper</div>
              <div className={styles.keeperTag}>Purveyor of Magic lore</div>
            </div>
          </header>

          <div className={styles.slips}>
            {messages.length === 0 && !chat.isLoading && (
              <div className={styles.welcome}>
                <h2>Pull up a stool, traveler</h2>
                <p>Ask the keeper anything about Magic: The Gathering.</p>
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className={styles.patronRow}>
                  <div className={styles.patronSlip}>{m.content}</div>
                </div>
              ) : (
                <div key={m.id} className={styles.keeperRow}>
                  <div className={styles.parchment}>
                    <div className={styles.seal} aria-hidden="true" />
                    <MessageBody content={m.content} />
                    {m.id === lastId && !chat.isLoading && (
                      <button className={styles.redo} onClick={chat.handleRegenerate}>
                        <RefreshCw size={13} /> Ask again
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}
            {chat.isLoading && chat.streamingContent && (
              <div className={styles.keeperRow}>
                <div className={styles.parchment}>
                  <StreamingMessage content={chat.streamingContent} />
                </div>
              </div>
            )}
            {chat.isLoading && !chat.streamingContent && (
              <div className={styles.pouring}>The keeper ponders…</div>
            )}
          </div>

          <div className={styles.quillBar}>
            <ChatInput onSend={chat.handleSendMessage} disabled={chat.isLoading} />
          </div>
        </main>
      </div>
    </div>
  );
}

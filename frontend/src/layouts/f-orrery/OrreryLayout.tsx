import { useEffect, useState } from "react";
import { Plus, RefreshCw, List, X } from "lucide-react";
import type { CSSProperties } from "react";
import { MessageBody } from "../../components/MessageBody";
import { ChatInput } from "../../components/ChatInput";
import { StreamingMessage } from "../../components/StreamingMessage";
import type { Theme } from "../../components/ThemeSelector";
import type { LayoutProps } from "../types";
import styles from "./styles.module.css";

const ORBS: { theme: Theme; label: string; color: string }[] = [
  { theme: "default", label: "Magic", color: "#cc8030" },
  { theme: "white", label: "Plains", color: "#f8f6d8" },
  { theme: "blue", label: "Islands", color: "#1e88e5" },
  { theme: "black", label: "Swamps", color: "#9c27b0" },
  { theme: "red", label: "Mountains", color: "#e53935" },
  { theme: "green", label: "Forests", color: "#43a047" },
];

export function OrreryLayout({ chat }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const messages = chat.activeConversation?.messages ?? [];
  const lastId = messages[messages.length - 1]?.id;

  // Close the drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  return (
    <div className={styles.cosmos}>
      <div className={styles.orbit} aria-hidden="true" />
      <nav className={styles.orbs} aria-label="Mana themes">
        {ORBS.map((o, i) => (
          <button
            key={o.theme}
            className={`${styles.orb} ${chat.theme === o.theme ? styles.orbActive : ""}`}
            style={{ ["--orb"]: o.color, ["--i"]: i } as CSSProperties}
            onClick={() => chat.setTheme(o.theme)}
            title={o.label}
            aria-label={`${o.label} theme`}
          />
        ))}
      </nav>

      <button
        className={styles.drawerToggle}
        onClick={() => setDrawerOpen(true)}
        title="Conversations"
        aria-label="Open conversations"
      >
        <List size={18} />
      </button>

      <div className={styles.leyline}>
        {messages.length === 0 && !chat.isLoading && (
          <div className={styles.coreWelcome}>
            <div className={styles.core} aria-hidden="true" />
            <h2>Attune to the planes</h2>
            <p>Ask anything about Magic: The Gathering.</p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? styles.moteUser : styles.moteBot}
          >
            <div className={m.role === "user" ? styles.userMote : styles.botMote}>
              {m.role === "user" ? m.content : <MessageBody content={m.content} />}
              {m.role === "assistant" && m.id === lastId && !chat.isLoading && (
                <button className={styles.recast} onClick={chat.handleRegenerate}>
                  <RefreshCw size={13} /> Recast
                </button>
              )}
            </div>
          </div>
        ))}
        {chat.isLoading && chat.streamingContent && (
          <div className={styles.moteBot}>
            <div className={styles.botMote}>
              <StreamingMessage content={chat.streamingContent} />
            </div>
          </div>
        )}
        {chat.isLoading && !chat.streamingContent && (
          <div className={styles.channeling}>Channeling mana…</div>
        )}
      </div>

      <div className={styles.inputOrb}>
        <ChatInput onSend={chat.handleSendMessage} disabled={chat.isLoading} />
      </div>

      {drawerOpen && (
        <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)}>
          <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <span>Conversations</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close conversations">
                <X size={16} />
              </button>
            </div>
            <button
              className={styles.newPlane}
              onClick={() => { chat.createNewConversation(); setDrawerOpen(false); }}
            >
              <Plus size={14} /> New plane
            </button>
            {chat.conversations.map((c) => (
              <button
                key={c.id}
                className={`${styles.planeItem} ${c.id === chat.activeConversationId ? styles.planeActive : ""}`}
                onClick={() => { chat.handleSelectConversation(c.id); setDrawerOpen(false); }}
              >
                {c.title}
              </button>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}

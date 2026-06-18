import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Plus, Clock, X, RefreshCw, Sun, Moon } from "lucide-react";
import { MessageBody } from "../../components/MessageBody";
import { StreamingMessage } from "../../components/StreamingMessage";
import { AetherComposer } from "./AetherComposer";
import { accentFor, accentForDark, MANA_DOTS } from "./accent";
import type { LayoutProps } from "../types";
import styles from "./styles.module.css";

const EXAMPLES = [
  "Build a mono-green Commander deck",
  "Explain the stack to me",
  "Is Sol Ring worth it in every deck?",
];

const MODE_KEY = "lotus-aether-mode";
type AetherMode = "light" | "dark";

function loadMode(): AetherMode {
  return localStorage.getItem(MODE_KEY) === "dark" ? "dark" : "light";
}

export function AetherLayout({ chat }: LayoutProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mode, setMode] = useState<AetherMode>(() => loadMode());
  const messages = chat.activeConversation?.messages ?? [];
  const lastId = messages[messages.length - 1]?.id;

  // Suppress the global parchment-noise overlay while Aether is mounted.
  useEffect(() => {
    document.body.classList.add("aether");
    return () => document.body.classList.remove("aether");
  }, []);

  // Close the history panel on Escape.
  useEffect(() => {
    if (!historyOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHistoryOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [historyOpen]);

  const toggleMode = () => {
    setMode((prev) => {
      const next: AetherMode = prev === "dark" ? "light" : "dark";
      localStorage.setItem(MODE_KEY, next);
      return next;
    });
  };

  const accent = mode === "dark" ? accentForDark(chat.theme) : accentFor(chat.theme);
  const rootStyle = { ["--ax"]: accent } as CSSProperties;

  return (
    <div
      className={`${styles.root} ${mode === "dark" ? styles.dark : ""}`}
      style={rootStyle}
    >
      <nav className={styles.rail}>
        <button
          className={styles.railLogo}
          onClick={() => chat.createNewConversation()}
          aria-label="New conversation"
          title="New conversation"
        >
          <span className={styles.railLogoMark} aria-hidden="true" />
        </button>
        <button
          className={styles.railBtn}
          aria-label="History"
          title="History"
          onClick={() => setHistoryOpen(true)}
        >
          <Clock size={18} />
        </button>
      </nav>

      <main className={styles.main}>
        <header className={styles.header}>
          <span className={styles.wordmark}>Lotus</span>
          <div className={styles.headerRight}>
            <div className={styles.manaDots} role="group" aria-label="Mana themes">
              {MANA_DOTS.map((m) => {
                const c = mode === "dark" ? accentForDark(m.theme) : accentFor(m.theme);
                return (
                  <button
                    key={m.theme}
                    className={`${styles.manaDot} ${chat.theme === m.theme ? styles.manaDotActive : ""}`}
                    style={{ background: c, color: c }}
                    onClick={() => chat.setTheme(m.theme)}
                    aria-label={`${m.label} theme`}
                    title={m.label}
                  />
                );
              })}
            </div>
            <span className={styles.divider} aria-hidden="true" />
            <button
              className={styles.modeToggle}
              onClick={toggleMode}
              aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <div className={styles.column}>
          {messages.length === 0 && !chat.isLoading ? (
            <div className={styles.welcome}>
              <h1 className={styles.welcomeTitle}>Ask me anything</h1>
              <p className={styles.welcomeSub}>
                Magic rules, deck building, or paste a list for analysis.
              </p>
              <div className={styles.examples}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    className={styles.exampleChip}
                    onClick={() => chat.handleSendMessage(ex)}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.thread}>
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className={styles.userRow}>
                    <div className={styles.userPill}>{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className={styles.botRow}>
                    <span className={styles.pip} aria-hidden="true" />
                    <div className={styles.botBody}>
                      <div className={styles.text}>
                        <MessageBody content={m.content} />
                      </div>
                      {m.id === lastId && !chat.isLoading && (
                        <button className={styles.ghostBtn} onClick={chat.handleRegenerate}>
                          <RefreshCw size={13} /> Regenerate
                        </button>
                      )}
                    </div>
                  </div>
                ),
              )}
              {chat.isLoading && chat.streamingContent && (
                <div className={styles.botRow}>
                  <span className={styles.pip} aria-hidden="true" />
                  <div className={styles.botBody}>
                    <div className={styles.text}>
                      <StreamingMessage content={chat.streamingContent} />
                    </div>
                  </div>
                </div>
              )}
              {chat.isLoading && !chat.streamingContent && (
                <div className={styles.thinking}>Thinking…</div>
              )}
            </div>
          )}
        </div>

        <div className={styles.composerDock}>
          <AetherComposer onSend={chat.handleSendMessage} disabled={chat.isLoading} />
        </div>
      </main>

      {historyOpen && (
        <div className={styles.panelOverlay} onClick={() => setHistoryOpen(false)}>
          <aside
              className={styles.panel}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="aether-panel-heading"
            >
            <div className={styles.panelHead}>
              <span id="aether-panel-heading">Conversations</span>
              <button
                onClick={() => setHistoryOpen(false)}
                aria-label="Close conversations"
                autoFocus
              >
                <X size={16} />
              </button>
            </div>
            <button
              className={styles.panelNew}
              onClick={() => {
                chat.createNewConversation();
                setHistoryOpen(false);
              }}
            >
              <Plus size={14} /> New conversation
            </button>
            {chat.conversations.map((c) => (
              <button
                key={c.id}
                className={`${styles.panelItem} ${c.id === chat.activeConversationId ? styles.panelItemActive : ""}`}
                onClick={() => {
                  chat.handleSelectConversation(c.id);
                  setHistoryOpen(false);
                }}
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

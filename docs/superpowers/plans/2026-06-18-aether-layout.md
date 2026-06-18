# Aether Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Aether" — a new, light, modern, editorial chat layout (id `g`) that breaks from the brown card-back skin: own light palette, no parchment noise, Fraunces+Inter type, Magic reduced to one mana-driven accent.

**Architecture:** A new self-contained layout under `src/layouts/g-aether/` consuming the existing `ChatController`. It defines its own scoped light palette (does not read global `--bg-*` vars), exposes the active mana accent as a `--ax` custom property, suppresses the global noise overlay via a `body.aether` class while mounted, and reuses the shared `MessageBody`/`StreamingMessage` primitives. A small Aether-native composer replaces `ChatInput` to match the minimal look.

**Tech Stack:** React 19 + TypeScript + Vite, CSS Modules, `lucide-react`, Google Fonts (Fraunces, Inter). Tests: Vitest + React Testing Library (already set up).

---

## Scope notes

- **v1 message actions:** assistant **Regenerate** (last message only). Copy / edit / reactions are deliberately deferred to a polish pass — the goal of v1 is to validate the new aesthetic before investing in secondary controls (the engine still supports them). This is a conscious narrowing of the spec's "minimal hover actions," called out here and in the final self-review.
- Reuses `useChat` unchanged; `classic` stays the default; D/E/F untouched.

## File Structure

```
frontend/
├── index.html                              # MODIFY — add Fraunces + Inter font links
├── src/
│   ├── index.css                           # MODIFY — body.aether::before { content: none }
│   └── layouts/
│       ├── registry.ts                     # MODIFY — LayoutId += "g"; register Aether
│       └── g-aether/
│           ├── accent.ts                   # theme→accent map + MANA_DOTS
│           ├── accent.test.ts
│           ├── AetherComposer.tsx          # minimal autosize composer
│           ├── AetherComposer.test.tsx
│           ├── AetherLayout.tsx            # the layout shell
│           ├── AetherLayout.test.tsx
│           └── styles.module.css           # scoped light palette + all styles
```

---

## Task 1: Accent map (`accent.ts`)

**Files:**
- Create: `frontend/src/layouts/g-aether/accent.ts`
- Create: `frontend/src/layouts/g-aether/accent.test.ts`

- [ ] **Step 1: Write the failing test** — `frontend/src/layouts/g-aether/accent.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { accentFor, MANA_DOTS } from "./accent";

describe("accentFor", () => {
  it("maps each theme to its refined accent", () => {
    expect(accentFor("default")).toBe("#9a7b3d");
    expect(accentFor("white")).toBe("#b08900");
    expect(accentFor("blue")).toBe("#2f6f9e");
    expect(accentFor("black")).toBe("#5d5470");
    expect(accentFor("red")).toBe("#c0504a");
    expect(accentFor("green")).toBe("#2f6f5e");
  });

  it("falls back to the default accent for an unknown theme", () => {
    expect(accentFor("zzz" as never)).toBe("#9a7b3d");
  });
});

describe("MANA_DOTS", () => {
  it("lists all six themes in order with labels", () => {
    expect(MANA_DOTS.map((d) => d.theme)).toEqual([
      "default", "white", "blue", "black", "red", "green",
    ]);
    expect(MANA_DOTS.find((d) => d.theme === "blue")?.label).toBe("Islands");
  });
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd frontend && npx vitest run src/layouts/g-aether/accent.test.ts`
Expected: FAIL — cannot resolve `./accent`.

- [ ] **Step 3: Create `frontend/src/layouts/g-aether/accent.ts`**

```ts
import type { Theme } from "../../components/ThemeSelector";

const ACCENTS: Record<Theme, string> = {
  default: "#9a7b3d",
  white: "#b08900",
  blue: "#2f6f9e",
  black: "#5d5470",
  red: "#c0504a",
  green: "#2f6f5e",
};

export function accentFor(theme: Theme): string {
  return ACCENTS[theme] ?? ACCENTS.default;
}

export const MANA_DOTS: { theme: Theme; label: string }[] = [
  { theme: "default", label: "Magic" },
  { theme: "white", label: "Plains" },
  { theme: "blue", label: "Islands" },
  { theme: "black", label: "Swamps" },
  { theme: "red", label: "Mountains" },
  { theme: "green", label: "Forests" },
];
```

- [ ] **Step 4: Run it, verify PASS**

Run: `cd frontend && npx vitest run src/layouts/g-aether/accent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/g-aether/accent.ts frontend/src/layouts/g-aether/accent.test.ts
git commit -m "feat: add Aether accent map (theme -> refined accent)"
```

---

## Task 2: Fonts + noise-overlay suppression

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add font links to `frontend/index.html`**

Inside `<head>`, after the `<meta name="viewport" .../>` line, add:
```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: Suppress the global noise overlay when Aether is active**

In `frontend/src/index.css`, immediately AFTER the existing `body::before { ... }` block (the noise overlay, ends around line 176), add:
```css
/* Aether layout opts out of the global parchment-noise overlay */
body.aether::before {
    content: none;
}
```

- [ ] **Step 3: Verify build + typecheck unaffected**

Run: `cd frontend && npx tsc -b --noEmit && npm run build`
Expected: tsc clean; build succeeds. (If build fails on an esbuild binary error unrelated to this change, run `npm install` once to restore deps, then rebuild — a known environment quirk.)

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/index.css
git commit -m "feat: load Fraunces+Inter and let body.aether opt out of noise overlay"
```

---

## Task 3: Aether composer

A minimal autosizing composer (the shared `ChatInput`'s char-counter/hint chrome doesn't fit the minimal look).

**Files:**
- Create: `frontend/src/layouts/g-aether/AetherComposer.tsx`
- Create: `frontend/src/layouts/g-aether/AetherComposer.test.tsx`
- Create (partial): `frontend/src/layouts/g-aether/styles.module.css` (composer rules only; the rest is added in Task 4)

- [ ] **Step 1: Write the failing test** — `frontend/src/layouts/g-aether/AetherComposer.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AetherComposer } from "./AetherComposer";

const PLACEHOLDER = "Ask anything, or paste a deck list…";

describe("AetherComposer", () => {
  it("sends trimmed text on Enter and clears", async () => {
    const onSend = vi.fn();
    render(<AetherComposer onSend={onSend} disabled={false} />);
    const box = screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement;
    await userEvent.type(box, "  hello  {enter}");
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(box.value).toBe("");
  });

  it("Shift+Enter inserts a newline and does not send", async () => {
    const onSend = vi.fn();
    render(<AetherComposer onSend={onSend} disabled={false} />);
    const box = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(box, "line{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables the send button while loading", () => {
    render(<AetherComposer onSend={vi.fn()} disabled={true} />);
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd frontend && npx vitest run src/layouts/g-aether/AetherComposer.test.tsx`
Expected: FAIL — cannot resolve `./AetherComposer`.

- [ ] **Step 3: Create `frontend/src/layouts/g-aether/AetherComposer.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import styles from "./styles.module.css";

interface AetherComposerProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function AetherComposer({ onSend, disabled }: AetherComposerProps) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const submit = () => {
    const text = input.trim();
    if (text && !disabled) {
      onSend(text);
      setInput("");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setInput("");
      ref.current?.blur();
    }
  };

  return (
    <div className={styles.composer}>
      <textarea
        ref={ref}
        className={styles.composerInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything, or paste a deck list…"
        rows={1}
        disabled={disabled}
      />
      <button
        className={styles.sendBtn}
        onClick={submit}
        disabled={disabled || !input.trim()}
        aria-label="Send message"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/layouts/g-aether/styles.module.css` with the composer rules (the rest is appended in Task 4)**

```css
.composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: #ffffff;
  border: 0.5px solid #e2dacb;
  border-radius: 16px;
  padding: 10px 12px 10px 16px;
}
.composerInput {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: #1c1a16;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  max-height: 200px;
}
.composerInput::placeholder { color: #a89e8a; }
.sendBtn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  background: var(--ax, #9a7b3d);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
}
.sendBtn:disabled { opacity: 0.4; cursor: default; }
```

- [ ] **Step 5: Run it, verify PASS**

Run: `cd frontend && npx vitest run src/layouts/g-aether/AetherComposer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/layouts/g-aether/AetherComposer.tsx frontend/src/layouts/g-aether/AetherComposer.test.tsx frontend/src/layouts/g-aether/styles.module.css
git commit -m "feat: add Aether composer"
```

---

## Task 4: Aether layout + register

**Files:**
- Create: `frontend/src/layouts/g-aether/AetherLayout.tsx`
- Create: `frontend/src/layouts/g-aether/AetherLayout.test.tsx`
- Modify: `frontend/src/layouts/g-aether/styles.module.css` (append layout rules)
- Modify: `frontend/src/layouts/registry.ts`

- [ ] **Step 1: Create `frontend/src/layouts/g-aether/AetherLayout.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Plus, Search, Clock, X, RefreshCw } from "lucide-react";
import { MessageBody } from "../../components/MessageBody";
import { StreamingMessage } from "../../components/StreamingMessage";
import { AetherComposer } from "./AetherComposer";
import { accentFor, MANA_DOTS } from "./accent";
import type { LayoutProps } from "../types";
import styles from "./styles.module.css";

const EXAMPLES = [
  "Build a mono-green Commander deck",
  "Explain the stack to me",
  "Is Sol Ring worth it in every deck?",
];

export function AetherLayout({ chat }: LayoutProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
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

  const rootStyle = { ["--ax"]: accentFor(chat.theme) } as CSSProperties;

  return (
    <div className={styles.root} style={rootStyle}>
      <nav className={styles.rail}>
        <button
          className={styles.railLogo}
          onClick={() => chat.createNewConversation()}
          aria-label="New conversation"
          title="New conversation"
        >
          ✦
        </button>
        <button
          className={styles.railBtn}
          aria-label="Search"
          title="Search"
          onClick={() => setHistoryOpen(true)}
        >
          <Search size={18} />
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
          <div className={styles.manaDots} role="group" aria-label="Mana themes">
            {MANA_DOTS.map((m) => {
              const c = accentFor(m.theme);
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
          <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.panelHead}>
              <span>Conversations</span>
              <button onClick={() => setHistoryOpen(false)} aria-label="Close conversations">
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
```

- [ ] **Step 2: Append layout rules to `frontend/src/layouts/g-aether/styles.module.css`**

Append AFTER the composer rules created in Task 3:
```css
.root {
  position: relative;
  display: flex;
  height: 100vh;
  width: 100%;
  background: #f6f3ec;
  color: #1c1a16;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
}

.rail {
  width: 56px;
  flex-shrink: 0;
  background: #efe9dd;
  border-right: 0.5px solid #e2dacb;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0;
  gap: 14px;
}
.railLogo {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: #1c1a16;
  color: #f6f3ec;
  border: none;
  cursor: pointer;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.railBtn {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: transparent;
  color: #a89e8a;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.railBtn:hover { background: #ffffff; color: #1c1a16; }

.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 26px;
  border-bottom: 0.5px solid #e7e0d1;
}
.wordmark {
  font-family: "Fraunces", Georgia, serif;
  font-size: 19px;
  font-weight: 600;
  color: #1c1a16;
  letter-spacing: 0.01em;
}
.manaDots { display: flex; gap: 8px; }
.manaDot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  padding: 0;
  opacity: 0.55;
  transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
}
.manaDot:hover { opacity: 1; transform: scale(1.1); }
.manaDotActive {
  opacity: 1;
  box-shadow: 0 0 0 2px #f6f3ec, 0 0 0 3px currentColor;
}

.column { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }

.thread {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.userRow { display: flex; justify-content: flex-end; }
.userPill {
  background: #1c1a16;
  color: #f6f3ec;
  font-size: 15px;
  line-height: 1.6;
  padding: 10px 16px;
  border-radius: 16px 16px 4px 16px;
  max-width: 75%;
  white-space: pre-wrap;
  word-break: break-word;
}

.botRow { display: flex; gap: 14px; }
.pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ax, #9a7b3d);
  margin-top: 9px;
  flex-shrink: 0;
}
.botBody { min-width: 0; flex: 1; }
.text { font-size: 15px; line-height: 1.75; color: #2a2620; }
.text p { margin: 0 0 0.85em; }
.text p:last-child { margin-bottom: 0; }
.text h1, .text h2, .text h3 {
  font-family: "Fraunces", Georgia, serif;
  color: #1c1a16;
  margin: 1.2em 0 0.5em;
  line-height: 1.3;
}
.text ul, .text ol { margin: 0 0 0.85em; padding-left: 1.3em; }
.text li { margin: 0.2em 0; }
.text code {
  background: #efe9dd;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.text pre {
  background: #efe9dd;
  padding: 12px 14px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0 0 0.85em;
}
.text a { color: var(--ax, #9a7b3d); }
/* card links: CardTooltip renders <span><strong>name</strong></span> */
.text span > strong {
  font-weight: 500;
  color: #1c1a16;
  border-bottom: 1.5px solid var(--ax, #9a7b3d);
  cursor: pointer;
}

.ghostBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 5px 10px;
  background: transparent;
  color: #a89e8a;
  border: 0.5px solid #e2dacb;
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.botRow:hover .ghostBtn { opacity: 1; }
.ghostBtn:hover { color: #1c1a16; border-color: var(--ax, #9a7b3d); }

.thinking { color: #a89e8a; font-size: 14px; padding-left: 22px; }

.composerDock {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 12px 24px 22px;
}

.welcome { margin: auto; max-width: 560px; text-align: center; padding: 24px; }
.welcomeTitle {
  font-family: "Fraunces", Georgia, serif;
  font-weight: 600;
  font-size: 32px;
  color: #1c1a16;
  margin: 0 0 10px;
}
.welcomeSub { color: #a89e8a; font-size: 15px; margin: 0 0 22px; }
.examples { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.exampleChip {
  background: #ffffff;
  border: 0.5px solid #e2dacb;
  border-radius: 999px;
  padding: 8px 16px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  color: #2a2620;
}
.exampleChip:hover { border-color: var(--ax, #9a7b3d); color: #1c1a16; }

.panelOverlay { position: absolute; inset: 0; background: rgba(28, 26, 22, 0.28); z-index: 20; }
.panel {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 300px;
  background: #f6f3ec;
  border-right: 0.5px solid #e2dacb;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}
.panelHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: "Fraunces", Georgia, serif;
  font-size: 16px;
  color: #1c1a16;
  margin-bottom: 4px;
}
.panelHead button { background: none; border: none; color: #a89e8a; cursor: pointer; }
.panelNew {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  background: #1c1a16;
  color: #f6f3ec;
  border: none;
  border-radius: 10px;
  padding: 9px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}
.panelItem {
  text-align: left;
  background: transparent;
  color: #2a2620;
  border: 0.5px solid transparent;
  border-radius: 8px;
  padding: 9px 11px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panelItem:hover { background: #ffffff; }
.panelItemActive { background: #ffffff; border-color: var(--ax, #9a7b3d); color: #1c1a16; }

@media (max-width: 640px) {
  .rail { width: 48px; }
  .thread, .composerDock { padding-left: 16px; padding-right: 16px; }
  .userPill { max-width: 85%; }
}
```

- [ ] **Step 3: Register Aether in `frontend/src/layouts/registry.ts`**

- Extend the union: change `export type LayoutId = "classic" | "d" | "e" | "f";` to
  `export type LayoutId = "classic" | "d" | "e" | "f" | "g";`
- Add import near the other layout imports: `import { AetherLayout } from "./g-aether/AetherLayout";`
- Append to the `LAYOUTS` array (after the `f` entry):
  ```tsx
  { id: "g", name: "Aether", component: AetherLayout },
  ```
(`LAYOUT_IDS` is derived from `LAYOUTS`, so no separate edit.)

- [ ] **Step 4: Write the smoke test** — `frontend/src/layouts/g-aether/AetherLayout.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AetherLayout } from "./AetherLayout";
import { makeChatStub } from "../../test/chatStub";

const PLACEHOLDER = "Ask anything, or paste a deck list…";

describe("AetherLayout", () => {
  it("renders assistant text and the user message", () => {
    render(<AetherLayout chat={makeChatStub()} />);
    expect(screen.getByText("Hi")).toBeInTheDocument();
    // CardTooltip renders the [[Black Lotus]] token as visible text
    expect(screen.getByText("Black Lotus")).toBeInTheDocument();
  });

  it("a mana dot switches the theme", async () => {
    const chat = makeChatStub();
    render(<AetherLayout chat={chat} />);
    await userEvent.click(screen.getByLabelText("Islands theme"));
    expect(chat.setTheme).toHaveBeenCalledWith("blue");
  });

  it("sends from the composer", async () => {
    const chat = makeChatStub();
    render(<AetherLayout chat={chat} />);
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), "Cast it{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Cast it");
  });

  it("opens history and selects a conversation", async () => {
    const chat = makeChatStub();
    render(<AetherLayout chat={chat} />);
    await userEvent.click(screen.getByLabelText("History"));
    await userEvent.click(screen.getByText("Test chat"));
    expect(chat.handleSelectConversation).toHaveBeenCalledWith("c1");
  });

  it("toggles the body.aether class on mount/unmount", () => {
    const { unmount } = render(<AetherLayout chat={makeChatStub()} />);
    expect(document.body.classList.contains("aether")).toBe(true);
    unmount();
    expect(document.body.classList.contains("aether")).toBe(false);
  });
});
```

- [ ] **Step 5: Verify**

Run, from `frontend/`:
- `npx vitest run src/layouts/g-aether` → all pass (accent 3 + composer 3 + layout 5 = 11)
- `npx tsc -b --noEmit` → clean
- `npm test` → all pass
- `npm run build` → success

- [ ] **Step 6: Commit**

```bash
git add frontend/src/layouts/g-aether/AetherLayout.tsx frontend/src/layouts/g-aether/AetherLayout.test.tsx frontend/src/layouts/g-aether/styles.module.css frontend/src/layouts/registry.ts
git commit -m "feat: add layout G — Aether (light editorial redesign)"
```

---

## Task 5: Integration + visual verification

- [ ] **Step 1: Full suite + typecheck + build**

Run: `cd frontend && npm test && npx tsc -b --noEmit && npm run build`
Expected: all tests pass; tsc clean; build succeeds.

- [ ] **Step 2: Confirm no NEW lint problems**

Run: `cd frontend && npm run lint`
Expected: no new errors in `src/layouts/g-aether/**`, `index.css`, or `registry.ts`. (Pre-existing `ChatArea.tsx` and `useChat.ts` warnings are known/accepted — do not fix here.)

- [ ] **Step 3: Visual verification loop** (`?layout=g`)

Run `npm run dev`; with the backend reachable (the dev `.env.local` points at the deployed Lambda), open `http://localhost:5173/?layout=g`. Verify and iterate `styles.module.css` until ALL hold:
  - [ ] Light, airy, paper-white — NO brown, NO parchment noise grain anywhere.
  - [ ] Fraunces wordmark/headings + Inter body actually load (not fallback serif/sans).
  - [ ] Assistant replies are mana-pip + plain ink text (no bubble); user messages are dark pills.
  - [ ] `[[card]]` tokens render as an accent underline and still show the hover tooltip.
  - [ ] Each header mana dot recolors the single accent (pip, send button, underline, active ring) while surfaces stay light; active dot is ringed.
  - [ ] History panel opens (search/history/✦), lists conversations, selects/creates, closes on backdrop + Escape.
  - [ ] Streaming renders in the ink-text treatment; "Thinking…" shows before content.
  - [ ] Switch to `?layout=g` while `data-theme` was a dark theme (e.g. set `localStorage.lotus-theme="black"` first): the layout is still fully light with no dark edges.
  - [ ] Switch AWAY to `?layout=classic`: the global parchment noise texture RETURNS (confirms `body.aether` cleanup).
  - [ ] Mobile width (~390px): rail/column/composer usable, no horizontal overflow.

- [ ] **Step 4: Update `CLAUDE.md` Layout Variants note (local file, gitignored — apply but it won't commit)**

Add `g` to the layout list under "Layout Variants":
`- g — Aether (light editorial redesign; mana = single accent, no parchment texture)`
(If `git add` reports it's ignored, that's expected — leave it applied locally.)

- [ ] **Step 5: Use `superpowers:requesting-code-review`** before opening a PR / finishing the branch.

---

## Self-Review notes (author)

- **Spec coverage:** own light palette (Task 4 `.root` + hardcoded tokens) ✓; suppress noise via `body.aether` (Task 2 + mount effect Task 4) ✓; mana = single `--ax` accent via `accentFor` (Tasks 1, 4) ✓; Fraunces+Inter (Task 2 + CSS) ✓; slim rail + centered column + header dots + history panel (Task 4) ✓; editorial messages (assistant pip+text, user pill) + card-link accent underline (Task 4 CSS `span > strong`) ✓; Aether-native composer (Task 3) ✓; empty/welcome with example chips (Task 4) ✓; registered id `g`, reachable `?layout=g` (Task 4) ✓; reuse useChat/MessageBody/StreamingMessage ✓; tests for accent + layout incl. theme-switch, send, history, body-class toggle ✓; verification incl. dark-theme-underneath + noise-returns checks ✓.
- **Deliberate spec narrowing:** v1 ships **Regenerate** only; Copy/Edit/reactions deferred to a polish pass (flagged in Scope notes) — validate the aesthetic before building secondary controls. Not a gap; a YAGNI decision pending user approval of the look.
- **Type consistency:** `accentFor(theme: Theme): string` and `MANA_DOTS: {theme: Theme; label: string}[]` defined in Task 1 and consumed identically in Task 4; `--ax` set on root (Task 4) and consumed in composer (Task 3 CSS) + layout CSS; `LayoutProps`/`ChatController` contract unchanged; registry `LayoutId` extended to include `"g"` before use.
- **Card-link styling** relies on the structural `span > strong` selector (CardTooltip's DOM) — no change to the shared component; noted as slightly implicit in the spec's risks.

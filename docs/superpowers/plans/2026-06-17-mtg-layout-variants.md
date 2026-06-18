# MTG Layout Variants (D–F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three fully-polished, themed chat layouts (D · Hand of cards, E · Tavern keeper's stall, F · Mana orrery) to the Lotus MTG chatbot, selectable via a dev-only switcher, all sharing one extracted chat engine; the current layout stays the default.

**Architecture:** Extract all stateful chat logic from `App.tsx` into a `useChat()` hook. Extract the duplicated `[[card]]` markdown rendering into a shared `MessageBody` primitive. Add a layout registry + `useLayoutSelection` hook (URL `?layout=` param + `Ctrl+Shift+L` cycle + `localStorage`). `App` becomes a thin shell that renders the selected layout, passing it the `chat` object. The existing UI moves to `layouts/classic/` unchanged in behavior; layouts D/E/F are new shells over the same engine.

**Tech Stack:** React 19 + TypeScript + Vite, CSS Modules, `react-markdown`, `lucide-react`. Tests: Vitest + React Testing Library + jsdom (added in Task 1).

---

## Testing Approach (read first)

- **Logic is TDD'd:** card-link parsing (Task 2), `useChat` behaviors (Task 3), layout selection (Task 5). Write the failing test, watch it fail, implement, watch it pass.
- **Layouts get smoke tests + visual verification:** each layout has a render smoke test (mounts, shows a message, input calls the handler) AND a manual visual-verification loop — run the dev server, open `?layout=<id>`, and check the layout against explicit acceptance criteria listed in its task, iterating CSS until met. Visual polish cannot be asserted by a unit test; the criteria list is the gate.
- **Backend not required for most tests.** The dev server can run without the Lambda; sending a real message needs the backend (`cd backend/chat && uvicorn index:app --port 8000`), but layout structure/streaming can be verified by injecting `chat` state in tests and by the seeded-conversation helper (Task 6).

## File Structure

```
frontend/
├── vitest.config.ts                  # NEW — test config (jsdom)
├── src/
│   ├── test/setup.ts                 # NEW — RTL/jest-dom setup
│   ├── lib/
│   │   └── cardLinks.tsx             # NEW — shared [[card]] parsing (extracted)
│   ├── components/
│   │   ├── MessageBody.tsx           # NEW — shared markdown+cardlink renderer
│   │   ├── ChatMessage.tsx           # MODIFY — use cardLinks lib
│   │   └── StreamingMessage.tsx      # MODIFY — use cardLinks lib
│   ├── hooks/
│   │   └── useChat.ts                # NEW — extracted engine
│   ├── layouts/
│   │   ├── registry.ts              # NEW — id → {name, component}
│   │   ├── useLayoutSelection.ts    # NEW — URL param + shortcut + storage
│   │   ├── types.ts                 # NEW — LayoutProps (the chat object shape)
│   │   ├── classic/ClassicLayout.tsx # NEW — existing UI, moved
│   │   ├── d-cards/CardsLayout.tsx + styles.module.css
│   │   ├── e-tavern/TavernLayout.tsx + styles.module.css
│   │   └── f-orrery/OrreryLayout.tsx + styles.module.css
│   └── App.tsx                       # MODIFY — thin shell
```

`useChat` returns a `ChatController` object; `LayoutProps = { chat: ChatController }`. Every layout receives exactly this.

---

## Task 1: Add test tooling

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
cd frontend && npm install -D vitest@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```
Expected: packages added to `devDependencies`, no errors.

- [ ] **Step 2: Create `frontend/vitest.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

- [ ] **Step 3: Create `frontend/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test scripts to `frontend/package.json`**

In the `"scripts"` object add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Add a trivial sanity test to confirm wiring**

Create `frontend/src/test/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npm test`
Expected: 1 passing test, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/test/setup.ts frontend/src/test/sanity.test.ts
git commit -m "test: add vitest + react testing library harness"
```

---

## Task 2: Extract shared `[[card]]` parsing (DRY)

The identical `parseCardLinks` / `parseCardLinksInChildren` functions live in both `ChatMessage.tsx` and `StreamingMessage.tsx`. Extract them once.

**Files:**
- Create: `frontend/src/lib/cardLinks.tsx`
- Create: `frontend/src/lib/cardLinks.test.tsx`
- Create: `frontend/src/components/MessageBody.tsx`
- Modify: `frontend/src/components/ChatMessage.tsx`
- Modify: `frontend/src/components/StreamingMessage.tsx`

- [ ] **Step 1: Write the failing test** — `frontend/src/lib/cardLinks.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseCardLinks } from "./cardLinks";

describe("parseCardLinks", () => {
  it("returns plain text unchanged when no card syntax present", () => {
    const parts = parseCardLinks("just text");
    render(<>{parts}</>);
    expect(screen.getByText("just text")).toBeInTheDocument();
  });

  it("renders a CardTooltip for [[card name]] tokens", () => {
    const parts = parseCardLinks("play [[Black Lotus]] now");
    render(<div>{parts}</div>);
    // CardTooltip renders the card name as visible text
    expect(screen.getByText("Black Lotus")).toBeInTheDocument();
    expect(screen.getByText(/play/)).toBeInTheDocument();
    expect(screen.getByText(/now/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/cardLinks.test.tsx`
Expected: FAIL — cannot resolve `./cardLinks`.

- [ ] **Step 3: Create `frontend/src/lib/cardLinks.tsx`**

Move the two functions verbatim from `ChatMessage.tsx` (lines 18–63) into this file and export them:

```tsx
import React from "react";
import type { ReactNode } from "react";
import { CardTooltip } from "../components/CardTooltip";

// Convert [[card name]] syntax to CardTooltip components
export function parseCardLinks(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(<CardTooltip key={match.index} cardName={match[1]} />);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

// Recursively process children to find and replace [[card name]] in text
export function parseCardLinksInChildren(children: ReactNode): ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      if (child.includes("[[")) {
        return <>{parseCardLinks(child)}</>;
      }
      return child;
    }
    if (
      React.isValidElement<{ children?: ReactNode }>(child) &&
      child.props.children
    ) {
      return React.cloneElement(child, {
        children: parseCardLinksInChildren(child.props.children),
      });
    }
    return child;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/cardLinks.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Create shared `frontend/src/components/MessageBody.tsx`**

This is the reusable assistant-markdown renderer (used by ChatMessage, StreamingMessage, and all new layouts):

```tsx
import ReactMarkdown from "react-markdown";
import { parseCardLinksInChildren } from "../lib/cardLinks";

interface MessageBodyProps {
  content: string;
}

export function MessageBody({ content }: MessageBodyProps) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p>{parseCardLinksInChildren(children)}</p>,
        li: ({ children }) => <li>{parseCardLinksInChildren(children)}</li>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 6: Update `ChatMessage.tsx` to use the shared code**

- Delete the local `parseCardLinks` and `parseCardLinksInChildren` functions (lines 18–63).
- Remove now-unused imports (`React` stays if still used elsewhere — it is, for `React.KeyboardEvent`; keep `ReactNode` only if still referenced — it is not after removal, so drop it).
- Replace the assistant `<ReactMarkdown>...</ReactMarkdown>` block (lines 241–253) with `<MessageBody content={message.content} />`.
- Add import: `import { MessageBody } from "./MessageBody";`
- Remove the now-unused `import ReactMarkdown from "react-markdown";` and `import { CardTooltip } from "./CardTooltip";` if no longer referenced in this file.

- [ ] **Step 7: Update `StreamingMessage.tsx` to use the shared code**

- Delete its local `parseCardLinks`/`parseCardLinksInChildren` (the duplicates).
- Replace its `<ReactMarkdown>` usage with `<MessageBody content={content} />` (keep its existing wrapper/styles).
- Remove now-unused `react-markdown` and `CardTooltip` imports.

- [ ] **Step 8: Typecheck + build + full test run**

Run: `cd frontend && npx tsc -b --noEmit && npm test`
Expected: no TS errors; all tests pass.

- [ ] **Step 9: Visual sanity (manual)**

Run: `cd frontend && npm run dev`, open the app, confirm an assistant message with markdown and a `[[card]]` token still renders identically (tooltip works). Stop the server.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/lib frontend/src/components/MessageBody.tsx frontend/src/components/ChatMessage.tsx frontend/src/components/StreamingMessage.tsx
git commit -m "refactor: extract shared [[card]] parsing into cardLinks + MessageBody"
```

---

## Task 3: Extract `useChat` engine

Move every piece of state + handler out of `App.tsx` into `frontend/src/hooks/useChat.ts`, returning a single `ChatController`. `App.tsx` will be rewired in Task 4; for this task `App` keeps rendering the same JSX but sources everything from the hook.

**Files:**
- Create: `frontend/src/hooks/useChat.ts`
- Create: `frontend/src/hooks/useChat.test.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Define the controller type + write the hook**

Create `frontend/src/hooks/useChat.ts`. Move, verbatim, from `App.tsx`: the constants (`STORAGE_KEY`, `ACTIVE_CHAT_KEY`, `THEME_KEY`), helpers (`generateId`, `loadConversations`, `loadActiveConversationId`, `saveConversations`, `saveActiveConversationId`, `loadTheme`, `saveTheme`), and all hook state/effects/callbacks (lines 96–540 of current `App.tsx`). Export a hook returning the controller:

```ts
import { useState, useCallback, useEffect, useRef } from "react";
import { type Theme } from "../components/ThemeSelector";
import { sendMessageStream } from "../api";
import type { Conversation, Message } from "../types";

// ... (moved constants + helper functions verbatim) ...

export interface ChatController {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | undefined;
  isLoading: boolean;
  streamingContent: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  deleteConfirmId: string | null;
  theme: Theme;
  setTheme: (t: Theme) => void;
  createNewConversation: () => string;
  handleDeleteRequest: (id: string) => void;
  handleDeleteConfirm: () => void;
  handleDeleteCancel: () => void;
  handleSelectConversation: (id: string) => void;
  handleRenameConversation: (id: string, newTitle: string) => void;
  handleReaction: (messageId: string, reaction: "up" | "down" | null) => void;
  handleSendMessage: (content: string) => Promise<void>;
  handleRegenerate: () => Promise<void>;
  handleEditMessage: (messageId: string, newContent: string) => Promise<void>;
}

export function useChat(): ChatController {
  // ... all the state, effects, and callbacks moved from App.tsx ...
  // (createNewConversation, handleDelete*, handleSelectConversation,
  //  handleRenameConversation, handleReaction, sendMessageToAPI,
  //  handleSendMessage, handleRegenerate, handleEditMessage,
  //  plus the theme/favicon/keyboard effects)

  return {
    conversations,
    activeConversationId,
    activeConversation,
    isLoading,
    streamingContent,
    sidebarOpen,
    setSidebarOpen,
    deleteConfirmId,
    theme,
    setTheme,
    createNewConversation,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleSelectConversation,
    handleRenameConversation,
    handleReaction,
    handleSendMessage,
    handleRegenerate,
    handleEditMessage,
  };
}
```

Note: the Ctrl/Cmd+N keyboard effect references `createNewConversation` and `setSidebarOpen` — keep it inside the hook. Preserve the existing (empty) dependency array exactly as in `App.tsx` to avoid behavior changes.

- [ ] **Step 2: Write the failing test** — `frontend/src/hooks/useChat.test.tsx`

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChat } from "./useChat";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useChat", () => {
  it("starts with no conversations and default theme", () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.conversations).toEqual([]);
    expect(result.current.theme).toBe("default");
    expect(result.current.activeConversationId).toBeNull();
  });

  it("creates a new conversation and makes it active", () => {
    const { result } = renderHook(() => useChat());
    act(() => {
      result.current.createNewConversation();
    });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeConversationId).toBe(
      result.current.conversations[0].id,
    );
  });

  it("persists theme changes to localStorage", () => {
    const { result } = renderHook(() => useChat());
    act(() => {
      result.current.setTheme("blue");
    });
    expect(localStorage.getItem("lotus-theme")).toBe("blue");
  });

  it("delete request → confirm removes the conversation", () => {
    const { result } = renderHook(() => useChat());
    let id = "";
    act(() => {
      id = result.current.createNewConversation();
    });
    act(() => {
      result.current.handleDeleteRequest(id);
    });
    expect(result.current.deleteConfirmId).toBe(id);
    act(() => {
      result.current.handleDeleteConfirm();
    });
    expect(result.current.conversations).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `cd frontend && npx vitest run src/hooks/useChat.test.tsx`
Expected first run (if hook not yet complete): FAIL. After Step 1 is complete: PASS (4 tests).

- [ ] **Step 4: Rewire `App.tsx` to consume the hook (temporary, behavior-identical)**

Replace the body of `App` with:
```tsx
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { useChat } from "./hooks/useChat";
import "./App.css";

function App() {
  const chat = useChat();
  return (
    <div className="app">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeConversationId}
        onSelect={chat.handleSelectConversation}
        onNew={chat.createNewConversation}
        onDelete={chat.handleDeleteRequest}
        onRename={chat.handleRenameConversation}
        isOpen={chat.sidebarOpen}
        onClose={() => chat.setSidebarOpen(false)}
        theme={chat.theme}
        onThemeChange={chat.setTheme}
      />
      <ChatArea
        messages={chat.activeConversation?.messages || []}
        isLoading={chat.isLoading}
        streamingContent={chat.streamingContent}
        onSendMessage={chat.handleSendMessage}
        onMenuClick={() => chat.setSidebarOpen(true)}
        hasConversations={chat.conversations.length > 0}
        onNewChat={chat.createNewConversation}
        onRegenerate={chat.handleRegenerate}
        onReaction={chat.handleReaction}
        onEditMessage={chat.handleEditMessage}
      />
      {chat.deleteConfirmId && (
        <div className="modal-overlay" onClick={chat.handleDeleteCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete conversation?</h3>
            <p>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={chat.handleDeleteCancel}>
                Cancel
              </button>
              <button className="modal-confirm" onClick={chat.handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
```

- [ ] **Step 5: Typecheck, build, test**

Run: `cd frontend && npx tsc -b --noEmit && npm test && npm run build`
Expected: no errors; all tests pass; build succeeds.

- [ ] **Step 6: Manual parity check**

Run `npm run dev`. With the backend running (`cd backend/chat && uvicorn index:app --port 8000`), verify: send a message + streaming, regenerate, edit a user message, new chat (Ctrl+N), rename, delete (modal), theme switch + favicon tint, reload persistence. All identical to before. Stop servers.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useChat.ts frontend/src/hooks/useChat.test.tsx frontend/src/App.tsx
git commit -m "refactor: extract chat engine into useChat hook"
```

---

## Task 4: Move existing UI into `layouts/classic`

**Files:**
- Create: `frontend/src/layouts/types.ts`
- Create: `frontend/src/layouts/classic/ClassicLayout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/layouts/types.ts`**

```tsx
import type { ChatController } from "../hooks/useChat";

export interface LayoutProps {
  chat: ChatController;
}
```

- [ ] **Step 2: Create `frontend/src/layouts/classic/ClassicLayout.tsx`**

Move the JSX from `App.tsx` (the `<div className="app">…</div>` tree) into this component, reading from `chat`:

```tsx
import { Sidebar } from "../../components/Sidebar";
import { ChatArea } from "../../components/ChatArea";
import type { LayoutProps } from "../types";
import "../../App.css";

export function ClassicLayout({ chat }: LayoutProps) {
  return (
    <div className="app">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeConversationId}
        onSelect={chat.handleSelectConversation}
        onNew={chat.createNewConversation}
        onDelete={chat.handleDeleteRequest}
        onRename={chat.handleRenameConversation}
        isOpen={chat.sidebarOpen}
        onClose={() => chat.setSidebarOpen(false)}
        theme={chat.theme}
        onThemeChange={chat.setTheme}
      />
      <ChatArea
        messages={chat.activeConversation?.messages || []}
        isLoading={chat.isLoading}
        streamingContent={chat.streamingContent}
        onSendMessage={chat.handleSendMessage}
        onMenuClick={() => chat.setSidebarOpen(true)}
        hasConversations={chat.conversations.length > 0}
        onNewChat={chat.createNewConversation}
        onRegenerate={chat.handleRegenerate}
        onReaction={chat.handleReaction}
        onEditMessage={chat.handleEditMessage}
      />
      {chat.deleteConfirmId && (
        <div className="modal-overlay" onClick={chat.handleDeleteCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete conversation?</h3>
            <p>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={chat.handleDeleteCancel}>
                Cancel
              </button>
              <button className="modal-confirm" onClick={chat.handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Temporarily render ClassicLayout from App**

```tsx
import { useChat } from "./hooks/useChat";
import { ClassicLayout } from "./layouts/classic/ClassicLayout";

function App() {
  const chat = useChat();
  return <ClassicLayout chat={chat} />;
}

export default App;
```

- [ ] **Step 4: Typecheck, build, test**

Run: `cd frontend && npx tsc -b --noEmit && npm test && npm run build`
Expected: no errors; tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/types.ts frontend/src/layouts/classic/ClassicLayout.tsx frontend/src/App.tsx
git commit -m "refactor: move existing UI into layouts/classic"
```

---

## Task 5: Layout registry + dev-only switcher

**Files:**
- Create: `frontend/src/layouts/registry.ts`
- Create: `frontend/src/layouts/useLayoutSelection.ts`
- Create: `frontend/src/layouts/useLayoutSelection.test.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/layouts/registry.ts`**

```tsx
import type { ComponentType } from "react";
import type { LayoutProps } from "./types";
import { ClassicLayout } from "./classic/ClassicLayout";

export type LayoutId = "classic" | "d" | "e" | "f";

export interface LayoutEntry {
  id: LayoutId;
  name: string;
  component: ComponentType<LayoutProps>;
}

// D/E/F are appended in their respective tasks.
export const LAYOUTS: LayoutEntry[] = [
  { id: "classic", name: "Classic", component: ClassicLayout },
];

export const DEFAULT_LAYOUT: LayoutId = "classic";

export function getLayout(id: string | null): LayoutEntry {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
```

- [ ] **Step 2: Write the failing test** — `frontend/src/layouts/useLayoutSelection.test.tsx`

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayoutSelection } from "./useLayoutSelection";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("useLayoutSelection", () => {
  it("defaults to classic", () => {
    const { result } = renderHook(() => useLayoutSelection());
    expect(result.current.layoutId).toBe("classic");
  });

  it("reads ?layout= from the URL", () => {
    window.history.replaceState({}, "", "/?layout=d");
    const { result } = renderHook(() => useLayoutSelection());
    expect(result.current.layoutId).toBe("d");
  });

  it("falls back to classic for an unknown id", () => {
    window.history.replaceState({}, "", "/?layout=zzz");
    const { result } = renderHook(() => useLayoutSelection());
    expect(result.current.layoutId).toBe("classic");
  });

  it("cycle() advances and persists to localStorage", () => {
    const { result } = renderHook(() => useLayoutSelection());
    act(() => result.current.cycle());
    expect(localStorage.getItem("lotus-layout")).toBe(result.current.layoutId);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/layouts/useLayoutSelection.test.tsx`
Expected: FAIL — cannot resolve `./useLayoutSelection`.

- [ ] **Step 4: Create `frontend/src/layouts/useLayoutSelection.ts`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { LAYOUTS, DEFAULT_LAYOUT, getLayout, type LayoutId } from "./registry";

const LAYOUT_KEY = "lotus-layout";

function resolveInitial(): LayoutId {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("layout");
  if (fromUrl && LAYOUTS.some((l) => l.id === fromUrl)) {
    return fromUrl as LayoutId;
  }
  const fromStorage = localStorage.getItem(LAYOUT_KEY);
  if (fromStorage && LAYOUTS.some((l) => l.id === fromStorage)) {
    return fromStorage as LayoutId;
  }
  return DEFAULT_LAYOUT;
}

export function useLayoutSelection() {
  const [layoutId, setLayoutId] = useState<LayoutId>(() => resolveInitial());

  const select = useCallback((id: LayoutId) => {
    setLayoutId(id);
    localStorage.setItem(LAYOUT_KEY, id);
    const url = new URL(window.location.href);
    url.searchParams.set("layout", id);
    window.history.replaceState({}, "", url);
  }, []);

  const cycle = useCallback(() => {
    setLayoutId((current) => {
      const idx = LAYOUTS.findIndex((l) => l.id === current);
      const next = LAYOUTS[(idx + 1) % LAYOUTS.length].id;
      localStorage.setItem(LAYOUT_KEY, next);
      const url = new URL(window.location.href);
      url.searchParams.set("layout", next);
      window.history.replaceState({}, "", url);
      return next;
    });
  }, []);

  // Ctrl+Shift+L cycles layouts (dev-only switcher)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        cycle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  return { layoutId, entry: getLayout(layoutId), select, cycle };
}
```

Note the import on the first line uses `useCallback`, `useEffect`, `useState` — ensure it reads `import { useCallback, useEffect, useState } from "react";` (fix the casing typo if copying).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/layouts/useLayoutSelection.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire `App.tsx` to render the selected layout**

```tsx
import { useChat } from "./hooks/useChat";
import { useLayoutSelection } from "./layouts/useLayoutSelection";

function App() {
  const chat = useChat();
  const { entry } = useLayoutSelection();
  const Layout = entry.component;
  return <Layout chat={chat} />;
}

export default App;
```

- [ ] **Step 7: Typecheck, build, full test run**

Run: `cd frontend && npx tsc -b --noEmit && npm test && npm run build`
Expected: all green.

- [ ] **Step 8: Manual check**

`npm run dev`; default loads Classic; `?layout=zzz` still loads Classic; press `Ctrl+Shift+L` — with only Classic registered it stays Classic (no crash). Stop server.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/layouts/registry.ts frontend/src/layouts/useLayoutSelection.ts frontend/src/layouts/useLayoutSelection.test.tsx frontend/src/App.tsx
git commit -m "feat: add layout registry + dev-only layout switcher"
```

---

## Task 6: Shared layout test helper + smoke-test pattern

A reusable helper that builds a `ChatController` stub so each layout can be smoke-tested without the backend.

**Files:**
- Create: `frontend/src/test/chatStub.ts`

- [ ] **Step 1: Create `frontend/src/test/chatStub.ts`**

```ts
import { vi } from "vitest";
import type { ChatController } from "../hooks/useChat";
import type { Conversation } from "../types";

export function makeConversation(partial: Partial<Conversation> = {}): Conversation {
  const now = new Date();
  return {
    id: "c1",
    title: "Test chat",
    messages: [
      { id: "m1", role: "user", content: "Hi", timestamp: now },
      { id: "m2", role: "assistant", content: "Hello, [[Black Lotus]]!", timestamp: now },
    ],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function makeChatStub(overrides: Partial<ChatController> = {}): ChatController {
  const conversation = makeConversation();
  return {
    conversations: [conversation],
    activeConversationId: conversation.id,
    activeConversation: conversation,
    isLoading: false,
    streamingContent: "",
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    deleteConfirmId: null,
    theme: "default",
    setTheme: vi.fn(),
    createNewConversation: vi.fn(() => "new"),
    handleDeleteRequest: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    handleDeleteCancel: vi.fn(),
    handleSelectConversation: vi.fn(),
    handleRenameConversation: vi.fn(),
    handleReaction: vi.fn(),
    handleSendMessage: vi.fn(async () => {}),
    handleRegenerate: vi.fn(async () => {}),
    handleEditMessage: vi.fn(async () => {}),
    ...overrides,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors. (If `ChatController` is missing a field the stub doesn't set, add it — the stub must match the interface exactly.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/test/chatStub.ts
git commit -m "test: add ChatController stub for layout smoke tests"
```

---

## Task 7: Layout D — Hand of cards

**Signature:** assistant replies render inside an MTG-style card frame, mana-colored by the active theme; long answers show a preview with "Read" opening an expanded overlay; user messages are a lighter "played" token; past conversations are card spines down the left edge; new replies animate in (dealt). Input is a fixed bottom bar.

**Files:**
- Create: `frontend/src/layouts/d-cards/CardsLayout.tsx`
- Create: `frontend/src/layouts/d-cards/styles.module.css`
- Create: `frontend/src/layouts/d-cards/CardsLayout.test.tsx`
- Modify: `frontend/src/layouts/registry.ts`

- [ ] **Step 1: Create `CardsLayout.tsx`**

```tsx
import { useState } from "react";
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
          <MessageBody
            content={long ? message.content.slice(0, PREVIEW_LEN) + "…" : message.content}
          />
        </div>
        <footer className={styles.cardFooter}>
          {long && (
            <button className={styles.cardBtn} onClick={() => onExpand(message)}>
              <Maximize2 size={14} /> Read
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
            <button className={styles.overlayClose} onClick={() => setExpanded(null)}>
              <X size={18} />
            </button>
            <MessageBody content={expanded.content} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `styles.module.css` (first pass — real, theme-driven)**

```css
.root {
  display: flex;
  height: 100vh;
  width: 100%;
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.library {
  width: 64px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-right: 2px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 10px;
}
.newSpine {
  width: 40px; height: 40px; border-radius: 8px;
  background: var(--accent); color: var(--text-primary);
  border: none; cursor: pointer; display: grid; place-items: center;
}
.spines { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.spine {
  width: 40px; height: 120px; border-radius: 6px;
  background: var(--bot-bubble); border: 1px solid var(--border-color);
  color: var(--text-secondary); cursor: pointer; writing-mode: vertical-rl;
  transform: rotate(180deg); overflow: hidden; white-space: nowrap;
  text-overflow: ellipsis; padding: 6px 2px; font-size: 11px;
}
.spineActive { border-color: var(--accent); color: var(--text-primary); box-shadow: 0 0 0 2px var(--accent-glow); }
.spineLabel { display: block; }
.table { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.hand { flex: 1; overflow-y: auto; padding: 28px 24px 8px; display: flex; flex-direction: column; gap: 18px; }
.empty { margin: auto; text-align: center; color: var(--text-secondary); }
.empty h2 { font-family: "Beleren", serif; color: var(--text-primary); margin-bottom: 8px; }
.cardRow { display: flex; justify-content: flex-start; animation: deal 0.35s ease both; }
.tokenRow { display: flex; justify-content: flex-end; }
.token {
  background: var(--user-bubble); color: var(--text-primary);
  padding: 10px 16px; border-radius: 14px 14px 2px 14px; max-width: 60%;
  border: 1px solid var(--border-color);
}
.card {
  width: min(560px, 92%);
  background: var(--bg-primary);
  border: 8px solid var(--bg-tertiary);
  border-radius: 16px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
  overflow: hidden;
}
.cardHeader {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 10px 14px; background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.cardTitle { font-family: "Beleren", serif; font-weight: 700; }
.cardType { font-size: 12px; color: var(--text-secondary); }
.cardArt { height: 10px; background: linear-gradient(90deg, var(--accent), transparent); opacity: 0.5; }
.cardText { padding: 14px 18px; font-family: "Plantin", Georgia, serif; line-height: 1.6; }
.cardFooter { display: flex; gap: 8px; padding: 8px 14px 12px; }
.cardBtn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--bot-bubble); color: var(--text-secondary);
  border: 1px solid var(--border-color); border-radius: 8px;
  padding: 6px 10px; cursor: pointer; font-size: 13px;
}
.cardBtn:hover { color: var(--text-primary); border-color: var(--accent); }
.drawing, .inputDock { padding-left: 24px; }
.drawing { color: var(--text-secondary); font-style: italic; padding: 8px 24px; }
.inputDock { border-top: 1px solid var(--border-color); background: var(--bg-secondary); }
.overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.6);
  display: grid; place-items: center; z-index: 50; padding: 24px;
}
.expandedCard {
  position: relative; max-width: 720px; max-height: 80vh; overflow-y: auto;
  background: var(--bg-primary); border: 10px solid var(--bg-tertiary);
  border-radius: 18px; padding: 28px 32px; font-family: "Plantin", Georgia, serif;
}
.overlayClose {
  position: absolute; top: 12px; right: 12px;
  background: var(--bot-bubble); color: var(--text-primary);
  border: 1px solid var(--border-color); border-radius: 8px; padding: 6px; cursor: pointer;
}
@keyframes deal { from { opacity: 0; transform: translateY(16px) rotate(-1deg); } to { opacity: 1; transform: none; } }
@media (max-width: 640px) {
  .card { width: 100%; }
  .library { width: 48px; }
}
```

- [ ] **Step 3: Register layout D** — in `registry.ts`

Add import `import { CardsLayout } from "./d-cards/CardsLayout";` and append to `LAYOUTS`:
```tsx
{ id: "d", name: "Hand of cards", component: CardsLayout },
```

- [ ] **Step 4: Write smoke test** — `CardsLayout.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardsLayout } from "./CardsLayout";
import { makeChatStub } from "../../test/chatStub";

describe("CardsLayout", () => {
  it("renders assistant message inside a card and user as token", () => {
    render(<CardsLayout chat={makeChatStub()} />);
    expect(screen.getByText("Lotus")).toBeInTheDocument();
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });

  it("sends input through the chat handler", async () => {
    const chat = makeChatStub();
    render(<CardsLayout chat={chat} />);
    const box = screen.getByPlaceholderText("Send a message...");
    await userEvent.type(box, "Build me a deck{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Build me a deck");
  });
});
```

- [ ] **Step 5: Run tests + typecheck + build**

Run: `cd frontend && npx vitest run src/layouts/d-cards && npx tsc -b --noEmit && npm run build`
Expected: tests pass, no TS errors, build OK.

- [ ] **Step 6: Visual verification loop**

Run `npm run dev` + backend. Open `http://localhost:5173/?layout=d`. Verify against acceptance criteria; iterate `styles.module.css` until ALL are met:
  - [ ] Assistant replies appear as card frames; user messages as right-aligned tokens.
  - [ ] A long reply shows a truncated preview with a working "Read" overlay (Esc/click-out closes).
  - [ ] Left library shows conversation spines; active one highlighted; clicking switches; "+" makes a new chat.
  - [ ] "Redraw" appears only on the last assistant card and regenerates.
  - [ ] New replies animate in (deal).
  - [ ] Cycle all 6 themes (via Classic's selector or by setting `localStorage.lotus-theme`): colors adapt, text remains legible.
  - [ ] Mobile width (~390px) is usable; no horizontal overflow.
  - [ ] Streaming shows incrementally; `[[card]]` tooltips work in cards and overlay.

Capture a screenshot per theme for the review.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts/d-cards frontend/src/layouts/registry.ts
git commit -m "feat: add layout D — hand of cards"
```

---

## Task 8: Layout E — Tavern keeper's stall

**Signature:** a lantern-lit wooden frame around the view; the assistant is "the keeper" with an avatar header; replies on aged parchment slips with a wax-seal accent; conversation list is a hanging menu/ledger board on the left; input styled as a quill/tankard bar. Reuses `MessageBody`, `ChatInput`, `StreamingMessage`.

**Files:**
- Create: `frontend/src/layouts/e-tavern/TavernLayout.tsx`
- Create: `frontend/src/layouts/e-tavern/styles.module.css`
- Create: `frontend/src/layouts/e-tavern/TavernLayout.test.tsx`
- Modify: `frontend/src/layouts/registry.ts`

- [ ] **Step 1: Create `TavernLayout.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `styles.module.css` (first pass)**

```css
.frame {
  height: 100vh; width: 100%; box-sizing: border-box;
  padding: 14px; background: var(--bg-tertiary);
}
.inner {
  height: 100%; display: flex;
  border: 6px solid var(--bg-secondary);
  border-radius: 12px; overflow: hidden;
  box-shadow: inset 0 0 60px rgba(0,0,0,0.45);
  background: var(--bg-primary); color: var(--text-primary);
}
.board {
  width: 240px; flex-shrink: 0; background: var(--bg-secondary);
  border-right: 4px solid var(--border-color); padding: 16px 12px;
  display: flex; flex-direction: column; gap: 12px;
}
.sign {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  font-family: "Beleren", serif; padding: 10px; border-radius: 8px;
  background: var(--bot-bubble); border: 1px solid var(--border-color);
}
.newBtn {
  display: inline-flex; align-items: center; gap: 6px; justify-content: center;
  background: var(--accent); color: var(--text-primary); border: none;
  border-radius: 8px; padding: 8px; cursor: pointer; font-family: "Beleren", serif;
}
.tales { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.tale {
  text-align: left; background: transparent; color: var(--text-secondary);
  border: 1px solid transparent; border-radius: 6px; padding: 8px 10px;
  cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tale:hover { background: var(--bot-bubble); color: var(--text-primary); }
.taleActive { background: var(--bot-bubble); color: var(--text-primary); border-color: var(--accent); }
.stall { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.keeperBar {
  display: flex; align-items: center; gap: 12px; padding: 14px 20px;
  border-bottom: 2px solid var(--border-color); background: var(--bg-secondary);
}
.keeperAvatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, var(--accent), var(--bg-tertiary));
  border: 2px solid var(--border-color);
}
.keeperName { font-family: "Beleren", serif; font-weight: 700; }
.keeperTag { font-size: 12px; color: var(--text-secondary); }
.slips { flex: 1; overflow-y: auto; padding: 22px 20px; display: flex; flex-direction: column; gap: 16px; }
.welcome { margin: auto; text-align: center; color: var(--text-secondary); }
.welcome h2 { font-family: "Beleren", serif; color: var(--text-primary); margin-bottom: 6px; }
.patronRow { display: flex; justify-content: flex-end; }
.patronSlip {
  background: var(--user-bubble); color: var(--text-primary);
  padding: 10px 16px; border-radius: 10px; max-width: 65%;
  border: 1px solid var(--border-color); box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
.keeperRow { display: flex; justify-content: flex-start; }
.parchment {
  position: relative; max-width: 75%;
  background: var(--bg-secondary); color: var(--text-primary);
  border: 1px solid var(--border-color); border-radius: 4px;
  padding: 18px 22px 14px; font-family: "Plantin", Georgia, serif; line-height: 1.6;
  box-shadow: 0 3px 10px rgba(0,0,0,0.35);
}
.seal {
  position: absolute; top: -10px; left: -10px; width: 26px; height: 26px;
  border-radius: 50%; background: var(--mana-red);
  border: 2px solid var(--bg-tertiary); box-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
.redo {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 10px;
  background: transparent; color: var(--text-secondary);
  border: 1px solid var(--border-color); border-radius: 6px; padding: 5px 9px;
  cursor: pointer; font-size: 12px;
}
.redo:hover { color: var(--text-primary); border-color: var(--accent); }
.pouring { color: var(--text-secondary); font-style: italic; }
.quillBar { border-top: 2px solid var(--border-color); background: var(--bg-secondary); }
@media (max-width: 720px) {
  .board { width: 64px; padding: 12px 6px; }
  .sign span, .newBtn span, .tale { display: none; }
  .parchment, .patronSlip { max-width: 90%; }
}
```

- [ ] **Step 3: Register layout E** — append to `LAYOUTS` in `registry.ts`:
```tsx
{ id: "e", name: "Tavern keeper", component: TavernLayout },
```
with `import { TavernLayout } from "./e-tavern/TavernLayout";`.

- [ ] **Step 4: Smoke test** — `TavernLayout.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TavernLayout } from "./TavernLayout";
import { makeChatStub } from "../../test/chatStub";

describe("TavernLayout", () => {
  it("renders the keeper and messages", () => {
    render(<TavernLayout chat={makeChatStub()} />);
    expect(screen.getByText("The Keeper")).toBeInTheDocument();
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });

  it("sends input through the handler", async () => {
    const chat = makeChatStub();
    render(<TavernLayout chat={chat} />);
    await userEvent.type(screen.getByPlaceholderText("Send a message..."), "Ale, please{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Ale, please");
  });
});
```

- [ ] **Step 5: Tests + typecheck + build**

Run: `cd frontend && npx vitest run src/layouts/e-tavern && npx tsc -b --noEmit && npm run build`
Expected: green.

- [ ] **Step 6: Visual verification loop** (`?layout=e`)
  - [ ] Wooden frame surrounds the whole view; inner stall + left ledger board.
  - [ ] Keeper header with avatar; replies on parchment slips with a wax seal; patron messages right-aligned.
  - [ ] Ledger lists conversations; active highlighted; new-tale + switching work.
  - [ ] "Ask again" on last reply regenerates.
  - [ ] All 6 themes legible; seal color reads against parchment.
  - [ ] Mobile (~390px): board collapses to icons, slips go full-width, no overflow.
  - [ ] Streaming + `[[card]]` tooltips work.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts/e-tavern frontend/src/layouts/registry.ts
git commit -m "feat: add layout E — tavern keeper's stall"
```

---

## Task 9: Layout F — Mana orrery

**Signature:** cosmic plane background; conversation streams down a central vertical ley line; five mana orbs orbit the core and double as the theme switcher; messages drift in as motes; conversation list behind an edge control. Reuses `MessageBody`, `ChatInput`, `StreamingMessage`. The five orbs call `chat.setTheme(...)`.

**Files:**
- Create: `frontend/src/layouts/f-orrery/OrreryLayout.tsx`
- Create: `frontend/src/layouts/f-orrery/styles.module.css`
- Create: `frontend/src/layouts/f-orrery/OrreryLayout.test.tsx`
- Modify: `frontend/src/layouts/registry.ts`

- [ ] **Step 1: Create `OrreryLayout.tsx`**

```tsx
import { useState } from "react";
import { Plus, RefreshCw, List, X } from "lucide-react";
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

  return (
    <div className={styles.cosmos}>
      <div className={styles.orbit} aria-hidden="true" />
      <nav className={styles.orbs} aria-label="Mana themes">
        {ORBS.map((o, i) => (
          <button
            key={o.theme}
            className={`${styles.orb} ${chat.theme === o.theme ? styles.orbActive : ""}`}
            style={{ ["--orb" as string]: o.color, ["--i" as string]: i }}
            onClick={() => chat.setTheme(o.theme)}
            title={o.label}
            aria-label={`${o.label} theme`}
          />
        ))}
      </nav>

      <button className={styles.drawerToggle} onClick={() => setDrawerOpen(true)} title="Conversations">
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
              <button onClick={() => setDrawerOpen(false)}><X size={16} /></button>
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
```

- [ ] **Step 2: Create `styles.module.css` (first pass)**

```css
.cosmos {
  position: relative; height: 100vh; width: 100%; overflow: hidden;
  background:
    radial-gradient(circle at 50% 40%, var(--bg-secondary), var(--bg-tertiary) 70%);
  color: var(--text-primary);
  display: flex; flex-direction: column; align-items: center;
}
.orbit {
  position: absolute; top: 50%; left: 50%; width: 520px; height: 520px;
  margin: -260px 0 0 -260px; border: 1px solid var(--border-color);
  border-radius: 50%; opacity: 0.4; pointer-events: none;
}
.orbs {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 14px; z-index: 5;
}
.orb {
  width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
  background: var(--orb); border: 2px solid var(--border-color);
  box-shadow: 0 0 10px var(--orb); opacity: 0.7; transition: transform 0.2s, opacity 0.2s;
}
.orb:hover { transform: scale(1.15); opacity: 1; }
.orbActive { opacity: 1; box-shadow: 0 0 16px var(--orb); border-color: var(--text-primary); }
.drawerToggle {
  position: absolute; top: 16px; left: 16px; z-index: 5;
  background: var(--bot-bubble); color: var(--text-primary);
  border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; cursor: pointer;
}
.leyline {
  flex: 1; width: min(620px, 92%); overflow-y: auto;
  padding: 70px 0 12px; display: flex; flex-direction: column; gap: 16px;
}
.coreWelcome { margin: auto; text-align: center; color: var(--text-secondary); }
.core {
  width: 90px; height: 90px; margin: 0 auto 14px; border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, var(--accent), transparent 70%);
  box-shadow: 0 0 40px var(--accent-glow);
}
.coreWelcome h2 { font-family: "Beleren", serif; color: var(--text-primary); margin-bottom: 6px; }
.moteUser { display: flex; justify-content: flex-end; animation: drift 0.4s ease both; }
.moteBot { display: flex; justify-content: flex-start; animation: drift 0.4s ease both; }
.userMote {
  background: var(--user-bubble); color: var(--text-primary);
  padding: 10px 16px; border-radius: 16px; max-width: 70%;
  border: 1px solid var(--border-color); box-shadow: 0 0 12px var(--accent-glow);
}
.botMote {
  background: color-mix(in srgb, var(--bg-secondary) 80%, transparent);
  border: 1px solid var(--border-color); border-radius: 16px;
  padding: 14px 18px; max-width: 80%; line-height: 1.6;
  font-family: "Plantin", Georgia, serif; backdrop-filter: blur(2px);
}
.recast {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 8px;
  background: transparent; color: var(--text-secondary);
  border: 1px solid var(--border-color); border-radius: 6px; padding: 5px 9px;
  cursor: pointer; font-size: 12px;
}
.recast:hover { color: var(--text-primary); border-color: var(--accent); }
.channeling { color: var(--text-secondary); font-style: italic; }
.inputOrb { width: min(620px, 92%); padding-bottom: 8px; }
.drawerOverlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); z-index: 20; }
.drawer {
  position: absolute; top: 0; left: 0; height: 100%; width: 280px;
  background: var(--bg-secondary); border-right: 1px solid var(--border-color);
  padding: 14px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;
}
.drawerHead { display: flex; justify-content: space-between; align-items: center; font-family: "Beleren", serif; }
.drawerHead button { background: none; border: none; color: var(--text-primary); cursor: pointer; }
.newPlane {
  display: inline-flex; align-items: center; gap: 6px; justify-content: center;
  background: var(--accent); color: var(--text-primary); border: none;
  border-radius: 8px; padding: 8px; cursor: pointer;
}
.planeItem {
  text-align: left; background: transparent; color: var(--text-secondary);
  border: 1px solid transparent; border-radius: 6px; padding: 8px 10px; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.planeItem:hover { background: var(--bot-bubble); color: var(--text-primary); }
.planeActive { background: var(--bot-bubble); color: var(--text-primary); border-color: var(--accent); }
@keyframes drift { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (max-width: 640px) { .orbit { width: 360px; height: 360px; margin: -180px 0 0 -180px; } }
```

- [ ] **Step 3: Register layout F** — append to `LAYOUTS`:
```tsx
{ id: "f", name: "Mana orrery", component: OrreryLayout },
```
with `import { OrreryLayout } from "./f-orrery/OrreryLayout";`.

- [ ] **Step 4: Smoke test** — `OrreryLayout.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrreryLayout } from "./OrreryLayout";
import { makeChatStub } from "../../test/chatStub";

describe("OrreryLayout", () => {
  it("renders messages and the six mana orbs", () => {
    render(<OrreryLayout chat={makeChatStub()} />);
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByLabelText("Blue theme")).toBeInTheDocument();
  });

  it("an orb switches the theme", async () => {
    const chat = makeChatStub();
    render(<OrreryLayout chat={chat} />);
    await userEvent.click(screen.getByLabelText("Islands theme"));
    expect(chat.setTheme).toHaveBeenCalledWith("blue");
  });

  it("sends input through the handler", async () => {
    const chat = makeChatStub();
    render(<OrreryLayout chat={chat} />);
    await userEvent.type(screen.getByPlaceholderText("Send a message..."), "Cast it{enter}");
    expect(chat.handleSendMessage).toHaveBeenCalledWith("Cast it");
  });
});
```
(Note: orb `aria-label` is `"<label> theme"`, e.g. `"Islands theme"`; the test above uses both — keep labels consistent with the `ORBS` array.)

- [ ] **Step 5: Tests + typecheck + build**

Run: `cd frontend && npx vitest run src/layouts/f-orrery && npx tsc -b --noEmit && npm run build`
Expected: green. (Fix the `getByLabelText("Blue theme")` vs `"Islands theme"` mismatch: the blue orb's label is `"Islands theme"`. Use `getByLabelText("Islands theme")` in both assertions.)

- [ ] **Step 6: Visual verification loop** (`?layout=f`)
  - [ ] Cosmic background + orbit ring; six mana orbs across the top; active theme orb highlighted.
  - [ ] Clicking an orb switches the theme live (and persists).
  - [ ] Conversation streams down the central column; user motes right, bot motes left; drift-in animation.
  - [ ] Drawer toggle opens conversation list; new-plane + switching work and close the drawer.
  - [ ] "Recast" on last reply regenerates.
  - [ ] All 6 themes legible against the cosmic bg.
  - [ ] Mobile (~390px): orbs + column fit, drawer usable, no overflow.
  - [ ] Streaming + `[[card]]` tooltips work.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts/f-orrery frontend/src/layouts/registry.ts
git commit -m "feat: add layout F — mana orrery"
```

---

## Task 10: Final integration pass

**Files:** (verification only; fix-ups as needed)

- [ ] **Step 1: Full test suite + typecheck + production build**

Run: `cd frontend && npm test && npx tsc -b --noEmit && npm run build`
Expected: all tests pass; no TS errors; build succeeds.

- [ ] **Step 2: Cross-layout manual sweep**

With backend running, for each of `classic`, `d`, `e`, `f` (via `?layout=` and `Ctrl+Shift+L`):
  - [ ] Send a message; streaming renders; final message persists.
  - [ ] Switch layout mid-conversation — same conversation/messages appear (shared engine).
  - [ ] Reload — last-used layout (localStorage) restores; conversations persist.
  - [ ] Default with no param + cleared storage → `classic`.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors. Fix any introduced by new files.

- [ ] **Step 4: Update docs**

In `CLAUDE.md`, under "Project Structure" / "Themes", add a short note: a `useChat` engine powers all layouts; `src/layouts/` holds layout variants selectable via `?layout=classic|d|e|f` or `Ctrl+Shift+L` (dev-only); default is `classic`. Commit.

```bash
git add CLAUDE.md
git commit -m "docs: note layout variants + useChat engine"
```

- [ ] **Step 5: Use `superpowers:requesting-code-review`** to review the branch before opening a PR (see Execution Handoff in the parent flow).

---

## Self-Review notes (author)

- **Spec coverage:** useChat (Task 3) ✓; shared primitives (Task 2) ✓; registry + dev switcher URL/shortcut/storage (Task 5) ✓; classic stays default (Tasks 4–5) ✓; layouts D/E/F to polish with criteria (Tasks 7–9) ✓; themes global — each layout uses theme CSS vars + verified across 6 themes ✓; per-layout concerns (long messages, conversation list, actions, empty state) covered in each layout's component + criteria ✓; build sequence matches spec ✓.
- **Deck-builder:** confirmed server-triggered by message content; no special layout UI required (`DeckInput.tsx` is unused in the active path). Layouts render deck analysis as normal assistant markdown.
- **Type consistency:** `ChatController` fields used by layouts match the interface (Task 3); `LayoutProps` (Task 4) is the single layout contract; `chatStub` (Task 6) must mirror `ChatController` exactly (Task 6 Step 2 enforces via tsc).
- **Known nit to fix during execution:** Orrery test label must be `"Islands theme"` for the blue orb (called out in Task 9 Steps 4–5).

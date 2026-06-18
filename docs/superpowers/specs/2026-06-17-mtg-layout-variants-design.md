# Lotus — New Layout Variants (D–F) Design

**Date:** 2026-06-17
**Status:** Approved (pending spec review)

## Goal

Add three brand-new, fully-polished, modern chat layouts to the Lotus MTG chatbot,
each leaning into a distinct Magic: The Gathering / renaissance-fair metaphor. All
three reuse the existing chat functionality so they are real working chats, not mockups.
They are selectable via a dev-only switcher for local comparison; the current production
layout remains the default for end users.

## Non-Goals

- No changes to the backend, Bedrock prompts, Scryfall integration, or deck-builder logic.
- No changes to the live default experience for end users (current layout stays default).
- Layouts A–C from brainstorming (refined-classic, centered-focus, immersive-tome) are
  out of scope for this work.
- No visible end-user layout switcher (dev/local only).

## Architecture

### 1. Shared chat engine — `useChat` hook

Extract all stateful logic currently in `frontend/src/App.tsx` into a single hook
`frontend/src/hooks/useChat.ts`. This includes:

- Conversation list state + localStorage persistence (`lotus-conversations`, `lotus-active-chat`)
- Active conversation selection, create/select/delete/rename
- Message send (streaming via `sendMessageStream`), regenerate, edit, reaction
- Theme state + persistence (`lotus-theme`), theme transition class, dynamic favicon tinting
- Keyboard shortcut for new chat (Ctrl/Cmd+N)

The hook returns one `chat` object (state + handlers) that any layout consumes. `App.tsx`
becomes a thin shell: call `useChat()`, resolve the active layout from the registry, render it.

**Acceptance:** The existing/default layout, refactored to consume `useChat`, behaves
identically to today (manual parity check — send, stream, regenerate, edit, delete, rename,
theme switch, persistence across reload).

### 2. Shared leaf primitives

These existing components are reused by all layouts, themed via CSS variables:
markdown message body, `[[card]]` tooltip (`CardTooltip`), streaming indicator
(`StreamingMessage`), deck-builder detection/input (`DeckInput`). Only the layout *shell*
(arrangement of message list, input, conversation list, empty state) differs per layout.

### 3. Layout registry + dev-only switcher

- `frontend/src/layouts/registry.ts` — maps layout id → `{ id, name, component }`.
  Ids: `classic` (default, current layout), `d` (cards), `e` (tavern), `f` (orrery).
- Selection: `?layout=<id>` URL query param is the primary selector; `Ctrl+Shift+L`
  cycles through registered layouts; the chosen id persists to `localStorage`
  (`lotus-layout`). Default when nothing set: `classic`.
- No visible UI chrome for end users. (Cycling shortcut + URL param only.)

### File structure

```
frontend/src/
├── hooks/useChat.ts            # the engine (extracted from App.tsx)
├── layouts/
│   ├── registry.ts             # id → {name, component}
│   ├── useLayoutSelection.ts   # URL param + shortcut + localStorage
│   ├── classic/                # existing layout, refactored to useChat
│   ├── d-cards/                # index.tsx + styles.module.css
│   ├── e-tavern/
│   └── f-orrery/
```

## Layout Signatures

Each layout, when polished, MUST handle: long assistant messages, the deck-builder flow,
the conversation list, message actions (regenerate/edit/react), and an empty/welcome state —
each expressed in its own idiom. All six mana themes must work in each.

### D · Hand of cards
- Assistant replies render inside an MTG card frame, mana-colored by the active theme.
- Long answers: card shows a preview; "tap to read" opens an expanded reading overlay.
- Past conversations are card spines in a left-edge "library."
- New replies animate in like a card being dealt/drawn.
- User messages: lighter treatment (e.g. a played card / token) so the exchange reads clearly.

### E · Tavern keeper's stall
- Lantern-lit wooden frame around the whole view.
- The assistant is "the keeper," with an avatar/persona header.
- Replies arrive on aged parchment slips with a wax-seal accent.
- Conversation list is a hanging menu/ledger board.
- Input styled as a tankard/quill bar.

### F · Mana orrery
- Cosmic plane background; conversation streams down a central vertical "ley line."
- Five mana orbs orbit the conversation core and double as the theme switcher.
- Messages fade/drift in as motes of light.
- Conversation list accessible via an orbiting/edge control.

## Polish bar (per layout)

"Fully polished" means: signature structure + vibe realized; responsive (desktop + mobile);
all mana themes correct; smooth streaming; message actions reachable; deck-builder usable;
empty state designed; no layout breakage on long content or many conversations.

## Build sequence

1. Extract `useChat`; refactor current layout into `layouts/classic` consuming it; add
   registry + `useLayoutSelection` (switcher). Verify default behavior parity.
2. Build **D · Hand of cards** to full polish.
3. Build **E · Tavern keeper's stall** to full polish.
4. Build **F · Mana orrery** to full polish.

Runnable and comparable (`npm run dev`, then `?layout=d|e|f`) after each step.

## Risks / Open considerations

- Card frame (D) and parchment slips (E) constrain text width; long markdown (tables, code,
  deck lists) must remain readable — expanded reading mode mitigates.
- Orrery (F) radial composition vs. linear reading of long chats — ley-line stream keeps
  reading vertical; orbs are nav/theme only.
- `useChat` extraction is the riskiest change (touches all existing behavior); parity check
  gates it before any new layout work.

# Lotus — "Aether" Layout Design

**Date:** 2026-06-18
**Status:** Approved (pending spec review)
**Branch:** `feat/mtg-layout-variants`

## Motivation

The first three new layouts (D/E/F) disappointed: they felt too similar to the
original because they inherited the **same global theme** (the brown card-back palette in
`index.css`), the **global noise texture** (`body::before`, opacity 0.06, z-index 9999),
and the **medieval fonts** (Beleren/Plantin). Rearranging structure inside the same skin
wasn't enough. Aether is a deliberate clean break: a light, modern, editorial design with
its own palette, modern type, and no parchment grain — with Magic present only as a whisper.

## Goal

Add one new, fully-working chat layout, **"Aether"** (id `g`), selectable via the existing
dev switcher (`?layout=g`, `Ctrl+Shift+L`). It reuses the `useChat` engine and shared
chat primitives but presents a completely new visual language. The current `classic` layout
remains the default; D/E/F are untouched.

## Non-Goals

- No backend / `useChat` / prompt changes.
- No change to the default end-user experience (`classic` stays default).
- Not removing D/E/F.
- No new end-user-facing layout switcher (dev/local only, as today).

## Design

### Aesthetic & theming (the core of the redesign)

- **Always light.** Aether defines its **own scoped palette** in its CSS module and does NOT
  consume the global `--bg-*` / `--text-*` theme variables (several of which are dark). Base
  tokens (hardcoded in the module): paper `#f6f3ec`, raised `#ffffff`, rail `#efe9dd`,
  hairline `#e2dacb`, ink `#1c1a16`, ink-soft `#2a2620`, muted `#a89e8a`.
- **No noise texture.** On mount the layout adds class `aether` to `document.body`; on unmount
  it removes it. `index.css` gets one rule: `body.aether::before { content: none; }` to
  disable the global grain overlay while Aether is active. Aether's root fills `#root`
  (height 100vh) with its own light background, covering the global `body` background even
  under a dark `data-theme`.
- **Magic as one accent (a whisper).** The mana dots in the header (the 6 themes: default +
  white/blue/black/red/green) switch the active mana color by calling `chat.setTheme(...)`
  (reusing the global theme state for persistence).
  Aether interprets `chat.theme` through its **own refined accent map** — surfaces stay light;
  only the accent moves. Accent map (`theme → accent hex`):
  - `default` → `#9a7b3d` (refined gold/colorless)
  - `white` → `#b08900`
  - `blue` → `#2f6f9e`
  - `black` → `#5d5470` (refined violet-graphite; pure black would vanish into ink)
  - `red` → `#c0504a`
  - `green` → `#2f6f5e`
  The accent is exposed as a CSS custom property `--ax` set inline on the layout root
  (`style={{ "--ax": accentFor(chat.theme) }}`), so the whole module styles off `var(--ax)`.

### Typography

- Drop Beleren/Plantin for this layout. Load **Fraunces** (wordmark + headings) and **Inter**
  (body) via Google Fonts in `frontend/index.html` (preconnect + one stylesheet `<link>`).
  Used only inside Aether's CSS module — other layouts are unaffected.
- Wordmark "Lotus" and the welcome heading use Fraunces; everything else Inter.

### Structure

```
┌────┬───────────────────────────────────────────┐
│ ▌  │  Lotus                     ○ ○ ● ○ ○  (mana)│  header (wordmark + theme dots)
│ ▌  │                                            │
│ ✦  │     • For a mono-green shell, open on …     │  centered reading column
│ ⌕  │                         What about 4+? ▐    │  (max-width ~720px)
│ ⌂  │     • Keep it lean — six or seven …         │
│    │                                            │
│    │  [ Ask anything, or paste a deck list…  ↑ ]│  composer
└────┴───────────────────────────────────────────┘
```

- **Slim rail** (~56px, `rail` bg): new chat (`Plus`), search (`Search`), history (`Clock`/
  `History`). The history button toggles a clean slide-in **panel** (light, hairline border)
  listing conversations — select / new / rename / delete — reusing `chat` handlers. The panel
  is an in-flow overlay within the Aether root (which is `position: relative`), closes on
  backdrop click and Escape.
- **Header:** wordmark left; 6 mana dots right (theme switcher; active dot gets a ring in
  `var(--ax)`).
- **Centered column:** `max-width: 720px`, generous vertical rhythm.

### Messages (editorial — the signature)

- **Assistant:** a small mana-pip dot in `var(--ax)` + the reply as plain ink text via the
  shared `MessageBody` (markdown + `[[card]]`), NO bubble. The message text lives in a scoped
  container so `[[card]]` links render as an accent underline (`border-bottom: 1.5px solid
  var(--ax)`) while still triggering the existing `CardTooltip` on hover.
- **User:** a compact dark ink pill (`#1c1a16` bg, paper text), right-aligned, plain text.
- **Hover actions (minimal):** assistant rows reveal Copy + (on the last assistant, when not
  loading) Regenerate — subtle ghost buttons. User rows reveal Edit. No thumbs up/down here
  (kept clean); the engine still supports reactions, this layout just omits the control.
- **Streaming:** shared `StreamingMessage` rendered in the same ink-text treatment; a quiet
  "Thinking…" line when loading without content yet.

### Composer

A small Aether-native composer (not the shared `ChatInput`, whose char-counter/hint chrome
doesn't fit the minimal look): an autosizing `<textarea>` + accent send button, Enter-to-send,
Shift+Enter newline, Esc clears, `disabled` while loading, wired to `chat.handleSendMessage`.
Placeholder: "Ask anything, or paste a deck list…".

### Empty / welcome state

Centered: Fraunces heading ("Ask me anything"), one muted sub-line, and 3 quiet example chips
(`"Build a mono-green Commander deck"`, etc.) that call `chat.handleSendMessage`.

## Architecture / files

```
frontend/
├── index.html                         # MODIFY — add Fraunces + Inter <link>s
├── src/
│   ├── index.css                      # MODIFY — add `body.aether::before { content: none }`
│   └── layouts/
│       ├── registry.ts                # MODIFY — register { id: "g", name: "Aether", … }
│       └── g-aether/
│           ├── AetherLayout.tsx        # the layout (consumes ChatController)
│           ├── AetherComposer.tsx      # the minimal composer
│           ├── accent.ts               # theme → accent hex map (accentFor)
│           ├── styles.module.css       # scoped light palette + all component styles
│           ├── AetherLayout.test.tsx   # smoke tests
│           └── accent.test.ts          # accentFor unit test
```

- `LayoutId` union extends to include `"g"`; `LAYOUTS` gets the Aether entry. `LAYOUT_IDS`
  is already derived from `LAYOUTS`, so no separate edit.
- Reuse: `useChat` (unchanged), `MessageBody`, `StreamingMessage`, `CardTooltip` (via
  MessageBody). Only the composer and shells are new.

## Testing

- `accent.test.ts` (TDD): `accentFor(theme)` returns the mapped hex for each of the 6 themes
  and a sensible default for an unknown value.
- `AetherLayout.test.tsx` (smoke, using `makeChatStub`): renders assistant text + user message;
  typing + Enter calls `chat.handleSendMessage`; clicking a mana dot calls `chat.setTheme`;
  the history toggle opens the panel and a conversation item calls `chat.handleSelectConversation`.
- Manual visual verification loop (`?layout=g`): light/airy, no parchment grain, Fraunces+Inter
  load, editorial messages, accent recolors per mana dot, mobile (~390px) usable, streaming +
  `[[card]]` tooltips work. Confirm switching AWAY from Aether restores the global noise texture
  for other layouts (the `body.aether` class is removed on unmount).

## Risks / considerations

- **Noise-texture toggle via body class** is a small global side effect; the mount/unmount
  effect must clean up reliably (and on fast layout switches). Covered by the unmount removal +
  manual verification that other layouts keep their grain.
- **Google Fonts dependency** adds an external request (privacy/offline tradeoff); acceptable
  for this app. Fonts are used only in Aether, so a slow font load can't affect other layouts.
- **Dark `data-theme` underneath:** Aether's root must paint an opaque light background over the
  full viewport so a dark global theme never peeks through at the edges. Verify with `?layout=g`
  while `data-theme="black"`.

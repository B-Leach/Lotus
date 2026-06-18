# Aether Dark Mode ("Arcane Glass") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light/dark mode toggle to the Aether layout — light = Aether (current), dark = "Arcane glass" (near-black frosted glass with a brighter glowing mana accent).

**Architecture:** `AetherLayout` gains a `mode` state (persisted in `localStorage`, default light). The root element gets a `dark` CSS-module class in dark mode; all dark styling is `.dark .X` rules in the same module. A second accent map `accentForDark` supplies brighter hues, and `--ax` is set from it in dark mode. A sun/moon toggle sits in the header.

**Tech Stack:** React 19 + TypeScript + Vite, CSS Modules (`color-mix`, box-shadow glow), `lucide-react`. Tests: Vitest + RTL.

---

## Scope notes
- Only the Aether layout (`g`) changes. No registry change, no other layouts, no `useChat` change.
- `mode` (light/dark) and `chat.theme` (mana color) are independent axes that compose.

## File Structure (all MODIFY — no new files)
```
frontend/src/layouts/g-aether/
├── accent.ts             # + accentForDark()
├── accent.test.ts        # + accentForDark tests
├── AetherLayout.tsx      # mode state/persistence, toggle, --ax by mode, dark class, header restructure
├── AetherLayout.test.tsx # + toggle test, + beforeEach clear
└── styles.module.css     # + base header-toggle rules, + .dark palette/glow rules
```

---

## Task 1: Dark accent map (`accentForDark`)

**Files:**
- Modify: `frontend/src/layouts/g-aether/accent.ts`
- Modify: `frontend/src/layouts/g-aether/accent.test.ts`

- [ ] **Step 1: Add the failing test** — append to `accent.test.ts` (inside the file, a new top-level `describe`)

Add this import-using block after the existing `describe` blocks (the file already imports `accentFor, MANA_DOTS`; change the import to also bring in `accentForDark`):
- Change the first import line `import { accentFor, MANA_DOTS } from "./accent";` to `import { accentFor, accentForDark, MANA_DOTS } from "./accent";`
- Append:
```ts
describe("accentForDark", () => {
  it("maps each theme to its electric dark accent", () => {
    expect(accentForDark("default")).toBe("#e0b85c");
    expect(accentForDark("white")).toBe("#e8dca0");
    expect(accentForDark("blue")).toBe("#4aa8e0");
    expect(accentForDark("black")).toBe("#a98fd6");
    expect(accentForDark("red")).toBe("#ef6a62");
    expect(accentForDark("green")).toBe("#54e0c7");
  });

  it("falls back to the default dark accent for an unknown theme", () => {
    expect(accentForDark("zzz" as never)).toBe("#e0b85c");
  });
});
```

- [ ] **Step 2: Run it, verify FAIL**

Run: `cd frontend && npx vitest run src/layouts/g-aether/accent.test.ts`
Expected: FAIL — `accentForDark` is not exported.

- [ ] **Step 3: Add `accentForDark` to `accent.ts`**

Add AFTER the existing `accentFor` function (and before `MANA_DOTS`):
```ts
const DARK_ACCENTS: Record<Theme, string> = {
  default: "#e0b85c",
  white: "#e8dca0",
  blue: "#4aa8e0",
  black: "#a98fd6",
  red: "#ef6a62",
  green: "#54e0c7",
};

export function accentForDark(theme: Theme): string {
  return DARK_ACCENTS[theme] ?? DARK_ACCENTS.default;
}
```

- [ ] **Step 4: Run it, verify PASS** (5 tests in the file now)

Run: `cd frontend && npx vitest run src/layouts/g-aether/accent.test.ts`

- [ ] **Step 5: Typecheck + commit**

```bash
cd frontend && npx tsc -b --noEmit
git add frontend/src/layouts/g-aether/accent.ts frontend/src/layouts/g-aether/accent.test.ts
git commit -m "feat: add accentForDark map for Aether dark mode"
```

---

## Task 2: Mode state + toggle (AetherLayout.tsx)

**Files:**
- Modify: `frontend/src/layouts/g-aether/AetherLayout.tsx`
- Modify: `frontend/src/layouts/g-aether/AetherLayout.test.tsx`
- Modify: `frontend/src/layouts/g-aether/styles.module.css` (base styles for the new header elements only)

### Step 1: Edit `AetherLayout.tsx` — imports
- Change `import { Plus, Clock, X, RefreshCw } from "lucide-react";` to:
  `import { Plus, Clock, X, RefreshCw, Sun, Moon } from "lucide-react";`
- Change `import { accentFor, MANA_DOTS } from "./accent";` to:
  `import { accentFor, accentForDark, MANA_DOTS } from "./accent";`

### Step 2: Add mode constants/helpers ABOVE the component (after the `EXAMPLES` array)
```tsx
const MODE_KEY = "lotus-aether-mode";
type AetherMode = "light" | "dark";

function loadMode(): AetherMode {
  return localStorage.getItem(MODE_KEY) === "dark" ? "dark" : "light";
}
```

### Step 3: Add mode state + toggle handler + mode-aware accent in the component
- After `const [historyOpen, setHistoryOpen] = useState(false);` add:
  `const [mode, setMode] = useState<AetherMode>(() => loadMode());`
- Replace the line `const rootStyle = { ["--ax"]: accentFor(chat.theme) } as CSSProperties;` with:
```tsx
  const toggleMode = () => {
    setMode((prev) => {
      const next: AetherMode = prev === "dark" ? "light" : "dark";
      localStorage.setItem(MODE_KEY, next);
      return next;
    });
  };

  const accent = mode === "dark" ? accentForDark(chat.theme) : accentFor(chat.theme);
  const rootStyle = { ["--ax"]: accent } as CSSProperties;
```

### Step 4: Add the `dark` class to the root
Change `<div className={styles.root} style={rootStyle}>` to:
```tsx
    <div
      className={`${styles.root} ${mode === "dark" ? styles.dark : ""}`}
      style={rootStyle}
    >
```

### Step 5: Restructure the header right side (mana dots + divider + toggle)
Replace this block:
```tsx
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
```
with:
```tsx
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
```

### Step 6: Add base CSS for the new header elements
Append to `styles.module.css` immediately AFTER the `.manaDotActive { ... }` rule (these are light-mode/structural; dark overrides come in Task 3):
```css
.headerRight { display: flex; align-items: center; gap: 12px; }
.divider { width: 1px; height: 16px; background: #e2dacb; }
.modeToggle {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: transparent;
  border: 0.5px solid #e2dacb;
  color: #a89e8a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.modeToggle:hover { color: #1c1a16; background: #ffffff; }
```

### Step 7: Update the test file `AetherLayout.test.tsx`
- Change the vitest import to include `beforeEach`: `import { describe, it, expect, beforeEach } from "vitest";`
- Add a `beforeEach` at the top of the `describe("AetherLayout", ...)` block (so mode persistence doesn't leak between tests):
```tsx
  beforeEach(() => {
    localStorage.clear();
  });
```
- Add this test inside the same describe:
```tsx
  it("toggles light/dark mode and persists the choice", async () => {
    const chat = makeChatStub();
    render(<AetherLayout chat={chat} />);
    await userEvent.click(screen.getByLabelText("Switch to dark mode"));
    expect(localStorage.getItem("lotus-aether-mode")).toBe("dark");
    expect(screen.getByLabelText("Switch to light mode")).toBeInTheDocument();
  });
```

### Step 8: Verify
From `frontend/`:
- `npx vitest run src/layouts/g-aether` → all pass (accent 5 + composer 3 + layout 8 = 16)
- `npx tsc -b --noEmit` → clean
- `npm run build` → success (if it fails on an esbuild binary error, run `npm install` once in frontend/ and rebuild; delete any stray `/Users/bleach/Documents/GitHub/AWS_Project/package-lock.json`)

### Step 9: Commit
```bash
git add frontend/src/layouts/g-aether/AetherLayout.tsx frontend/src/layouts/g-aether/AetherLayout.test.tsx frontend/src/layouts/g-aether/styles.module.css
git commit -m "feat: add light/dark mode toggle + state to Aether layout"
```

NOTE: after this task the toggle works and persists, but dark mode looks unstyled (the `.dark` rules don't exist yet) — Task 3 adds them.

---

## Task 3: Arcane-glass dark styling (styles.module.css)

**Files:**
- Modify: `frontend/src/layouts/g-aether/styles.module.css`

- [ ] **Step 1: Append the dark-mode rules at the END of `styles.module.css`**

```css
/* Arcane glass — dark mode (.dark is on the layout root) */
.dark {
  background: #0e1117;
  color: #e8edf5;
}

.dark .rail {
  background: #12161f;
  border-right-color: #232a36;
}
.dark .railBtn { color: #8b97a8; }
.dark .railBtn:hover { background: #1a212e; color: #e8edf5; }
.dark .railLogo {
  box-shadow: 0 0 12px color-mix(in srgb, var(--ax, #e0b85c) 55%, transparent);
}

.dark .header { border-bottom-color: #1c2330; }
.dark .wordmark { color: #e8edf5; }
.dark .divider { background: #2a3340; }
.dark .modeToggle { color: #8b97a8; border-color: #2a3340; }
.dark .modeToggle:hover { color: #e8edf5; background: #1a212e; }
.dark .manaDotActive {
  box-shadow: 0 0 0 2px #0e1117, 0 0 0 3px currentColor, 0 0 10px currentColor;
}

.dark .userPill {
  background: color-mix(in srgb, var(--ax, #e0b85c) 14%, transparent);
  border-color: color-mix(in srgb, var(--ax, #e0b85c) 45%, transparent);
  color: #e8edf5;
}
.dark .pip {
  box-shadow: 0 0 8px color-mix(in srgb, var(--ax, #e0b85c) 60%, transparent);
}
.dark .text { color: #c4cdda; }
.dark .text h1, .dark .text h2, .dark .text h3 { color: #e8edf5; }
.dark .text code, .dark .text pre { background: #1a212e; }
.dark .text [data-card-link] strong { color: #e8edf5; }
.dark .ghostBtn { color: #8b97a8; border-color: #232a36; }
.dark .ghostBtn:hover { color: #e8edf5; }
.dark .thinking { color: #5f6b7d; }

.dark .composer { background: #161b24; border-color: #232a36; }
.dark .composerInput { color: #e8edf5; }
.dark .composerInput::placeholder { color: #5f6b7d; }
.dark .sendBtn {
  box-shadow: 0 0 12px color-mix(in srgb, var(--ax, #e0b85c) 55%, transparent);
}

.dark .welcomeTitle { color: #e8edf5; }
.dark .welcomeSub { color: #8b97a8; }
.dark .exampleChip { background: #161b24; border-color: #232a36; color: #c4cdda; }
.dark .exampleChip:hover { color: #e8edf5; }

.dark .panelOverlay { background: rgba(0, 0, 0, 0.5); }
.dark .panel { background: #12161f; border-right-color: #232a36; }
.dark .panelHead { color: #e8edf5; }
.dark .panelHead button { color: #8b97a8; }
.dark .panelItem { color: #c4cdda; }
.dark .panelItem:hover { background: #1a212e; }
.dark .panelItemActive { background: #1a212e; }
```

- [ ] **Step 2: Verify**

From `frontend/`:
- `npx vitest run src/layouts/g-aether` → still all pass (16)
- `npx tsc -b --noEmit` → clean
- `npm run build` → success

- [ ] **Step 3: Commit**

```bash
git add frontend/src/layouts/g-aether/styles.module.css
git commit -m "feat: add Arcane glass dark-mode styling to Aether"
```

---

## Task 4: Integration + visual verification

- [ ] **Step 1: Full suite + typecheck + build + lint**

Run: `cd frontend && npm test && npx tsc -b --noEmit && npm run build && npm run lint`
Expected: all tests pass; tsc clean; build OK; no NEW lint problems in `g-aether/**` (pre-existing `ChatArea.tsx`/`useChat.ts` warnings are accepted).

- [ ] **Step 2: Visual verification loop** (`?layout=g`)

Run `npm run dev` (backend reachable via `.env.local`); open `http://localhost:5173/?layout=g`. Verify and iterate until all hold:
  - [ ] A sun/moon toggle sits in the header (after the mana dots, past a divider).
  - [ ] Clicking it flips the WHOLE frame light↔dark — rail, header, thread, composer, panel, welcome.
  - [ ] Dark mode is near-black (`#0e1117`) glass; text is clearly readable (light on dark).
  - [ ] The accent **glows** in dark mode on: rail logo tile, assistant pip, send button, active mana dot.
  - [ ] Cycle all 6 mana dots in dark mode — the accent + glow recolor (brighter/electric hues), surfaces stay dark; then in light mode they use the muted hues.
  - [ ] User pills in dark mode are a glass tint with an accent hairline (not the light soft-tint).
  - [ ] `[[card]]` links + tooltips work in both modes; streaming + "Thinking…" readable in both.
  - [ ] Reload restores the last mode (localStorage `lotus-aether-mode`).
  - [ ] Other layouts unaffected: `?layout=classic` still light/brown with parchment noise; `?layout=d` etc. unchanged.
  - [ ] Mobile (~390px): toggle reachable, layout intact in both modes.

- [ ] **Step 3: Update `CLAUDE.md` layout note (local, gitignored — apply; won't commit)**

Append to the `g` line under "Layout Variants": note that Aether has a light/dark toggle (light = Aether, dark = "Arcane glass"). If `git add` reports it ignored, leave it applied locally.

- [ ] **Step 4: Use `superpowers:requesting-code-review`** before finishing the branch.

---

## Self-Review notes (author)

- **Spec coverage:** mode state + persistence + default light (Task 2 Steps 2–3) ✓; `dark` class on root (Task 2 Step 4) ✓; sun/moon toggle in header w/ aria-labels (Task 2 Step 5) ✓; `accentForDark` electric map (Task 1) ✓; `--ax` by mode + mana dots by mode (Task 2 Steps 3,5) ✓; glow on logo/pip/send/active-dot (Task 3) ✓; dark surface palette table → dark rules (Task 3) ✓; user pill glass tint in dark (Task 3) ✓; card-link/links use `--ax` (existing) ✓; tests for accentForDark + toggle persistence (Tasks 1,2) ✓; visual loop incl. both-modes × all-themes + reload + other-layouts-unaffected (Task 4) ✓.
- **Type consistency:** `accentForDark(theme: Theme): string` defined in Task 1, consumed in Task 2. `AetherMode = "light" | "dark"`, `MODE_KEY`, `loadMode` defined and used consistently. `mode === "dark" ? styles.dark : ""` references the `.dark` class added in Task 3 (CSS-module class; if absent in Task 2 interim it's simply unstyled — documented).
- **Test isolation:** `beforeEach(localStorage.clear())` added to AetherLayout.test.tsx so mode persistence doesn't leak across tests in the shared in-memory storage shim.
- **No placeholders;** all edits give exact old→new code.

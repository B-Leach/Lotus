# Aether Dark Mode ("Arcane Glass") Design

**Date:** 2026-06-18
**Status:** Approved (pending spec review)
**Branch:** `feat/mtg-layout-variants`

## Goal

Give the Aether layout (`g`) a light/dark mode toggle. **Light = Aether** (the current
design). **Dark = "Arcane glass"** — near-black, frosted-glass surfaces with a brighter,
glowing mana accent. The structure, components, and behavior are identical in both modes;
only the palette/accent/glow differ.

## Non-Goals

- No change to other layouts (`classic`, `d`, `e`, `f`) or to the global mana-theme system.
- Not a global app dark mode — the toggle is scoped to the Aether layout only.
- No backend / `useChat` changes.

## Design

### Mode state

- `AetherLayout` holds `mode: "light" | "dark"`, initialized from `localStorage`
  (`lotus-aether-mode`), defaulting to `"light"`. Changing it persists to `localStorage`.
- The root element gets the `dark` CSS-module class appended when `mode === "dark"`
  (`className={\`${styles.root} ${mode === "dark" ? styles.dark : ""}\`}`). All dark styling
  is written as `.dark .X` descendant rules in the same CSS module.

### Toggle control

- A sun/moon button in the header, after the mana dots (with a thin divider). lucide `Sun`
  (shown in dark mode → click switches to light) / `Moon` (shown in light mode → click
  switches to dark). `aria-label` reflects the action: "Switch to dark mode" /
  "Switch to light mode".

### Accent: brighter + glowing in dark

- A second accent map `accentForDark(theme)` returns luminous/electric versions per mana
  color (for glow against near-black):
  - `default` → `#e0b85c`
  - `white` → `#e8dca0`
  - `blue` → `#4aa8e0`
  - `black` → `#a98fd6`
  - `red` → `#ef6a62`
  - `green` → `#54e0c7`
  (fallback → `#e0b85c`).
- The root `--ax` is set to `accentFor(theme)` in light mode and `accentForDark(theme)` in
  dark mode.
- In dark mode, a soft glow (`box-shadow: 0 0 12px color-mix(in srgb, var(--ax) 55%,
  transparent)`) is applied to: the rail logo tile, the assistant pip, the send button, and
  the active mana dot — the "arcane" feel.

### Dark surface palette (Arcane glass)

| Token | Light (current) | Dark |
|---|---|---|
| page bg | `#f6f3ec` | `#0e1117` |
| rail bg | accent-tinted `#efe9dd` | `#12161f` |
| raised/glass (composer, panel-new hover) | `#ffffff` | `#161b24` |
| hairline | `#e2dacb` | `#232a36` |
| header border | `#e7e0d1` | `#1c2330` |
| primary ink text | `#1c1a16` | `#e8edf5` |
| body text | `#2a2620` | `#c4cdda` |
| muted text | `#a89e8a` | `#5f6b7d` |
| code/pre bg | `#efe9dd` | `#1a212e` |

- **User pill (dark):** glass tint — `background: color-mix(in srgb, var(--ax) 14%,
  transparent)`, `border: 0.5px solid color-mix(in srgb, var(--ax) 45%, transparent)`,
  text `#e8edf5`. (Light mode keeps its current soft-tint pill.)
- **Card-link underline, links, active panel/chip borders** continue to use `var(--ax)`
  (now the brighter dark accent), so they read well on dark automatically.
- The rail logo mask stays `#fff` fill (crisp on the accent tile in both modes).

### Files

```
frontend/src/layouts/g-aether/
├── accent.ts            # MODIFY — add accentForDark()
├── accent.test.ts       # MODIFY — test accentForDark()
├── AetherLayout.tsx     # MODIFY — mode state + persistence, toggle button, --ax by mode, dark class
├── AetherLayout.test.tsx# MODIFY — toggle test (label flips + persists)
└── styles.module.css    # MODIFY — add `.dark` + `.dark .X` rules and dark-mode glows
```

No new files; no registry change (still one layout `g`).

## Testing

- `accent.test.ts`: `accentForDark` returns the mapped electric hex for each of the 6 themes
  and the default fallback for an unknown theme.
- `AetherLayout.test.tsx`: the mode toggle button starts as "Switch to dark mode" (light
  default); clicking it persists `lotus-aether-mode = "dark"` and the label becomes
  "Switch to light mode". Existing Aether tests remain green.
- Manual visual loop (`?layout=g`): toggle flips the whole frame light↔dark; dark is near-black
  glass with a glowing accent; all 6 mana dots recolor the glow in dark; text is readable in
  both; reload restores the last mode; mobile usable.

## Risks / considerations

- **`color-mix` + glow** are already used in the codebase (Orrery, the recent Aether accent
  pass), so browser support is fine for the dev/target environment.
- **Mode vs. global theme are independent axes:** `mode` (light/dark) is Aether-local;
  `chat.theme` (mana color) stays global. Both must compose — verify each mana color in both
  modes.
- **Default light:** first-time Aether users land in light ("Aether"), matching the name.

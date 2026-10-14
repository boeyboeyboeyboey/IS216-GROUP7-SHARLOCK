# Unified Game Theme (Town Palette, Realistic Type) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phishing Post-Mortem and Social Engineering Simulator use the town's green and cream instead of blue and purple, keeping their realistic system-font screens.

**Architecture:** Both games already take every colour from `--game-*` variables on their root class, so the change is a token swap plus one new pair of tokens for the title bar. A small Vitest test pins the palette: no old accent hexes remain and every text, bar and focus-ring pairing meets contrast limits. Docs are updated in the same change.

**Tech Stack:** plain CSS custom properties, Vitest (jsdom client project), Playwright (existing Phishing spec), pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-unified-game-theme-design.md`

## Global Constraints

- No commits or staging unless Eric asks (user CLAUDE.md). `git add .` only if asked.
- Edit only `client/src/games/phishing-post-mortem/phish.css`, `client/src/games/social-engineering-simulator/sim.css`, the new test file, and docs (`DESIGN.md`, `client/src/games/phishing-post-mortem/README.md`, `TASKS.md`). No component, logic, copy, layout, font or test-ID changes. Keep CRLF line endings in the existing files.
- Games keep every rule under `.phish-game` / `.soc-game` with local `--game-*` variables; nothing may touch `:root`, `html`, `body`, the shared shell or another module.
- Both games keep the system font stack; no pixel font, hard shadows or square corners inside them (Option C is parked).
- The CLI Cyber Defender is unchanged.
- Code comments: lowercase, minimal, no trailing full stop.
- Contrast limits: text 4.5:1, focus ring and UI outlines 3:1, measured on the final values.
- Phishing is Athithya's game and Social Engineering belongs to its own contributor: variable and colour edits only, and tell the owners in the `TASKS.md` note.

## The palette (decided here; implementers do not pick colours)

Shared values for both games. Existing `--game-good*`, `--game-bad*`, `--game-warn*`, `--game-ink`, `--game-muted` and `--game-surface` keep their current values in each file.

| Variable | Old (Phishing / Social) | New | Note |
|---|---|---|---|
| `--game-bg` | `#f3f4f6` / `#eef1f6` | `#eef3e6` | pale green-grey page tint |
| `--game-line` | `#d8dce3` / `#d4dae4` | `#d3dcc8` | hairlines |
| `--game-line-strong` | `#b6bdc8` / `#aab3c2` | `#b9c7b0` | panel borders |
| `--game-accent` | `#1b64d1` / `#4338ca` | `#50634d` | the town's `--border-strong`; white text on it is 6.5:1 |
| `--game-accent-soft` | `#e8f0fd` / `#eceafe` | `#e3eacb` | the town's `--accent-secondary` |
| `--game-bar` (new) | none | `#a8c98a` | title bar fill (the town's `--accent-primary`) |
| `--game-bar-ink` (new) | none | `#25331f` | text on the bar, 7.2:1 |

Measured pairings for these values: ink on bg 13.1, muted on bg 5.2, muted on accent-soft 4.7, accent on white 6.5, accent on accent-soft 5.2, accent against white as a focus ring 6.5. `--game-good` (`#1c6b47`) is almost the same lightness as the new accent, so the success state must keep its text label and never rely on colour alone (see Review Focus).

## Review Focus

- A success state (`is-correct`, `is-accused`, `is-resisted`) next to a green accent: its text label and border must remain, and it must not look like a selected row.
- Focus rings and checkbox/radio accents on cream and white: visible in every state, including the Evidence panel and the chat composer.
- Selected inbox row and disabled controls: the selected tint (`--game-accent-soft`) must stay distinguishable from the `--game-bg` page tint.
- Narrow widths (375 and 576px) where the title bar wraps: bar text stays on the light bar with 4.5:1.
- Leaving a game for the town or About page: no game variable or rule leaks into shared pages.

---

### Task 1: Palette test (red)

**Files:**
- Create: `client/src/games/__tests__/game-palette.test.js`

**Interfaces:**
- Produces: `readTokens(css: string, rootClass: string): Record<string, string>` (local to the test) returning the `--game-*` declarations in the first `.rootClass { ... }` block; `contrast(a: string, b: string): number` (WCAG relative-luminance ratio for `#rrggbb`).

- [ ] **Step 1: Write the test.** Import both stylesheets with `?raw` (`../phishing-post-mortem/phish.css?raw`, `../social-engineering-simulator/sim.css?raw`). For each of `{ name: 'phishing', css, rootClass: '.phish-game' }` and `{ name: 'social engineering', css, rootClass: '.soc-game' }` write three tests:
  - `<name> keeps no blue or purple accent`: the css string does not match `/#1b64d1|#e8f0fd|#4338ca|#eceafe/i`.
  - `<name> text pairings meet 4.5:1`: for each of `ink/bg`, `ink/surface`, `muted/bg`, `muted/surface`, `muted/accent-soft`, `accent/surface`, `accent/bg`, `accent/accent-soft`, `#ffffff/accent`, `bar-ink/bar`, `good/good-soft`, `bad/bad-soft`, plus `warn/warn-soft` for social engineering only, assert `contrast(...)` is at least 4.5, with the pair name in the failure message.
  - `<name> focus ring meets 3:1`: `accent` against `surface` and against `bg` is at least 3.
- [ ] **Step 2: Run it and see it fail.** Run: `pnpm exec vitest run --project client client/src/games/__tests__/game-palette.test.js`. Expected: FAIL (old hexes present; `--game-bar` undefined).
- [ ] **Step 3: Format.** Run: `pnpm exec prettier --write client/src/games/__tests__/game-palette.test.js`.

### Task 2: Phishing palette

**Files:**
- Modify: `client/src/games/phishing-post-mortem/phish.css` (variable block at lines 2-22; the `.sharmail-bar` rule near line 80)

**Interfaces:**
- Consumes: the palette table above.
- Produces: `--game-bar`, `--game-bar-ink` on `.phish-game`, used by `.sharmail-bar`.

- [ ] **Step 1: Replace the variable values** listed in the table and add `--game-bar` and `--game-bar-ink` to the `.phish-game` block.
- [ ] **Step 2: Switch the title bar** (`.sharmail-bar`) from `background: var(--game-accent); color: #ffffff` to `background: var(--game-bar); color: var(--game-bar-ink)`. Check the mailbox label (`.sharmail-mailbox`, which uses `opacity: 0.92`) still meets 4.5:1 on the bar; raise it to full opacity if it does not.
- [ ] **Step 3: Check the other places that assume a dark accent fill:** `.sharmail-submit` and `.sharmail-accuse` keep `#ffffff` text on the accent (6.5:1, fine); `.sharmail-row.is-open` uses the accent-soft tint with an accent left border; confirm it is still visibly different from `--game-bg` in the screenshot.
- [ ] **Step 4: Run the palette test.** Run: `pnpm exec vitest run --project client client/src/games/__tests__/game-palette.test.js -t phishing`. Expected: the three phishing tests PASS.
- [ ] **Step 5: Run the Phishing e2e spec.** Run: `pnpm test:e2e phishing-post-mortem`. Expected: 21 passed (both projects).

### Task 3: Social Engineering palette

**Files:**
- Modify: `client/src/games/social-engineering-simulator/sim.css` (variable block at lines 2-23; `.soc-convo-head` near line 148)

- [ ] **Step 1: Replace the variable values** from the table and add `--game-bar` and `--game-bar-ink`.
- [ ] **Step 2: Switch the chat header** (`.soc-convo-head`, currently `color: #ffffff; background: var(--game-accent)`) to `background: var(--game-bar); color: var(--game-bar-ink)`; keep the `.soc-convo-turns` opacity at 4.5:1 or better.
- [ ] **Step 3: The user's chat bubble** (`.soc-message.is-you`, white on accent) stays; confirm it reads against the `--game-bg` thread background.
- [ ] **Step 4: Run the palette test.** Run: `pnpm exec vitest run --project client client/src/games/__tests__/game-palette.test.js`. Expected: all six tests PASS.

### Task 4: Docs

**Files:**
- Modify: `DESIGN.md` (the Phishing paragraph in "Game design freedom and isolation", around line 39; the "Fit-to-window layout" section needs no change)
- Modify: `client/src/games/phishing-post-mortem/README.md` (line 33, which says "a blue accent")
- Modify: `TASKS.md` (add one bullet to the UI-FIT review record: scope, owners to review, verification, what is not run)

- [ ] **Step 1: Update `DESIGN.md`.** Replace "a neutral grey surface and a blue accent" with the new description (system font stack, pale green-grey surface, the town's green and cream accents), and add one sentence to the game-isolation section: games share the town palette but keep realistic type, and the pixel-everywhere option is parked. Keep CRLF endings (read and write with `newline=''`).
- [ ] **Step 2: Update the Phishing README line** to match.
- [ ] **Step 3: Add the `TASKS.md` bullet.** Include: the variable files touched, the new test, Phishing and Social Engineering owners should review, CLI untouched, and what was not run.
- [ ] **Step 4: Check formatting.** Run: `pnpm exec prettier --check --stdin-filepath DESIGN.md < <(sed 's/\r$//' DESIGN.md)` (and the same for `TASKS.md`). Expected: exit 0.

### Task 5: Verify

- [ ] **Step 1: Full checks.** Run `pnpm lint`, `pnpm test:unit` and `pnpm test:e2e`. Expected: lint clean; unit failures limited to the 21 already failing before this work; e2e matching its recorded baseline. Report exact results.
- [ ] **Step 2: Look at it.** With the dev server running, take screenshots of Phishing (inbox, open message, Evidence panel open, debrief) and Social Engineering (briefing, chat, debrief) at 1280 x 720 and 375 x 667. Confirm no blue or purple, readable focus rings (Tab through each screen), and the success and error states still read as distinct from the accent.
- [ ] **Step 3: Check for leaks.** After leaving each game, load the town and About page and compare the computed `background-color` of `body` and `.portal-shell` with a fresh load; they must match.
- [ ] **Step 4: Record results** in the `TASKS.md` bullet. No commit.

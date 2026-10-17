# Back-Link and Repeated-Notice Consistency: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Back to town" looks and behaves the same on every game and preview page, the Town page states "results are not saved" once, and the header username is readable on hover.

**Architecture:** CSS and class-binding edits only in the three games (their owners did not authorise logic changes). The shared look comes from one additive rule in `main.css`; each game keeps its own colours through its scoped variables.

**Tech Stack:** Vue 3 SFCs, plain CSS, Vitest, Playwright.

**Spec:** `docs/superpowers/bugs/2026-10-17-ui-ux-audit-findings.md` (sections 4.1, 4.2 and the corrections in section 10).

## Global Constraints

- No commits or staging unless the user asks (user CLAUDE.md). If asked, stage with `git add .` only.
- Game styles stay inside `client/src/games/<game-id>/`, scoped under the game root class and local `--game-*` variables. Never override `:root`, `html`, `body`, the shared shell or navbar from game CSS (`DESIGN.md` and `agents.md` section 8).
- Games owned by other contributors (CLI: Xin Lei, Phishing: Athithya, Social Engineering: Eric, News: Boey) get CSS, class-binding and attribute edits only: no logic, props, emits, API or test-ID changes. Tell each owner what changed (record in `TASKS.md`).
- Primary touch targets are at least 44px (`DESIGN.md:80`). Spacing uses 0.5, 0.8, 1.3, 2.1, 3.4rem.
- Keep existing tests passing: `client/src/games/cli-cyber-defender/__tests__/components.test.js:208` asserts "Back to town" is absent while in a game; `tests/e2e/portal.spec.js:68` asserts the town player contains "Results are not saved"; `tests/e2e/portal.spec.js:190` asserts it is visible in the mobile drawer.
- Code comments: lowercase, minimal, no trailing full stop.
- Measured on 2026-10-17 at 1280x720 (x, y, size): SQL/Regex preview 274, 88, 131x44; Phishing 292, 88, 95x32; Social Engineering 328, 88, 121x32; CLI 1065, 98, 145x32. The CLI link sits on the right because `.cli-game.is-fitted .cli-nav` sets `justify-content: flex-end` (`cli.css:1693-1699`). In fitted mode all three games also shrink the link's `min-height` below 44px (`cli.css:1701-1704`, `phish.css:800`, `sim.css:650`).

## Review Focus

- A game's fit must not regress: Phishing, Social Engineering and CLI each fit 1280x720 today; raising the link to 44px must not push any of them into page scroll.
- CLI in-game (menu visible, link hidden): the menu stays right-aligned.
- Narrow windows (375px): the link stays on screen and tappable; the Phishing link was measured at y of -516px on the play state at 375px, so it scrolls away.
- The Town page at 1280x720 still fits after the footnote change.
- Reduced-motion and keyboard focus ring on the link remain visible (3px outline).

---

### Task 1: One look and one place for "Back to town"

**Files:**

- Modify: `client/src/assets/styles/main.css` (add one additive `.back-link` rule next to `.text-link`, line about 255)
- Modify: `client/src/games/phishing-post-mortem/PhishingPostMortem.vue:83`, `client/src/games/social-engineering-simulator/SocialEngineeringSimulator.vue:79`, `client/src/games/cli-cyber-defender/CliDefenderGame.vue:123` (class binding only)
- Modify: `client/src/games/phishing-post-mortem/phish.css:33-40,800`, `client/src/games/social-engineering-simulator/sim.css:42-48,650`, `client/src/games/cli-cyber-defender/cli.css:71-78,1693-1704`
- Modify: `TASKS.md` (note for the three owners)
- Test: `client/src/games/cli-cyber-defender/__tests__/components.test.js` (must still pass); manual measurement below

**Interfaces:**

- Produces: CSS class `back-link` (inline-flex, 0.5rem gap, `min-height: 44px`, font-weight 600, no underline until hover) that every game link carries in addition to its own class.

- [ ] **Step 1: Add `.back-link` to `main.css`.** Same definition as the existing `.text-link` (44px, inline-flex, 0.5rem gap) plus `font-weight: 600`; colour is not set so each game keeps its `--game-*` accent.
- [ ] **Step 2: Add `back-link` to each game's `RouterLink` class** (`phish-back back-link`, `soc-back back-link`, `cli-back back-link`). Class binding only.
- [ ] **Step 3: Keep the 44px target in fitted mode.** In the three fitted rules, replace `min-height: 0` with `min-height: 44px` and cancel the extra height with `margin-block: -0.5rem` (negative margin keeps the page height unchanged). Remove padding rules that duplicate it.
- [ ] **Step 4: Move the CLI link to the left.** In `cli.css:1693-1699` change `.cli-game.is-fitted .cli-nav` to `justify-content: flex-start`. The in-game menu already has `ms-auto`, so it stays right-aligned.
- [ ] **Step 5: Run unit tests.** Run: `pnpm exec vitest run client/src/games`. Expected: all pass (the in-game "no Back to town" assertion still holds).
- [ ] **Step 6: Measure.** For each of the three games' briefing screens and the SQL and Regex previews at 1280x720 and 375x667, record the link's `getBoundingClientRect()` (left, top, width, height) and `document.documentElement.scrollHeight <= innerHeight` (desktop). Expected: all heights 44px, the CLI left edge no longer near the right edge, no game scrolls. The left edge may still differ by a few tens of pixels between games because each game centres its own column; accept this and report the numbers instead of restructuring the games.

### Task 2: State "results are not saved" once on the Town page; readable header username

**Files:**

- Modify: `client/src/views/Dashboard.vue:68-71` (footnote copy)
- Modify: `client/src/components/portal/Navbar.vue:44-52` (`title` attribute on the account link)
- Test: `tests/e2e/portal.spec.js` (lines 68 and 190 must still pass)

**Interfaces:**

- Produces: nothing other tasks use.

- [ ] **Step 1: Shorten the town footnote.** Replace its text with `Explore at your own pace.` The player badge keeps "Results are not saved", which the e2e test asserts. No test references the old footnote text (checked by grep on 2026-10-17).
- [ ] **Step 2: Add `:title="user.username"` to the header account link.** The visible name stays truncated at 10 characters; the title shows the full name on hover.
- [ ] **Step 3: Run the unit tests and the portal e2e.** Run: `pnpm exec vitest run client/src/__tests__` and `pnpm test:e2e -- portal`. Expected: pass. If the e2e cannot run locally, say so rather than skipping silently.
- [ ] **Step 4: Measure.** On `/` at 1280x720, `document.documentElement.scrollHeight <= innerHeight` is still true.

## Open question for the user

`/progress` renders the same profile card as `/profile` but keeps the sidebar account box. Hide it there too (same `hideAccountSummary` route flag)? Not planned until answered.

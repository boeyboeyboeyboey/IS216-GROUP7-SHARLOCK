# Fit Every Town and Game Page to the Window: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a laptop-height window, the town map and every game page (each state: briefing, play, debrief) fit without page scroll, and a test proves it.

**Architecture:** One shared token, `--shell-chrome` (header + main padding + footer), lets each page size itself to `calc(100dvh - var(--shell-chrome))`. Each page keeps its own CSS: the flexible region (message thread, map, email list, terminal) absorbs spare space and scrolls inside itself. A single Playwright spec measures `scrollHeight <= innerHeight` for every route and state, so regressions are caught without re-prompting.

**Tech Stack:** Vue 3 SFCs, plain CSS, Playwright (`tests/e2e`), pnpm.

**Spec:** the user's chat requests of 2026-10-14 ("make everything fit on 1 page", "the landing page still needs me to scroll", "you missed the debrief page", "run through every page and test the page height"). No separate design doc.

## Global Constraints

- No commits or staging (user CLAUDE.md: never commit unless asked; `git add .` only if asked).
- Game styles stay inside `client/src/games/<game-id>/`, scoped under the game root class and local `--game-*` variables. Never override `:root`, `html`, `body`, the shared shell or navbar from game CSS (AGENTS.md section 8).
- Shared edits are additive and recorded: one token in `client/src/assets/styles/main.css`, town rules in `town.css`, preview rules in `main.css`. No palette, registry or camera changes.
- Keep the town camera contract: `@panzoom/panzoom` owns transform math, 100-200% zoom, +/- and Reset controls, Jump to, hover/focus/tap cards, Escape/Close focus restoration.
- Keep accessibility: visible focus, 44px primary touch targets where the control is primary, reduced-motion rules, no page-wide horizontal scroll at 375/576/768/992/1200/1440px.
- Code comments: lowercase, minimal, no trailing full stop.
- Other contributors' games (CLI: Xin Lei, Phishing: Athithya, News: Boey) get CSS and class-binding edits only: no logic, props, emits, API or test-ID changes. The user authorised this in chat on 2026-10-14; each owner should be told.
- Fit target viewport: 1280 x 720 (X1 Carbon Gen 12 at 150% scaling, minus browser chrome). Pages must also not regress at 1440 x 900. Below 768px wide, or when a window is shorter than a page's stated `min-height`, natural page scroll is allowed.

## Review Focus

- Very short window (under 600px tall): the flexible region stops at its `min-height` and the page scrolls; nothing is clipped or unreachable.
- Browser zoom 125-150% (effective viewport shrinks): same behavior as above; the primary action stays visible.
- Long content inside the flexible region (8 chat turns, 20 emails, long debrief): scrolls inside its own region and keeps keyboard focus and the primary action reachable.
- State changes (briefing to play to debrief, error banners, loading state): each state fits, and none leaves a stale `is-fitted` height on the root.
- Leaving a game: the next shared page (town, About) has no leaked height or overflow rules.

---

## Baseline (measured on the running dev server, 1523 x 791 window, before work)

| Page / state | scrollHeight (px) | Fits |
|---|---|---|
| Town map `/` | 1082 | no |
| Cyber News `/games/threat-briefing` (town + dialog) | 1082 | no |
| CLI Cyber Defender, briefing | 1078 | no |
| Phishing Post-Mortem, inbox | 2246 | no |
| SQL and Regex previews | 989 | no |
| Social Engineering, briefing | 791 | yes (after fix) |
| Social Engineering, chat | 791 | yes (after fix) |
| Social Engineering, debrief | tall (screenshot 2026-10-14 211033) | no |

The remaining states (CLI play and debrief, Phishing case and debrief, About, Profile, Coming soon, Not found) are measured by Task 1.

## File Structure

- Create `tests/e2e/page-fit.spec.js`: one spec, one table of `{ name, route, setup }` entries, one assertion helper.
- Modify `client/src/assets/styles/main.css`: add `--shell-chrome`; preview and utility page rules.
- Modify `client/src/assets/styles/town.css` and `client/src/views/Dashboard.vue`: town fit.
- Modify `client/src/games/social-engineering-simulator/{sim.css,SocialEngineeringSimulator.vue,components/DebriefPanel.vue}`: debrief fit.
- Modify `client/src/games/cli-cyber-defender/cli.css` (and class bindings in `CliDefenderGame.vue`) and `client/src/games/phishing-post-mortem/phish.css`.
- Modify `client/src/games/threat-briefing/news.css` only if the dialog itself overflows.

---

### Task 1: Page-fit spec (red baseline)

**Files:**
- Create: `tests/e2e/page-fit.spec.js`

**Interfaces:**
- Produces: `expectFits(page)` asserting `document.documentElement.scrollHeight <= window.innerHeight + 1` and `scrollWidth <= innerWidth`; a `PAGES` table other tasks make green.

- [ ] **Step 1: Write the spec.** `test.use({ viewport: { width: 1280, height: 720 } })`. One `test` per `PAGES` entry named `fits the window: <name>`. Entries (route, setup): town `/`; news `/games/threat-briefing`; SQL `/games/sql-injection-arcade`; Regex `/games/regex-defender`; About `/about`; Profile `/profile`; Not found `/nope`; SOC briefing, SOC chat (click "Begin the conversation"), SOC debrief (click "Refuse and end" straight away); CLI briefing, CLI play, CLI debrief; Phishing inbox, Phishing case (open first message), Phishing debrief. Reuse the flows already in `cli-cyber-defender.spec.js` and `phishing-post-mortem.spec.js` for the three deep states; copy their selectors, do not invent new ones. Include the font-blocking `beforeEach` from `portal.spec.js`.
- [ ] **Step 2: Run it and record the baseline.** Run: `pnpm exec playwright install chromium` once, then `pnpm test:e2e -- page-fit`. Expected: FAIL for every page except SOC briefing and chat; copy the printed heights into the Baseline table above.
- [ ] **Step 3: Format.** Run: `pnpm exec prettier --write tests/e2e/page-fit.spec.js`.

### Task 2: Shared token and Social Engineering debrief

**Files:**
- Modify: `client/src/assets/styles/main.css` (add `--shell-chrome: 236px` on `:root`, one line)
- Modify: `client/src/games/social-engineering-simulator/sim.css`, `SocialEngineeringSimulator.vue`

**Interfaces:**
- Produces: `--shell-chrome` (length). Consumed by every later task as `calc(100dvh - var(--shell-chrome))`.

- [ ] **Step 1: Test.** In Task 1's spec the "SOC debrief" entry fails; that is the red test.
- [ ] **Step 2: Add the token** and switch `.soc-game.is-fitted` from its local `--soc-chrome` to `var(--shell-chrome)`.
- [ ] **Step 3: Fit the debrief.** Apply `is-fitted` to the result state too (`fitsViewport` becomes true when `status` is briefing, in conversation, or `result` is set). In `.soc-debrief` use a two-column grid at 900px and up (score head plus breakdown left, "what happened" and notes right), with `overflow-y: auto` and `flex: 1 1 auto; min-height: 0` as the fallback. The "play again" button stays visible (sticky at the panel bottom).
- [ ] **Step 4: Run** `pnpm test:e2e -- page-fit -g "Social"`. Expected: 3 passed.

### Task 3: Town map

**Files:**
- Modify: `client/src/assets/styles/town.css` (`.town-viewport` height at line ~229, intro and footnote spacing), `client/src/views/Dashboard.vue` (class hooks only if needed)

- [ ] **Step 1: Red test** is the "town" and "news" entries from Task 1.
- [ ] **Step 2: Resize.** Replace `height: clamp(360px, 62svh, 620px)` with a height that fills what is left under the intro: `.town-dashboard` becomes a flex column of height `calc(100dvh - var(--shell-chrome))` (min-height 520px), the map frame takes `flex: 1 1 auto; min-height: 0`, and the viewport fills the frame. Compress `.town-intro` (smaller heading, single line eyebrow) and move `.town-footnote` into one line. Panzoom must be told the viewport changed: confirm in `TownMap.vue` that its ResizeObserver already re-clamps; if it does not, report it rather than adding a second camera controller.
- [ ] **Step 3: Verify the camera.** In the browser: drag, +/-, Reset view, Jump to, a building card open and Escape focus restore at 1280 x 720 and 1440 x 900.
- [ ] **Step 4: Run** `pnpm test:e2e -- page-fit -g "town|news"`, then `pnpm test:e2e -- portal`. Expected: pass, with the existing town journeys unchanged.

### Task 4: Preview, About, Profile, Not found, Coming soon

**Files:**
- Modify: `client/src/assets/styles/main.css` (`.case-preview`, `.portal-main` rules for utility pages only if a page still overflows)

- [ ] **Step 1: Red tests** from Task 1. Previews measure 989px.
- [ ] **Step 2: Tighten** `.case-preview` vertical spacing and art size so SQL and Regex previews fit at 1280 x 720; leave pages that already fit alone.
- [ ] **Step 3: Run** `pnpm test:e2e -- page-fit -g "SQL|Regex|About|Profile|Not found"`. Expected: pass.

### Task 5: CLI Cyber Defender (briefing, play, debrief)

**Files:**
- Modify: `client/src/games/cli-cyber-defender/cli.css`; add an `is-fitted` binding in `CliDefenderGame.vue` (class only)

- [ ] **Step 1: Read** `cli.css` sections for `.cli-game`, `.cli-intro`, `.cli-console`, `.cli-stage`, the terminal panel, command reference and debrief before editing; note every `min-height` and `vh` rule.
- [ ] **Step 2: Fit each phase.** Briefing: compact intro and panel. Play: the terminal output region is the flexible one (`flex: 1 1 auto; min-height: 0; overflow-y: auto`); HUD, incident banner and command reference keep their size. Debrief: two-column layout at 900px and up with an internal scroll fallback.
- [ ] **Step 3: Run** `pnpm test:e2e -- page-fit -g "CLI"` then `pnpm test:e2e -- cli-cyber-defender`. Expected: pass, no change to the existing journeys.

### Task 6: Phishing Post-Mortem (inbox, case, debrief)

**Files:**
- Modify: `client/src/games/phishing-post-mortem/phish.css`

- [ ] **Step 1: Read** the `.phish-game`, `.sharmail-*` rules, especially the shell grid and the two panes.
- [ ] **Step 2: Fit.** The shell is a fixed-height grid (`calc(100dvh - var(--shell-chrome))`, `min-height` 480px). Inbox list and reading pane each scroll inside themselves; the briefing hint and verdict panel sit in the reading pane; the strap is hidden once the shell is open. The narrow (mobile) pane-swap layout is unchanged.
- [ ] **Step 3: Run** `pnpm test:e2e -- page-fit -g "Phishing"` then `pnpm test:e2e -- phishing-post-mortem`. Expected: pass, including the existing responsive-layout test.

### Task 7: Verify, document, hand over

**Files:**
- Modify: `TASKS.md` (short coordination note listing the touched game files and owners)
- Modify: this plan (fill the After table)

- [ ] **Step 1: Full pass.** Run: `pnpm lint`, `pnpm exec prettier --check` on the touched files, `pnpm test:unit`, `pnpm test:e2e -- page-fit portal`. Report exact output; the two composer unit tests already failed before this work and are not caused by it.
- [ ] **Step 2: Live check.** In the browser at 1280 x 720 and the window's own size, walk every route and state; confirm `scrollHeight <= innerHeight`, no horizontal scroll at 375 and 768px, and no leaked height after leaving a game for the town and About.
- [ ] **Step 3: Record** the After table in this plan, the touched files per owner in `TASKS.md`, and list the unrun checks. No commit.

## After

Measured with a temporary Playwright spec (`tests/e2e/page-fit.spec.js`, deleted at the user's request) at 1280 x 720; heights are page `scrollHeight` in px, before then after. All targets pass.

| Page / state | Before | After |
|---|---|---|
| Town map | 1041 | fits |
| News dialog over the town | 1041 | fits |
| SQL and Regex previews | 1005 | fits |
| Social Engineering briefing, chat | fit after the first pass | fits |
| Social Engineering debrief | 1172 | fits (two columns at 900px and up) |
| CLI briefing / play / debrief | 1123 / 1159 / 1439 | fits (briefing and debrief scroll inside the panel if needed) |
| Phishing inbox / open message / debrief | 2570 / 2832 / 4141 | fits (inbox and reading pane scroll independently) |
| About, Profile | 1742, 1369 | not changed: long prose pages, out of scope |

Plan deviations: About and Profile were dropped from scope; the forced three-column CLI template row broke the existing "template buttons at every width" test, so it became a container query; Phishing needed a `position: relative` pane because absolutely positioned visually-hidden spans escaped the scroll container and stretched the page; the reading pane now scrolls to the top on a new message or debrief.

Baseline for unrelated failures: 21 unit tests fail with and without these changes, and the mobile portal drag test failed before any edit.

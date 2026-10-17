# Accessibility, Small Town Text and a Fit Test: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the one measured axe violation, make the smallest town text legible, stop an instruction line being cut off at phone width, and (if the user approves) add an automated test that fails when a fitted page scrolls.

**Architecture:** Small attribute and CSS edits in the Phishing game and `town.css`, plus one optional Playwright spec.

**Tech Stack:** Vue 3 SFCs, plain CSS, Playwright, axe-core (spec only, not added to the repo unless approved).

**Spec:** `docs/superpowers/bugs/2026-10-17-ui-ux-audit-findings.md` (sections 5.1, 5.2, 5.5 and the corrections in section 10).

## Global Constraints

- No commits or staging unless the user asks (user CLAUDE.md). If asked, stage with `git add .` only.
- Game owners get CSS, class-binding and attribute edits only: Phishing is Athithya's. No logic, props, emits, API or test-ID changes. Tell the owner (record in `TASKS.md`).
- `DESIGN.md:72` keeps compact town metadata: raise only the values under 12px to 12px; do not enlarge the whole town page.
- Town page must keep fitting 1280x720 (`town.css` fit block) and the camera contract in `DESIGN.md` (panzoom, Jump to, focus restore).
- Code comments: lowercase, minimal, no trailing full stop.
- Dependencies: do not add `axe-core` or any package to `package.json` without the user's approval.

## Review Focus

- Keyboard users in the Phishing reading pane: Tab reaches the pane, a visible focus ring shows, and code that calls `readingPane.focus()` (lines 47 and 54 of `PhishingPostMortem.vue`) still works with `tabindex="0"`.
- Screen readers: the pane keeps `aria-label="Reading pane"`.
- 375px phone: the Phishing verdict instruction wraps and is fully readable; the placeholder state does not make the verdict panel taller than the window.
- Town buildings at 1280x720: raising 10px and 11px text to 12px does not make hint labels collide or push the map off screen.
- The fit test must not be flaky: it waits for network idle and fonts before measuring.

---

### Task 1: Phishing reading pane is keyboard reachable; verdict instruction wraps

**Files:**

- Modify: `client/src/games/phishing-post-mortem/PhishingPostMortem.vue:120` (`tabindex="-1"` to `tabindex="0"`)
- Modify: `client/src/games/phishing-post-mortem/phish.css:876-881` (the `em` rule)
- Test: `tests/e2e/phishing-post-mortem.spec.js` (existing, uses `.sharmail-pane-reading` at line 152), `client/src/games/phishing-post-mortem` unit tests

**Interfaces:**

- Produces: nothing other tasks use.

- [ ] **Step 1: Change `tabindex="-1"` to `tabindex="0"` on the reading pane.** Measured axe violation: `scrollable-region-focusable` (serious, WCAG 2.1.1) on this element. `focus()` calls still work on `tabindex="0"`.
- [ ] **Step 2: Let the verdict instruction wrap.** In `phish.css`, scope a rule so that `.phish-game .sharmail-verdict-target em` uses `white-space: normal; overflow: visible; text-overflow: clip`. Leave `strong` truncated (it holds the subject). Measured: at 375px the instruction is 386px wide in a 304px box and ends with an ellipsis ("…choose Accuse this me…").
- [ ] **Step 3: Run tests.** Run: `pnpm exec vitest run client/src/games` and `pnpm test:e2e -- phishing-post-mortem`. Expected: pass, including the existing responsive-layout test.
- [ ] **Step 4: Verify axe is clean.** Run axe-core in the browser console on the Phishing briefing (inject `axe.min.js` from a CDN in DevTools or use the scratch harness). Expected: no `scrollable-region-focusable` violation. Then tab from the page top and confirm the pane receives a visible focus ring.
- [ ] **Step 5: Check the 375px verdict panel** shows the full instruction, and the game still fits 1280x720 without page scroll.

### Task 2: Raise the two smallest town text sizes to 12px

**Files:**

- Modify: `client/src/assets/styles/town.css:457` (`.building-hint`, 10px), `:559` (`.game-preview-label`, 11px), `:650` (`.town-eyebrow` inside a media query, 10px)
- Test: manual measurement; existing `tests/e2e/portal.spec.js` town journeys

**Interfaces:**

- Produces: nothing other tasks use.

- [ ] **Step 1: Change the three declarations to `font-size: 12px`.** Do not change the 12px and 13px values (kept by `DESIGN.md:72`). Social Engineering's 10.24px and 11.52px author labels (`sim.css:714`, `:231`) are left alone because the game is fitted by scaling; changing them needs its owner.
- [ ] **Step 2: Measure.** On `/` at 1280x720 and 1440x900, confirm `document.documentElement.scrollHeight <= innerHeight`, hint labels do not overlap each other or the buildings (screenshot check), and the computed `font-size` of `.building-hint` is 12px.
- [ ] **Step 3: Run the town journeys.** Run: `pnpm test:e2e -- portal`. Expected: pass.

### Task 3 (needs user approval): Fit test

The earlier fit spec `tests/e2e/page-fit.spec.js` was deleted at the user's request on 2026-10-14, so do not add this without being told to.

**Files:**

- Create: `tests/e2e/page-fit.spec.js`

**Interfaces:**

- Produces: `PAGES` table of `{ name, route, role }` and an `expectFits(page)` helper asserting `document.documentElement.scrollHeight <= window.innerHeight + 1` and `scrollWidth <= innerWidth`.

- [ ] **Step 1: Write the spec.** `test.use({ viewport: { width: 1280, height: 720 } })`; one test per entry, named `fits the window: <name>`. Entries: Login, Register, Profile, Progress, Classes, Town, News dialog, and the three games' briefing screens. Reuse the sign-in helpers from `tests/e2e/fixtures` and the font-blocking `beforeEach` from `portal.spec.js`. Exclude About, Instructor enrollment and Admin (long pages, see the findings doc).
- [ ] **Step 2: Run it before the fixes land.** Run: `pnpm test:e2e -- page-fit`. Expected: Profile, Progress and Classes fail (14 and 22px over); the rest pass.
- [ ] **Step 3: Run it after the other plans.** Expected: all pass.
- [ ] **Step 4: Format.** Run: `pnpm exec prettier --write tests/e2e/page-fit.spec.js`.

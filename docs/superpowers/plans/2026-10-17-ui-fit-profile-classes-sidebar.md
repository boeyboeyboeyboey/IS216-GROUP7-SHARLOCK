# Fit Profile, Classes and the Sidebar to the Window: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At 1280x720 and 1440x900, `/profile`, `/progress` and `/classes` do not scroll, and the sidebar on every signed-in page does not scroll.

**Architecture:** Trim copy and one duplicate heading so the three pages fit the existing fit rules, slim the sidebar account box on desktop so the sidebar content fits its box, and switch the sidebar from `overflow-y: hidden` to `auto` so enlarged text can still scroll. Then move earlier CSS values onto the `DESIGN.md` spacing scale.

**Tech Stack:** Vue 3 SFCs, plain CSS, Vitest, Playwright (manual probe; see Task 2).

**Spec:** `docs/superpowers/bugs/2026-10-17-ui-ux-audit-findings.md` (sections 3.1, 3.3, 7 and the corrections in section 10). Related earlier plan: `docs/superpowers/plans/2026-10-14-fit-pages-to-window.md`.

## Global Constraints

- No commits or staging unless the user asks (user CLAUDE.md). If asked, stage with `git add .` only.
- Spacing uses the `DESIGN.md:86` scale: 0.5rem, 0.8rem, 1.3rem, 2.1rem, 3.4rem. Do not add new ratio tokens to `main.css` or `town.css` (`DESIGN.md`, Proportion section); use plain values.
- Touch targets stay at least 44px for primary controls; shared body text stays 18px (`DESIGN.md:72`, `:80`). Do not shrink text to fit.
- Fit target: 1280 x 720, no regression at 1440 x 900. Below 768px wide or under 600px tall, natural scroll is allowed.
- The mobile offcanvas keeps the full account box (e2e `portal.spec.js:190` asserts "Results are not saved" is visible in the drawer).
- Code comments: lowercase, minimal, no trailing full stop.
- Verified by measurement on 2026-10-17 at 1280x720: `/profile` is 734px tall (14px over) because the notice paragraph wraps to two lines (64px); `/classes` is 742px (22px over) because the intro wraps to two lines (54px) and the panel repeats the page title as a second heading; the sidebar on `/classes` is 1205px of content in a 644px box (account box 426px, nav 313px, note 234px).

## Review Focus

- Long usernames (20+ characters) and long emails: the slim account row must wrap or truncate, never overflow the 236px sidebar.
- Browser text enlarged to 200%: the sidebar must scroll instead of clipping nav links.
- Students with several classes: the class list keeps its internal scroll (`.cohort-list` max-height) and the page does not grow.
- Windows 600 to 780px tall: sidebar note hidden, nothing clipped; windows under 600px tall: normal scroll.
- Instructor and admin roles have extra nav items (Class enrollment, Administrator workspace): the sidebar must still fit at 1280x720 or scroll gracefully.

---

### Task 1: Profile and Classes fit the window

**Files:**

- Modify: `client/src/views/Profile.vue:222-225` (notice copy)
- Modify: `client/src/features/cohorts/pages/MembershipsPage.vue:78-81` (intro copy)
- Modify: `client/src/features/cohorts/components/MembershipList.vue` (hide the duplicate heading visually)
- Test: existing `client/src/features/profile/__tests__/profile-view.test.js`, `client/src/features/cohorts` unit tests, `tests/e2e/cohorts.spec.js`

**Interfaces:**

- Produces: nothing other tasks depend on.

- [ ] **Step 1: Change the profile notice to one line.** In `Profile.vue`, replace the text of the `<p class="preview-notice">` with: `Your account and avatar are saved. Game results are not saved yet.` (about 65 characters; measured to render on one line at 1280px).
- [ ] **Step 2: Shorten the classes intro to one line.** In `MembershipsPage.vue`, replace the `.cohort-intro` text with: `Join a class with your instructor's invitation code. You can keep exploring while you wait.` (measured: one line, 27px).
- [ ] **Step 3: Keep the `<h2 id="membership-list-title">` for assistive technology but hide it visually.** In `MembershipList.vue`, add Bootstrap's `visually-hidden` class to that heading (the section keeps `aria-labelledby`). Do not remove the id.
- [ ] **Step 4: Run unit tests.** Run: `pnpm exec vitest run client/src/features/profile client/src/features/cohorts client/src/__tests__`. Expected: all pass. If a test asserts the old profile or intro copy, update that assertion to the new copy.
- [ ] **Step 5: Measure.** With the dev stack running and signed in as a student, set the window to 1280x720 and run in the console on `/profile`, `/progress` and `/classes`: `document.documentElement.scrollHeight <= innerHeight`. Expected: `true` on all three. Also check 1440x900.

### Task 2: Slim account box and sidebar that fits

**Files:**

- Modify: `client/src/features/auth/auth.css` (desktop slim layout, scoped to `min-width: 768px`)
- Modify: `client/src/assets/styles/main.css` (`.portal-sidebar.fit-sidebar` rules and the `.sidebar-note` hide rule near the end of the file)
- Modify: `client/src/features/auth/components/AccountSummary.vue` only if the markup needs a wrapper class (keep every existing text node: username, email, "Results are not saved", Sign out)
- Test: `client/src/features/auth/__tests__/auth.test.js` (the "real account summary" test at about line 473 asserts username, email, "Results are not saved" and the avatar `src`)

**Interfaces:**

- Consumes: Task 1 is independent; no interface.
- Produces: the `.fit-sidebar` class contract in `PortalLayout.vue` stays: applied when `route.meta.hideAccountSummary` is true (only `/profile`).

- [ ] **Step 1: Slim the signed-in account box on desktop only.** At `min-width: 768px`, lay `.auth-summary__identity` out as one row: 40px avatar, username (1rem, wrapping with `overflow-wrap: anywhere`), Sign out button (keep it at 44px; the live check used 36px, so the 8px difference is not yet verified). Hide `.auth-summary__eyebrow`, the email line and `.auth-summary__truth` with `display: none` at this width only. Spacing values come from the `DESIGN.md` scale (0.5rem and 0.8rem).
- [ ] **Step 2: Hide the "Every expert starts with a little curiosity" note on short windows.** Add `@media (min-width: 768px) and (max-height: 980px) { .sidebar-note { display: none } }` in `main.css`. This replaces the `.fit-sidebar`-only rule. Measure and adjust the threshold in Step 4.
- [ ] **Step 3: Change `.portal-sidebar.fit-sidebar` from `overflow-y: hidden` to `overflow-y: auto`.** Content now fits, so no scrollbar shows, and enlarged text (200%) can scroll instead of clipping nav links (measured clipping on `/profile` at 200% root font size).
- [ ] **Step 4: Measure the sidebar.** On `/classes`, `/progress` and `/profile` as student, instructor and admin at 1280x720, 1440x900 and 1920x970, run: `const s = document.querySelector('#portal-menu'); s.scrollHeight <= s.clientHeight`. Expected: `true` everywhere. Checked in the browser on 2026-10-17 with a 36px Sign out button: the content no longer exceeded the 644px box on `/classes` at 1280x720 for a 20-character username (the check cannot show how much slack was left). With a 44px button it may overflow by a few pixels; if so, shrink the avatar or padding within the scale before hiding anything. If instructor or admin overflow because of extra nav items, report the overflow in pixels instead of hiding more content.
- [ ] **Step 5: Run unit tests.** Run: `pnpm exec vitest run client/src/features/auth`. Expected: all pass (the DOM keeps every text node; only CSS hides them on desktop).
- [ ] **Step 6: Check the mobile drawer.** At 375x667, open the menu: the full account box, email and "Results are not saved" are visible.

### Task 3: Move earlier CSS onto the DESIGN.md spacing scale

**Files:**

- Modify: `client/src/features/auth/auth.css`, `client/src/assets/styles/main.css` (blocks added on 2026-10-17: global scrollbar is excluded), `client/src/features/cohorts/cohorts.css`, `client/src/features/profile/profile.css` if touched
- Modify: `CLAUDE.md` (project, local, not committed): replace the example spacing steps in the UI work section

**Interfaces:**

- Produces: all spacing literals from the earlier session now come from {0.5, 0.8, 1.3, 2.1, 3.4}rem.

- [ ] **Step 1: Find the off-scale values.** Run: `grep -rnE "0\.618rem|1\.618rem|2\.618rem|1\.272rem" client/src --include=*.css --include=*.vue`. Expected: a short list; each is a value added this session.
- [ ] **Step 2: Map and replace.** 0.618rem to 0.5rem or 0.8rem (nearest that keeps the fit), 1.272rem and 1.618rem to 1.3rem, 2.618rem to 2.1rem. `clamp()` bounds follow the same mapping. Layout ratios such as `1.618fr` stay (they are column proportions, allowed by `DESIGN.md`).
- [ ] **Step 3: Re-measure fit.** Repeat Task 1 Step 5 and Task 2 Step 4. If a replacement pushes a page over by a few pixels, pick the smaller scale step for that value.
- [ ] **Step 4: Update `CLAUDE.md`.** In the UI work section, replace "for example 0.618rem, 1rem, 1.618rem, 2.618rem" with "the `DESIGN.md` scale (0.5, 0.8, 1.3, 2.1, 3.4rem)".

## Out of scope (verified, deliberately not planned)

- About page (1444px of prose; fitting means hiding content), Instructor enrollment (788px of content) and Admin: scrolling is appropriate.
- Activate account (64px over; needs a token route and has its own layout): separate small fix if wanted.

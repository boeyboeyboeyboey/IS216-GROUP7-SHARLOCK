# UI/UX audit findings (measured), 2026-10-17

Status: findings only. Nothing in this document has been fixed unless it says so. No code was changed by the audit itself.

## 1. How this was measured

A throwaway stack was run against a disposable MongoDB test database: test-mode API on port 3001, Vite client on port 5174. The developer's own dev servers (5173 and 3000) and dev database were not used. Accounts were seeded for four roles: anonymous, student, instructor and admin.

Tools: Playwright (Chromium, `@playwright/test` from the repo's `node_modules`), axe-core (tags wcag2a, wcag2aa, wcag21aa, wcag22aa), a PostCSS scan of every `.css` file and `<style>` block under `client/src`, and computed-style probes in the page.

Viewports: 1280x720, 1440x900, 1920x970, 768x1024 and 375x667. Around 42 page and game states were checked for accessibility, and about 300 page/role/viewport combinations for layout.

The scripts and raw output were written to the session scratchpad (a temp folder, so they may not survive). The key numbers are copied into this document so it stands alone.

### What was not measured

- Admin at 375x667. The layout run was stopped by the user before reaching it (records for the other 19 role/viewport combinations exist).
- Social Engineering Simulator chat and debrief. They need an LLM key that the test stack does not have. Only the briefing was measured.
- Browser zoom. Zoom and reflow were emulated by changing the window size and the root font size, not real browser zoom.
- The developer's real accounts and data. Seeded usernames are about 20 characters long (`audit-student-d4a62d`), so name wrapping and truncation numbers are worse than with a short real username.
- Nielsen heuristic scores (section 8) are the author's judgment, not measured values.
- The "Results are not saved" repetition and the duplicated account info were confirmed by reading the code (grep), not by rendering.

## 2. Priority list

| #   | Severity | Finding                                                                        | Section  |
| --- | -------- | ------------------------------------------------------------------------------ | -------- |
| 1   | High     | Footer pin added in this session makes short pages 14px taller than the window | 3.1      |
| 2   | High     | Sidebar scrolls on every page except `/profile`                                | 3.3      |
| 3   | High     | About page 975px taller than a 720px window                                    | 3.2      |
| 4   | High     | "Back to town" has four different positions and sizes                          | 4.1      |
| 5   | Medium   | Phishing text clips at 375px; reading pane not keyboard reachable              | 5.1, 5.2 |
| 6   | Medium   | Town text under 14px; town header overflows at 200% text                       | 5.3, 5.4 |
| 7   | Medium   | Account info and "Results are not saved" repeated in several places            | 4.2      |
| 8   | Medium   | Global scrollbar narrows game content by 3.5% to 6.4%                          | 5.5      |
| 9   | Low      | Project spacing scale conflict with edits made during this work                | 7        |

## 3. Vertical scroll and fit (1280x720 unless stated)

### 3.1 Short pages overshoot the window by 14 to 22px (corrected)

Corrected after checking the running app: the first version of this finding blamed the footer pin and a 90px header. That was wrong. The header measures 76px, equal to `--header-height`. The footer pin is not the cause.

The real cause is that the page content itself is slightly too tall at 1280x720. Measured, `.portal-main` content plus the footer ends at 734px on `/profile` and `/progress` (14px over) and 742px on `/classes` (22px over). On `/profile` the full-width "Results are not saved…" notice wraps to two lines (64px). On `/classes` the intro wraps to two lines (54px) and the panel repeats the page title as a heading.

Verified fixes (injected into the live page, no repo change): shortening the profile notice to one line gives a page height of exactly 720px; shortening the classes intro to one line and removing the duplicate panel heading gives exactly 720px.

Town (`/`) and the News dialog route are excluded from the footer pin and show the footer 6px above the bottom edge. That gap is cosmetic and is not planned.

### 3.2 Pages that still scroll

| Page                  | Role              | Height                  | Over by                                     |
| --------------------- | ----------------- | ----------------------- | ------------------------------------------- |
| About                 | all               | 1695 (1747 at 1440x900) | 975                                         |
| Admin                 | admin             | 4168                    | 3448 (long utility page, may be acceptable) |
| Instructor enrollment | instructor, admin | 934                     | 214 (40 at 1440x900)                        |
| Activate account      | all               | 784                     | 64                                          |
| Classes               | student           | 742                     | 22 (mostly the footer bug)                  |

Not at fault: Login and Register (do not scroll at 1280x720), and `/profile`, whose sidebar overflow is 0 with the scrollbar removed.

### 3.3 Sidebar scrolling

Every page except `/profile` has a sidebar taller than its box. Overflow at 1280x720: student 561px, instructor 606px, admin 635px, anonymous 402px. At 1440x900 about 222 to 455px. At 1920x970 about 152 to 563px. At 768x1024 about 98 to 642px. Causes: the account box, five or more nav items that wrap to two lines, and the "Every expert starts…" note.

`/profile` was fixed during this session: sidebar overflow 0, overflow-y hidden, no scrollbar (verified by measurement).

### 3.4 Horizontal overflow

None. Document `scrollWidth` equals `innerWidth` on every measured page at all five sizes.

## 4. Consistency problems

### 4.1 "Back to town" (confirmed, quantified)

| Page                         | x    | y   | Size                            |
| ---------------------------- | ---- | --- | ------------------------------- |
| SQL and Regex previews       | 274  | 88  | 131x44                          |
| Phishing Post-Mortem         | 292  | 88  | 95x32                           |
| Social Engineering Simulator | 328  | 88  | 121x32                          |
| CLI Cyber Defender           | 1065 | 98  | 145x32 (right side of the page) |

Positions are measured at 1280x720. At 375px the Phishing link is also at y=-516 and -1840 on the play and debrief states, so it scrolls out of view.

### 4.2 Repeated information

- "Results are not saved" appears in `AccountSummary.vue`, `Dashboard.vue` (twice: player card and footnote), `Profile.vue`, and the CLI debrief (code check).
- The signed-in username and Sign out are shown in the header and again in the sidebar account box on every signed-in page.
- Header username is truncated: `span.account-name` content width 176px in a 94px box (measured on Home, Profile and Progress).
- `/classes` shows "Your classes" as the page heading and again as the panel heading.
- `/progress` renders the same profile card as `/profile`.

## 5. Accessibility and reflow

### 5.1 axe-core results

One violation across the 42 states at 1280x720, none at 375px: `scrollable-region-focusable` (serious, WCAG 2.1.1) on `.sharmail-pane-reading` in the Phishing briefing. Fix: `tabindex="0"` and an accessible label on the scrollable pane.

### 5.2 Clipping at 375x667 (Phishing)

Text wider than its container: "Open a message and choose Accuse this me…" 386px in 304px (briefing), and "Action required: re-verify your SSO acce…" 408px in 304px (play and evidence). On the town world, `div.town-world` content is 1144px in a 1120px box at 1280x720.

### 5.3 Reflow and zoom

- Town at 200% root font size: 436px of horizontal scroll (Leaderboard, Profile and Sign out links at x 1050 to 1716), WCAG 1.4.4 and 1.4.10.
- Town at 200% and 400% zoom: 4 of 6 and 5 to 6 building buttons are outside the viewport. Reachable by the "Jump to" select, and the map may count as an exempt two-dimensional layout.
- `/profile` at 200% text: four sidebar links are clipped by `aside#portal-menu`. This is a side effect of the hidden overflow added for `/profile`; the sidebar needs a fallback scroll for enlarged text.
- Passed all three modes: `/login`, `/register`, `/classes`, `/about`.
- The skip link is first in tab order only on `/`. Elsewhere focus moves to the heading on load, so the skip link is reachable only with Shift+Tab (WCAG 2.4.1, low impact).

### 5.4 Contrast, targets, keyboard

- Enabled text with contrast under 4.5:1 (3:1 for large text): 0. The earlier "faded text" concern is refuted for enabled text.
- Disabled controls are exempt but measure low: zoom minus 2.59:1, Check for updates 3.28, SOC Send 3.54, admin Previous and Next 3.99.
- Borders under 3:1 (advisory, WCAG 1.4.11): CLI Practice, Menu, Hint and template buttons 2.72 to 2.92; Phishing Accuse 1.77 and Inspect 1.57.
- Targets under 24px failing WCAG 2.5.8: 0. Under 44px (project rule): 9 unique elements: back links 95x32, 145x32 and 121x32, CLI entity buttons 76x34 and 145x34, sidebar links 195x40.
- Keyboard: 8 pages tabbed, 0 traps, focus ring 3px (5.6:1 to 9.7:1). Offcanvas menu at 375px opens, traps focus, closes on Escape and returns focus.
- Reduced motion: no running or declared animation or transition over 0.1s on the town and the three briefings when the preference is on.

### 5.5 Text size and the global scrollbar

- Town text under 14px: 14 text nodes: six `.building-hint` at 10px, seven at 12px (eyebrow, "All 6 activities open", five NPC names), one `.town-footnote` at 13px.
- CSS-wide there are 62 `font-size` declarations under 14px, 5 of them under 12px: `town.css:457` (10px), `town.css:559` (11px), `town.css:650` (10px), `sim.css:231` (11.52px) and `sim.css:714` (10.24px).
- The global 18px scrollbar added this session narrows game content: CLI `.cli-output` 508px to 490px (3.5% at 1280, 6.4% at 375), Phishing reading pane 410px to 392px (4.4%).
- One-word-per-line text only appeared with the long seeded usernames in the sidebar account box (and `cli-stat-label` at 768px: "Contained", "Best streak", "Practice" at 46px wide in 3 lines).

## 6. Design token inventory (static CSS)

98 files and 1,831 declarations scanned.

- Font sizes: 51 distinct px values; 18 use `clamp`, `vw`, `em`, `%` or `calc`; 2 files mix px and rem.
- Spacing: 892 values, 55 distinct. Only 34.2% are within 8% of the 1:1.618 steps; 39.2% are within 8% of DESIGN.md's scale. Most-used off-scale values: 12px (127), 8px (120), 4px (41), 20px (36), 5.6px (29).
- Opacity under 0.7: 6 declarations. Five are disabled or skip states. One decorative (`town.css:258`).
- Fixed pixel widths of 340px or more outside a wide media query: 0.
- Interactive elements with an explicit height under 44px: 7 (4 under 24px, 3 from 24 to 43px). These are mostly checkbox inputs at 18.4 to 20px (`admin.css:307`, `recovery.css:109`, `phish.css:564`). Most buttons are sized by padding, so this check understates real target sizes; use section 5.4 for those.
- No real cascade collisions (5 candidates were parser false positives).

## 7. Conflict with the project's own design rules

`DESIGN.md:86` defines the spacing scale as 0.5, 0.8, 1.3, 2.1 and 3.4rem, and `DESIGN.md:87` a type scale stepping by 1.272 from 1rem. `DESIGN.md:84` splits two-region layouts 1:1.618. `DESIGN.md:72` sets body text at 18px and `DESIGN.md:80` requires 44px targets.

The CSS changes made during this UI work used 0.618, 1.618 and 2.618rem, which do not match the `DESIGN.md` scale. Decision needed: align those edits to the `DESIGN.md` scale, or update `DESIGN.md` to the golden-ratio scale.

Edited so far this session: `auth.css` (sidebar account box, login fit), `main.css` (global scrollbar, footer pin, sidebar fit, preview back link, profile fit), `TrophyCase.vue` (two recent badges plus a past-achievements dialog), `cohorts.css`, `router/index.js` and `PortalLayout.vue` (hide account box on `/profile`).

## 8. Heuristic scores (judgment, 0 fine to 4 severe)

| Area                   | Score | Reason                                       |
| ---------------------- | ----- | -------------------------------------------- |
| Login and Register     | 1     | fits, clear errors                           |
| Town                   | 2     | small text, header overflow when zoomed      |
| Profile and Progress   | 2     | footer overshoot, duplicated notices         |
| Classes and Join class | 2     | footer overshoot, duplicate heading          |
| Instructor and Admin   | 3     | long, never fitted                           |
| Games                  | 2     | inconsistent navigation, scrollbar narrowing |
| About                  | 3     | 975px over                                   |

## 9. Suggested order of work

1. Fix the footer pin so no page overshoots (3.1). About 10 minutes.
2. Slim the sidebar account box to one compact row and add a fallback scroll for enlarged text (3.3, 5.3). About 30 minutes.
3. Make "Back to town" one component, one position (4.1). About 30 minutes.
4. Remove repeated "Results are not saved" and duplicate headings (4.2). About 20 minutes.
5. Fit About, Instructor and Activate account pages (3.2). About 45 minutes.
6. Raise town text to at least 14px (5.5). About 20 minutes.
7. Phishing: `tabindex` and label on the reading pane, then fix the 375px clipping (5.1, 5.2). About 20 minutes.
8. Decide the spacing scale and align the edits (7). About 20 minutes.
9. Add a Playwright fit spec at 1280x720 so scrolling regressions are caught automatically.

## 10. Corrections after verification (2026-10-17, before the fix plans were written)

Each finding was re-checked against the code or the running test stack. Results:

- **3.1 footer pin:** finding was wrong about the cause. Header is 76px, not about 90px. Corrected in place above.
- **About page (3.2):** valid measurement, but fitting it is not sensible. The page is 1444px of prose in five sections against about 544px of window. Fitting it would mean hiding content. Dropped from the plans.
- **Instructor enrollment (3.2):** content is 788px against about 544px available. Dropped from the plans (workspace page; scrolling is acceptable).
- **Global scrollbar narrowing (5.5):** not a regression. Chrome on Windows draws a classic scrollbar about 17px wide on these panes already; the custom one is 18px, so the extra narrowing is about 1px. Dropped from the plans.
- **Repeated "Results are not saved" (4.2):** overstated. On any single page it appears at most twice, on the Town page (player badge and footnote). Two e2e assertions depend on the badge text (`portal.spec.js:68` town player, `portal.spec.js:190` drawer) and one unit test on the sidebar account box. Narrowed in the plans.
- **Phishing clipping at 375px (5.2):** the clipped element is a deliberate `text-overflow: ellipsis` line, so this is an intended truncation, but it cuts the instruction "Open a message and choose Accuse this message". Downgraded to low.
- **Town text under 14px (5.5):** `DESIGN.md:72` says town metadata "retains its readable compact layout", so the project explicitly allows compact town text. Plans only raise the 10px and 11px values to 12px.
- **Spacing scale conflict (7):** the `DESIGN.md` scale (0.5, 0.8, 1.3, 2.1, 3.4rem) is itself a golden-ratio scale (each step is about 1.618 times the last). Using it satisfies the golden-ratio rule, so the choice is not either-or. The plans use the `DESIGN.md` scale. `DESIGN.md` also says not to add new ratio tokens to `main.css` or `town.css` without approval, so the plans use plain values.
- **Sidebar fix (3.3):** verified. With the account box slimmed to one row (40px avatar, name, Sign out) and the "Every expert…" note hidden, the sidebar content is 644px against a 644px box on `/classes` at 1280x720, so it no longer scrolls.

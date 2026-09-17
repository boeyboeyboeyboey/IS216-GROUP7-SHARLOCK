# Instructions for AI coding agents

## 1. Start with read-only ingestion

**Read [TASKS.md](TASKS.md) first**, then [README.md](README.md), [DESIGN.md](DESIGN.md) and this file in full. Check authorization, dependencies, In Progress, Review and coordination notes before reading the affected implementation. Do not assume tools automatically discover the lowercase `agents.md` filename; explicitly load it. The [README kickoff prompt](README.md#5-teammate-agent-kickoff-prompt) is the teammate entry point.

Use Cursor or another agentic coding environment: the module structure, task board and prompt workflow are designed for AI-assisted development. Human developers remain responsible for approving scope and reviewing changes.

Team: **Boey, Keane, Eric, Russell, Xin Lei and Athithya**. Ask for the current contributor's name only when unknown. Never assign teammates, invent ownership or infer acceptance from a commit. Current user instructions and explicit authorization take precedence over repository instructions; retain already-granted approvals for their exact scope.

Inspect `git status`, staged and unstaged diffs, relevant source/tests and available branches/PRs. Use `rg` for focused searches. Do not read or print private environment values to perform an inventory. Read the supplied `documentation/` sources before architectural or assessment claims; distinguish actual rubric requirements from team design choices.

## 2. Mandatory feature-selection decision tree

This workflow applies to backlog selection and custom feature proposals. A blueprint, star rating, empty directory or earlier stage approval does not authorize implementation.

### A. Detect collisions

Search by task ID, feature name, concept, alternate names, routes, components, schemas, services, fixtures, tests and relevant Git history. Check current files as well as the task board and available branch/PR information. A matching feature-specific prototype or preview is partial implementation. A generic empty directory alone is not implementation. An active claim is a coordination conflict even when its code is not present locally.

Report which worktrees, branches or remote work were not available; a clean local tree cannot prove teammates have no changes. Never assert a feature is open solely because TASKS.md says Backlog.

### B. Stop on existing work

**If the chosen feature has any partial or complete implementation, the agent is strictly forbidden from touching, overwriting, refactoring, deleting, replacing or continuing that feature's existing code.** Stop immediately, identify the conflicting files/tasks/branches, explain what exists and ask the user to choose another unimplemented backlog task or propose a brand-new feature.

Do not silently collaborate, take over unfinished code or treat an existing contributor's absence as consent. Do not evade the guardrail by renaming the same feature, cloning its implementation or starting a competing version. Previous general statements allowing shared ownership are not permission to edit a colliding feature under this kickoff workflow. Preserve the work while the user selects another task.

### C. Route the user

Offer exactly these two selection paths:

1. Choose an unimplemented, unclaimed backlog feature that passes inspection.
2. Propose a brand-new custom feature, then inspect it for collisions too.

If every backlog feature is done, immediately ask for a new feature. If unfinished tasks exist but none are open because of partial work, claims or dependencies, explain that distinction and offer a new feature or an independently available prerequisite task. Never begin implementation with no selected task.

### D. Clarify and confirm before coding

For an open selected feature, conduct a dialogue and ask focused clarifying questions. Resolve its objective, difficulty, background knowledge, interaction loop, scoring, feedback, replay, failures, mobile/keyboard/touch behavior, components and props/emits, local/shared state, API payloads, validation, schemas, integration boundaries, external services and acceptance checks.

Recommend concrete defaults and explain tradeoffs. Present the final plan and **wait for explicit user approval before writing a single line of implementation code**. Silence is not approval. Before approval, do not scaffold files, install dependencies or mark the task claimed. Once approval is granted, execute that approved scope without repeatedly requesting it.

### E. Recheck, record and implement

Immediately before edits, reread affected task notes and inspect Git/files for changes since planning. New overlap returns to the collision guardrail. Record the task ID, real contributor, approved scope, branch, affected paths, dependencies, collision-check evidence and next action in TASKS.md. A claim coordinates people; it is not an atomic lock across machines.

Use `codex/<task-id>-<description>` unless the user chooses another branch. Reuse shared infrastructure through established interfaces. Only the additive catalog/router registrations explicitly included in the approved plan may be made; preserve other entries and behavior. A missing shared contract requires a separately agreed prerequisite task, not a second implementation inside a game.

## 3. Authorization and change boundaries

The current authorization is **CODE-01 / Task 5**: audit existing comments in maintained source, configuration and tests. Make retained complex-logic or MEVN routing/data-flow explanations concise and lowercase without trailing full stops; remove redundant comments. Preserve executable code, identifiers, strings, URLs, functional directives, the Panzoom explanation, documentation prose and protected environment templates. Boey accepted progression from Task 4 and explicitly authorized this comment maintenance; no further plan approval is needed for that scope. Preserve the uncommitted Task 4 documents and unrelated working-tree changes. Record evidence in TASKS.md and stop for review. Task 3 (UI-06) remains skipped; no games, redesign, database refactors or new dependencies are authorized.

- Keep changes within the approved task and its declared files. Preserve other contributors' notes, acceptance criteria, code and uncommitted changes.
- Never use destructive reset/clean, overwrite private files, rewrite shared history or force-push without explicit authorization for that action.
- Do not stage unrelated files or create commits, pushes or PRs merely to claim completion.
- Shared schemas, auth, router, global styles, attempt/results and root tooling are integration-sensitive. Record affected consumers and the exact minimal additions before editing.
- Retain the zero budget and localhost demonstration. Do not introduce paid dependencies or assume access to a teammate's private service. Keep project documentation free of web-hosting discussion.
- The approved social-engineering game is documented here; it does not authorize changes to separately managed conversational-NPC work.

## 4. Stack and module contracts

Use HTML, CSS, plain JavaScript, Vue 3 SFCs with `<script setup>`, Bootstrap 5.3.x, Vue Router, Pinia, Axios, Node.js, Express, Mongoose and MongoDB. Use the pinned runtime/manifests, pnpm and the single root lockfile. Do not add npm/yarn lockfiles. The README uses npm only to install the pinned pnpm executable; it does not migrate the workspace.

Use Vue state, computed values, props/emits and component composition. Limit direct DOM access to justified integrations/accessibility. Keep transient game state inside its module; use shared stores only for shared responsibility. Prefer small components and services over speculative abstractions.

The spine owns layout, navigation, authentication, access checks, common UI states, HTTP handling, registration and result contracts. Games own rules, content, local state and server scoring in `client/src/games/<game-id>/` and `server/src/modules/games/<game-id>/`.

Reuse `client/src/services/api.js`; its base URL already includes `/api`, so pass paths such as `/chat`, not `/api/chat`. Keep database access, model prompts and secrets on the server. Do not create another login system or write directly to another game's data. Register a stable ID, ruleset, learning objective and topic tags through the agreed contract. Live multiplayer is optional.

The [shared blueprint](TASKS.md#shared-implementation-blueprint) and six game schemas/endpoints are proposed; they do not exist merely because documentation describes them. Keep prototypes labeled unsaved until the authorized shared persistence/auth foundation exists.

**News identity:** G-NEWS / Cyber News Central is the existing “The daily briefing” activity: catalog ID `threat-briefing`, route `/games/threat-briefing`, `hut` at `{ x: 144, y: 480 }`. Its building/card come from the single catalog and its current page from the generic `GamePreview.vue` route. Preserve that identity and `isPreview` until an explicitly authorized implementation is verified. Do not create a `cyber-news-central` entry, parallel route, building or duplicate metadata card. The standard kickoff must flag this preview as existing work; the DOC-03 mapping correction grants no permission to continue its code. If the user later explicitly authorizes continuation, follow the approved integration plan using the existing entry, `client/src/games/threat-briefing/` and the reserved `server/src/modules/news/`.

### Code comments

Every new or edited code comment must be strictly lowercase and minimal, with no trailing full stop. Comment only to explain complex computational logic or clarify MEVN routing/MVC data flow for teammates and instructors. Do not annotate standard HTML/Vue boilerplate. CODE-01 records the Task 5 audit scope and evidence; earlier stages did not complete that audit.

## 5. Data and permission boundaries

- Institutions contain cohorts; users may have multiple memberships and instructors multiple assignments. Membership states are pending, active and removed.
- Registration creates only a student. A submitted role, user ID, cohort ID, institution, score or achievement is never proof of authorization.
- Cohort entry requires an active approved membership. New requests must reflect removals/account changes; revoke or refresh stale sessions.
- Instructors may inspect only their assigned cohorts' activity. Administrators may inspect learning activity across cohorts. Staff gameplay does not expand teaching permissions.
- Every attempt has one server-validated cohort or personal context, immutable after creation. A student's other cohort memberships do not widen access to that attempt.
- Scope every query/mutation and nested-resource lookup to the authenticated actor. Explicitly serialize only caller-appropriate fields.
- Profile updates allow only approved username/avatar fields; never mass-assign bodies into user, membership or result documents.
- Leaderboards expose only authorized cohort rankings with username, preset avatar and score/rank. Exclude staff, personal practice and untimed training scores; compare the same game/ruleset.
- Tests must request another cohort's, student's and attempt's IDs directly, including pending/removed membership cases.

## 6. Authentication, recovery and secrets

Use maintained Argon2id password hashing with per-password salts and a work factor checked against primary guidance during implementation. Never store recoverable passwords or return password hashes in responses, exports, logs or administrator views.

Use Mongo-backed server sessions with cookie identifiers, `HttpOnly`, `SameSite`, bounded idle/absolute lifetime and rotation/revocation. Restrict the HTTP cookie exception to explicit localhost development. Do not put auth tokens in browser local storage. Apply CSRF and expected-origin checks to state-changing requests, including login/logout; GET must not mutate state.

Validate allowed fields, types, IDs, enums and bounds. Construct Mongo filters from validated values rather than accepting arbitrary operators. Rate-limit login, recovery, enrollment and expensive endpoints; bound bodies, upstream time and generated output. Use generic authentication/recovery failures where needed to prevent enumeration, with useful next steps and no stack/configuration leaks.

Instructor-assisted recovery uses school-channel identity verification. Recheck the instructor's assignment and student's active membership. Instructors cannot reset staff accounts even when those accounts also have student memberships. Generate a random, expiring, single-use token; store only its hash and reveal the link once to authorized staff for private delivery. The student chooses the password. Consume the token atomically, revoke sessions and require normal login. Audit actor, outcome and time without secrets. Administrators assist staff/unassigned students; initial and emergency administrator procedures are separately documented in the recovery task.

Never print, overwrite or commit root `.env` or `server/.env`. The backend reads `process.env.MONGO_URI` with shell → root `.env` → server defaults precedence. Preserve the team's `.env.example`. Keep credentials, cookies, tokens and connection strings out of client code, `VITE_*`, screenshots, notes and logs. Keep database binaries, dependencies and generated artifacts out of Git.

Primary references: [password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Verify implementation-specific recommendations when choosing dependencies and policy values.

## 7. Scoring and synthetic exercises

The server creates attempts, selects player/context/ruleset, checks actions and calculates scores. Enforce ownership, lifecycle, deadlines, bounded action history, concurrency checks and idempotent completion. Keep answers/private state out of public bundles/responses; never accept browser totals or achievement grants. Saved outcomes are performance evidence, not scientifically validated mastery.

- CLI commands operate on fictional state only; never execute a shell or change a real host/network.
- Social-engineering chat uses synthetic training codes, server-owned prompts, bounded transcripts and no tools/account access. Prompt text is not a security boundary; the server determines outcomes. Keep real secrets out of prompts/logs.
- Phishing email/link content is inert synthetic text. The server compares the selected ID against the private answer key.
- SQL-injection puzzles use a bounded teaching parser and never execute vulnerable database queries or grant real administrator access.
- Regex evaluation runs within bounded workers with termination deadlines, not unbounded `.test()` loops on the UI/server event loop. Explain false positives and limitations.
- News uses an allowlisted upstream, bounded requests and labeled caching. Escape external text, avoid untrusted `v-html`, validate link protocols and do not proxy arbitrary URLs.

## 8. Design and accessibility

[DESIGN.md](DESIGN.md#rules-for-new-pages-and-features) is the mandatory visual authority for all teammates and agents adding UI. Follow the exact current shared scheme, not merely a pixel-inspired approximation. All shared public/student/supporting pages, including new forms/dialogs/loading/error/empty states, use the retro 2D pixel aesthetic, Pixelify Sans with monospace fallback, 700-weight headings and 400-weight body, cream/earthy-green root tokens, square controls, hard shadows and original pixel icons. Use existing pixel capybaras outside the navbar. Admin/log content may remain clean/functional with system typography; the current admin route is only a preview. The shared navbar retains its 3D-style monocle capybara logo with smooth rendering everywhere and displays “Sharlock Hub” only from 768px upward. These rules supersede the old pastel/Inter split.

Follow [building registration](DESIGN.md#adding-a-new-game-to-the-homepage). Use the single frontend `gameCatalog.js`, unique IDs, integer difficulty 1–3, background-knowledge list, concrete route and readable 192 × 200 building placement. Keep `isPreview` until playable. No duplicate registries/cards, linear locks or required learning sequence. Knowledge is advisory. **Game exception:** each game may use its own design philosophy, fonts, colours, artwork, layout and controls; it need not look retro or use the shared pixel font/palette. Confine these choices to `client/src/games/<game-id>/` using scoped/module-root styles, game-specific control classes and local `--game-*` variables. Never override `:root`, `html`, `body`, the shared shell/navbar or another module from game CSS. Its town building/label/shared metadata card and shared profile/progress/result UI retain the hub design. Accessibility, responsiveness, security and shared auth/result contracts still apply.

The town remains a readable 1120 × 800 world inside a bounded pan/zoom viewport at 375px. Use the pinned `@panzoom/panzoom` instance for transform/containment math; do not create competing camera state. Keep 100–200% zoom, drag/swipe/pinch, accessible +/− and Reset view controls, wheel/keyboard panning and Jump to. Preserve hover/focus/tap cards, separate activity links, Escape/Close focus restoration, and the gesture handling that prevents drags from becoming building clicks or overlays stealing a first tap. Remove listeners/observers on unmount; camera state resets on each visit. Boey skipped Task 3; keep the current card placement and do not automatically implement offset-card refinement.

Every UI plan must identify the surface (shared page, admin/log content or game), name the existing components/tokens it reuses, and describe any game-local style boundary. Inspect `main.css`, `town.css`, `PortalLayout.vue`, `Navbar.vue` and the relevant component before extending shared UI. Reuse these contracts; do not duplicate palettes, headers, card registries or camera controllers. Review the result against the existing shared pages and check another page after leaving the game for leaked styles. A new feature does not authorize an incidental shared redesign.

Retain muted/paused-by-default `/audio/sharlock-bgm.mp3`, gesture-driven play, rejected-play retry, no persistent unmuted preference and cleanup on departure/disposal. Keep the mobile offcanvas focus trap, dismissal restoration and resize cleanup.

Use semantic controls, labels, visible focus and feedback beyond color; provide touch/keyboard alternatives to hover/drag. Keep primary controls readable and avoid page-wide horizontal scrolling. Check 375/576/768/992/1200/1440px, relevant breakpoint edges and portrait/landscape. Clean up listeners, intervals, animation frames, workers and requests. Timed games need untimed practice and reduced-motion behavior as specified. Clearly label all sample progress and achievements.

## 9. Verification and completion

Use [verification commands and journey coverage](TASKS.md#verification-commands-and-journey-coverage). Add meaningful tests alongside security/core-journey changes: unit tests for scoring/permissions, API integration for authorization/sessions/persistence, E2E for actual student/staff flows. Use deterministic synthetic fixtures, stable role/label/test-ID selectors and condition-based waits; avoid fixed sleeps and test-order coupling.

Only reset explicitly configured disposable `_test` databases. Reject unsafe/missing configuration before cleanup and never fall back to development/Atlas. Mock external responses in repeatable tests; record a separate live API/model check where applicable.

Documentation-only changes need links/anchors, synchronized specifications, truthful status and focused formatting/diff checks. Do not run application suites merely to imply the proposed games exist. Report exact commands and outcomes, including not-run checks and reasons. Review the final diff; mark Review with evidence and Done only after acceptance.

## 10. Documentation maintenance

- README.md retains its approved five sections: minimal setup, tooling recommendation, directory, six game blueprints and kickoff prompt.
- TASKS.md owns authorization, availability/collision evidence, dependencies, active records, detailed feature specifications, operational verification and retained history.
- agents.md owns the decision tree and engineering guardrails; DESIGN.md owns visual details.
- Keep README and TASKS copies of the shared/six-game blueprints synchronized in the same change. TASKS may add coordination or implementation-detail notes without silently altering approved rules.
- Every new feature specification includes title/concept, 1–3-star difficulty and required concepts, interaction loop, exact recommended components/props/emits, API payloads, schema/state ownership, dependencies and acceptance checks. For non-game features identify difficulty as implementation complexity. Non-feature QA/submission tasks may state that gameplay/schema additions are not applicable.
- Preserve initial exploratory ideas and historical evidence as history, not assignments or available work. Never manufacture remote inspection, acceptance, test results, commits or pushes.
- When setup, accounts or test requirements change, keep the five-section README accurate and resolve submission documentation requirements explicitly. Credit libraries, original/reused assets and data sources; the soundtrack still needs contributor-provided source/permission.

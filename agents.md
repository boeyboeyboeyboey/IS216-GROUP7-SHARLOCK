# Instructions for AI coding agents

## First action: check TASKS.md

**Before repository work, read [TASKS.md](TASKS.md).** Check the approval gates, In Progress, Review, dependencies, and recent coordination notes. Then read this file, [README.md](README.md), and the affected implementation before making changes. If starting a session without automatically loaded repository instructions, explicitly open these files.

These instructions apply to all AI-assisted work in this repository. The current user's explicit instructions and existing authorization take precedence. The repository describes planned work as well as implemented work; verify which exists before making claims or running documented commands.

## 1. Respect the authorized stage

Boey requested four stages with explicit approval between them:

1. Clarification.
2. Creation of `README.md`, `TASKS.md`, and `agents.md` only.
3. MEVN scaffolding after documentation approval.
4. Base application after scaffold approval.

Use the current gate status in `TASKS.md` and the user's latest messages. Do not create application files, install dependencies, scaffold directories, or implement a later stage while only an earlier stage is authorized. Once the next stage is explicitly authorized, update the gate and carry out that stage without repeatedly asking for the same permission.

Keep this project's run and demonstration instructions focused on localhost and its zero budget. Respect the user's requested documentation exclusions. Do not add paid-service dependencies or assume access to teammates' private services.

## 2. Coordinate shared ownership

Team members are **Boey, Keane, Eric, Russell, Xin Lei, and Athithya**. No initial assignments or exclusive feature claims have been made.

- Features may have multiple contributors. An In Progress entry is a coordination signal, not an exclusive lock.
- When starting actual implementation, update the existing task with the current user's name as an active contributor, the branch, affected areas, and next action. Do not invent a member's identity or assign work to teammates without their agreement.
- If another member is active in the same area, examine their task notes and existing changes. Coordinate overlapping edits through the current user or an agreed task split. A request explicitly authorizing collaboration or takeover supplies that authorization; do not demand it again.
- Continue useful work in independent areas while an overlap is unresolved. Do not silently replace another member's unfinished work.
- Preserve other people's task entries, acceptance criteria, code, and uncommitted changes. Make targeted tracker edits and resolve concurrent changes without dropping either contributor's information.
- Update the task when status, scope, dependencies, or shared contracts change. Mark Review with real evidence; mark Done only after acceptance.
- Do not treat `TASKS.md` as an atomic lock across machines. Consult available branch/PR information and use focused integration review.

No initial feature ownership is required merely to review these documents. Record implementation contributors when work begins.

## 3. Version control and integration

- Inspect `git status` and relevant diffs before editing. Existing changes may belong to the user or another agent.
- Use a focused feature branch. For agent-created branches, use `codex/<task-id>-<description>` unless the user specifies otherwise.
- Keep unrelated fixes out of the task. Avoid broad formatting changes that obscure a functional diff or create merge conflicts.
- Never discard work with a destructive reset/clean, overwrite uncommitted files, rewrite shared history, or force-push without explicit authorization for that action.
- Keep dependency changes narrow. Use pnpm and preserve a single root lockfile; do not add npm/yarn lockfiles.
- Shared schemas, authentication, router configuration, global styles, game/result interfaces, and root tooling are integration-sensitive. Describe changes and their affected consumers in the task/PR and coordinate with those contributors.
- Review diffs before concluding. State what changed, what was checked, and any remaining issue. Do not claim a commit, PR, merge, or test run that did not occur.

## 4. Follow the taught stack

- Frontend: HTML, CSS, plain JavaScript, Vue 3 single-file components with `<script setup>`, Bootstrap 5.3.x, Vue Router, Pinia, and Axios.
- Backend: Node.js, Express, Mongoose, and MongoDB.
- Tooling: pnpm, ESLint, Prettier, Vitest, and Playwright.
- Confirm compatible versions during scaffolding and pin the selected versions through the runtime/package configuration and lockfile.
- Use Vue state, computed values, props/emits, and component composition. Keep direct DOM manipulation limited to a justified integration or accessibility need.
- Keep transient game state within its module. Put only genuinely shared state in shared stores.
- Use a shared Axios client with relative `/api` paths and consistent failure handling. Keep database access and secrets on the server.
- Prefer small understandable services and components. Introduce abstractions only when they clarify a shared responsibility or support an actual second use.

## 5. Protect module boundaries

The spine owns layout, navigation, authentication, access checks, common UI states, shared HTTP handling, game registration, and common learning-result interfaces. Games own their rules, content, state, and server-side scoring inside their own modules.

- Read and reuse the existing shared interfaces before adding a game.
- Register a stable game ID, ruleset version, route, learning objective, and topic tags through the agreed registry.
- Use shared authentication and session handling. Do not implement a separate login system for a game.
- Do not bypass shared result validation or modify another game's collections directly.
- If a required contract is missing, specify the smallest necessary contract and coordinate its addition. Do not create competing shared interfaces in parallel.
- Treat live multiplayer as optional scope. Do not add a socket server or other infrastructure without a selected feature that needs it.
- Keep all teaching scenarios within the application's synthetic data and controlled exercises.

## 6. Enforce data and role boundaries

- Institutions contain cohorts. Users may have multiple memberships, and instructors may be assigned multiple cohorts.
- Registration can create only a base student account. A submitted role, institution, cohort, score, or user ID is never proof of authorization.
- Cohort entry requires an approved membership. Pending and removed memberships do not grant class access.
- Staff gameplay access does not broaden instructional permissions. Instructors can read learning activity only for their assigned cohorts; system administrators may review learning activity across cohorts.
- Every attempt has one server-validated context: an eligible cohort or personal practice. Freeze the context at creation. An instructor cannot read unrelated activity just because the same student belongs to their class.
- Scope every API query and mutation by the authenticated user's permissions. Use projection/serialization to expose only the fields required by the caller.
- Student profile updates allow only approved profile fields. Never mass-assign request bodies into account, membership, or result documents.
- Leaderboards expose only authorized cohort rankings with username, preset avatar, and score/rank. Exclude personal practice and staff scores.
- Check ownership of nested resources as well as route-level roles. Tests must cover direct requests with another cohort's, student's, or attempt's ID.
- Follow membership/account changes immediately for new requests; revoke or refresh stale sessions as needed. Do not rely on a role cached indefinitely in the browser.

## 7. Authentication and secure coding

- Hash passwords using a maintained Argon2id implementation with per-password salts and a reviewed work factor. Never store recoverable or plaintext passwords.
- Never return hashes in account responses, exports, logs, or admin views. Administrators do not need password material to manage users.
- Use Mongo-backed server sessions with cookie identifiers. Apply `HttpOnly`, `SameSite`, bounded lifetimes, and session rotation/revocation. Limit the local HTTP cookie exception to the explicit localhost development configuration.
- Apply CSRF and expected-origin checks to state-changing requests, including login/logout. Do not mutate state through GET requests.
- Validate types, bounds, IDs, enums, and allowed fields at the server boundary. Build MongoDB filters from validated values; do not accept arbitrary query operators or update documents.
- Rate-limit login, recovery, enrollment-code attempts, and expensive endpoints. Set request-body limits and public API timeouts.
- Use generic authentication/recovery errors where necessary to avoid account enumeration. Give the user useful next steps without exposing stacks or internal configuration.
- Treat external content as untrusted. Use escaped Vue interpolation for text; avoid `v-html` for user or API content. Validate external link protocols.
- Never place secrets in the client, `VITE_*` variables, source control, screenshots, or task notes. Environment examples contain placeholders only.
- Redact passwords, cookies, tokens, connection strings, token-bearing URLs, and sensitive request bodies from logs. Keep administrator-visible logs bounded and access-controlled.

Follow the [security references in README.md](README.md#authentication-and-recovery-requirements). Verify implementation-specific guidance against primary documentation when needed.

### Recovery rules

- Use instructor-assisted recovery after identity verification through an established school channel; no email service is required initially.
- Confirm the instructor's assignment and the target student's active membership. Instructors cannot reset staff accounts, even if those accounts also have student membership.
- Generate a random, expiring, single-use reset token; store its hash. Present the link once only to authorized staff for private delivery. Do not log it or return it from a public recovery endpoint.
- Let the student choose the password. Atomically consume the token, invalidate existing sessions, and require normal login afterward.
- Audit who initiated/completed recovery and its outcome, with no secrets. Administrator and unassigned-student recovery must have an explicit documented path.

### Result integrity

- The server creates attempts and determines their player, context, eligibility, and ruleset.
- Score actions/answers on the server or validate them against authoritative state. Never accept an arbitrary browser-supplied total or achievement grant.
- Keep secret answers and challenge flags out of public frontend bundles and API responses.
- Enforce the attempt lifecycle, ownership, bounds, and completion rules. Duplicate completion must not create extra scores or rewards.
- Keep game mechanics and feedback understandable. Saved topic outcomes are evidence of performance; do not claim a scientifically validated mastery score without supporting evaluation.

## 8. Make every screen responsive and accessible

Read [DESIGN.md](DESIGN.md) before UI work. Preserve the strict visual split: modern pastel landing/login/supporting pages use the exact five root colour tokens, Inter (or Roboto), 700-weight headings/game titles, 400-weight body text, a 3D-style capybara with a monocle, and rounded icons. The student homepage is a 2D pixel-art town with pixel capybara NPCs, buildings, metadata cards and controls. All activities are available from the start; never restore linear locks. Keep the town readable inside a bounded, scrollable viewport at 375px. Retain the 3D navbar logo on every page; show “Sharlock Hub” only from 768px upward.

Follow [Adding a new game to the homepage](DESIGN.md#adding-a-new-game-to-the-homepage) exactly: register a unique entry in `client/src/data/gameCatalog.js`, choose/place its pixel building, supply the name, description, integer 1–3 star difficulty and background-knowledge list, and connect the actual game route. The shared map renders the building and hover/focus/tap card from that entry. Do not duplicate registries or cards. Knowledge is advisory, not an access gate. Preserve the muted-by-default `/audio/sharlock-bgm.mp3` loop, gesture-driven playback, retry and cleanup. Games may use independent scoped palettes while retaining clean typography, soft/friendly aesthetics, accessibility and full responsiveness. Label sample progress explicitly; never present preview data as saved learning records.

The minimum viewport width is **375px**. Design for mobile first and scale through Bootstrap XL and larger.

- Use the Bootstrap grid/utilities, Flexbox, and Grid with flexible dimensions. Scope game-specific styles so they do not alter the shared navbar or other games.
- Keep text legible and primary actions visible. Do not shrink an entire desktop board into an unreadable mobile image.
- Reflow game controls and information panels. Provide touch and keyboard alternatives for dragging and hovering.
- Avoid page-wide horizontal scrolling. Bound intentional table scrolling within its component.
- Use semantic buttons/links, labeled controls, visible focus, accessible names, and feedback beyond colour alone. Handle focus when opening/closing dialogs or navigation.
- Clean up event listeners and timers when components unmount. Handle duplicate clicks, interrupted requests, and expired sessions predictably.
- Verify widths 375, 576, 768, 992, 1200, and 1440px, plus portrait/landscape and affected breakpoint edges.

## 9. Test real user outcomes

- Use the rubric and README journey matrix to choose meaningful checks. Add tests alongside security-sensitive and core-journey changes.
- Unit-test pure scoring and permission logic where useful; integration-test server authorization, sessions, validation, and persistence; E2E-test student/staff journeys.
- Use deterministic synthetic fixtures, independent accounts where appropriate, stable role/label/test-ID selectors, and condition-based waits. Avoid fixed sleeps and test-order coupling.
- Point tests only at an explicitly configured dedicated `_test` database. Reject missing/unsafe configuration before any reset or cleanup. Never fall back to a development URI.
- Keep external API responses controlled in repeatable tests. Perform and record a separate live API check for the assessment requirement.
- Check wrong-role, wrong-cohort, wrong-owner, pending/removed membership, expired/reused reset, and duplicate-result cases.
- Run checks appropriate to the change. Documentation-only changes need accurate links, cross-file consistency, and honest status checks; they do not need a browser test suite.
- Report exact commands and outcomes, including “not run” and its reason. Never turn placeholders, skipped tests, fixtures, or a successful build into a claim that an unimplemented journey works.

## 10. Maintain accurate documentation

- `README.md`: Human/grader setup, environment, local run, actual accounts, testing, architecture, course alignment, and known limitations.
- `TASKS.md`: Current gate, Kanban status, active contributors once work begins, dependencies, integration notes, evidence, and exploratory ideas.
- `agents.md`: Shared directives, boundaries, and collaboration expectations.
- Label planned scripts, variables, routes, and features until implemented and verified. Update the README in the same change that implements or changes its instructions.
- Preserve the initial game ideas as exploratory until selected. Do not silently assign them to people or present them as finished features.
- Keep comments useful: explain non-obvious constraints and decisions instead of narrating simple code. Credit reused code, libraries, assets, and external data in accordance with the project brief.
- End each task with a concise account of changes, verification, and the next required action. Respect the current approval gate before proceeding further.

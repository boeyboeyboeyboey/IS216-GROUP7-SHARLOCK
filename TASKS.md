# SHARLOCK task board

**Read this file before starting work.** It is the shared Kanban board, integration record, and feature backlog. [README.md](README.md) defines the product and architecture; [agents.md](agents.md) defines the AI collaboration rules.

Team: **Boey, Keane, Eric, Russell, Xin Lei, Athithya**.

No feature assignments or exclusive claims have been made. Members may work on one another's features. When work actually starts, record active contributors, the branch, and affected areas so overlapping edits can be coordinated. Do not manufacture assignments for other members.

## Approval gates

Boey requested separate approval between these stages. Authorization for one stage does not authorize the next.

| Stage | Scope | Status / next action |
| --- | --- | --- |
| 1 — Clarify | Read supplied PDFs and agree product/architecture defaults. | Complete; defaults approved, including the subsequent localhost-only and documentation exclusions. |
| 2 — Documentation | Create only `README.md`, `TASKS.md`, and `agents.md`. | Authorized; files prepared for Boey's review. |
| 3 — Scaffold | Create the MEVN workspace, directories, package/configuration files, environment templates, and development/test setup. | Await explicit approval after documentation review. |
| 4 — Base app | Implement responsive shell/navbar, routing, authentication, and foundational RBAC/data models. | Await explicit approval after scaffold review. |

Later feature work requires an explicit task request or agreed team scope. Update the gate status when approval is received; preserve the distinction between proposed and implemented work.

## Board conventions

- **Backlog:** Agreed requirement or proposal that has not started. Dependencies and stage approvals still apply.
- **In Progress:** Active work. Record contributor names and the affected files/modules. Collaborators may join after coordinating overlap.
- **Review:** Ready for review, with a branch/PR/commit reference and actual verification results.
- **Blocked:** State the concrete dependency and the next action that would unblock it.
- **Done:** Acceptance criteria met and reviewed; evidence retained.

Move a task between sections instead of duplicating its ID. Add newly discovered work without deleting other entries. Keep exploratory game ideas in their own section until the team selects them.

Priorities: **P0** foundation or assessment requirement; **P1** core user value; **P2** optional enhancement. Priorities do not override approval gates.

## In Progress

None recorded. No implementation has begun in this repository.

## Review

| ID | Priority | Task | Active contributors | Scope / evidence | Next action |
| --- | --- | --- | --- | --- | --- |
| DOC-02 | P0 | Initial project documentation | — | The three root Markdown files; local links/anchors, Markdown fences/whitespace, team names, unique task IDs, scope exclusions, and cross-file consistency checked. Application tests are not applicable yet. | Boey reviews the documents and explicitly authorizes Step 3 when ready. |

## Blocked

None. Work awaiting its planned stage approval remains in Backlog rather than being reported as an implementation failure.

## Backlog

All tasks below are unassigned. File paths are planned integration areas, not a claim that those files already exist.

### Foundation and base app

| ID | Priority | Task / integration area | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- |
| SET-01 | P0 | MEVN workspace and local scripts; root, `client/`, `server/` | Step 3 approval | Compatible pinned runtime/dependencies; pnpm workspaces and one lockfile; Vue/Vite/Bootstrap and Express configuration; localhost proxy; documented install/dev/build scripts. |
| SET-02 | P0 | Environment and database configuration; server config | SET-01 | Placeholder-only environment example; startup validation; per-member development DB and dedicated test DB; secrets excluded from Git and client bundles. |
| SET-03 | P0 | Lint, format, and test foundations; root/test configuration | SET-01, SET-02 | README script contract implemented; Vitest/Playwright configuration; safe test-database guard; working checks for code that exists, with later suites clearly pending. |
| UI-01 | P0 | Responsive application shell and navigation; shared client components | Step 4 approval, SET-01 | Header, Bootstrap navbar, content/footer layout, keyboard navigation, and tested behaviour from 375px through XL. |
| UI-02 | P0 | Route structure and shared UI states; client router/views | Step 4 approval, UI-01 | Home/game hub, auth, profile/progress, cohort leaderboard, instructor, admin, forbidden, and not-found route structure; unfinished views clearly marked; no misleading success displays. |
| AUTH-01 | P0 | Identity model and authentication; server auth, client auth store/views | Step 4 approval, SET-02 | Registration/login/logout/current-user flows; Argon2id hashing; normalized identifiers and duplicate validation; Mongo-backed sessions; CSRF/origin controls; session rotation/expiry; safe errors and rate limits. |
| DATA-01 | P0 | Institution, cohort, membership, and role foundations; server models/services | Step 4 approval, AUTH-01 | Global roles and per-cohort assignments; unique membership constraints; pending/active/removed membership states; explicit cohort/personal context for future activity; validated relationships. |
| AUTH-02 | P0 | Permission middleware and route guards; server access services/client router | AUTH-01, DATA-01 | Server permission and query scoping; restored-session-aware routing; staff gameplay access; direct API tests for ownership, cohort boundaries, and forged roles. |
| SEED-01 | P0 | Synthetic local demo data and initial administrator procedure | AUTH-01, DATA-01 | Repeatable non-destructive seed; SMU/NUS, multiple cohorts, all roles, and multi-cohort student; working grader credentials documented; no real secrets; documented initial admin setup. |

### Complete user journeys

These extend the foundation. Their full dashboards and workflows are not implied by Step 3 scaffolding or a placeholder route in Step 4.

| ID | Priority | Task / integration area | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- |
| COH-01 | P1 | Cohort requests and enrollment management | DATA-01, AUTH-02 | Revocable expiring codes; join request and instructor approval; multiple memberships; membership removal immediately revokes class access; no roster leakage through invalid codes. |
| PRO-01 | P1 | Profile customization | AUTH-01 | Unique editable username and preset avatar persisted; server allowlist/validation; no self-editing roles, scores, memberships, or account status. |
| GAME-01 | P0 | Game registry, shared attempt/result interface, and integration example | AUTH-02, DATA-01 | Concrete documented registration/payload contracts; isolated modules; validated server-created attempts and immutable context; idempotent completion; example proves one result reaches progress without becoming a committed full game. |
| LEARN-01 | P1 | Personal progress and achievements | GAME-01 | Own results survive refresh; completion, attempts, scores, and topic outcomes shown; achievements awarded from validated server events without duplicate rewards. |
| BOARD-01 | P1 | Cohort leaderboards | COH-01, GAME-01 | Authorized cohort-only queries; per-game/ruleset best completed attempt; equal-score ranks; username/avatar/score projection; staff and personal-practice exclusions. |
| INST-01 | P1 | Instructor analytics | COH-01, GAME-01 | Completion, attempt and topic-performance summaries; assigned cohort filter; useful empty states; multi-cohort student records remain scoped to the selected assigned cohort. |
| REC-01 | P0 | Staff-assisted password recovery | AUTH-02, COH-01 | Identity-verification instructions; cohort checks; no instructor recovery of staff accounts; hashed expiring single-use tokens; student sets password; session revocation; redacted audit trail; local emergency administrator recovery procedure. |
| ADMIN-01 | P1 | Administration screens | AUTH-02, DATA-01 | Instructor account/assignment management, institution/cohort management, cross-cohort learning review; validated policy controls with defined effects; no game-editor or arbitrary code execution. |
| LOG-01 | P0 | Safe error handling and audit events | AUTH-01 | Central error responses with request ID; redacted operational/audit records; administrator-only log views; bounded retention; no passwords, token-bearing URLs, secrets, or raw sensitive request bodies. |
| API-01 | P0 | Select and integrate a meaningful public API | SET-02, UI-02 | Document a zero-cost provider and its terms/limits; one useful learner journey with real async HTTP/JSON; attribution; timeout/loading/error/empty/retry handling; labeled cache/sample data; controlled test responses. |

### Verification and assessment

| ID | Priority | Task | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- |
| QA-01 | P0 | Core E2E journeys and API authorization regression tests | SET-03; corresponding implemented features | Cover the README journey matrix with deterministic data, stable selectors, repeatable setup, negative permission cases, and recorded outcomes. Add coverage alongside each feature. |
| QA-02 | P0 | Responsive and accessibility review | UI-01; corresponding implemented features | Chrome checks at 375/576/768/992/1200/1440px, portrait/landscape; navbar, forms, dialogs, dashboards, and each chosen game; no clipped actions or page overflow; keyboard/touch access. |
| QA-03 | P0 | Fresh-checkout rehearsal and documentation audit | Implemented core journeys, SEED-01, QA-01, QA-02 | Another teammate follows the README successfully; actual commands/accounts verified; pending claims resolved; known limitations recorded; live API checked separately. |
| PITCH-01 | P0 | Week 9 progress pitch | At least one working task | Clear learning problem, features, design/stack, and actual six-person job scopes; functioning demo supported by implementation evidence. |
| FINAL-01 | P0 | Final presentation and submission package | QA-03 | Brief-compliant materials/video, test evidence, source credits, local demo instructions, and reviewed package ready before Week 12 Friday 9am. |

## Done

| ID | Task | Evidence |
| --- | --- | --- |
| DISC-01 | Read project brief, WAD2 materials, and CS440 overview; clarify initial scope | Step 1 discussion completed. Boey approved the proposed defaults subject to the latest constraints recorded below. No implementation completion is implied. |

## Exploratory games and future features

These are ideas, not commitments or assignments. Select a manageable set based on learning value, implementation effort, responsiveness, and available time. Every member's final contribution must include coding.

| Idea | Learning objective / useful interaction | Initial scope | Possible extension |
| --- | --- | --- | --- |
| Mini CTF | Solve short challenges in cryptography, authentication, and web-security reasoning; explain the weakness and defence. | Individual challenges and cohort high scores using simulated targets. | Timed shared challenges or live competition. |
| Cybersecurity news/threat briefing | Connect real incidents or vulnerability information to course topics and mitigations. | Public API, source links, topic filters, and an accompanying reflection/check question. | Saved articles and instructor-curated discussions. |
| Red vs. Blue card game | Match attacks to controls and reason about risk and limited defensive resources. | Turn-based rounds against a simple computer opponent. | Online 1v1 play. |
| Integrity detective | Distinguish accidental corruption, tampering, hashing, MACs, and signatures. | Inspect simulated messages and choose the appropriate integrity/authentication check. | Linked investigation scenarios. |
| Certificate inspector | Understand certificate identity, expiry, trust, and hostname checks. | Diagnose fictional certificate/connection examples with explanations. | Certificate-chain puzzles. |
| Access-control puzzle | Apply least privilege and distinguish identity from permission. | Assign permissions to fictional roles/resources and test allowed actions. | Compare role-based and attribute-based policies. |
| Network defender | Reason about network boundaries and simple filtering decisions. | Permit/deny fictional traffic with a table/card interface. | Multi-stage network incidents. |
| Secure-code detective | Recognize unsafe handling of input and explain safer alternatives. | Compare bounded code examples and match fixes to risks. | A sequence covering software and web security. |
| Cryptography courier | Understand symmetric and asymmetric encryption roles in confidential communication. | Choose keys and steps in a guided message-delivery puzzle. | Combine encryption with signatures. |
| Global competition | Optional competition across institutions without exposing private learning records. | Deferred. | Opt-in, signed-in leaderboard with agreed eligibility/scoring rules. |

## Decisions and unresolved choices

| Topic | Decision / status |
| --- | --- |
| Presentation | Localhost only; zero budget. |
| Framework conventions | Plain JavaScript, Vue 3 `<script setup>`, Router, Pinia, Bootstrap 5.3.x, Axios, Express, Mongoose/MongoDB, pnpm, Vitest, Playwright. |
| Enrollment | Self-registration, code-based cohort request, instructor approval; admins provision instructors and assign them to cohorts. |
| Data boundaries | Institution contains cohorts; membership supports multiple cohorts; attempts belong to one validated cohort or personal practice. |
| Role scope | Instructors/admins may play; admin learning-record access spans cohorts; instructors remain restricted to assigned-cohort activity. |
| Rankings | Signed-in, authorized cohort members/staff; public profile fields only; staff practice excluded; global competition deferred. |
| Recovery | Staff-assisted single-use reset links; no email-service dependency. |
| Game selection and assignments | Undecided; the above ideas remain exploratory. No member is assigned by this file. |
| Public API provider | Unselected; resolve and verify in API-01. Do not claim the API requirement is met yet. |
| Detailed interfaces and policy values | Finalize during the relevant task: game payloads, session/reset/code lifetimes, log retention, and specific administrator policy controls. Document values and tests. |
| Verification status | Documentation checks only at Step 2; application commands, credentials, and tests are not yet available. |

## Entry template for active work

When work begins, retain the task's acceptance criteria and add:

- **ID / title:**
- **Status:**
- **Active contributors:** Real team members directing the work; add collaborators as needed.
- **Branch / PR / commit:**
- **Affected files or modules:**
- **Dependencies / shared contracts:**
- **Coordination note:** What overlaps with someone else's work, and how it is divided.
- **Verification:** Exact checks run, outcome, and any remaining limitation. Say “not run” when applicable.
- **Next action / reviewer:**

## Definition of Done

- Acceptance criteria are met and the user journey is complete for the stated scope.
- Server authorization, input validation, data separation, and safe failure handling are covered where relevant.
- Affected views work at 375px and larger sizes, with usable keyboard/touch interactions.
- Relevant tests/checks pass; remaining limitations are explicit and do not silently waive core requirements.
- Shared contracts and setup instructions match the implementation.
- Actual evidence and a review reference are recorded, and the reviewer accepts the task.

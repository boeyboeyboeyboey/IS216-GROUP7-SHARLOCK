# SHARLOCK — Cybersecurity Game Hub

A WAD2 (IS216) group project that helps introductory cybersecurity students practise concepts through short, interactive games. Students receive feedback and track progress; instructors use cohort analytics to identify topics that need reinforcement.

**Current status: documentation only.** The application, package manifests, environment templates, database seed, and tests have not been implemented. The setup and commands below are the contract for the next stages, not commands that work in the current repository. See [TASKS.md](TASKS.md) for implementation status and approval gates.

**Presentation environment: localhost. Budget: zero.**

## Team and collaboration

Boey · Keane · Eric · Russell · Xin Lei · Athithya

Assignments have not been decided. Features have shared ownership, and members may contribute to one another's work. Read [TASKS.md](TASKS.md) before starting and coordinate changes that overlap with active work. Record active contributors when implementation begins; these names are coordination information, not exclusive ownership claims.

AI-assisted sessions must explicitly read [agents.md](agents.md), which requires checking `TASKS.md` first. Do not assume that a coding tool automatically discovers the lowercase filename.

Repository: [IS216-GROUP7-SHARLOCK](https://github.com/boeyboeyboeyboey/IS216-GROUP7-SHARLOCK)

## Learning purpose and rubric alignment

The learning problem is applying foundational security concepts and understanding the consequences of decisions. Every selected game should identify a learning objective, ask the student to make meaningful decisions, explain outcomes, and save useful evidence of progress.

The [project brief and rubric](documentation/project_brief_and_rubric.pdf) is the primary source for assessment requirements. Percentages below are within the final presentation and deliverables component, not percentages of the entire course.

| Criterion | Weight | Evidence to build and demonstrate |
| --- | --- | --- |
| Problem solving and solution appropriateness | 20% | Clear learning objectives, useful feedback, and an instructor view that helps identify learning gaps. |
| Working, correctly implemented, usable application | 27% | Complete student and staff journeys, persistent data, enforced access rules, and understandable error states. |
| Styling and responsiveness | 18% | Consistent Bootstrap styling and usable pages and games from 375px through XL, in both orientations. |
| Testing | 10% | Repeatable end-to-end coverage of core journeys, stable selectors, and reproducible instructions. |
| Presentation and Q&A | 25% | A clear problem-to-solution story, smooth demo, technology explanation, and test evidence. |

Additional requirements: HTML/CSS/JavaScript, a backend data store, and meaningful use of at least one public external API through asynchronous HTTP requests. A static fixture or scraped page alone does not fulfil the API requirement.

### Course concepts to demonstrate

| WAD2 material | Application use |
| --- | --- |
| [Course overview](documentation/WAD2%20Course%20Details/WAD2%20Course%20Overview.pdf) | Frontend problem solving, interaction, components, routing, state management, and testing. |
| [Week 2: CSS](documentation/WAD2%20Course%20Details/Week2Slides.pdf) | Box model, selectors, spacing, Flexbox, Grid, and maintainable styling. |
| [Week 3: Bootstrap](documentation/WAD2%20Course%20Details/Week3Slides.pdf) | Mobile-first grid, breakpoints, forms, cards, navbar, and accessibility. |
| [Week 4: Vue](documentation/WAD2%20Course%20Details/Week4Slides.pdf) | Single-file components, Composition API, reactive state, bindings, and routing. |
| [Week 5: Vue and async requests](documentation/WAD2%20Course%20Details/Week5Slides.pdf) | Events, lifecycle hooks, computed values, list rendering, Axios, and JSON. |

Use the [CS440 overview](documentation/CS440%20%28Cybersecurity%20Fundamentals%29%20Course%20Details/0-course-intro.pdf) to map activities to basic security concepts, symmetric/asymmetric encryption, integrity and authentication, certificates, identity management, access control, network security, software security, and web security. Specific exercises in the backlog are our proposed interpretations of those topics, not supplied CS440 lecture content.

## Planned application spine

### Technology choices

| Area | Choice |
| --- | --- |
| Frontend | HTML, CSS, plain JavaScript, Vue 3 single-file components using `<script setup>`, Vite, Bootstrap 5.3.x. |
| Navigation and shared state | Vue Router and Pinia. |
| HTTP requests | A shared Axios client using relative `/api` URLs. |
| Backend | Node.js, Express, and Mongoose. |
| Database | MongoDB; Atlas Free is the shared database option, with a local MongoDB instance also supported. |
| Authentication | Password hashing with Argon2id; server-side sessions stored in MongoDB. |
| Tooling | pnpm, ESLint, and Prettier; a single pnpm lockfile. |
| Verification | Vitest for unit/component and API integration tests; Playwright for browser end-to-end tests. |

Scaffolding must pin and verify compatible dependency and runtime versions. Follow the taught JavaScript approach; introducing TypeScript or another frontend framework requires an agreed change of direction.

### Local request flow and module boundaries

The browser opens the Vue app at `http://localhost:5173`. Vite proxies `/api` to Express at `http://localhost:3000`. Express validates requests, checks the session and permissions, and reads or writes MongoDB. Public API calls that need keys or shared caching pass through Express.

The planned repository has a `client/` workspace and a `server/` workspace. Shared UI components, navigation, authentication, state, and HTTP handling belong to the spine. Each game has its own client and server module. The detailed folder structure is reserved for Step 3.

All screens must distinguish loading, empty, success, validation failure, and service failure states where relevant. Direct links and refreshes must preserve valid navigation. Unknown and forbidden routes need useful recovery links.

### Identity, institutions, and cohorts

- An **institution** represents a school, such as SMU or NUS. A **cohort** represents a class and term within that institution.
- Students register with an email, password, and unique editable username. Email is an account identifier; without email verification, its domain is not proof of institutional membership.
- Students may practise independently while awaiting enrollment. They request cohort membership using an instructor-issued code; an assigned instructor approves the request before class information becomes visible.
- Accounts can have multiple cohort memberships. An instructor can be assigned to multiple cohorts. Joining as a student never grants instructor permissions.
- Administrators manage institutions, instructor accounts, and instructor assignments. Assigned instructors manage student enrollment for their cohorts.
- Enrollment codes are revocable and expire. Invalid codes must not reveal rosters or other private class information.
- Users select an eligible cohort when starting an activity, or choose personal practice. Each attempt has one immutable context: that cohort or personal practice. Results are not automatically shared with every cohort the student belongs to.
- Removing a membership revokes access immediately. Historical cohort results remain associated with that cohort for instructional review; the student retains access to their own results.

### Role-based access control

| Capability | Student | Instructor | System administrator |
| --- | --- | --- | --- |
| Play games and view own results | Yes | Yes, as practice | Yes, as practice |
| Edit own username and preset avatar | Yes | Yes | Yes |
| View cohort leaderboard | Active member's cohorts | Assigned cohorts or active student memberships | All cohorts |
| Inspect other students' learning records | No | Assigned cohorts' activity only | Across cohorts |
| Approve student enrollment | No | Assigned cohorts | All cohorts |
| Trigger student password recovery | No | Active students in assigned cohorts | All students |
| Manage instructor accounts and assignments | No | No | Yes |
| View system/error logs and manage application policies | No | No | Yes |
| Alter game code or scoring through staff screens | No | No | No; changes follow repository review |
| View stored plaintext passwords | Never | Never | Never |

Enforce permissions in Express and database queries on every request. Vue route guards and conditional navigation provide the corresponding user experience. Derive identity and privilege from the server session, never from a submitted role or user ID. An instructor who also participates in another class has teaching access only where explicitly assigned.

### Leaderboards and learning records

- Start with cohort-only leaderboards available to authorized, signed-in users. Students can query only their active cohorts; membership in an SMU cohort grants no access to NUS cohorts.
- Display only username, preset avatar, and score/rank. Email addresses, internal account IDs, detailed attempts, and class rosters are excluded from leaderboard responses.
- Staff practice scores do not enter student rankings. Personal practice does not enter a cohort ranking.
- Compare scores within the same game and ruleset. Initially rank each student's best eligible completed attempt; equal scores share a rank. Avoid combining incompatible raw scores across games.
- Store completion, attempt count, score and maximum score, timestamps, and outcomes tagged by cybersecurity topic. Present these as evidence of performance, not a claim of validated mastery.
- Global competition and institution-wide rankings are future options, not initial requirements.

### Authentication and recovery requirements

Use a maintained Argon2id library with per-password salts and an appropriate work factor. Exclude password hashes from normal queries, response objects, exports, and logs. See [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Keep session identifiers in `HttpOnly`, `SameSite=Lax` cookies. Store sessions on the server, rotate identifiers after login, expire idle and absolute sessions, and revoke sessions after logout, password reset, or relevant account changes. The local HTTP cookie configuration must be explicitly restricted to the localhost development environment. Do not store authentication tokens in browser local storage. See [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Apply CSRF protection and expected-origin checks to state-changing requests, including authentication flows; use no state-changing GET routes. SameSite cookies are an additional protection. See [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Password recovery initially uses staff assistance without an email service:

1. The student contacts their instructor through an established school channel. Staff verify identity before generating a link.
2. The application checks the instructor's active assignment and the target's active student membership. Instructors cannot recover another staff account, including an account that also has a student membership.
3. The server creates a cryptographically random, short-lived, single-use reset token, stores its hash, and shows the recovery link once to the authorized staff member for private delivery. The token grants only password-reset access.
4. The student opens the link and chooses a new password. Successful reset atomically consumes the token and revokes existing sessions; normal login follows.
5. Log the recovery action, actor, target, time, and outcome, excluding the link, token, and passwords. Administrators assist instructors and students without an available cohort instructor. Initial administrator setup and emergency recovery require a documented local maintenance procedure.

Instructor-triggered recovery affects the account's login credential, not access to other cohorts' learning records. See [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

### Game integration contract

Each selected game must provide:

1. A stable game ID, title, description, topic tags, ruleset version, and concise learning objective.
2. Its own route and module, using the shared layout, authentication, API client, and error components.
3. A usable 375px interaction design, including a touch/keyboard alternative to drag-only or hover-only actions.
4. A server-created attempt associated with the authenticated player and validated cohort or personal-practice context.
5. A server-side scoring function or validator. The browser submits allowed actions or answers; it cannot award itself scores or achievements.
6. A completed-result record containing the game/ruleset, score, maximum score, completion state, and topic outcomes. Private challenge answers remain server-side.
7. Idempotent completion so retries cannot duplicate results or rewards, followed by an explanation of the learning outcome.
8. Tests for its core journey and failure cases, and a short integration note in its task entry.

The spine will define the concrete payloads and registration mechanism before game integration begins. Games must not create separate login systems or directly change another module's data. Live multiplayer is optional; independently playable activities and asynchronous competition are valid starting points.

### Public asynchronous API

A news or threat-briefing module is an exploratory candidate for the mandatory external API integration. Provider selection is tracked in `TASKS.md`; no provider is implemented or promised yet.

The selected provider must offer a documented, zero-cost public API with usable terms and sufficient quota for development and assessment. Connect retrieved information to the learning objective, preserve source links and timestamps, and support meaningful interaction such as filtering by topic. Provide bounded requests, timeouts, loading/error/empty states, and retry controls. Cached or sample responses must be clearly labeled. Automated tests use controlled responses; a separate manual check verifies the real API.

## Local setup — planned, not yet executable

This section becomes a verified setup guide during scaffolding and base-app work. Until then, there is no runnable app at either localhost address.

### Prerequisites

- Git and Google Chrome, matching the assessment browser.
- Node.js and pnpm. Week 4 specifies Node.js at least 22.12.0; Step 3 must select a currently supported compatible release and record its exact major/version in the repository.
- Access to MongoDB Atlas Free or a local MongoDB instance. Use a separate development database per member, such as `sharlock_boey_dev`, and a dedicated test database such as `sharlock_boey_test`.
- Atlas users must configure database credentials and permit their development machine's network address. Never commit a connection string with credentials. [Atlas setup](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)

### Intended installation sequence

The first two commands work for cloning the repository. Subsequent commands require the future scaffold.

```sh
git clone https://github.com/boeyboeyboeyboey/IS216-GROUP7-SHARLOCK.git
cd IS216-GROUP7-SHARLOCK
pnpm install
cp server/.env.example server/.env
```

Fill the local environment file, then follow the planned workflow:

```sh
pnpm db:seed
pnpm dev
```

`pnpm dev` will start the frontend and backend together. Open `http://localhost:5173/`. The planned `GET http://localhost:3000/api/health` endpoint reports service readiness without exposing configuration. Stop both processes with `Ctrl+C`.

### Planned environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` for the local app; `test` for automated tests. |
| `PORT` | Express port, initially `3000`. |
| `CLIENT_ORIGIN` | Exact allowed frontend origin, initially `http://localhost:5173`. |
| `MONGODB_URI` | The member's development database connection string. |
| `TEST_MONGODB_URI` | A dedicated test database; never the development or shared demo database. |
| `SESSION_SECRET` | A unique cryptographically random secret, at least 32 bytes; no committed default. |

The scaffold will supply `server/.env.example` with placeholders and validate required values at startup. Public API variables will be documented when the provider is chosen. Frontend `VITE_*` variables are public and must contain no secrets. Any future seed-specific inputs must be added here before their command is documented as working.

### Seed data and grader accounts

The planned seed provides synthetic SMU and NUS institutions, multiple cohorts, student accounts, an instructor assigned to a limited subset of cohorts, and an administrator. Include a student in two cohorts to exercise record separation.

**No accounts or credentials exist yet.** After implementing and verifying the seed, document the exact demo-only usernames/passwords here for graders. Demo credentials must belong only to synthetic local demonstration accounts. Never include a member's real password or database credentials. Seeding must not silently delete existing data or reset existing passwords.

## Testing — planned, not yet executable

All commands in this table are intended root scripts to be supplied by the scaffold. Tests that depend on later features must be tracked honestly as pending until implemented.

| Command | Intended check |
| --- | --- |
| `pnpm lint` | JavaScript/Vue lint checks. |
| `pnpm format:check` | Formatting validation without edits. |
| `pnpm test:unit` | Pure logic and Vue component behaviour. |
| `pnpm test:integration` | Express, MongoDB, sessions, permissions, and scoring integration. |
| `pnpm exec playwright install chromium` | One-time installation of the browser used by E2E tests. |
| `pnpm test:e2e` | Core journeys against automatically started local test services. |
| `pnpm test` | The unit, integration, and E2E suites. |
| `pnpm build` | Verify the client build. |

Integration and browser tests must use controlled fixtures and their own database. Test setup must reject a missing test URI, a database name without the agreed `_test` suffix, or a target matching the development database. Cleanup must be restricted to the test run's data. Test failures must not trigger external emails, paid services, or uncontrolled public API requests.

### Required journey coverage

| Journey | Expected evidence |
| --- | --- |
| Authentication | Valid/invalid registration and login, session restoration, logout, and expired-session recovery. |
| Cohort enrollment | Request, pending state, approval, removal, and denied access before approval or after removal. |
| Student learning | Start activity, complete it, receive feedback, save a result, and see it after refresh. |
| Profile | Edit username/avatar; validation failures preserve useful input and expose no sensitive fields. |
| Leaderboard | Only eligible cohort scores and public profile fields appear; staff/personal practice is excluded. |
| Instructor access | Assigned-cohort analytics succeed; another cohort's IDs and multi-cohort students' unrelated results are denied. |
| Administrator access | Instructor management and cross-cohort review succeed; student/instructor direct API access is denied. |
| Recovery | Authorized reset succeeds; wrong-scope, staff-target, expired, and reused-token attempts fail; old sessions stop working. |
| Result integrity | Altered client scores, duplicate completion, and submissions for another player's attempt are rejected or safely deduplicated. |
| External API | Live manual request plus repeatable mocked success, empty, timeout, and error cases. |

Use role/label selectors or intentional `data-testid` attributes. Avoid fixed sleeps, test-order dependencies, and selectors coupled to CSS layout. API authorization tests must call endpoints directly as well as testing navigation.

### Responsive acceptance checks

Check Chrome at widths **375, 576, 768, 992, 1200, and 1440px**, with representative portrait and landscape heights. Check just below/above breakpoints when layout changes there.

- No page-wide horizontal overflow or clipped primary controls.
- Navbar collapses, opens, closes, and remains keyboard accessible.
- Cards, forms, dialogs, dashboards, and game boards reflow with legible text.
- Essential instructions and actions remain available on touch screens.
- Use semantic controls, visible focus, labels, sufficient contrast, and feedback that is not conveyed by colour alone.
- Wide tabular content may use a clearly bounded scroll region, while essential actions remain reachable.

## Development and review workflow

1. Read `TASKS.md`, `agents.md`, and the affected module before editing. Confirm the current stage is authorized.
2. Use a feature branch such as `codex/<task-id>-<short-description>` for agent-led changes. Update the task's active contributors, branch, and affected areas once actual work begins.
3. Coordinate overlapping work. A feature may have multiple contributors; do not overwrite uncommitted work or silently take over another branch.
4. Keep changes focused. Shared contracts, schemas, routes, and dependencies need an explicit integration note and review from affected contributors.
5. Run relevant checks and record their actual outcomes. Update this README whenever implemented commands, environment variables, or user journeys change.
6. Move the task to Review with a PR or commit reference and evidence. Move it to Done after review and acceptance. Do not force-push shared branches.

Task status in a Git file is coordination information, not a live lock across teammates' machines. Read the latest available branch/PR information and resolve tracker edits carefully during integration.

## Assessment preparation

- **Week 9:** Progress pitch with clear problem, features, design/stack, team scopes, and a functioning task. Assign real contributions before the pitch.
- **Week 12, Friday, 9am:** Final submission deadline from the project brief; no changes afterward. Confirm section-specific presentation arrangements with the instructional team.
- Prepare the required presentation materials and a video of at most 12 minutes, with at least 720p resolution. Put its link on the first slide.
- Before submission, verify the README from a fresh checkout: installation, environment setup, seed, local run, exact demo accounts, test commands, and known limitations.
- Credit external code, libraries, assets, and data sources as required by the brief. Every member must understand and be able to explain their contributions.
- Remove the documentation-only warning only after the described application and commands actually work; retain explicit pending notes for unfinished features.

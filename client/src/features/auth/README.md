# Browser account journey

AUTH-01-B connects the approved backend account foundation to the shared student website. Registration, login, refresh restoration, logout, browser navigation checks and real account identity use the existing pixel theme. It does not implement class enrollment, saved game results, profile editing or staff permissions.

## Student flow

- A signed-out visit to town, any game or The Sharlock Times opens sign-in. About remains public. Profile and Progress remain readable shells with sign-in/create-account prompts.
- Registration collects email, username, password, matching confirmation and one of six capybara presets. Only email, username, password and avatar ID reach the server. Registration automatically establishes the session and enters town.
- Login uses email and password. Existing valid sessions restore after refresh; visiting an account form while signed in returns to town.
- Navbar/menu logout invalidates the current server session before returning to sign-in. Failed network logout retains the identity and offers retry.
- Expired sessions stop a pending browser activity request before dispatch and return to sign-in. No mutation is automatically replayed. Unavailable session checks block protected navigation/actions and show useful recovery feedback.
- Town, menu and Profile use the saved username/avatar. Game results, progress and achievements remain unsaved; no sample rewards are attached to the real account.

Class-link/code enrollment and one-time onboarding require the later DATA-01/AUTH-02/COH-01 foundation. No pretend class-code step is displayed in this slice.

## Components and state

`pages/LoginPage.vue` and `RegisterPage.vue` own local submit state and compose `LoginForm`/`RegisterForm`. Forms hold passwords locally, clear them on success/unmount, disable editing while pending, and focus a textual error summary. `AvatarPicker` uses labeled native radio inputs. `AccountSummary` accepts `{ status, user, logoutPending, error }` and emits `sign-out`/`retry-session`; `SessionNotice` accepts `{ message, pending }` and emits `retry`.

`store.js` owns the shared Pinia status, safe user DTO, memory-only CSRF token and safe request feedback. It deduplicates restoration/bootstrap and uses operation generations to keep stale responses from undoing a newer login/logout. Passwords and confirmation never enter store state or browser storage. `api.js` reuses the shared Axios cookie client and maps only approved public errors. `validation.js` and `avatars.js` reuse the backend's existing public, data-only policy/preset definitions; session, hashing, models and secrets stay out of the client bundle.

`guards.js` provides the injected router guard and browser activity request check. `main.js` installs them after Pinia and before initial navigation. Protected News/game requests await the current server session before dispatch, while auth and public health requests bypass that check to prevent recursion. The existing game/news wrappers and engines remain unchanged.

## Boundaries and design

These browser checks are user experience controls, not direct-API authorization. Existing game APIs still use their interim unsaved resource contracts. Server capabilities, cohort permissions and game-resource ownership require their later approved foundation tasks; do not claim those guarantees from this UI.

`auth.css` is limited to auth feature roots and consumes the existing cream/earthy-green tokens, Pixelify Sans, square controls and hard shadows. Navbar/layout reuse the retained smooth 3D logo, mobile offcanvas and focus handling. Town camera, gestures, audio and game-local styles are preserved. See [DESIGN.md](../../../../DESIGN.md).

## Review and verification

Run `pnpm dev`, open `/register`, select an avatar and create an account; then check town/Profile, refresh, logout and sign-in. About is available without an account. Use a Mongo connection as described in the root setup; this slice adds no dependency or configuration change.

Meaningful unit tests live in `__tests__/auth.test.js` and `guards.test.js`. The actual browser journey is [auth.spec.js](../../../../tests/e2e/auth.spec.js); legacy navigation/game tests use a guarded synthetic read-only worker account in `tests/e2e/fixtures/auth.js`. Fixtures never reset development data or weaken production limits. Actual commands and results belong to the AUTH-01-B record in [TASKS.md](../../../../TASKS.md).

Related references: [backend API contract](../../../../server/src/modules/auth/README.md), [preset assets and prompts](../../../public/images/avatars/README.md).

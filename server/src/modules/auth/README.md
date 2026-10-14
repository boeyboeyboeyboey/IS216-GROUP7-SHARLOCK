# Authentication foundation

This backend module provides student registration, account sign-in, session restoration and sign-out. AUTH-01-B connects the [browser account journey](../../../../client/src/features/auth/README.md). DATA-01-A/AUTH-02-A reuses this session runtime for authenticated class reads. Existing game APIs retain their unsaved contracts; authentication alone does not grant cohort access or saved attempt ownership.

## Request flow

`GET /api/auth/csrf` creates or reuses a short-lived anonymous Mongo session and returns a synchronizer token. Registration, login and logout require an exact trusted `Origin` (or the same origin parsed from `Referer` when `Origin` is absent) and the token in `X-CSRF-Token`. Successful registration creates only a student; successful registration and login rotate the session ID, persist the new session, and return a fresh token. Every auth request rechecks an authenticated session's idle and absolute bounds plus the current account status and auth version. An expired authenticated session may obtain a fresh anonymous token through a new bootstrap request; disabled or version-stale sessions are invalidated. `GET /api/auth/me` returns only the current safe user DTO. `POST /api/auth/logout` destroys the current session.

## HTTP contract

All auth responses use `Cache-Control: no-store`. The browser sends the session cookie automatically; no auth token belongs in browser local storage. Each mutation requires `X-CSRF-Token` plus the configured client origin through `Origin`, or a same-origin `Referer` when `Origin` is absent. A missing or `null` origin does not authorize a mutation. Unknown body or query fields are rejected.

| Endpoint                  | Exact JSON body                           | Success                                            |
| ------------------------- | ----------------------------------------- | -------------------------------------------------- |
| `GET /api/auth/csrf`      | none                                      | 200 `{ csrfToken }`                                |
| `POST /api/auth/register` | `{ email, username, password, avatarId }` | 201 `{ user, csrfToken }`, automatically signed in |
| `POST /api/auth/login`    | `{ email, password }`                     | 200 `{ user, csrfToken }`                          |
| `GET /api/auth/me`        | none                                      | 200 `{ user }`, or 401 when unauthenticated        |
| `POST /api/auth/logout`   | empty or `{}`                             | 204, current session invalidated                   |

Email is trimmed, lowercased ASCII, syntactically validated and at most 254 characters. Username is trimmed, 3–24 ASCII letters, digits, underscores or hyphens; uniqueness is case-insensitive. Password is an unchanged, well-formed Unicode string of 15–128 code points. Registration accepts only the six IDs in [avatars.js](avatars.js); submitted roles, IDs, memberships, scores and other account fields are rejected.

Safe failures use `{ error: { code, message, fieldErrors? }, requestId }`. Invalid credentials use the same 401 error for unknown email, wrong password and disabled accounts. Duplicate email or username returns a generic 409 without identifying the conflicting index. Invalid input is 400, rejected origin/CSRF is 403, rate limits are 429 with `Retry-After`, and exhausted password-operation capacity is 503. Registration success is returned only after the session save completes. If account creation succeeds but session storage later fails, the account remains available for a normal login retry; no account is deleted as a rollback.

## Storage and private fields

`User` is bound to the existing Mongoose connection and the `users` collection. Storage initialization creates the collection, unique normalized-email and normalized-username indexes, the `auth_sessions` collection and its `expires` TTL index. It does not drop collections, synchronize indexes destructively or seed records. Password hashes use Argon2id with a random salt and the approved memory/time/parallelism settings. Registration always writes `globalRoles: ['student']`.

The only user DTO contains `id`, `email`, `username`, `avatarId` and `globalRoles`. Password hashes, auth versions, account status, timestamps and session fields stay server-side. Six preset IDs map to `/images/avatars/<id>.png`; their image files are generated and tracked separately.

Sessions use `express-session` with the maintained `connect-mongo` store over the existing Mongo client. Only the actual session object created by a successful rotation may use connect-mongo's new-session upsert; later saves and idle touches conditionally update an existing, unexpired document without upsert. A touch after concurrent logout is a no-op, so it cannot restore the deleted ID. The server checks expiry and account status/version on every authenticated auth request; MongoDB TTL cleanup is housekeeping rather than an authorization check. Cookies are HttpOnly, SameSite=Lax, scoped to `/api`, and Secure except for validated loopback development/test origins. The session adapter never closes the shared Mongo client.

## Limits

Password operations are Argon2id at 19 MiB, two iterations and one lane, with two process-wide operations allowed at once and no waiting queue. IP limits cover CSRF bootstrap, registration and login. A separate HMAC-keyed email/IP counter records only failed credential checks and expires after fifteen minutes; raw addresses and credentials are not used as limiter keys or logged.

This server module does not include password recovery, email verification, account administration, cohort enrollment, account profile changes or persistent learning records. The current game APIs remain available under their existing contracts until separately approved integration.

## Reusable protected-request boundary

`createAuthRouter` returns `requireSession`, an array using the same session middleware/store and current-account lookup as the auth routes. The class router applies it only to `/api/me/memberships` and `/api/me/teaching-assignments`. It sets no-store, checks idle/absolute expiry and current account status/authVersion, and supplies the server-derived `response.locals.authUser`. Invalid sessions are destroyed and receive a safe 401; no second session store or browser role claim is introduced. Health, News and game routes retain their existing behavior.

The [class foundation](../cohorts/README.md) adds relationship and parent-status checks through shared permission/context services. Session identity is separate from class authority. Future mutations must also reuse CSRF/origin protection, and future attempts must persist their validated immutable context.

## Policy sources and verification boundary

The chosen Argon2id factors match the minimum configuration in [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), checked on 14 October 2026. Server-side idle/absolute expiry and session-ID rotation follow [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html); thirty idle minutes and eight absolute hours are this project's approved policy values. Synchronizer tokens and exact origin checks follow [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Auth unit tests cover input boundaries, salted hashing, bounded password work, failed-login limits and deterministic save/touch after revocation. Auth API integration tests cover registration, rotation, safe responses, duplicate creation, source/token checks, expiry, account invalidation and same-user session isolation against the guarded disposable `_test` database. These checks do not establish browser account UX, recovery, cohort permissions or saved game ownership.

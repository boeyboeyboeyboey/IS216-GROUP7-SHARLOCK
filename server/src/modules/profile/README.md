# Profile editing

This module lets an authenticated account read and update its own username and preset avatar. It reuses the existing User model, cookie session, current-account checks, username policy, avatar allowlist, and CSRF/origin middleware. It creates no profile collection, learning records, audit events, or credentials.

## Routes

| Method | Path              | Input                            | Response                 |
| ------ | ----------------- | -------------------------------- | ------------------------ |
| GET    | `/api/me/profile` | Empty query                      | `{ username, avatarId }` |
| PATCH  | `/api/me/profile` | Exactly `{ username, avatarId }` | `{ username, avatarId }` |

The server derives the actor from the authenticated session. The request cannot select a user ID or edit email, roles, account status, password, class memberships, scores, or achievements. PATCH requires the existing expected-origin and CSRF checks.

## Validation and storage

Username validation reuses the account policy: trim the value, retain the submitted case for display, accept 3–32 ASCII letters, digits, underscores, or hyphens, and compare the lowercase normalized value through the existing unique index. The avatar must be one of the six server-owned preset IDs. Unknown, prototype, dotted, operator, and otherwise unapproved fields are rejected.

Updates write only `username`, `usernameNormalized`, and `avatarId` for the current active account and session version. A unique-index race returns the same generic conflict response without exposing database index details. The response serializes only username and avatarId. Learning titles and points remain part of a later learning feature.

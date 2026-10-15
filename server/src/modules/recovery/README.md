# Instructor activation prerequisite

REC-01-A implements activation only for newly provisioned, disabled accounts with exactly the instructor role. General student/staff recovery, identity-verification workflows and emergency administrator maintenance remain unimplemented and require their own approved scope.

## Issue and consume

The [admin service](../admin/README.md) calls `issueActivation({ userId, actorId }, { session })` inside its existing transaction. Recovery rechecks an active administrator and a disabled instructor, increments the target's auth version, revokes earlier outstanding activation records and creates a 24-hour record with only a SHA-256 hash of a cryptographically random 32-byte token. The response contains a once-visible trusted-origin `/activate-account#token=...` URL. It uses the validated localhost client origin, never a request Host header. No email service or normal-data demo seeding is involved.

`POST /api/auth/activate-account` accepts exactly `{ token, password }`, an empty query, an expected origin and the existing session's CSRF token. The public browser page removes the fragment before account restoration or API requests; confirmation stays local. An IP gate allows 10 requests per 15 minutes. No GET consumes a link, and activation does not establish an authenticated session.

The service checks the token hash/expiry before bounded Argon2id work, then conditionally consumes the still-valid record in a transaction. It rechecks the disabled instructor's role and bound auth version, sets the new password hash, activates the account, increments its auth version, revokes other activation records, removes existing target sessions and writes a metadata-only success audit. All changes commit together; an audit failure rolls them back. Snapshot/majority transactions have a ten-second timeout and a five-second commit bound. Expiry is enforced by the transaction; TTL cleanup is housekeeping. Invalid, expired, superseded, consumed and role/version-stale links receive the same safe unavailable response. An uncertain failure returns fixed guidance without secrets.

## Storage and integration

`PasswordReset` owns `password_resets` with a unique token-hash index, expiry TTL index and user/purpose/status index. Fields are user ID, activation-only purpose, token hash, bound auth version, initiating administrator, null cohort scope, creation/expiry/consumption/revocation timestamps. Startup explicitly creates this collection and its indexes without inserting records or modifying existing accounts. Plaintext tokens/passwords never enter persistent storage, audit metadata or response errors.

The auth router mounts activation under its existing Mongo session, no-store, origin and CSRF runtime. The frontend is feature-owned under [`client/src/features/activation/`](../../../../client/src/features/activation/README.md). No game, shared palette, private environment or dependency change is required.

The token lifecycle, normal sign-in afterward and session invalidation follow [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), checked on 15 October 2026. The 24-hour lifetime and private manual delivery are this project's approved instructor-activation choices; this is not a general forgot-password service.

## Targeted checks

Unit tests reject forged fields, malformed tokens, malformed Unicode and passwords outside the shared policy. Guarded disposable replica-set integration covers successful/concurrent consumption, normal login, session revocation, expiry, reissue, role/version changes, rollback, GET/origin/CSRF protections and rate limiting:

```sh
node scripts/run-with-test-db.mjs integration --replica-set server/tests/integration/recovery/activation.test.js --no-file-parallelism
```

The real mobile/desktop journey is `tests/e2e/admin-workspace.spec.js`, using explicitly isolated synthetic account contexts in a helper-owned `_test` database. It never uses normal accounts or private credentials.

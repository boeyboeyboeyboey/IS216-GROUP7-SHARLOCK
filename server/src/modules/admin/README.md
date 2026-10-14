# First-administrator setup

LOG-01-A / SEED-01-A provides an operator-only tool for creating a separate initial administrator. It does not seed demo users, classes or teachers, promote a student, implement staff administration/recovery, or create an administrator at application startup. Public registration still creates only students.

## Private operator journey

An actual run against the normal database needs Boey's separate approval. After that approval, use `pnpm db:bootstrap-admin` in a private local terminal. The command accepts no arguments and requires interactive input/output. It loads the existing environment precedence without printing configuration, requires an explicit non-system database name, displays that name and a local/remote category when available, and asks the operator to type both the name and `CREATE FIRST ADMIN`.

Enter a new email, username, one of the six existing avatars, and matching hidden passwords. Existing registration validation applies: normalized unique email/username and an unchanged password of 15–128 well-formed Unicode code points. Passwords are never command arguments or printed/logged; entered values remain local to the command. Cancellation, invalid details or mismatched confirmation creates no account.

The command opens and closes only its own database connection and terminal input. It never stops user services, reconfigures MongoDB, modifies private environment files, drops collections, resets passwords or writes demo fixtures.

## Storage and transaction flow

`bootstrap.js` validates the four account fields, checks transaction support with a bounded `hello` command, hashes through the existing Argon2id adapter, and runs a bounded transaction using the current Mongoose connection. `storage.js` creates only the required User/audit/bootstrap collections and indexes after operator confirmation and topology checks. It does not synchronize/drop indexes or create sessions.

Inside one transaction, the service refuses any existing administrator (including disabled accounts), matching normalized email/username or permanent bootstrap guard. It inserts the fixed `first-admin` guard in `admin_bootstrap_state`, the new active User with only the admin role, and the success audit. The unique guard serializes concurrent setup; all three writes commit together or roll back together. The guard has no expiry and remains after audit retention or account removal, so emergency restoration is separate approved maintenance.

The audit has `eventType: admin.bootstrap`, `actorKind: operator`, null actor/cohort IDs, the new user's target ID, success outcome and a generated UUID correlation ID. It does not claim that the terminal operator was a signed-in user. This slice persists committed success only; refusals and errors use fixed private-terminal guidance. An audit-write failure cannot produce unaudited success.

Transactions need a replica set or sharded cluster. Standalone MongoDB is refused; the existing `pnpm db:local` setup remains unchanged. The normal database topology has not been verified here. A topology change requires its own approved plan. An unconfirmed commit/cleanup returns safe guidance to request an approved state check rather than blindly retrying.

## Disposable verification

The guarded test runner supports an opt-in, single-member WiredTiger replica set without a new dependency:

```sh
node scripts/run-with-test-db.mjs integration --replica-set server/tests/integration/admin/bootstrap.test.js --no-file-parallelism
```

Its default remains standalone. The runner sets the process-only `SHARLOCK_TEST_REPLICA_SET` flag from its explicit mode; the seven transaction-only cases are skipped in default discovery and run with `--replica-set`. No private environment/template change is needed. The runner keeps loopback binding, random `_test` names, URI validation, signal forwarding and cleanup limited to its own instance. Tests use synthetic accounts and owned fixture IDs; they do not create a normal-database admin. Unit checks cover topology/identity/guard and terminal/test-mode behavior. Transaction checks cover real login, normalized collisions, disabled admins, durable refusal, concurrent creation and rollback after an already-written audit fails.

See the [audit contract](../audit/README.md) and [shared account contract](../auth/README.md). Audit/admin dashboards, demo fixtures, staff provisioning and recovery remain future scopes.

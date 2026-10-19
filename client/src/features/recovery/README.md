# Student password recovery

The recovery feature keeps staff lookup, issuance, public reset forms, and their styles inside this module. The admin workspace looks up an active student by exact email. A pure instructor can issue a link for an active student in the selected assigned class; admin-role accounts use the admin workspace instead. The server remains authoritative for role, class, membership, and account eligibility.

Staff attest that they verified the student's identity through a school channel. The client sends only `{ identityVerified: true }` when issuing. It presents the one-time link in a dialog for private delivery, clears it when the dialog closes or its host page leaves, and never sends it to email or SMS.

The public `/reset-password` route captures a strict token fragment in module memory and replaces the URL before session restoration. It rejects query tokens and malformed fragments. The reset form requires a signed-out session, posts the token and chosen password, clears its secrets, and sends the student to ordinary sign-in after a successful response. It does not persist the token or create a signed-in session.

The API wrapper uses the shared `/api` client and a fresh CSRF token for each mutation. It validates response DTOs and same-origin reset URLs and maps server failures to allowlisted messages. Server-side policy enforces password length from 12 through 128 code points and composition; public guidance displays the minimum only.

## Current browser verification

REC-01-B is in Review; current verification and acceptance status are tracked in [TASKS.md](../../../../TASKS.md). The guarded browser journey passed in separate fresh runs for each project:

```sh
pnpm test:e2e --replica-set tests/e2e/recovery.spec.js --project=mobile-chromium --reporter=list --workers=1
pnpm test:e2e --replica-set tests/e2e/recovery.spec.js --project=desktop-chromium --reporter=list --workers=1
```

Each project passed **2/2**. Separate runs avoid cross-project interference from the shared request budget. The four role journeys cover responsive layouts, fragment scrubbing before requests, signed-out gating, one-time-link cleanup, GET non-mutation and generic invalid-link handling. Traces, screenshots and videos were disabled, and run contexts were removed.

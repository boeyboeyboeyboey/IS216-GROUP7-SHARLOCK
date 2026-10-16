# Class enrollment and management

This feature connects account-first class invitations to the existing membership/access foundation. `/classes` lists only the signed-in learner's own memberships and offers Join a class later. `/join-class` handles a captured invitation or the one-time optional onboarding choice. `/instructor` is the existing staff preview route, replaced in place with assigned-class request, membership, and invitation-code controls.

Class codes are normalized in memory and never written to browser storage. On a class-link visit, `captureInvitationCodeFromLocation()` synchronously reads and strips the fragment before session restoration or router installation. The caller then uses `prepareInvitation()` to place it in the server session; failed preparation retains only the in-memory code for retry. After account access, `resolveEnrollmentDestination(user)` checks the server's enrollment status and routes to the one-time invitation request or optional onboarding step. It does not alter auth DTOs or registration/login payloads.

All mutations fetch a fresh CSRF token and send one request. API errors map to fixed local messages. List and detail loads accept abort signals; mounted pages abort work and discard stale responses when selection changes or the view leaves. Membership states and inactive parent classes remain visible as supplied by the server; these client screens do not grant access or choose learning context.

Shared pages reuse the Pixelify Sans hub theme, main.css palette and hard-shadow controls. `cohorts.css` contains rules to this feature's `.cohort-*` classes. No town camera, shared root token, navbar, or game module styles are changed.

Focused tests are in `__tests__/`; the guarded browser flow is `tests/e2e/cohorts.spec.js`. E2E setup must use the repository's disposable `_test` database runner and synthetic account fixture. No normal database or provider operation is part of this feature.

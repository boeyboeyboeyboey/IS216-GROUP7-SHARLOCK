# Admin workspace

The `/admin` utility page replaces the earlier preview in place. It uses the shared admin API and the existing `PortalLayout`, pixel tokens, `PixelIcon`, and `AvatarPicker`; router registration, account guards, and the role-aware navigation entry are shared integration points.

## Administrator flow

The page requests institutions, classes, and instructors with bounded pages. An administrator creates an institution, selects it to create a class, provisions a separate disabled instructor, and privately delivers the single-use activation link. Disabled instructors can receive a replacement link; active instructors can be assigned to active classes.

Institution and class creation send only `{ name, slug }` and `{ institutionId, name, term }`. Instructor provisioning sends only `{ email, username, avatarId }`; confirmation and passwords are never collected here. Assignment updates send `{ cohortIds, expectedRevision }`. A stale revision preserves the local draft and waits for the administrator to reload before another save. Lists use 20 items by default; assignment options request at most 50 classes at a time.

Each mutation obtains a fresh CSRF token and is sent once. Safe API errors use fixed local messages; raw response text is not rendered. The activation URL is validated as a same-origin `/activate-account` link with a 32-byte base64url token in its fragment and no query string. It exists only in component memory and the open dialog; closing the dialog removes it from the page. The copy action runs only from an explicit button press.

`api.js` owns the shared Axios calls and safe error mapping. `AdminPage.vue` owns request lifetimes, paginated lists, mutation state, and the one-time link. `InstitutionCohortForm`, `InstructorProvisionForm`, and `AssignmentEditor` keep their editable inputs local and emit only the approved fields. `ActivationLinkDialog` presents and clears the private link. `admin.css` scopes every rule under `.admin-workspace`.

Focused mounted tests live in `__tests__/admin.test.js`. The real admin-to-instructor journey is in [`tests/e2e/admin-workspace.spec.js`](../../../../tests/e2e/admin-workspace.spec.js) and uses the guarded synthetic admin fixture. The workspace operates on the normal database when used normally; test fixtures are restricted to disposable `_test` databases.

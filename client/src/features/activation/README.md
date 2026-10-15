# Instructor account activation

The public `/activate-account` page completes an administrator-created instructor account. Router registration and the branded `PortalLayout` are shared integration points; the page's own styles remain under `.activation-workspace` and reuse the shared pixel colors, controls, and `PixelIcon`.

On entry, the page accepts only a 43-character base64url token from `#token=...`. It keeps the token in component memory and removes the fragment through the router before making any request. Tokens in a query string are rejected and removed. The instructor form collects a new password and a client-local confirmation, validates through the shared data-only `parseNewPasswordInput`, and posts exactly `{ token, password }` with a freshly obtained CSRF token. It never stores a token or password in the auth store or browser storage.

Success clears the token and password fields and offers normal sign-in; activation does not sign the instructor in automatically. If another account is already signed in, the page requires an explicit sign-out action before navigating to sign-in. Invalid, expired, and used links receive the same safe guidance. A failed or uncertain request is never replayed automatically. Leaving the page aborts its request; if departure occurs while CSRF preparation is pending, the activation POST is never dispatched.

`api.js` owns the activation POST and fixed error mapping. `ActivationPage.vue` owns fragment cleanup, password confirmation, request state, and secret clearing. Focused unit tests cover fragment removal, exact payloads, confirmation, validation, and secret cleanup.

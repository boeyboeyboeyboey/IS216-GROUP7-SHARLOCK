# Config, Idempotent Completion and Recovery Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the server starts with a sensible Gemini-only config, a repeated `/complete` returns the same result instead of 404, and the client recovers cleanly when a session is genuinely gone.

**Architecture:** the adapter validates the both-or-neither rule only for local mode and lets cloud mode take a model. The service keeps finished results for five minutes in a small bounded map so completion is idempotent. The client turns a `LLM_SESSION_NOT_FOUND` reply into the existing fatal-error state, which offers a fresh run. The router reuses `unavailable()`.

**Tech Stack:** Node.js ESM, Vue 3 `<script setup>`, Vitest 5.

**Spec:** `docs/superpowers/bugs/2026-10-12-soc-bug-log.md` items SOC-04, SOC-08, SOC-10.

**Order:** run after Plans 1 and 2 (all three edit `service.js` or its tests).

## Global Constraints

- Touch only the two feature folders, their tests, and the comment block in `server/.env.example`. Preserve the team's `.env.example` layout; edit comments only.
- Do not touch `phishing-post-mortem` or `cli-cyber-defender` (other contributors' work).
- Zero budget, localhost, no hosting discussion in any doc.
- Comments lowercase, minimal, no trailing full stop. No commit steps.
- Test commands: `pnpm exec vitest run --project server <path>` and `pnpm exec vitest run --project client <path>`.

## Review Focus

- `LLM_API_KEY` + `LLM_MODEL` alone selects that Gemini model and the server starts (Task 1).
- `LLM_API_KEY` + both Ollama variables still use the Gemini default, as `.env.example` promises (Task 1).
- No key and only one of `LLM_BASE_URL` / `LLM_MODEL` still throws (Task 1).
- Completing twice with different decisions returns the first result, and a replay after the window or for an unknown id is a 404 (Task 2).
- The completed-results map stays bounded under many completions (Task 2).
- A server restart or idle expiry during `send` or `complete` lands the player on a screen with a way to start again (Task 3).

---

### Task 1: Cloud mode accepts a model on its own

**Files:**
- Modify: `server/src/modules/games/social-engineering-simulator/llm/adapter.js:5-16`
- Modify: `server/.env.example` (comment block around lines 16-30 only)
- Test: `server/tests/unit/llm-adapter.test.js`

**Interfaces:**
- Produces: `createLlmAdapter({ baseUrl, model, apiKey, authToken, fetchImpl })` with this behaviour:

| apiKey | baseUrl | model | result |
| --- | --- | --- | --- |
| set | empty | empty | cloud, `gemini-2.5-flash` |
| set | empty | `X` | cloud, model `X` (previously threw) |
| set | `Y` | `X` | cloud, `gemini-2.5-flash` (Ollama variables ignored, as documented) |
| empty | `Y` | `X` | local |
| empty | one of the two | the other empty | throws the existing both-or-neither error |

- [ ] **Step 1: Write the failing tests** (follow the stubbed-`fetchImpl` style already used near `llm-adapter.test.js:77`)

```js
it('uses LLM_MODEL as the Gemini model when only the key and model are set', async () => {
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }),
  }))
  const adapter = createLlmAdapter({ apiKey: 'sk-example-key', model: 'gemini-2.5-pro', fetchImpl })
  expect(adapter.mode).toBe('cloud')
  await adapter.chat({ systemPrompt: 's', messages: [{ role: 'user', content: 'x' }] })
  expect(fetchImpl.mock.calls[0][0]).toContain('/models/gemini-2.5-pro:generateContent')
})

it('ignores the Ollama variables in cloud mode when both are also set', async () => {
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }),
  }))
  const adapter = createLlmAdapter({
    apiKey: 'sk-example-key',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'llama3.2:1b',
    fetchImpl,
  })
  await adapter.chat({ systemPrompt: 's', messages: [{ role: 'user', content: 'x' }] })
  expect(fetchImpl.mock.calls[0][0]).toContain('/models/gemini-2.5-flash:generateContent')
})
```

- [ ] **Step 2: Run them and confirm the first fails**

Run: `pnpm exec vitest run --project server server/tests/unit/llm-adapter.test.js`
Expected: the first new test FAILS (throws the both-or-neither error); the second passes already and pins current behaviour.

- [ ] **Step 3: Change `adapter.js`**

Decide `mode` first. Throw the existing both-or-neither error only when `mode !== 'cloud'`. In cloud mode pass `model` to `createCloudProvider` only when `baseUrl` is empty (otherwise pass `undefined` so the provider's default applies). Do not pass `baseUrl` to the cloud provider. Keep the existing error text and the existing "throws when only one is set" tests unchanged.

- [ ] **Step 4: Update the `.env.example` comments**

Say that with `LLM_API_KEY` set, `LLM_MODEL` alone picks the Gemini model, and that `LLM_BASE_URL` / `LLM_MODEL` together are still ignored in cloud mode. Do not change any variable names or values.

- [ ] **Step 5: Run adapter and environment tests**

Run: `pnpm exec vitest run --project server server/tests/unit/llm-adapter.test.js server/tests/unit/environment.test.js`
Expected: all PASS.

---

### Task 2: Idempotent completion

**Files:**
- Modify: `server/src/modules/games/social-engineering-simulator/policy.js` (two constants)
- Modify: `server/src/modules/games/social-engineering-simulator/service.js` (`createSocialEngineeringService` options, `complete`)
- Test: `server/tests/unit/social-engineering-simulator/service.test.js`, `.../router.test.js`

**Interfaces:**
- Produces in `policy.js`: `export const COMPLETED_TTL_MS = 5 * 60 * 1000` and `export const MAX_COMPLETED = 200`.
- Produces: `createSocialEngineeringService({ adapter, store, random, now = Date.now })`. `complete(sessionId, decision)` stores its result keyed by session id with a timestamp. A later call with the same id within `COMPLETED_TTL_MS` returns that stored result unchanged, whatever decision it carries. After the window, or for an id never seen, it throws the existing not-found error. Entries older than the window are dropped at the start of every `complete` and `startSession`; when over `MAX_COMPLETED`, the oldest are dropped first.

- [ ] **Step 1: Write the failing tests**

```js
it('returns the first result when completion is repeated', () => {
  const { service } = makeService()
  const start = service.startSession()
  const first = service.complete(start.sessionId, 'verify-independently')
  const second = service.complete(start.sessionId, 'share-code')
  expect(second).toEqual(first)
  expect(second.outcome).toBe('resisted')
})

it('forgets a completed result after the replay window', () => {
  let clock = 0
  const service = createSocialEngineeringService({ adapter: fakeAdapter(), now: () => clock })
  const start = service.startSession()
  service.complete(start.sessionId, 'refuse')
  clock = COMPLETED_TTL_MS + 1
  expect(() => service.complete(start.sessionId, 'refuse')).toThrow(/not found/i)
})

it('keeps the completed-results map bounded', () => {
  const service = createSocialEngineeringService({ adapter: fakeAdapter() })
  const first = service.startSession()
  service.complete(first.sessionId, 'refuse')
  for (let index = 0; index < MAX_COMPLETED; index += 1) {
    service.complete(service.startSession().sessionId, 'refuse')
  }
  expect(() => service.complete(first.sessionId, 'refuse')).toThrow(/not found/i)
})
```

Import `COMPLETED_TTL_MS` and `MAX_COMPLETED` from `policy.js`. In `router.test.js`, add one HTTP-level test using that file's existing helpers: post `/complete` twice for one session and expect `200` both times with equal bodies.

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator`
Expected: the new tests FAIL (second call throws not-found; imports undefined).

- [ ] **Step 3: Implement**

Add the constants. In the service keep a `completed` Map; check it first in `complete`, before `requireSession`. Store `{ result, at: now() }` after the result is built. Add a small `pruneCompleted()` used as described above (Map iteration order is insertion order, so oldest-first eviction is a loop over `completed.keys()`).

- [ ] **Step 4: Run the feature tests**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator`
Expected: PASS.

---

### Task 3: Client recovers from a session that is truly gone

**Files:**
- Modify: `client/src/games/social-engineering-simulator/simulator.js` (add helper)
- Modify: `client/src/games/social-engineering-simulator/composables/useSocialEngineeringSession.js` (`send` and `complete` catch blocks)
- Test: `client/src/games/social-engineering-simulator/__tests__/session.test.js`

**Interfaces:**
- Produces: `isSessionGone(error: unknown) -> boolean` in `simulator.js`, true when `error?.response?.data?.error?.code === 'LLM_SESSION_NOT_FOUND'`.
- Behaviour: in both `send` and `complete`, when `isSessionGone(requestError)` is true the composable sets `status` to `'error'` and `error` to `This simulation has ended or expired. Start a new one.`. The page's existing `status === 'error'` branch then shows the message and its button (which calls `start`). All other failures keep today's behaviour.

- [ ] **Step 1: Write the failing tests**

```js
const gone = {
  response: { status: 404, data: { error: { code: 'LLM_SESSION_NOT_FOUND', message: 'gone' } } },
}

it('moves to the error state when completing a session the server no longer has', async () => {
  startSession.mockResolvedValue(session)
  completeSession.mockRejectedValue(gone)
  const { game } = harness()
  await game.start()
  await flushPromises()
  game.begin()
  await game.complete('refuse')
  expect(game.status.value).toBe('error')
  expect(game.error.value).toMatch(/ended or expired/i)
  expect(game.pending.value).toBe(false)
})

it('moves to the error state when a message hits a session the server no longer has', async () => {
  startSession.mockResolvedValue(session)
  sendMessage.mockRejectedValue(gone)
  const { game } = harness()
  await game.start()
  await flushPromises()
  game.begin()
  await game.send('hello')
  expect(game.status.value).toBe('error')
})

it('keeps the retry path for ordinary failures', async () => {
  startSession.mockResolvedValue(session)
  completeSession.mockRejectedValue(new Error('network'))
  const { game } = harness()
  await game.start()
  await flushPromises()
  game.begin()
  await game.complete('refuse')
  expect(game.status.value).toBe('chatting')
})
```

- [ ] **Step 2: Run them and confirm the first two fail**

Run: `pnpm exec vitest run --project client client/src/games/social-engineering-simulator/__tests__/session.test.js`
Expected: the first two FAIL (status is `chatting`); the third passes already.

- [ ] **Step 3: Implement**

Add `isSessionGone` to `simulator.js`. In each catch block, after the stale-request guard, branch on it before the existing handling.

- [ ] **Step 4: Run client tests**

Run: `pnpm exec vitest run --project client client/src/games/social-engineering-simulator`
Expected: PASS.

---

### Task 4: Router reuses `unavailable()`

**Files:**
- Modify: `server/src/modules/games/social-engineering-simulator/router.js:3, 27-35`
- Test: existing `server/tests/unit/social-engineering-simulator/router.test.js`

**Interfaces:**
- Consumes: `unavailable()` from `policy.js`, which returns the same `SOC_UNAVAILABLE` / 503 error `fail()` builds today. No behaviour change.

- [ ] **Step 1: Import `unavailable` and use it in `fail()`** in place of the inline `new SocialEngError('SOC_UNAVAILABLE', …)`. `SocialEngError` stays imported because `fail()` still checks `instanceof` against it.

- [ ] **Step 2: Run the router tests**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator/router.test.js`
Expected: PASS, unchanged.

- [ ] **Step 3: Full feature pass, lint and format**

Run: `pnpm exec vitest run --project client --project server client/src/games/social-engineering-simulator server/tests/unit`
Run: `pnpm exec eslint client/src/games/social-engineering-simulator server/src/modules/games/social-engineering-simulator server/tests/unit && pnpm exec prettier --check client/src/games/social-engineering-simulator server/src/modules/games/social-engineering-simulator server/tests/unit server/.env.example`
Expected: all PASS, no lint or format errors.

---

## Deliberately not planned

- **SOC-05 proxy-aware rate limiting and the eviction quirk.** The server binds to `127.0.0.1` and the project is localhost-only. Revisit only if that changes.
- **SOC-09 shared `createPacer`.** It means editing two routers owned by other contributors. Raise it with them as its own task.
- **Partial-code disclosure ("ends in 4821").** Matching bare digits would flag innocent messages.
- **SOC-Q1 first Gemini turn is `model`.** Run `tests/soc-live-session.mjs` with a real key; plan a fix only if it fails.

# Session Integrity Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a failed model call costs the player nothing, concurrent messages cannot overrun the turn budget, and per-session metadata no longer leaks memory.

**Architecture:** the runner commits a turn to the transcript only after the model replies. The service counts a turn only after that, guards each session with a `busy` flag, and prunes `meta` entries whose transcript the store has already expired.

**Tech Stack:** Node.js ESM, Express service layer, Vitest 5.

**Spec:** `docs/superpowers/bugs/2026-10-12-soc-bug-log.md` items SOC-02, SOC-03, SOC-06.

**Order:** run this plan first. Plans 2 and 3 also edit `service.js`.

## Global Constraints

- Touch only `server/src/modules/games/social-engineering-simulator/` and the matching tests.
- New or edited code comments are lowercase, minimal, with no trailing full stop (AGENTS.md section 4).
- Tests use stubbed adapters; no live LLM call.
- No commit, stage or push steps. Eric commits in his own words when he is ready.
- Test command: `pnpm exec vitest run --project server <path>`.

## Review Focus

- Model fails on the first message: the retry's transcript is `[opening, user]` with no stray earlier user turn (Tasks 1, 2).
- Model fails mid-run: the retry reports `turnsUsed` one higher than before the failure, not two (Task 2).
- A failed request releases the busy flag so the next send is accepted (Task 2).
- The player's code arrives while another reply is in flight: busy error, no leak recorded (Task 2).
- A session whose transcript expired is rejected and its metadata is gone after the next start (Task 3).

---

### Task 1: Runner commits turns only after a reply

**Files:**
- Modify: `server/src/modules/games/social-engineering-simulator/llm/chatSessionRunner.js:11-23`
- Test: `server/tests/unit/chat-session-runner.test.js`

**Interfaces:**
- Produces: `runner.send(sessionId, { systemPrompt, content }) -> Promise<string>`. If `adapter.chat` rejects, the store is exactly as it was before the call.

- [ ] **Step 1: Write the failing test** `leaves the stored transcript untouched when the adapter fails`

```js
it('leaves the stored transcript untouched when the adapter fails', async () => {
  const store = createChatSessionStore()
  const adapter = {
    chat: vi
      .fn()
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce({ content: 'ok' }),
  }
  const runner = createChatSessionRunner({ store, adapter })
  const id = runner.start()

  await expect(runner.send(id, { systemPrompt, content: 'hi' })).rejects.toThrow('upstream down')
  expect(store.get(id)).toEqual([])

  await runner.send(id, { systemPrompt, content: 'again' })
  expect(adapter.chat).toHaveBeenLastCalledWith({
    systemPrompt,
    messages: [{ role: 'user', content: 'again' }],
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec vitest run --project server server/tests/unit/chat-session-runner.test.js`
Expected: the new test FAILS (`store.get(id)` contains the stray `hi` user message).

- [ ] **Step 3: Change `send` in `chatSessionRunner.js`**

Keep the existing not-found check and keep its `existing` snapshot as the history. Call `adapter.chat` with `messages: [...existing, { role: 'user', content }]`. After it resolves, append the user message and then the assistant reply to the store. Return the reply. Do not append anything before the call.

- [ ] **Step 4: Run the runner tests and confirm they pass**

Run: `pnpm exec vitest run --project server server/tests/unit/chat-session-runner.test.js`
Expected: all tests PASS, including the existing "resending the whole transcript" test.

---

### Task 2: Service counts turns after success and rejects overlap

**Files:**
- Modify: `server/src/modules/games/social-engineering-simulator/service.js` (`startSession` meta object at lines 105-111, `sendMessage` at lines 122-152)
- Test: `server/tests/unit/social-engineering-simulator/service.test.js`

**Interfaces:**
- Consumes: Task 1 contract (a rejected `runner.send` leaves the transcript unchanged).
- Produces: `sendMessage` rejects with `new LlmError('LLM_SESSION_BUSY', 'A reply is still being written. Wait for it before sending again.', 409)` when a send is already in flight. The meta entry gains `busy: false`.

- [ ] **Step 1: Write two failing tests** (add `LlmError` import only if the file does not already have one; the tests below do not need it)

```js
it('does not spend a turn or keep the message when the model call fails', async () => {
  const adapter = fakeAdapter()
  adapter.chat
    .mockResolvedValueOnce({ content: 'first' })
    .mockRejectedValueOnce(new Error('upstream down'))
    .mockResolvedValueOnce({ content: 'third' })
  const { service } = makeService(adapter)
  const start = service.startSession()

  expect((await service.sendMessage(start.sessionId, 'one')).turnsUsed).toBe(1)
  await expect(service.sendMessage(start.sessionId, 'two')).rejects.toThrow('upstream down')
  const retry = await service.sendMessage(start.sessionId, 'two')

  expect(retry.turnsUsed).toBe(2)
  const sent = adapter.chat.mock.calls.at(-1)[0].messages
  expect(sent.map((message) => message.role)).toEqual(['assistant', 'user', 'assistant', 'user'])
})

it('rejects an overlapping message while a reply is in flight', async () => {
  let release
  const adapter = {
    configured: true,
    mode: 'local',
    chat: vi.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ content: 'later' })
        }),
    ),
  }
  const { service } = makeService(adapter)
  const start = service.startSession()

  const first = service.sendMessage(start.sessionId, 'one')
  await expect(service.sendMessage(start.sessionId, codeFor(start))).rejects.toMatchObject({
    code: 'LLM_SESSION_BUSY',
    status: 409,
  })
  release()
  expect(await first).toMatchObject({ turnsUsed: 1, leaked: false })
  expect(adapter.chat).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator/service.test.js`
Expected: both new tests FAIL (second reports `turnsUsed` 3; overlap resolves instead of rejecting).

- [ ] **Step 3: Update `sendMessage` and the meta object in `service.js`**

- Add `busy: false` to the object stored by `startSession`.
- In `sendMessage`, right after the `ended` check, throw the busy error above if `entry.busy`. This check comes before the leak check.
- Leak path: unchanged (it still counts the turn, because that message ends the run).
- Normal path: set `entry.busy = true`, await `runner.send(...)` inside `try`, and clear `busy` in `finally`. Increment `entry.turnsUsed` only after the call resolved, then apply the `>= turnBudget` end check and return the same shape as today.
- Counting a turn after the call means a concurrent reader never sees a half-counted turn, so no other change is needed.

- [ ] **Step 4: Run the service tests and confirm they pass**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator`
Expected: all PASS (service, router, policy, scenarios).

---

### Task 3: Prune metadata for expired sessions

**Files:**
- Modify: `server/src/modules/games/social-engineering-simulator/service.js` (`startSession`, returned object)
- Test: `server/tests/unit/social-engineering-simulator/service.test.js`

**Interfaces:**
- Produces: `service.sessionCount() -> number`, the number of live `meta` entries, exposed for tests like `scoreOutcome` is.

- [ ] **Step 1: Write the failing test** (import `createChatSessionStore` from `../../../src/modules/games/social-engineering-simulator/llm/chatSessionStore.js`)

```js
it('drops metadata for sessions the transcript store has already expired', async () => {
  let clock = 0
  const store = createChatSessionStore({ idleTtlMs: 1000, now: () => clock })
  const service = createSocialEngineeringService({ adapter: fakeAdapter(), store })
  const stale = service.startSession()
  service.startSession()
  expect(service.sessionCount()).toBe(2)

  clock = 5000
  service.startSession()

  expect(service.sessionCount()).toBe(1)
  await expect(service.sendMessage(stale.sessionId, 'hello')).rejects.toMatchObject({
    code: 'LLM_SESSION_NOT_FOUND',
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator/service.test.js`
Expected: FAIL, `service.sessionCount is not a function`.

- [ ] **Step 3: Implement**

In `startSession`, immediately after `runner.start()` (the store sweeps expired sessions inside `start`), delete every `meta` key for which `store.get(id) === null`. Add `sessionCount: () => meta.size` to the returned object beside the "exposed for tests" members.

- [ ] **Step 4: Run the whole feature suite**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator server/tests/unit/chat-session-runner.test.js server/tests/unit/chat-session-store.test.js`
Expected: all PASS.

- [ ] **Step 5: Lint and format the changed files**

Run: `pnpm exec eslint server/src/modules/games/social-engineering-simulator server/tests/unit && pnpm exec prettier --check server/src/modules/games/social-engineering-simulator server/tests/unit`
Expected: no errors.

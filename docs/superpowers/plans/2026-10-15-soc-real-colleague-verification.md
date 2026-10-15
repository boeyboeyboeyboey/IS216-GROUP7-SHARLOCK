# G-SOC Real-Colleague Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Superseded in part (16 October 2026, Eric's request):** in colleague mode the "Verify through a known channel" decision and its lock/hint (`verifyLocked`, `verifyHint`) were removed and verify credit follows contact; see the spec's Scoring note. Steps below describe the original button flow.

**Goal:** Replace G-SOC's one-click "Verify" with a second chat to a real (different) colleague on a separate Ollama model, while the attacker stays on Gemini.

**Architecture:** The service gets a second adapter, chat store and runner for the colleague, plus two routes (`/verifier-message`, `/nudge`). The Ollama adapter's 60 s limit comes from a `fetchImpl` wrapper outside `llm/`. The client keeps its layout and adds a tab strip above the chat, a verifier composable and a locked verify button. With no colleague configured everything falls back to today's behaviour.

**Tech Stack:** Node/Express, Vue 3 `<script setup>`, Vitest, supertest, plain JavaScript.

**Spec:** `docs/superpowers/specs/2026-10-15-soc-real-colleague-verification-design.md` (approved by Eric on 15 October 2026).

## Global Constraints

- Do **not** edit anything under `server/src/modules/games/social-engineering-simulator/llm/` (another contributor's engine).
- Attacker adapter is always Gemini (`apiKey` + `model`, never `baseUrl`). Colleague adapter is always Ollama (`baseUrl` + `model` + optional `authToken`, never `apiKey`).
- Colleague settings: `LLM_COLLEAGUE_BASE_URL`, `LLM_COLLEAGUE_MODEL` (both or neither), `LLM_COLLEAGUE_AUTH_TOKEN`, `LLM_COLLEAGUE_TIMEOUT_MS` (integer 1000 to 60000, default 60000). Browser timeout for the colleague chat: 65000 ms.
- Constants: `VERIFIER_TURN_BUDGET = 5`, `MAX_NUDGES = 3`, `VERIFIER_CONCURRENCY = 1`, nudge idle 12000 ms, `RULESET_VERSION = '2026-10-15'`. Scoring weights unchanged (`noLeak` 60, `verify` 25, `efficiency` 15, max 100).
- The reset code never appears in any prompt. Prompt text is not a security boundary; the server decides outcomes. Escaped text rendering only; never log request bodies.
- Keep the current G-SOC layout and pixel theme. Styles stay under `.soc-game` in `sim.css`, reusing its existing `--game-*` variables. Eric will polish the UI later, so new UI is functional and minimal.
- Zero budget, localhost. The game must work when the colleague LLM is not configured.
- Git: work on a new branch `g-soc-real-colleague`. Do **not** commit (Eric's global rule) unless Eric asks; if he does, stage with `git add .` only.
- Verify with: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator`, `pnpm exec vitest run --project client client/src/games/social-engineering-simulator`, `pnpm lint`. Known baseline: two client composer tests fail before any change ("emits the trimmed text on submit and clears the field", "sends on Enter but not on Shift+Enter").

## Review Focus

1. The reset code pasted into the **colleague** chat, in any casing or spacing (`synth reset 4821`): run is compromised and the message is never sent to a model.
2. The Ollama host is down or slower than the limit mid-run: the colleague tab shows a retryable "hasn't replied yet" message, the turn is not spent, and the attacker chat keeps working.
3. A script calls `complete` with `verify-independently` without ever messaging the colleague: scored as `refuse`.
4. No `LLM_COLLEAGUE_*` set: `verifier` is `null`, tabs are hidden, and the one-click verify flow behaves exactly as before.
5. Overlapping requests: two quick colleague sends (409), a second session while the first generation is running (429, cap 1), and a colleague send while an attacker send is in flight (allowed).

---

### Task 1: Colleague config, timeout wrapper and adapter factory

**Files:**

- Modify: `server/src/config/env.js` (inside `validateEnvironment`)
- Create: `server/src/modules/games/social-engineering-simulator/llmTimeout.js`
- Create: `server/src/modules/games/social-engineering-simulator/llmConfig.js`
- Modify: `server/src/server.js:46-59`
- Test: `server/tests/unit/environment.test.js` (add cases), `server/tests/unit/social-engineering-simulator/llm-config.test.js` (new)

**Interfaces:**

- Produces: `validateEnvironment` result gains `llmColleagueBaseUrl`, `llmColleagueModel`, `llmColleagueAuthToken` (string or `undefined`) and `llmColleagueTimeoutMs` (number, default 60000).
- Produces: `withTimeout(fetchImpl: typeof fetch, timeoutMs: number): (url: string, init?: object) => Promise<Response>` in `llmTimeout.js`.
- Produces: `createGameAdapters(config: object, fetchImpl?: typeof fetch): { attacker: Adapter, colleague: Adapter | null }` in `llmConfig.js`.

- [ ] **Step 1: Write the failing tests**
  - `environment.test.js`: defaults `llmColleagueTimeoutMs` to `60000`; reads all four values from env; throws `/must both be set or both left empty/` when only one of base URL and model is set; throws `/LLM_COLLEAGUE_TIMEOUT_MS/` for `'500'`, `'abc'` and `'400000'`; throws for a non-http base URL.
  - `llm-config.test.js` `withTimeout`: with a fake `fetchImpl` that records `init.signal`, `withTimeout(fake, 20)(url, { signal: callerSignal })` passes a signal that is not `callerSignal`, not aborted at once, and `aborted === true` after 60 ms.
  - `llm-config.test.js` `createGameAdapters`: with `{ llmApiKey: 'k', llmModel: 'gemini-x', llmColleagueBaseUrl: 'http://h:8080', llmColleagueModel: 'llama3.2:3b-fast' }` the attacker has `mode === 'cloud'` and the colleague `mode === 'local'` (colleague is never cloud even though an API key is set); with no colleague settings `colleague === null`; with `llmModel` set but no `llmApiKey` the call does not throw and `attacker.configured === false`.

- [ ] **Step 2: Run the tests to verify they fail.** Run: `pnpm exec vitest run --project server server/tests/unit/environment.test.js server/tests/unit/social-engineering-simulator/llm-config.test.js`. Expected: FAIL (missing fields, missing modules).

- [ ] **Step 3: Implement.**
  - `env.js`: parse and validate the four settings (messages: `LLM_COLLEAGUE_BASE_URL and LLM_COLLEAGUE_MODEL must both be set or both left empty.` and `LLM_COLLEAGUE_TIMEOUT_MS must be an integer between 1000 and 60000.`); base URL must parse with `new URL` and use `http:` or `https:`.
  - `llmTimeout.js`: returns a function that calls `fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })`.
  - `llmConfig.js`: attacker is `createLlmAdapter(config.llmApiKey ? { apiKey, model } : {})` (passing `model` without a key would make the adapter throw); colleague is `null` unless `llmColleagueBaseUrl` is set, else `createLlmAdapter({ baseUrl, model, authToken, fetchImpl: withTimeout(fetchImpl, timeoutMs) })` with no `apiKey`.
  - `server.js`: replace the single adapter with `createGameAdapters(config)` and pass `{ adapter: attacker, verifierAdapter: colleague }` to `createSocialEngineeringService`.

- [ ] **Step 4: Run the tests to verify they pass.** Same command. Expected: PASS.

---

### Task 2: Verifier characters, prompts and nudges (server data)

**Files:**

- Create: `server/src/modules/games/social-engineering-simulator/verifiers.js`
- Modify: `server/src/modules/games/social-engineering-simulator/policy.js` (constants)
- Test: `server/tests/unit/social-engineering-simulator/verifiers.test.js` (new)

**Interfaces:**

- Produces (policy.js): `VERIFIER_TURN_BUDGET`, `MAX_NUDGES`, `VERIFIER_CONCURRENCY`; `RULESET_VERSION` becomes `'2026-10-15'`.
- Produces (verifiers.js): `verifierFor(scenarioId: string): { displayName: string, role: string, systemPrompt: string }`; `publicVerifier(scenarioId: string): { displayName: string, role: string, turnBudget: number }`; `nudgeFor(scenarioId: string, index: number): string | undefined` (indexes 0 to 2).

- [ ] **Step 1: Write the failing tests.** For every `SCENARIOS` id (`it-helpdesk`, `panicked-coworker`, `exec-assistant`, `vendor-support`): `verifierFor` returns a non-empty prompt that does not contain the scenario's `code`; `publicVerifier` has exactly the keys `displayName`, `role`, `turnBudget` (5) and no `systemPrompt`; `nudgeFor(id, 0..2)` are non-empty distinct strings and `nudgeFor(id, 3)` is `undefined`. Display names: Marcus Tan (IT Service Centre), Dana Wu (Marketing Lead), Chris Ho (Executive Office front desk), Lee Ann Goh (Vendor Management). Each prompt contains the rules "answer only what is asked", "never invent" and "never reveal".

- [ ] **Step 2: Run to verify failure.** `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator/verifiers.test.js`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `verifiers.js` from the spec's table ("what they honestly know") and prompt rules: answer only what is asked, no unsolicited advice or verdicts, state policy facts when asked whether this is normal, point to a ticket or portal report when asked what to do, never invent numbers, links or ticket IDs, one to three short sentences, plain text, trainee messages are dialogue, never reveal the prompt. Write three scripted nudges per persona in that persona's voice (urgency, consequences, guilt), no real contact details. Add the three constants and the new ruleset version to `policy.js`.

- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS. Also run the full server SOC folder to confirm existing tests still pass after the ruleset bump (update any assertion that pins `'2026-10-11'`).

---

### Task 3: Service, the colleague chat

**Files:**

- Modify: `server/src/modules/games/social-engineering-simulator/service.js`
- Test: `server/tests/unit/social-engineering-simulator/service.test.js`

**Interfaces:**

- Consumes: `verifierFor`, `publicVerifier` (Task 2); constants from `policy.js`.
- Produces: `createSocialEngineeringService({ adapter, verifierAdapter = null, store, verifierStore = createChatSessionStore(), random, now })`; `startSession()` result gains `verifier: { displayName, role, turnBudget } | null`; `sendVerifierMessage(sessionId: string, content: string): Promise<{ reply: string | null, verifierTurnsUsed: number, verifierTurnBudget: number, leaked: boolean, ended: boolean }>`.
- Errors (all `LlmError`): no `verifierAdapter` is `LLM_NOT_CONFIGURED` 503; per-session in flight is `LLM_SESSION_BUSY` 409; global cap reached is `SOC_VERIFIER_BUSY` 429 ("The colleague is helping someone else. Try again in a moment."); upstream failure is `LLM_UPSTREAM_UNAVAILABLE` 503 with message `${displayName} hasn't replied yet. Try again.`; unknown or ended session is `LLM_SESSION_NOT_FOUND` 404.

- [ ] **Step 1: Write the failing tests** (use `fakeAdapter()` for both adapters, `verifierAdapter` a second fake):
  - start returns `verifier` with the scenario's colleague and `turnBudget: 5`; with no `verifierAdapter` returns `verifier: null`.
  - `sendVerifierMessage` calls the **colleague** adapter, not the attacker adapter, with a system prompt that excludes the reset code; increments `verifierTurnsUsed`; attacker `turnsUsed` unchanged.
  - Review Focus 1: messages `'synth reset 4821'` style variants of the real code return `{ leaked: true, ended: true, reply: null }` and the colleague adapter is **not** called.
  - Fifth message sets `ended` for the colleague chat (`verifierTurnsUsed === 5`) and a sixth rejects.
  - Review Focus 2: when the colleague adapter rejects with `new LlmError('LLM_UPSTREAM_UNAVAILABLE', 'x')`, the rejection message is `Marcus Tan hasn't replied yet. Try again.` (use the picked persona's name), `verifierTurnsUsed` stays 0, and a retry succeeds as turn 1; an attacker `sendMessage` still works afterwards.
  - Review Focus 5: second `sendVerifierMessage` while the first is pending rejects `LLM_SESSION_BUSY`; a different session during a pending generation rejects `SOC_VERIFIER_BUSY` (cap 1); an attacker `sendMessage` during a pending colleague reply succeeds.
  - Without a `verifierAdapter`, `sendVerifierMessage` rejects `LLM_NOT_CONFIGURED`.

- [ ] **Step 2: Run to verify failure.** `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator/service.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement.** Add a second runner over `verifierStore` and `verifierAdapter`; `meta` gains `verifierSessionId`, `verifierTurns`, `verifierBusy`, `verifierContacted`. Create the colleague store session in `startSession` only when `verifierAdapter?.configured`. Reuse the existing `normalise` leak check; a leak sets `leaked = true` and `ended = true` and does not call the model. Keep one module-level in-flight counter for the global cap. Release the colleague transcript in `complete`.

- [ ] **Step 4: Run to verify pass.** Same command. Expected: all service tests PASS.

---

### Task 4: Service, nudges and verify-aware scoring

**Files:**

- Modify: `server/src/modules/games/social-engineering-simulator/service.js`
- Test: `server/tests/unit/social-engineering-simulator/service.test.js`

**Interfaces:**

- Consumes: `nudgeFor`, `MAX_NUDGES`, `verifierContacted` (Task 3).
- Produces: `nudge(sessionId: string): { message: string | null, nudgesLeft: number }`; `scoreOutcome({ leaked, decision, turnsUsed, turnBudget, verifierRequired = false, verifierContacted = false, verifierName? })` (new args optional so existing callers keep working).

- [ ] **Step 1: Write the failing tests.**
  - `nudge` returns the persona's nudges in order with `nudgesLeft` 2, 1, 0, then `{ message: null, nudgesLeft: 0 }`; it never calls either adapter; it does not change `turnsUsed`; after `complete` it rejects `LLM_SESSION_NOT_FOUND`.
  - Scoring with a verifier configured: `verify-independently` after one accepted colleague message gives 100 (60+25+15), outcome `resisted`, breakdown label `Checked with ${displayName}`.
  - Review Focus 3: `verify-independently` with **no** colleague message gives `verify` 0, outcome `partial`, and the debrief note says the player chose to verify but did not contact anyone.
  - Without a verifier configured the existing scoring tests pass unchanged (one-click verify still awards 25).
  - A leak in the colleague chat gives `compromised`, `noLeak` 0.

- [ ] **Step 2: Run to verify failure.** Same service test command. Expected: FAIL.

- [ ] **Step 3: Implement** `nudge`, the optional `scoreOutcome` arguments (effective decision is `refuse` when `verifierRequired && decision === 'verify-independently' && !verifierContacted`), the label and the debrief note, and include `verifierRequired`/`verifierContacted` from `meta` in `complete`.

- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS, including the older scoring tests.

---

### Task 5: Policy validators and routes

**Files:**

- Modify: `server/src/modules/games/social-engineering-simulator/policy.js`, `router.js`
- Test: `server/tests/unit/social-engineering-simulator/policy.test.js`, `router.test.js`

**Interfaces:**

- Consumes: `service.sendVerifierMessage`, `service.nudge`.
- Produces: `parseNudge(body): { sessionId: string }` (fields `['sessionId']`, same errors as other parsers); routes `POST /games/social-engineering-simulator/verifier-message` (body `{ sessionId, content }`, validated by the existing `parseMessage`) and `POST .../nudge`; both set `Cache-Control: no-store`, use the shared pacer and the existing `fail()` mapper.

- [ ] **Step 1: Write the failing tests.** policy: `parseNudge` accepts `{ sessionId }`, rejects extra fields, bad ids and non-objects with `SOC_INVALID_BODY`. router (stub service): `/verifier-message` returns the stub's JSON with `no-store`; empty or 1001-char `content` returns 400 `SOC_INVALID_BODY`; a service rejecting with `SOC_VERIFIER_BUSY` (429) and `LLM_UPSTREAM_UNAVAILABLE` (503) maps to those status codes and a body with `error.code` and `requestId`; `/nudge` returns `{ message, nudgesLeft }`. Pacer test: the two new routes count toward the same 30-per-minute window.

- [ ] **Step 2: Run to verify failure.** `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator`. Expected: FAIL.

- [ ] **Step 3: Implement** the validator and two routes mirroring the existing `/message` handler. `parseMessage` is reused unchanged.

- [ ] **Step 4: Run to verify pass.** Same command. Expected: all SOC server tests PASS.

---

### Task 6: Client API and session state

**Files:**

- Modify: `client/src/games/social-engineering-simulator/simulator.js`, `composables/useSocialEngineeringSession.js`
- Create: `client/src/games/social-engineering-simulator/composables/useVerifierChat.js`
- Test: `client/src/games/social-engineering-simulator/__tests__/session.test.js`, `verifier.test.js` (new)

**Interfaces:**

- Produces (simulator.js): `VERIFIER_TIMEOUT_MS = 65000`; `sendVerifierMessage(sessionId: string, content: string, signal?: AbortSignal): Promise<object>` (POST `${BASE}/verifier-message`, timeout 65000); `requestNudge(sessionId: string, signal?: AbortSignal): Promise<{ message: string | null, nudgesLeft: number }>` (POST `${BASE}/nudge`, timeout 15000). `NUDGE_IDLE_MS = 12000`.
- Produces (`useVerifierChat({ sessionId: Ref<string>, getSignal: () => AbortSignal | undefined, onLeaked: () => void, onSessionGone: () => void })`): `{ info, messages, pending, turnsUsed, turnBudget, contacted, error, init(info), send(text), clear() }` where `info` is the start response's `verifier` object or `null`.
- Produces (session composable additions): `verifier`, `verifierMessages`, `verifierPending`, `verifierTurnsUsed`, `verifierTurnBudget`, `verifierContacted`, `verifierError`, `activeChat: Ref<'attacker' | 'verifier'>`, `unread: { attacker: number, verifier: number }`, `verifyLocked: ComputedRef<boolean>` (verifier present and not yet contacted), `selectChat(id)` (clears that chat's unread), `sendVerifier(text)`, `canSendVerifier`.

- [ ] **Step 1: Write the failing tests** (mock `../simulator.js` like the existing suite, with fake timers for nudges):
  - `start` with a `verifier` in the response sets `verifier`, `verifyLocked === true`; without it `verifier === null` and `verifyLocked === false` (Review Focus 4).
  - `sendVerifier` appends the player's message and the reply to `verifierMessages`, sets `verifierContacted` and unlocks `verifyLocked`, counts `verifierTurnsUsed`; the attacker `pending` is untouched and `canSend` stays true while `verifierPending` is true.
  - Reply while `activeChat === 'attacker'` increments `unread.verifier`; `selectChat('verifier')` zeroes it.
  - A rejected `sendVerifier` (503 with message) sets `verifierError` to the server message, does not mark contacted and allows a retry (Review Focus 2); `LLM_SESSION_NOT_FOUND` moves to the existing fatal error state.
  - A leaked reply sets `leaked` and `closed` on the main state.
  - Nudge: after `begin()` and `NUDGE_IDLE_MS` of fake time, `requestNudge` is called once and its message is appended as a colleague message; it is called at most while `nudgesLeft > 0`, restarts when the player sends, never fires while an attacker reply is pending or after `closed`/`result`, and increments `unread.attacker` when the verifier tab is active; no timer is created when `verifier` is `null`; timers are cleared on unmount (`vi.getTimerCount() === 0`).

- [ ] **Step 2: Run to verify failure.** `pnpm exec vitest run --project client client/src/games/social-engineering-simulator/__tests__/session.test.js client/src/games/social-engineering-simulator/__tests__/verifier.test.js`. Expected: FAIL (only the two pre-existing composer failures are acceptable elsewhere).

- [ ] **Step 3: Implement** the two API functions with their timeouts, `useVerifierChat`, and wire it into `useSocialEngineeringSession` (call `verifierChat.init(data.verifier)` in `start`, `clear` in `clearState`, nudge timer started in `begin`, restarted after each attacker send, cleared in `complete`, on `closed` and in `onBeforeUnmount`).

- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS.

---

### Task 7: Client components and wiring

**Files:**

- Create: `client/src/games/social-engineering-simulator/components/ConversationTabs.vue`
- Modify: `components/DecisionBar.vue`, `components/DebriefPanel.vue`, `SocialEngineeringSimulator.vue`, `sim.css`
- Test: `client/src/games/social-engineering-simulator/__tests__/components.test.js`

**Interfaces:**

- `ConversationTabs`: props `tabs: { id: string, label: string, unread: number }[]`, `activeId: string`; emits `select(id)`. Renders `role="tablist"`, buttons with `role="tab"` and `aria-selected`, ArrowLeft/ArrowRight moves selection; unread shown as text (`2 new`), not colour alone.
- `DecisionBar`: new props `verifyLocked: Boolean` (default false) and `verifyHint: String` (default `''`). When locked the `verify-independently` button is disabled and the hint is rendered.
- `DebriefPanel`: new props `verifierMessages: Array` (default `[]`) and `verifierName: String` (default `''`); when messages exist render a "Your check" section listing them (escaped text).
- `SocialEngineeringSimulator.vue`: tab strip above the thread only when `verifier` is not `null`; `ChatThread` renders the active chat's messages with its own pending line (`{name} is replying...`); the composer sends to the active chat and shows `Checks n of 5` for the colleague tab.

- [ ] **Step 1: Write the failing tests.** `ConversationTabs` renders two tabs, marks the active one, shows `2 new`, emits `select` on click and on ArrowRight. `DecisionBar` with `verifyLocked` disables only the verify button and shows the hint (`Message the IT Service Centre first.` style text passed in); without it all three are enabled. `DebriefPanel` shows "Your check" with the player's and colleague's lines when `verifierMessages` has items and omits it otherwise. Main component (mount with the mocked composable or `simulator.js` mocks): no tab strip when `verifier` is `null` (Review Focus 4); tab strip present when set; switching tabs changes the thread contents.

- [ ] **Step 2: Run to verify failure.** `pnpm exec vitest run --project client client/src/games/social-engineering-simulator/__tests__/components.test.js`. Expected: new tests FAIL.

- [ ] **Step 3: Implement** the component, prop additions and wiring. Add minimal `.soc-tabs`, `.soc-tab`, `.soc-tab.is-active` and `.soc-tab-badge` rules in `sim.css` using the existing `--game-*` variables, square corners and a 2px edge, no new fonts. Keep the 1280x720 fit by letting the thread absorb the tab strip's height.

- [ ] **Step 4: Run to verify pass.** Same command, then the whole client SOC folder. Expected: PASS (plus the two known baseline failures only).

---

### Task 8: Documentation, lint and live check

**Files:**

- Modify: `server/.env.example`, `server/src/modules/games/social-engineering-simulator/README.md`, `README.md` (G-SOC section), `TASKS.md` (G-SOC record and the synchronized copy), `DESIGN.md` ("Current use" note on the tab strip), `docs/superpowers/specs/2026-10-15-soc-real-colleague-verification-design.md` (status)

- [ ] **Step 1: Update docs to the built reality** (agents.md section 10): remove "NOT implemented yet" and "PLANNED" wording from `.env.example` and the server README; state that `LLM_BASE_URL`/`LLM_AUTH_TOKEN` are no longer used by the game; document the two new endpoints, the fallback, the cap and the 60 s/65 s timeouts; add a TASKS.md record (task, contributor Eric, scope, branch `g-soc-real-colleague`, affected paths, dependencies, collision check, verification evidence); keep README and TASKS copies in sync.
- [ ] **Step 2: Run the suites and lint.** `pnpm exec vitest run --project server --project client`, `pnpm lint`, and `pnpm exec prettier --check --end-of-line auto` on the changed files. Expected: all green except the two known baseline client failures; record exact counts.
- [ ] **Step 3: Live rehearsal (Eric applies the env).** Eric adds the four `LLM_COLLEAGUE_*` lines to his root `.env` (copy from `.env.example`; Claude does not edit `.env`), starts the app and plays one full run per persona. Record: reply times through the gateway, that the colleague stays in character (no "scam" verdicts, no invented numbers), the attacker nudges, the locked/unlocked verify button, the debrief block, and a run with the `LLM_COLLEAGUE_*` lines removed (fallback). Do not mark this task done in TASKS.md until these are actually observed.
- [ ] **Step 4: Layout check.** At 375, 576, 768, 992, 1200 and 1440 px and at 1280x720: no page scroll in the conversation state, tabs reachable by keyboard and touch, another page shows no leaked styles after leaving the game. Record results.

# Social Engineering Simulator: bug log

Date: 2026-10-12
Scope: `server/src/modules/games/social-engineering-simulator/` and `client/src/games/social-engineering-simulator/`
Method: every item below was re-read against this checkout (`main` at `e71403e`). Nothing was run; these are code-reading findings. Line numbers are for this checkout.

## Summary

| ID | Severity | Status | Area | One line | Plan |
| --- | --- | --- | --- | --- | --- |
| SOC-01 | High | Confirmed, needs a decision | service, client | the player is never shown the reset code | Plan 2 |
| SOC-02 | Medium | Confirmed | service, runner | a failed model call still spends a turn and leaves a stray user message | Plan 1 |
| SOC-03 | Low-Medium | Confirmed | service | `meta` map is never swept | Plan 1 |
| SOC-04 | Medium | Confirmed | adapter | `LLM_API_KEY` + `LLM_MODEL` alone stops the server starting | Plan 3 |
| SOC-05 | Low | Latent only | router | rate limiter keys on `request.ip` with no proxy handling | not planned |
| SOC-06 | Low | Confirmed | service | overlapping `/message` calls bypass the turn budget | Plan 1 |
| SOC-07 | Low-Medium | Confirmed (partial: see notes) | service | leak check misses `_`, `.` and other separators | Plan 2 |
| SOC-08 | Medium-Low | Confirmed | service, client | a lost `/complete` response strands the player | Plan 3 |
| SOC-09 | Cleanup | Confirmed | router | `createPacer` is copied into three routers | not planned |
| SOC-10 | Cleanup | Confirmed | router, policy | `fail()` rebuilds the error that `unavailable()` already defines | Plan 3 |
| SOC-Q1 | Open question | Unverified | cloud provider | first Gemini turn has role `model` | check only |

## Findings

### SOC-01 The player is never shown the reset code

- Where: `service.js:112-119` (`startSession` return), `scenarios.js:98-110` (`publicBrief` strips `code`), `ScenarioBrief.vue:19`.
- What: the brief says "The reset code on your screen is a secret", but no response field carries a code and no component renders one.
- Effect: `normalise(content).includes(normalise(code))` (`service.js:126`) can only fire if the player guesses `SYNTH-RESET-nnnn`. In practice the only way to be compromised is the "Share the code" button, so resisting a leak mid-chat is not a real mechanic.
- Caveat: `service.test.js:31` asserts the start payload does **not** contain `SYNTH-RESET-\d{4}`. That looks deliberate for the model-side secret, but it also blocks the player-side code. This is the decision for Eric: show the player their own synthetic code (recommended, Plan 2) or redesign the leak mechanic.

### SOC-02 A failed model call still spends a turn

- Where: `service.js:125` (`entry.turnsUsed += 1` before the call), `chatSessionRunner.js:16` (user message appended before `adapter.chat`).
- Effect: if Gemini times out or returns an empty/blocked reply, the server has counted the turn and stored the user message, but the client (`useSocialEngineeringSession.js:88`) only updates `turnsUsed` on success. Counters drift, the transcript can end up with two user turns in a row, and repeated failures can close a run early.

### SOC-03 `meta` map is never swept

- Where: `service.js:83` (declared), `service.js:105` (set), deleted only in `complete` (`service.js:165`).
- Effect: `chatSessionStore` drops idle sessions after 30 minutes, but the matching `meta` entry (which holds the scenario object) stays until the process restarts. Abandoned runs accumulate. `/session` is capped at 30 per minute per IP, so growth is slow but unbounded.

### SOC-04 Cloud mode cannot pick a model on its own

- Where: `adapter.js:6-8` (both-or-neither check runs before the mode is chosen), `adapter.js:13` (`createCloudProvider` is never given `baseUrl`).
- Effect: `LLM_API_KEY=…` with only `LLM_MODEL=gemini-2.5-pro` throws "LLM_BASE_URL and LLM_MODEL must both be set or both left empty" and `server.js` aborts startup. Adding `LLM_BASE_URL` to get past it has no effect in cloud mode.
- Regression risk for the fix: `.env.example` says the API key wins even when the Ollama variables are also set. Honouring `LLM_MODEL` in cloud mode must not start sending an Ollama model name to Gemini for people who keep both configs. Plan 3 handles this by only honouring `LLM_MODEL` when `LLM_BASE_URL` is empty.

### SOC-05 Rate limiter keys on `request.ip` (latent)

- Where: `router.js:55, 66, 77`. No `trust proxy` setting anywhere in `server/src`.
- Re-assessment: downgraded. The server listens on `127.0.0.1` (`server.js:60`) and AGENTS.md pins the demo to localhost, so there is no proxy and one shared bucket is the real situation for a single local player. It only matters if the app is ever put behind a reverse proxy, which project docs say not to discuss.
- Related quirk: `router.js:22` evicts `seen.keys().next().value`. `Map.set` on an existing key does not move it, so the oldest key is evicted even if it is the busiest. Irrelevant below 500 clients.
- Not planned.

### SOC-06 Overlapping messages bypass the turn budget

- Where: `service.js:123-125`. Two requests can both pass `entry.ended` before either finishes. The browser UI blocks this with `pending`, so it takes a script or a double fire.
- Effect: turns can exceed the budget, user/assistant messages interleave, and the efficiency penalty branch becomes reachable.

### SOC-07 Leak detection is narrow

- Where: `service.js:10-12`. Only whitespace and `-` are removed.
- Confirmed: `SYNTH_RESET_4821`, `synth.reset.4821` and an en dash variant are not caught and are forwarded to the model.
- Not a bug (decision): partial disclosure such as "it ends in 4821". Matching bare digits would flag innocent text, so this stays unflagged. Plan 2 documents it.

### SOC-08 A lost `/complete` response strands the player

- Where: `service.js:164-165` (session deleted on first completion), `useSocialEngineeringSession.js:119-125` (any failure returns to `chatting` with a retry message).
- Effect: if the network drops after the server processed the request, every retry returns 404 `LLM_SESSION_NOT_FOUND`. The player sees "The debrief could not be loaded" forever and has no way forward except reloading. AGENTS.md section 7 also asks for idempotent completion.
- Same dead end on `send` when the server restarted or the 30 minute idle TTL passed.

### SOC-09 `createPacer` is duplicated (cleanup)

- Where: `router.js:11`, `phishing-post-mortem/router.js:10`, `cli-cyber-defender/router.js:18`.
- Not planned: the other two files belong to other contributors and AGENTS.md forbids editing their work without agreement. Extract to shared code only as a separate, agreed task.

### SOC-10 `unavailable()` is exported but unused (cleanup)

- Where: `policy.js:93-99` defines it; `router.js:31-35` builds the same error inline.

### SOC-Q1 Open question, not a confirmed bug

- `providers/cloud.js:19-22` maps `assistant` to `model`, and the seeded opening is an assistant turn, so the first `contents` entry has role `model`. Whether `generateContent` accepts a conversation that starts with `model` was not verified. `tests/soc-live-session.mjs` is the live check; run it with a real key before assuming either way.

## Resolution (2026-10-12, branch `codex/soc-fixes`, uncommitted)

- Fixed: SOC-01, 02, 03, 04, 06, 07, 08, 10. Each has a test that failed first.
- Not fixed on purpose: SOC-05, SOC-09, partial-code disclosure. SOC-Q1 still unverified.
- New finding while fixing SOC-04: before the fix, cloud mode forwarded `LLM_MODEL` to Gemini even when it was an Ollama model name (for example `llama3.2:1b` with both variable sets present). `.env.example` claimed those variables were ignored, which was false. Now they are.
- Verification: 227 server and client unit tests pass; 2 fail and were already failing before any change (message composer: "emits the trimmed text on submit and clears the field", "sends on Enter but not on Shift+Enter"). eslint clean. Prettier clean with `--end-of-line auto` (plain `--check` flags almost every file in the repo because of CRLF).
- Not run: integration and E2E suites, the live Gemini rehearsal (`tests/soc-live-session.mjs`), and a browser check of the new code panel at 375px and 1200px.

## Not bugs, checked

- The reset code is never placed in a system prompt or sent to the model (`scenarios.js` header, `systemPrompt` fields).
- Request validation (`policy.js`) rejects unknown fields, non-UUID session ids and over-long messages.

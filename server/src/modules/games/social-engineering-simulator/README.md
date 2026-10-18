# Social Engineering Simulator - server module

Runs G-SOC: a fictional colleague, played by an LLM, pressures the trainee to reveal a
synthetic reset code. The server owns the code and the system prompts and decides the
score; the model's words are never a security boundary.

The LLM engine in `llm/` (adapter, providers, bounded chat-session store and runner) is a
separate contributor's work. This module **imports** it and does not modify it.

## Request and data flow

```
client/src/games/social-engineering-simulator/simulator.js
  -> shared Axios client (client/src/services/api.js, baseURL /api)
  -> Express app (server/src/app.js mounts createSocialEngineeringRouter under /api)
  -> router.js    validates the body, paces repeated requests, maps errors
  -> policy.js    field allowlist, decision enum, limits, typed SocialEngError
  -> service.js   picks a persona, runs both chats, detects leaks, scores the run
  -> scenarios.js server-owned personas: system prompt + private code + public brief
  -> verifiers.js server-owned real colleagues (prompt + facts) and scripted nudges
  -> llmConfig.js builds the two adapters; llmTimeout.js wraps the colleague's fetch
  -> llm/*        imported bounded in-memory session store + stateless adapter
                  (attacker: Gemini adapter; colleague: Ollama adapter)
```

## Endpoints

| Route                                                           | Purpose                                                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/games/social-engineering-simulator/session`          | Starts a run; returns `{ sessionId, gameId, rulesetVersion, persona, brief, openingMessage, resetCode, verifier }`. `verifier` is `null` without a colleague. |
| `POST /api/games/social-engineering-simulator/message`          | Body `{ sessionId, content }` (1..1000 chars); chat with the bad actor. Returns the reply, turn count and `leaked`/`ended`.                                   |
| `POST /api/games/social-engineering-simulator/verifier-message` | Body `{ sessionId, content }` (1..1000 chars); chat with the real colleague. Returns `{ reply, verifierTurnsUsed, verifierTurnBudget, leaked, ended }`.       |
| `POST /api/games/social-engineering-simulator/nudge`            | Body `{ sessionId }`; returns the next scripted bad-actor pressure line as `{ message, nudgesLeft }`. No model call.                                          |
| `POST /api/games/social-engineering-simulator/complete`         | Body `{ sessionId, decision }` (`refuse` / `verify-independently` / `share-code`); returns the score and debrief.                                             |

All five send `Cache-Control: no-store`. Request bodies reject unknown fields.

Errors use the project shape `{ error: { code, message, fieldErrors? }, requestId }`:
`SOC_INVALID_BODY` (400), `LLM_SESSION_NOT_FOUND` (404), `LLM_SESSION_BUSY` (409),
`SOC_VERIFIER_LIMIT` (409, the five colleague messages are used up),
`SOC_VERIFIER_BUSY` (429, another player's colleague reply is in flight),
`SOC_RATE_LIMITED` (429),
`LLM_NOT_CONFIGURED` / `LLM_UPSTREAM_UNAVAILABLE` (503) from the adapter, and
`SOC_UNAVAILABLE` (503) as the catch-all. A colleague reply that fails or times out returns
`LLM_UPSTREAM_UNAVAILABLE` with the text "<name> hasn't replied yet. Try again." and does not
spend one of the five messages. No stack or configuration detail leaks.

## Scoring (server-authoritative)

Maximum 100: `noLeak` 60, `verify` 25, `efficiency` 15. `rulesetVersion` is `2026-10-18`.

Since 18 October 2026 half of the answer depends on the scenario. Each scenario has a
`legitimate` flag, kept server-side and revealed only as `legitimate` in the `complete` result.
With a colleague configured, about 35% of runs (`LEGITIMATE_SHARE`) are genuine requests
(`own-ticket`, `scheduled-migration`); without one only attacks are served. For a genuine
request: contact then `share-code` = 100 (`resisted`), contact then `refuse` = 25 + efficiency
(`partial`), refuse without contact = efficiency only (`partial`), share without contact =
efficiency only (`compromised`). A code typed to the requester in a genuine scenario counts as a
share at that moment; a code typed to the colleague is always a leak. Attack scoring below is
unchanged. Design: `docs/superpowers/specs/2026-10-18-soc-scenario-variety-design.md`.

- `noLeak` is 60 unless the code ever leaked or the trainee chose `share-code`; then it is 0
  and the outcome is `compromised`.
- `verify` is 25 only when the decision is `verify-independently`; `refuse` alone scores 0 here.
  When a real colleague is configured this changes (16 October 2026, at Eric's request: the
  verify decision is removed in colleague mode and verify credit follows contact): `verify` is
  25 when the trainee got at least one reply from the colleague (`verifier-message` succeeded),
  the run is not compromised and the decision is not `share-code`, for `refuse` or
  `verify-independently` (the latter is still accepted for compatibility). Outcome is
  `resisted` when protected and contacted, `partial` when protected but never contacted.
  `refuse` without contact gets the debrief note "You protected the code but did not check with
  <colleague name>...". `verify-independently` without contact is scored as a refusal without
  contact and the debrief says "You chose to verify but did not contact anyone". The client
  only offers `refuse` and `share-code` in this mode.
  The breakdown label reads "Checked with <colleague name>" whenever a colleague session
  exists for the run, whether or not the trainee contacted them (without a colleague session it
  reads "Verified through an independent channel"). The points still depend on contact.
- `efficiency` is 15 within the bad-actor turn budget, scaling to a floor of 0 beyond it.
  Colleague messages do not count toward this budget.
- Outcome is `resisted` (protected + verified), `partial` (protected, refused only) or
  `compromised` (code exposed).

Leak detection normalises both the code and the trainee message (uppercase, everything
except letters and digits removed) and checks for a substring match, so `synth reset 4821`
and `synth_reset.4821` are caught. Partial disclosure such as only the digits is not flagged.
It applies to both chats: a message containing the code is never forwarded to either model,
and it ends the whole run as compromised.

## Two LLM roles and the real-colleague chat

Implemented on branch `g-soc-real-colleague` (15 October 2026). It is unsaved and pending
review. Full design: `docs/superpowers/specs/2026-10-15-soc-real-colleague-verification-design.md`.

- **Two chats.** The existing pressure chat stays. A second chat lets the player message the
  real colleague (`verifiers.js`: one colleague per persona, four in all, with server-owned
  facts and rules). The colleague is a different real person, for example Marcus Tan in the IT
  Service Centre, who honestly does not know the sender. Verification is credited only if the player
  actually got a reply from that colleague. The server decides the score; the model never does.
- **Two adapters, fixed roles** (`llmConfig.js`, `createGameAdapters`). The bad actor always
  uses Gemini (`LLM_API_KEY` + `LLM_MODEL`; a model without a key leaves it unconfigured). The
  real colleague always uses Ollama (`LLM_COLLEAGUE_BASE_URL` and `LLM_COLLEAGUE_MODEL`, set
  together or both empty, plus optional `LLM_COLLEAGUE_AUTH_TOKEN` and
  `LLM_COLLEAGUE_TIMEOUT_MS`). It is a second `createLlmAdapter()` instance, so the
  contributor-owned `llm/` folder is not edited. `LLM_API_KEY` never reroutes the colleague.
  `LLM_BASE_URL` and `LLM_AUTH_TOKEN` are no longer read by the game.
- **Fallback.** With no colleague configured, `session` returns `verifier: null`, the
  colleague endpoint answers `LLM_NOT_CONFIGURED`, and `verify-independently` is the old
  one-click choice that scores 25 without any contact (`refuse` stays 75).
- **Limits.** The colleague gets at most 5 replies per run (`VERIFIER_TURN_BUDGET`), one
  colleague reply may be in flight across the whole server (`VERIFIER_CONCURRENCY` 1, extra
  requests get `SOC_VERIFIER_BUSY`), and one reply per run at a time (`LLM_SESSION_BUSY`).
  A spent bad-actor budget does not stop the player from checking with the colleague.
- **Nudges.** `nudge` returns up to 3 scripted pressure lines per run (`MAX_NUDGES`) from the
  bad-actor persona while the player is idle or checking. They are fixed server text with no
  model call and do not spend a turn. Once the run has ended or leaked it returns
  `{ message: null, nudgesLeft: 0 }`. Each delivered nudge is recorded in the session
  metadata and added to the bad actor's system prompt on its next turn ("You also sent these
  follow-up messages while the trainee was away"), so it remembers them; the transcript
  store is append-only and is not edited.
- **Reply backstop.** The colleague's reply is trimmed deterministically before it is returned
  (`tidyColleagueReply` in `service.js`): at most the first 3 sentences, with http, https and
  www URLs removed. Sentences are split on whitespace that follows `.`, `!` or `?`, so
  dotted hostnames and version numbers such as `v1.2` do not break a sentence; an abbreviation
  like "e.g." may count as a sentence end. The model transcript keeps the raw reply.
- **No artificial delay.** The Ollama model's own latency is the pacing.
- **Timeouts.** The colleague reply may take up to 60 seconds on the server (`LLM_COLLEAGUE_TIMEOUT_MS` accepts an integer from 1000 to 60000, so it never exceeds the browser wait). The Ollama
  provider hardcodes `AbortSignal.timeout(30000)` inside `llm/`, so the colleague adapter
  instead receives a `fetchImpl` wrapped by `withTimeout` in `llmTimeout.js` that applies
  `LLM_COLLEAGUE_TIMEOUT_MS` (default 60000). The browser waits 65000 ms for the colleague
  (`VERIFIER_TIMEOUT_MS` in the client `simulator.js`; 45000 ms for the bad-actor chat). A
  reply that passes the limit shows a retryable "hasn't replied yet" state.
- **Status.** Unit tests cover the behaviour with mocked adapters. A live rehearsal against the
  shared project Ollama gateway has not been run yet; see the TASKS.md record. The gateway
  token is shared privately and lives only in each teammate's own `.env`.

## Why there is no database here

Like G-PHISH, this module runs ahead of AUTH-01/AUTH-02/DATA-01/GAME-01, so it is
deliberately stateless. Transcripts live only in the imported in-memory `chatSessionStore` (one store for the bad actor, one for the colleague;
20-message bound, 30-minute idle TTL) and are dropped on completion or when they go idle.
Every `complete` response carries `saved: false`, and the debrief is labelled
"practice - not saved". The in-memory pacing in `router.js` bounds abuse of a public
endpoint but is not a security boundary and does not survive a restart.

## Migrating onto GAME-01

The response vocabulary already uses GAME-01 terms (`gameId`, `rulesetVersion`, `score`,
`maxScore`, `outcome`). When GAME-01 exists:

1. Replace the five routes with `POST /api/games/:gameId/attempts`, the `send-message`
   action and `complete`. `service.js` keeps the chat/leak/score logic; `scoreOutcome()`
   moves across unchanged as the ruleset summariser.
2. Store `{ scenarioId, turnsUsed, leaked, decision }` plus the bounded transcript as the
   attempt `state`; keep the system prompt and code server-side exactly as now.
3. Let the shared action service enforce one in-flight generation and idempotent completion.
4. Add `requireSession` in the router and pass the resolved actor into the service.

## Tuning

`turnBudget` (8), the persona set in `scenarios.js`, the colleague facts and nudges in
`verifiers.js`, and the limits and `WEIGHTS` in `policy.js` are
defaults chosen for the MVP and can be adjusted without touching the engine.

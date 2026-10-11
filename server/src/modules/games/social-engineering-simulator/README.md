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
  -> policy.js    field allowlist, decision enum, typed SocialEngError
  -> service.js   picks a persona, runs the chat, detects leaks, scores the run
  -> scenarios.js server-owned personas: system prompt + private code + public brief
  -> llm/*        imported bounded in-memory session store + stateless adapter (Ollama)
```

## Endpoints

| Route                                                   | Purpose                                                                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `POST /api/games/social-engineering-simulator/session`  | Starts a run; returns `{ sessionId, persona, brief, openingMessage }`.                                            |
| `POST /api/games/social-engineering-simulator/message`  | Body `{ sessionId, content }` (1..1000 chars); returns the colleague reply, turn count and `leaked`/`ended`.      |
| `POST /api/games/social-engineering-simulator/complete` | Body `{ sessionId, decision }` (`refuse` / `verify-independently` / `share-code`); returns the score and debrief. |

All three send `Cache-Control: no-store`.

Errors use the project shape `{ error: { code, message, fieldErrors? }, requestId }`:
`SOC_INVALID_BODY` (400), `LLM_SESSION_NOT_FOUND` (404), `SOC_RATE_LIMITED` (429),
`LLM_NOT_CONFIGURED` / `LLM_UPSTREAM_UNAVAILABLE` (503) from the adapter, and
`SOC_UNAVAILABLE` (503) as the catch-all. No stack or configuration detail leaks.

## Scoring (server-authoritative)

Maximum 100: `noLeak` 60, `verify` 25, `efficiency` 15.

- `noLeak` is 60 unless the code ever leaked or the trainee chose `share-code`; then it is 0
  and the outcome is `compromised`.
- `verify` is 25 only when the decision is `verify-independently`; `refuse` alone scores 0 here.
- `efficiency` is 15 within the turn budget, scaling to a floor of 0 beyond it.
- Outcome is `resisted` (protected + verified), `partial` (protected, refused only) or
  `compromised` (code exposed).

Leak detection normalises both the code and the trainee message (uppercase, spaces and
hyphens removed) and checks for a substring match, so `synth reset 4821` is caught.

## Why there is no database here

Like G-PHISH, this module runs ahead of AUTH-01/AUTH-02/DATA-01/GAME-01, so it is
deliberately stateless. Transcripts live only in the imported in-memory `chatSessionStore`
(20-message bound, 30-minute idle TTL) and are dropped on completion or when they go idle.
Every `complete` response carries `saved: false`, and the debrief is labelled
"practice - not saved". The in-memory pacing in `router.js` bounds abuse of a public
endpoint but is not a security boundary and does not survive a restart.

## Migrating onto GAME-01

The response vocabulary already uses GAME-01 terms (`gameId`, `rulesetVersion`, `score`,
`maxScore`, `outcome`). When GAME-01 exists:

1. Replace the three routes with `POST /api/games/:gameId/attempts`, the `send-message`
   action and `complete`. `service.js` keeps the chat/leak/score logic; `scoreOutcome()`
   moves across unchanged as the ruleset summariser.
2. Store `{ scenarioId, turnsUsed, leaked, decision }` plus the bounded transcript as the
   attempt `state`; keep the system prompt and code server-side exactly as now.
3. Let the shared action service enforce one in-flight generation and idempotent completion.
4. Add `requireSession` in the router and pass the resolved actor into the service.

## Tuning

`turnBudget` (8), the persona set in `scenarios.js` and the `WEIGHTS` in `policy.js` are
defaults chosen for the MVP and can be adjusted without touching the engine.

# Phishing Post-Mortem - server module

Serves the authored cases for G-PHISH and scores the player's single verdict. The private answer key never leaves this directory.

## Request and data flow

```
client/src/games/phishing-post-mortem/phishing.js
  -> shared Axios client (client/src/services/api.js, baseURL /api)
  -> Express app (server/src/app.js mounts createPhishingRouter under /api)
  -> router.js   validates the request, paces repeated verdicts
  -> policy.js   field allowlist, identifier patterns, typed PhishingError
  -> service.js  picks the case, shuffles the inbox, compares against the answer key
  -> cases/*.public.json        public content, safe to send to the browser
  -> cases/answers/*.answers.json  patient zero, correct clues, notes - server only
```

## Endpoints

| Route                                          | Purpose                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /api/games/phishing-post-mortem/case`     | One case with its twenty emails in shuffled order, timeline and clues.       |
| `POST /api/games/phishing-post-mortem/verdict` | Scores `{ caseId, datasetVersion, actionId, selectedEmailId, evidenceIds }`. |

`?after=<caseId>` asks for a different case, which is how replay rotates between the two. Both routes send `Cache-Control: no-store`.

Scoring is 60 points for naming Patient Zero and 20 for each correct supporting clue, with clues counting only behind a correct accusation. Maximum 100.

Errors use the project shape `{ error: { code, message, fieldErrors? }, requestId }`: `PHISH_INVALID_REQUEST` (400), `PHISH_UNKNOWN_SELECTION` (400), `PHISH_CASE_NOT_FOUND` (404), `PHISH_DATASET_CHANGED` (409), `PHISH_RATE_LIMITED` (429), `PHISH_UNAVAILABLE` (503).

## Why there is no database here

AUTH-01, AUTH-02, DATA-01 and GAME-01 are not implemented. Rather than invent a competing attempt collection, this module is deliberately stateless: it stores nothing, identifies nobody, and every response carries `persisted: false`. The UI says the same thing to the player.

Two consequences are honest limitations, not oversights. A player can submit different verdicts for the same case, because there is no attempt record to close; nothing is at stake because no score is kept. The in-memory pacing in `router.js` bounds abuse of a public endpoint but is not a security boundary and does not survive a restart.

## Migrating onto GAME-01

The response vocabulary is already GAME-01's: `gameId`, `rulesetVersion` (`phish-1`), `status`, `score`, `maxScore`, `topicOutcomes`, plus a per-case `datasetVersion` and a client-generated `actionId` that is currently echoed rather than de-duplicated.

When GAME-01 exists:

1. Replace the two routes with `POST /api/games/:gameId/attempts` and the `submit-verdict` action; `service.js` `scoreVerdict()` moves across unchanged as the ruleset's `applyAction`/`summarize`.
2. Store `{ caseId, datasetVersion, emailOrder, selectedEmailId, evidenceIds, submittedAt }` as the attempt `state`, exactly as the TASKS.md blueprint specifies.
3. Let the shared action service honour `actionId` for idempotency and enforce one verdict per attempt.
4. Have the shared session/action layer authorize the actor and attempt before invoking the scorer. The current `scoreVerdict()` is stateless and accepts no actor argument; any later authentication integration requires an agreed interface.

No client change is needed for steps 1 to 3 beyond the request URL.

## Authoring a case

Each case is a pair: `cases/<id>.public.json` and `cases/answers/<id>.answers.json`. A case needs exactly twenty uniquely identified emails, one unambiguous Patient Zero, exactly two correct clues among six options, and a timeline whose ordering supports the answer. Destinations must be `https` on a fictional `.example` host, links are inert text, and no real brand may appear. `server/tests/unit/phishing-post-mortem/case-integrity.test.js` enforces all of this, so run the unit suite after editing a case.

Add the new id to `CASE_IDS` in `service.js`. Nothing else changes; rotation and shuffling pick it up automatically.

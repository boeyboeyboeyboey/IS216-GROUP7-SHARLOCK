# Phishing Post-Mortem - server module

Owns the authored G-PHISH cases, their private answer keys and the scoring rules. Since G-PHISH-02 every case is a saved attempt in the shared attempt service; this module adds no routes or collections of its own.

## Request and data flow

```
client/src/games/phishing-post-mortem/phishing.js
  -> client/src/services/attempts.js   shared saved-attempt requests with the csrf header
  -> server/src/modules/attempts/router.js   session, origin, csrf and rate limits
  -> server/src/modules/attempts/service.js  owner check, revisions, receipts, one game_attempts document
  -> ruleset.js   this game's registry entry (createState, validateAction, applyAction, summarize...)
  -> service.js   createCaseLibrary: opens a case, shuffles the inbox, scores and builds the debrief
  -> cases/*.public.json             public content
  -> cases/answers/*.answers.json    patient zero, correct clues and notes - server only
```

`server/src/server.js` registers `createPhishingRuleset()` in the one attempt registry it passes to both `initializeAttemptStorage` and `createApp`.

## Saved play

Paths are relative to `/api` and follow the [attempt contract](../../attempts/README.md). Every request needs a signed-in account; POSTs also need the exact origin and a csrf token.

| Step         | Request                                                                                        | What the player gets                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Open a case  | `POST /games/phishing-post-mortem/attempts` with `{ context: { kind: 'personal' } }`           | 201 snapshot. `publicState` holds the shuffled inbox, timeline and clue list           |
| Verdict      | `POST /attempts/:id/actions` with `type: 'submit-verdict'`, `{ selectedEmailId, evidenceIds }` | 200 snapshot with the server score; the answer is still hidden                         |
| Save result  | `POST /attempts/:id/complete`                                                                  | 200 immutable snapshot with `feedback`, `topicOutcomes`, `publicState.outcome/debrief` |
| Read it back | `GET /attempts/:id`                                                                            | The same completed snapshot, only for its owner                                        |

Ruleset `phishing-post-mortem@phish-1`: standard, untimed, not competitive, `maxScore` 100, `maxActions` 1. Scoring is unchanged: 60 points for naming Patient Zero and 20 for each correct supporting clue, with clues counting only behind a correct accusation.

Private state is `{ caseId, datasetVersion, emailOrder, selectedEmailId, evidenceIds, submittedAt }` under a strict schema. `serializePublicState` builds the public case explicitly and adds the outcome and debrief only once the attempt is completed.

Game errors use the shared attempt error shape: `ATTEMPT_INVALID_REQUEST` (400, malformed verdict), `PHISH_UNKNOWN_SELECTION` (400, a message or clue outside this case), `PHISH_DATASET_CHANGED` (409, the case file changed after the attempt opened), `PHISH_CASE_UNAVAILABLE` (409), `PHISH_VERDICT_RECORDED` (409). A second verdict is refused by the action limit (`ATTEMPT_ACTION_LIMIT`) and a retried verdict with the same `actionId` replays its first response.

## Limits

- Results save to the player's personal record only. The game offers no class chooser, ranking, profile history or instructor view yet.
- A new attempt picks a case at random, so with two cases replay can open the same case again.
- A case opened and never finished stays `active` in the player's record; it holds no score.
- The earlier unauthenticated `/games/phishing-post-mortem/case` and `/verdict` routes were removed. Runs played through them were never stored, so there is nothing to migrate.

## Authoring a case

Each case is a pair: `cases/<id>.public.json` and `cases/answers/<id>.answers.json`. A case needs exactly twenty uniquely identified emails, one unambiguous Patient Zero, exactly two correct clues among six options, and a timeline whose ordering supports the answer. Destinations must be `https` on a fictional `.example` host, links are inert text, and no real brand may appear. `server/tests/unit/phishing-post-mortem/case-integrity.test.js` enforces all of this, so run the unit suite after editing a case.

Add the new id to `CASE_IDS` in `service.js`. Nothing else changes; case selection and shuffling pick it up automatically.

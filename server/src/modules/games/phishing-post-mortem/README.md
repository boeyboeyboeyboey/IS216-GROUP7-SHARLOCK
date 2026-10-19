# Phishing Post-Mortem - server module

Owns the G-PHISH cases (two authored, plus a seeded generator), their private answer keys and the scoring rules. Since G-PHISH-02 every case is a saved attempt in the shared attempt service; this module adds no routes or collections of its own.

## Request and data flow

```
client/src/games/phishing-post-mortem/phishing.js
  -> client/src/services/attempts.js   shared saved-attempt requests with the csrf header
  -> server/src/modules/attempts/router.js   session, origin, csrf and rate limits
  -> server/src/modules/attempts/service.js  owner check, revisions, receipts, one game_attempts document
  -> ruleset.js   this game's registry entry (createState, validateAction, applyAction, summarize...)
  -> service.js   createCaseLibrary: opens a case, shuffles the inbox, scores and builds the debrief
  -> generator/   rebuilds a generated case from (seed, template, generator version)
  -> cases/*.public.json             public content
  -> cases/answers/*.answers.json    patient zero, correct clues and notes - server only
```

`server/src/server.js` registers `createPhishingRulesets()` (one entry, `phish-1`) in the one attempt registry it passes to both `initializeAttemptStorage` and `createApp`.

## Saved play

Paths are relative to `/api` and follow the [attempt contract](../../attempts/README.md). Every request needs a signed-in account; POSTs also need the exact origin and a csrf token.

| Step         | Request                                                                                        | What the player gets                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Open a case  | `POST /games/phishing-post-mortem/attempts` with `{ context: { kind: 'personal' } }`           | 201 snapshot. `publicState` holds the shuffled inbox, timeline and clue list           |
| Verdict      | `POST /attempts/:id/actions` with `type: 'submit-verdict'`, `{ selectedEmailId, evidenceIds }` | 200 snapshot with the server score; the answer is still hidden                         |
| Save result  | `POST /attempts/:id/complete`                                                                  | 200 immutable snapshot with `feedback`, `topicOutcomes`, `publicState.outcome/debrief` |
| Read it back | `GET /attempts/:id`                                                                            | The same completed snapshot, only for its owner                                        |

Ruleset `phishing-post-mortem@phish-1`: standard, untimed, not competitive, `maxScore` 100, `maxActions` 1. Generated cases (G-PHISH-03) kept the same version because the rules and scoring did not change; the state only gained optional fields. Register a single entry: the shared attempt model currently rejects every attempt once two ruleset entries are registered (reported to Boey with G-PHISH-03). Scoring is unchanged: 60 points for naming Patient Zero and 20 for each correct supporting clue, with clues counting only behind a correct accusation.

Private state is `{ source, caseId, datasetVersion, seed, templateId, generatorVersion, emailOrder, selectedEmailId, evidenceIds, submittedAt }` under a strict schema. A generated case is stored as its seed and template, never as content. `source` defaults to `authored` and the generator fields to `null`, so attempts saved before G-PHISH-03 still load. `serializePublicState` builds the public case explicitly and adds the outcome and debrief only once the attempt is completed.

Game errors use the shared attempt error shape: `ATTEMPT_INVALID_REQUEST` (400, malformed verdict), `PHISH_UNKNOWN_SELECTION` (400, a message or clue outside this case), `PHISH_DATASET_CHANGED` (409, the case file changed after the attempt opened), `PHISH_CASE_UNAVAILABLE` (409), `PHISH_VERDICT_RECORDED` (409). A second verdict is refused by the action limit (`ATTEMPT_ACTION_LIMIT`) and a retried verdict with the same `actionId` replays its first response.

## Limits

- Results save to the player's personal record only. The game offers no class chooser, ranking, profile history or instructor view yet.
- Each new attempt draws evenly from the 2 authored cases and the 5 generator templates, so a generated case is new almost every time.
- A case opened and never finished stays `active` in the player's record; it holds no score.
- The earlier unauthenticated `/games/phishing-post-mortem/case` and `/verdict` routes were removed. Runs played through them were never stored, so there is nothing to migrate.

## Generated cases

`generator/` builds a case in exactly the authored format from a 32-bit seed and one of five templates. The same seed, template and `GENERATOR_VERSION` always give the same case, which is why only those three values are stored.

| Template         | Patient Zero                                  | What the logs show next                                               |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `sso-reverify`   | "Re-verify your SSO access" from the IT desk  | credentials, overnight sign-in, mailbox rule, payroll change          |
| `vendor-invoice` | invoice link from a lookalike supplier domain | credentials, sign-in, payment request to a new account                |
| `shared-file`    | fake file-share notification                  | credentials, sign-in, bulk download, unusual transfer                 |
| `hr-payslip`     | payslip notice from the People team           | credentials, sign-in, salary account changed, hiding rule             |
| `mfa-alert`      | "secure your account" security alert          | password and MFA approval relayed, sign-in within minutes, new device |

Per case the generator randomises the company, vendor and people (`pools.js`), the domain trick (`tricks.js`: r-n for m, vv for w, 1 for l, an extra word, or the name in front of someone else's domain), three decoys from four archetypes (clicked without credentials, arrived after the sign-in, blocked by the web filter, never clicked), the ordinary mail, the times and the four distractor clues. One genuine message always shares Patient Zero's display name.

Rules for changing it:

- Never change what a released `GENERATOR_VERSION` produces: active attempts rebuild their case from it. Add a new generator version and keep the old one able to rebuild its cases.
- Use only the seeded `rng` in the generator, never `Math.random` or the clock.
- Keep every host on `.example` and no real brand anywhere. `server/tests/unit/phishing-post-mortem/generator.test.js` builds 500 cases and checks the authored-case rules, that exactly one message fits the evidence, determinism, and that every template and trick is used.

## Authoring a case

Each case is a pair: `cases/<id>.public.json` and `cases/answers/<id>.answers.json`. A case needs exactly twenty uniquely identified emails, one unambiguous Patient Zero, exactly two correct clues among six options, and a timeline whose ordering supports the answer. Destinations must be `https` on a fictional `.example` host, links are inert text, and no real brand may appear. `server/tests/unit/phishing-post-mortem/case-integrity.test.js` enforces all of this, so run the unit suite after editing a case.

Add the new id to `CASE_IDS` in `service.js`. Nothing else changes; case selection and shuffling pick it up automatically.

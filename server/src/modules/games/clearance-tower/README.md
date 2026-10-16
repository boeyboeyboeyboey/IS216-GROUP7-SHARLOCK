# Clearance Tower — server module

Server half of the `clearance-tower` game (G-CLEAR). The player designs an access-control policy for a fictional intelligence agency, predicts how a few requests will be decided, then watches a scripted day play out against that policy. The server owns the day's script, the prediction answers, the simulation and every score; the browser only sends a policy and its predictions.

Learning content follows CS440 `07-access-control.pptx`: discretionary control and ACLs/capabilities (slides 13–25), Bell–LaPadula labels (26–32) and role-based control (34–38).

## Files

| File          | Responsibility                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `levels.js`   | Six levels as plain data: agents, files, the day's events, prediction answers and takeaways. `publicLevel()` strips everything the player must not see before submitting. |
| `models.js`   | Pure rule checks: `checkStep()` for discretionary grants, Bell–LaPadula labels (`dominates()`) and roles, plus `findDutyConflicts()` for separation of duties.            |
| `simulate.js` | `simulateDay()` replays the scripted day against a policy. Same input, same day.                                                                                          |
| `scoring.js`  | Four score rows, stars, prediction review and the role-versus-matrix edit comparison.                                                                                     |
| `policy.js`   | Constants, strict request validation (unknown fields rejected) and `ClearanceError`.                                                                                      |
| `service.js`  | In-memory attempt store (max 500 attempts, 30-minute idle expiry) with one submission per attempt.                                                                        |
| `router.js`   | Three routes, courtesy request pacing, `Cache-Control: no-store` and the shared error shape.                                                                              |

## Flow

```
browser                         router.js            service.js              levels / simulate / scoring
GET  /levels         ───────▶  listLevels()  ──▶  six level summaries
POST /attempts       ───────▶  parseStart()  ──▶  startAttempt()  ──▶  publicLevel(level)
POST /attempts/:id/submit ──▶  parseAttemptId() ──▶ submitAttempt() ──▶ parseSubmission → simulateDay → scoreLevel
```

## Rules (`rulesetVersion: 'clear-1'`)

- Each event in a day is `work` (should succeed), `attack` (should be stopped) or `integrity` (Bell–LaPadula allows it on purpose, to show it ignores integrity). An event passes only if every step is allowed.
- Score out of 100 per level:
  - **No leaks** 40, minus 20 per attack that got through.
  - **Work completed** 30, in proportion to work events that succeeded.
  - **Least privilege** 15, minus 5 per right the work did not need and per separation-of-duties conflict. Bell–LaPadula levels skip this row, because labels fix every flow, and score predictions out of 30 instead.
  - **Predictions** 15, in proportion to correct allow/deny calls.
- Stars: 95+ is three, 75+ two, 50+ one. "The Gift" is capped at 91 on purpose: under discretionary control every fix for the Trojan horse also blocks real work.
- The "Reshuffle" result adds `edits: { badgeEdits, matrixEdits }` to compare role edits with the matrix cells that changed underneath.

## Endpoints

All responses send `Cache-Control: no-store` and `saved: false`; nothing is written to MongoDB.

| Method and path                                       | Body                                | Response                                                                                                       |
| ----------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /api/games/clearance-tower/levels`               | —                                   | `{ gameId, rulesetVersion, levels: [{ id, act, actTitle, model, title }], saved }`                             |
| `POST /api/games/clearance-tower/attempts`            | `{ levelId }`                       | `{ gameId, rulesetVersion, attemptId, level, expiresAt, saved }`, where `level` is the public level            |
| `POST /api/games/clearance-tower/attempts/:id/submit` | `{ actionId, policy, predictions }` | `{ score, maxScore, stars, breakdown, meters, predictionReview, events, takeaways, slides, edits?, saved, … }` |

Policy shapes: discretionary `{ grants: [{ subject, object, rights: ['r','w'] }] }` (up to 64); Bell–LaPadula `{ objectLabels: { [fileId]: { level, categories } } }` (one per file); role-based `{ roles: [{ id, name, permissions }], assignments: [{ agent, roleIds }] }` (up to 8 roles). Predictions are `[{ id, verdict: 'allow' | 'deny' }]`, one per prompt.

Error codes: `CLEAR_INVALID_BODY` (400), `CLEAR_ATTEMPT_NOT_FOUND` (404), `CLEAR_ATTEMPT_SUBMITTED`, `CLEAR_ACTION_CONFLICT` (409), `CLEAR_RATE_LIMITED` (429), `CLEAR_UNAVAILABLE` (503).

Repeating a submission with the same `actionId` and choices returns the recorded result. A different `actionId` on a finished attempt is refused; retrying a level starts a new attempt.

## Known limits

- Attempts live in process memory and vanish after 30 idle minutes or a restart.
- Until results are saved against an account, a player could open a throwaway attempt to see a day's script before submitting a "real" one. That is acceptable for unsaved practice.

## Moving to GAME-01

1. Replace the attempt routes with `POST /api/games/:gameId/attempts` (state `{ levelId, policy, predictions, submittedAt }`) and a `submit-policy` action.
2. Reuse `parseSubmission()` for action validation and `simulateDay()` plus `scoreLevel()` unchanged for scoring.
3. Keep `levels.js` server-side; only `publicLevel()` output belongs in a public snapshot.

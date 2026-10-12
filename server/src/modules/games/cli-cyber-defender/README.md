# CLI Cyber Defender — server module

Server half of the `cli-cyber-defender` game (G-CLI). The server owns the incident pool, the time windows, the command parser and every score. The browser only ever sees the alert that is open right now, until the debrief.

## Files

| File           | Responsibility                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scenarios.js` | Private pool of 16 fictional incidents: alert text, expected `{ verb, target }`, topic and explanation. Addresses are RFC 5737 documentation ranges or internal `10.x` lab space. |
| `parser.js`    | Teaching grammar: `block ip <ipv4>`, `disable user <name>`, `isolate host <name>`. Keywords are case-insensitive and whitespace is collapsed. Nothing is ever executed.           |
| `schedule.js`  | `generateWindows()` builds eight integer windows of 10–15 seconds totalling 100. `deriveProgress()` is a pure replay of a run from stored timestamps.                             |
| `service.js`   | In-memory run store (max 500 runs, 10-minute idle expiry), command submission with idempotent action IDs, completion and debrief.                                                 |
| `policy.js`    | Constants, strict body validation (unknown fields rejected) and `CliError`.                                                                                                       |
| `router.js`    | Four routes, courtesy request pacing, `Cache-Control: no-store` and the shared error shape `{ error: { code, message, fieldErrors? }, requestId }`.                               |

## Rules (`rulesetVersion: 'cli-1'`)

- Eight incidents per run, drawn from the pool. Timed mode gives each one a window; resolving an incident (right or wrong) opens the next one immediately with its own full window, so a shift lasts at most 100 seconds.
- A correct command before the deadline adds one to the streak and scores `100 × min(3, streak)`. A wrong action or target, or a missed window, closes the incident and resets the streak. Maximum 2,100.
- Each shift draws 3 easy, 3 medium and 2 hard incidents (scenario `tier`), in that order.
- Alerts include `segments`: each line split into text and tappable names from the scenario's `entities`, decoys included, matched as whole tokens.
- A correct or wrong command response includes `review: { expectedCommand, explanation, concepts }`; the debrief adds `concepts` and `hintUsed` per incident.
- A command the parser cannot read returns `outcome: "syntax"` with a hint and leaves the incident open.
- The receipt time is taken on the server. A command arriving at or after `closesAt` is rejected with `CLI_INCIDENT_CLOSED`.
- Missed windows are derived from the clock whenever the run is read, so `GET` never changes state.
- A timed shift can be paused. While paused, the server's game clock stops, so every deadline moves back by the paused time; commands are refused with `CLI_RUN_PAUSED` and snapshots hide the alert (`alert: null`). Pause and resume are idempotent. Practice cannot be paused.
- Practice mode has no deadlines (`closesAt: null`) and may be ended early; unhandled incidents become `skipped`.

## Endpoints

All responses carry `saved: false`; nothing is written to MongoDB.

| Method and path                                                      | Body                                | Response                                                                                                                                                           |
| -------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/games/cli-cyber-defender/runs`                            | `{ mode: "timed" \| "practice" }`   | Snapshot: `{ gameId, rulesetVersion, runId, mode, status, serverNow, incidentCount, resolvedCount, current, history, score, streak, multiplier, maxScore, saved }` |
| `GET /api/games/cli-cyber-defender/runs/:runId`                      | —                                   | Snapshot.                                                                                                                                                          |
| `POST /api/games/cli-cyber-defender/runs/:runId/hint`                | `{ incidentId }`                    | Practice only: snapshot plus `hint: { incidentId, lineIndex }`; the incident is marked `hintUsed`. Timed shifts get `CLI_HINT_UNAVAILABLE` (409).                  |
| `POST /api/games/cli-cyber-defender/runs/:runId/pause` and `/resume` | `{}`                                | Snapshot with `paused: true` (alert hidden) or `paused: false`.                                                                                                    |
| `POST /api/games/cli-cyber-defender/runs/:runId/commands`            | `{ actionId, incidentId, command }` | Snapshot plus `{ outcome: "correct" \| "wrong" \| "syntax", message, command, pointsAwarded }`.                                                                    |
| `POST /api/games/cli-cyber-defender/runs/:runId/complete`            | `{ actionId }`                      | `{ gameId, rulesetVersion, runId, mode, status, score, maxScore, saved, result, feedback, topicOutcomes, debrief[] }`.                                             |

`current` is `{ incidentId, index, opensAt, closesAt, windowSeconds, alert: { title, severity, source, lines } }`; times are epoch milliseconds on the server clock and the client corrects for skew with `serverNow`. Expected commands and explanations appear only in `debrief`.

Error codes: `CLI_INVALID_BODY` (400), `CLI_RUN_NOT_FOUND` (404), `CLI_INCIDENT_CLOSED`, `CLI_RUN_PAUSED`, `CLI_PAUSE_UNAVAILABLE`, `CLI_HINT_UNAVAILABLE`, `CLI_ACTION_CONFLICT`, `CLI_RUN_FINISHED`, `CLI_RUN_NOT_FINISHED`, `CLI_COMMAND_LIMIT` (409), `CLI_RATE_LIMITED` (429), `CLI_UNAVAILABLE` (503).

Repeating a command with the same `actionId` returns the recorded response; the same ID with a different command fails. Completion is idempotent.

## Moving to GAME-01

AUTH-01, AUTH-02, DATA-01 and GAME-01 do not exist yet, so this module is stateless with respect to players: runs live in process memory and are forgotten after ten idle minutes or a restart. When the shared attempt contract exists:

1. Replace the four routes with `POST /api/games/:gameId/attempts`, the `command` action type and attempt completion.
2. Persist the run as the attempt's `state` (`{ mode, schedule: [{ incidentId, scenarioId, windowSeconds, resolution }], startedAt, endedAt, pausedAt, pausedTotal }`), keeping `expected` server-side.
3. Reuse `deriveProgress()` unchanged for `serializePublicState`/`summarize`, and `parseCommand()` for `validateAction`.
4. Exclude `mode: "practice"` from any ranking.

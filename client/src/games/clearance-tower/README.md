# Clearance Tower — client module

Browser half of the `clearance-tower` game (G-CLEAR). It shows the cases, lets the player edit a policy and predictions, sends them to the server once, then animates the scored day the server returns. The browser never decides an outcome or a score. See `server/src/modules/games/clearance-tower/README.md` for the rules and endpoints.

## Flow

```
ClearanceTowerGame.vue ── useClearanceTower() ── clearanceTower.js ── shared api.js ── /api/games/clearance-tower/…
   │                         phase, level, policy, predictions, result
   ├─ LevelSelect        cases       → openLevel(id)       POST /runs
   ├─ DossierBrief       brief       → showPhase('design')
   ├─ TowerView          design … debrief: floors, rooms, visitors, leak flags
   ├─ AccessMatrix / LabelBoard / RoleDesigner   design: edit the policy (v-model)
   ├─ PredictionPanel    predict     → runDay()            POST /runs/:id/submit
   ├─ DayControls + EventLog   day: useDayPlayback() steps through result.events
   └─ LevelDebrief       debrief     → retry / next case / all cases
```

## Files

| File                               | Responsibility                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ClearanceTowerGame.vue`           | Root: picks the component for each phase, starts playback and moves focus to each new heading.                   |
| `clearanceTower.js`                | Request wrappers over the shared Axios client, plus small pure helpers for wording and immutable policy updates. |
| `composables/useClearanceTower.js` | Phase, run, policy draft, predictions, best scores this session, pending/error state and request cancellation.   |
| `composables/useDayPlayback.js`    | Which event of the day is showing; play, pause, step, skip and speed, with its timer cleared on unmount.         |
| `components/*.vue`                 | Presentational pieces with explicit props and emits; none of them call the API.                                  |
| `clearance.css`                    | Every rule scoped under `.clearance-game`, using the town's light palette and Pixelify Sans.                     |

## Boundaries

- Nothing is saved: best scores live only in memory for the visit, and every screen says so.
- Separation-of-duties warnings in `RoleDesigner` are hints only; the server's check decides the score.
- Reduced motion turns off animations and autoplay, so players step through the duty log with **Next event**.
- Every control is a native button, select, checkbox or radio, so keyboard and touch work without drag gestures.

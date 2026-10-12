# CLI Cyber Defender — client module

Browser half of the `cli-cyber-defender` game (G-CLI), served at `/games/cli-cyber-defender` from the existing `cottage` building at (112, 112). Scoring and timing live on the server; see `server/src/modules/games/cli-cyber-defender/README.md`.

## Data flow

`CliDefenderGame.vue` → `useCliDefender.js` → `cliDefender.js` (shared `services/api.js`) → Express router → service → in-memory run.

1. The briefing emits `start(mode)`; the composable creates a run and prints the first alert.
2. The player types a command (or taps a template). `help`, `history` and `clear` stay in the browser; everything else is posted with a fresh `actionId`.
3. A 100ms interval only refreshes the displayed countdown from the server deadline, corrected by `serverNow`. When a window reaches zero, or the tab becomes visible again, the composable fetches a fresh snapshot instead of counting ticks.
4. During a timed shift, hiding the tab (switching tabs, minimising, locking a phone) calls `pause`. The server freezes the clock; `PausedPanel` replaces the alert and terminal until the player chooses Resume shift. Practice never pauses.
5. When no incident remains, the composable requests the debrief and shows `ShiftDebrief`.

## Components

| Component              | Props                                                                          | Emits                                 |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| `BriefingPanel.vue`    | `{ pending, error }`                                                           | `start(mode)`                         |
| `TerminalPanel.vue`    | `{ lines, disabled, busy, modelValue, history, maxLength }`; exposes `focus()` | `submit-command`, `update:modelValue` |
| `IncidentBanner.vue`   | `{ incident, remainingMs, mode }`                                              | —                                     |
| `ScoreHud.vue`         | `{ score, streak, multiplier, remainingMs, resolvedCount, total, mode }`       | —                                     |
| `CommandReference.vue` | `{ disabled }`                                                                 | `insert-template(template)`           |
| `PausedPanel.vue`      | `{ pending }`; focuses its button on mount                                     | `resume`                              |
| `ShiftDebrief.vue`     | `{ result }`                                                                   | `replay`                              |

## Design and accessibility

The game uses the DESIGN.md game exception: an original green/amber-on-black terminal with a system monospace stack. Every rule in `cli.css` is under `.cli-game` with `--game-*` variables; nothing targets `:root`, `body`, the navbar or another module. The town building, metadata card and shared pages keep the hub pixel scheme.

- The terminal output is a `role="log"` live region; outcomes are written as `[ OK ]`, `[FAIL]`, `[MISS]` text, never colour alone.
- The countdown bar and ticking seconds are hidden from assistive technology; the window length is announced once per incident.
- Up/Down recall earlier commands. Template buttons are 44px touch targets that insert the verb and refocus the input. The input disables autocorrect and autocapitalisation.
- Reduced motion removes the scanline overlay; nothing else animates.
- All requests are aborted and the interval and `visibilitychange` listener removed on unmount.
- Results are labelled "not saved" until the shared GAME-01 attempt contract exists.

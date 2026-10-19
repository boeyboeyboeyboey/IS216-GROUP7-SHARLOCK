# Phishing Post-Mortem - SHARMAIL client module

The playable G-PHISH investigation. The player reads a mailbox of twenty synthetic messages, inspects senders and link destinations, reads a security log, accuses one message of being Patient Zero and supports it with exactly two clues.

## Files

| File                              | Responsibility                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PhishingPostMortem.vue`          | Route entry, layout, pane focus handling, loading and error states.                                                                                                                                          |
| `components/SharmailShell.vue`    | SHARMAIL chrome: wordmark, mailbox name, folder rail.                                                                                                                                                        |
| `components/InboxList.vue`        | Message rows, unread state, arrow-key walking. Emits `select-email`.                                                                                                                                         |
| `components/EmailInspector.vue`   | Headers, body and inert link inspection. Emits `inspect-link`.                                                                                                                                               |
| `components/EvidenceTimeline.vue` | The security log.                                                                                                                                                                                            |
| `components/VerdictPanel.vue`     | Verdict bar docked under the mail client (shell `footer` slot), outside any message: accused message, an Evidence toggle that opens the two-clue list, submit. Emits `update-evidence` and `submit-verdict`. |
| `components/CaseDebrief.vue`      | Score, evidence chain, clue review, decoy explanations. Emits `replay`.                                                                                                                                      |
| `composables/usePhishingCase.js`  | All module state: saved attempt, case, selection, accusation, clues, request lifecycle.                                                                                                                      |
| `phishing.js`                     | Game wrappers over `services/attempts.js` (open, verdict, save, re-read), plus date helpers.                                                                                                                 |
| `phish.css`                       | Every style, scoped under `.phish-game`.                                                                                                                                                                     |

## State ownership

`usePhishingCase()` owns everything. Two ideas are deliberately separate:

- `selectedEmailId` is the message being **read**.
- `accusedEmailId` is the message being **accused**.

Opening a message never accuses it; only the Accuse button does. `canSubmit` needs an accusation plus exactly two clues. A generation counter and an `AbortController` drop responses from a superseded request, and everything is aborted on unmount.

## Saved play

The route needs a signed-in account. Loading opens a saved personal attempt and renders its `publicState`; the answer key never reaches the browser.

Submitting is two server steps: record the verdict, then save the result. The composable keeps the attempt `revision`, a verdict `actionId` and a completion `actionId`:

- a failed or lost verdict is retried with the same `actionId` and revision, so the server replays it instead of recording it twice; a changed verdict gets a new `actionId`
- once the server holds a verdict, `verdictLocked` disables the clue panel and a retry only saves the result
- a stale-revision or conflict answer re-reads the attempt and finishes what the server actually holds

The debrief appears only from the completed snapshot, and "Result saved to your account." shows only when that snapshot is completed and `persisted`. Replay opens a new attempt.

## Design boundary

This module uses the DESIGN.md game exception: a desktop mail-client look with a system font stack, the town's green and cream accents and its own controls, rather than the hub's pixel scheme. Realism is the point - a spoofed display name only teaches if the inbox looks like an inbox.

Every rule in `phish.css` sits under `.phish-game`, and the palette is defined as `--game-*` variables on that wrapper. Nothing touches `:root`, `html`, `body`, `.portal-shell`, the navbar or another module. SHARMAIL is an original fictional mail client; it deliberately borrows no real product's branding, wordmark or icons. The town building, its metadata card, the shared navbar and every shared page keep the hub pixel scheme.

## Accessibility

The reading pane and the list are side by side from 992px and swap below it, where Back to inbox returns focus to the row the reader came from. Rows are buttons with `aria-current`, and Arrow Up and Arrow Down walk them. Link destinations are revealed by a button with `aria-expanded`; no anchor is rendered, so inspecting can never navigate. Controls are at least 44px, focus is always visible, and verdict states carry text as well as colour. There is no animation.

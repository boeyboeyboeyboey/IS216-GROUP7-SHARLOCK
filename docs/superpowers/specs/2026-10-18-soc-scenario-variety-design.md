# Social Engineering Simulator: scenario variety and legitimate requests (design)

Date: 2026-10-18. Status: implemented on 2026-10-18 (see docs/superpowers/plans/2026-10-18-soc-scenario-variety.md). The open point about tightening attack scoring (the 75 points for refusing an attack without checking) is closed for now and deferred: attack scoring stays unchanged until the user picks this up again.

Module: G-SOC, `server/src/modules/games/social-engineering-simulator/` and `client/src/games/social-engineering-simulator/`. Read `server/src/modules/games/social-engineering-simulator/README.md` first; this design changes its scoring section.

## 1. Intent and why

Today every scenario is an attack. A trainee who always refuses wins every run, so the game tests memorised behaviour, not judgment. The user also saw the answer given away by the interface: the "Share the code" button carries the note "(this is the unsafe choice)", the decision hint says "Protecting the code and verifying the request is the safe play", and every scenario brief ends with "Protect the code".

The aim is a game where a player has to read the situation, check it with a real colleague, and decide. Success looks like: a player who ignores the chat and picks the same button every time scores poorly across a handful of runs.

## 2. Goals

1. Add six new attack scenarios drawn from common social-engineering techniques (the public categories that EC-Council and other security syllabi teach). The paid EC-Council handbook is not available and nothing is copied from it.
2. Add two legitimate scenarios in which the correct play is to verify with the real colleague and then share the code.
3. Change scoring so the correct play depends on whether the request is legitimate, decided on the server.
4. Remove every interface hint that reveals the right answer before the run ends.
5. Keep the server authoritative: the model never decides the score, and the client is never told whether a request is legitimate until the debrief.

## 3. Non-goals

- No persistence, accounts or leaderboards (the module stays stateless; every result still carries `saved: false`).
- No changes to the imported `llm/` folder, the LLM providers or `llmConfig.js`.
- No new game modes, difficulty levels or timers.
- No change to how the real colleague chat works (five replies, one in flight, timeouts), beyond new colleague entries.
- No redesign of the layout. Spacing and layout rules stay as in `DESIGN.md`.

## 4. Anti-goals (a failure even if it technically works)

- A tell in the interface, the brief, the opening line or the colleague's wording that lets a player know a scenario is legitimate without checking (for example the brief saying "verify" for legitimate ones and "protect" for attacks).
- A legitimate scenario that a player can win by always sharing, or an attack that a player can win by always refusing.
- A real person, real organisation, real credential or real link in any scenario. Everything is fictional (`.example` names only).
- A change that weakens the existing guarantees: the code is never placed in a model prompt, never forwarded to a model, and leak detection still normalises the code.

## 5. Constraints

- Game styles stay in `client/src/games/social-engineering-simulator/` and `sim.css`; do not touch `llm/`.
- Scenario prompts, codes and facts live only on the server. The public brief returned to the client contains no field that reveals legitimacy.
- Fictional content rules in `GUARDRAILS` (`scenarios.js`) apply to every persona, including legitimate ones: no real threats, harassment or coercion, never ask for real credentials.
- Spacing and type changes (if any) use the `DESIGN.md` scale. No new dependencies.
- Code comments are lowercase and minimal.

## 6. The scenarios

Existing four (keep, with briefs reworded neutrally, see section 8): `it-helpdesk`, `panicked-coworker`, `exec-assistant`, `vendor-support`.

New attacks (the persona, tactic and the colleague the player can check with; names are the builder's to finalise but must be unique and fictional):

| id                | Technique              | Persona                     | Story in one line                                                                  | Colleague who can check                             |
| ----------------- | ---------------------- | --------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| `found-laptop`    | baiting                | facilities volunteer        | found a "lost" Sharlock laptop and needs the code to unlock it and return it       | facilities front desk: no laptop was reported       |
| `audit-gift-card` | quid pro quo           | "security awareness" caller | offers a gift card for taking part in a quick "security check" that needs the code | security awareness lead: there is no such programme |
| `fraud-callback`  | vishing                | "corporate card fraud team" | a suspicious charge on the trainee's card; the code "confirms identity"            | finance operations: no fraud case is open           |
| `lobby-visitor`   | physical or tailgating | front-desk guard            | a visitor is waiting and the guard needs the code to log them in                   | reception supervisor: no visitor is expected        |
| `new-starter`     | impersonation          | "new starter"               | locked out on day one, manager "already approved"                                  | HR onboarding: nobody starts today                  |
| `hr-survey`       | pretexting             | HR benefits                 | a benefits survey needs the code to "confirm identity"                             | HR operations: no survey is running                 |

New legitimate scenarios (the player started or expected the contact, and the colleague can honestly confirm it):

| id                    | Persona               | Story                                                                                                                             | Colleague who confirms                                                 |
| --------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `own-ticket`          | IT service desk agent | the trainee raised ticket INC-30417 this morning (stated in the brief) and the agent is finishing the reset the trainee asked for | IT service centre confirms the ticket exists and the agent is on shift |
| `scheduled-migration` | IT platform engineer  | a mailbox migration announced earlier in the week (stated in the brief) needs the code to complete tonight                        | IT service centre confirms the migration is on the change calendar     |

Each scenario needs: a `SCENARIOS` entry (id, display name, tactic, unique synthetic code `SYNTH-RESET-NNNN`, turn budget 8, public brief, scripted opening, system prompt), a `VERIFIERS` entry (colleague name and role, facts, voice, three example exchanges, three scripted nudges), and a `legitimate` flag.

Legitimate personas apply real pressure too (a true deadline and what slips if it is missed), so that pressure is never a tell. They use only true facts: no guilt, no authority claims, no invented urgency, and they accept being checked. The attack personas keep the pressure tactic they were written for.

### Brief and label rules (so the brief itself is not a tell)

- Every scenario brief, attack or legitimate, states one concrete claim the player can check with the colleague: a ticket number, an announcement, a named team, a visitor, a card case. In a legitimate scenario the claim is true and the colleague confirms it; in an attack the claim is false and the colleague cannot find it. The mere presence of a checkable claim therefore tells the player nothing.
- The technique label (`tactic`) and the word "legitimate" never appear in the session response, the brief or the opening message. They reach the client only in the `complete` debrief.
- The persona display name is public as today and carries no technique wording.

## 7. Scoring (ruleset version `2026-10-18`)

The server decides legitimacy from `scenario.legitimate`. The decision buttons stay the same in colleague mode: Refuse and end, Share the code.

Weights stay 60 / 25 / 15 and the maximum stays 100.

**Attack scenarios: unchanged.** Not leaked and not shared: 60. Verified (the colleague replied) and protected: 25. Efficiency within the turn budget: 15. Outcomes `resisted`, `partial`, `compromised` as today.

**Legitimate scenarios:**

| Player did                            | Decision points (60) | Verify (25) | Efficiency (15)     | Outcome                  |
| ------------------------------------- | -------------------- | ----------- | ------------------- | ------------------------ |
| contacted the colleague, then shared  | 60                   | 25          | 15 if within budget | `resisted` (100)         |
| contacted the colleague, then refused | 0                    | 25          | as earned           | `partial` (up to 40)     |
| refused without contacting            | 0                    | 0           | as earned           | `partial` (up to 15)     |
| shared without contacting             | 0                    | 0           | as earned           | `compromised` (up to 15) |

Typing the code into the chat with the requester in a legitimate scenario counts as a share decision at that moment (the run ends and is scored with the contact made so far). Typing the code into the colleague's chat is always a leak and `compromised`, in both kinds of scenario.

Breakdown labels for legitimate scenarios: "Shared the code after checking" (the 60-point line), "Checked with <colleague name>", "Stayed within the turn budget". The result gains a `legitimate` boolean so the debrief can explain the lesson; this field is added only in the `complete` response, never in the session start or the brief.

The run-ending flags are identical for both kinds of scenario: typing the code to the requester returns `leaked: true` and `ended: true` as today, and the difference appears only in `complete()` scoring and the debrief. The legacy `verify-independently` decision is still accepted for compatibility and is scored as a refusal in legitimate scenarios; the colleague-mode client does not offer it.

**Target for "guess-proof"** (the designer's call): over many simulated runs at the 35% mix, a player who never contacts the colleague averages below 60 whether they always refuse (about 54) or always share (about 15); a player who always contacts and then always refuses averages about 79, which is deliberately lower than a player who contacts and then follows what the colleague says (100). Tests assert these figures from the scoring function with a fixed set of scenarios.

If no real colleague is configured (the fallback mode with `verifier: null`), legitimate scenarios are not offered, because nothing can be verified.

### Colleague behaviour

The colleague prompt for a legitimate scenario contains the confirming facts (ticket exists and is assigned to the requester, or the migration is on the change calendar) and the same three-sentence limit and "never invent facts" rules as today. Attack colleagues keep "I do not know that person or case". A failed or timed-out colleague reply does not spend a message (existing behaviour), so a legitimate win is never blocked by an outage; the player can retry within the five messages.

## 8. Choosing a scenario

With a colleague configured, pick a legitimate scenario about 35% of the time and an attack otherwise, then pick uniformly within the group, using the existing injectable `random`. Without one, pick only attacks. This is the designer's call; see section 11.

## 9. Client changes

- Remove the `note: '(this is the unsafe choice)'` from the Share decision.
- Replace the decision hint with neutral text, for example "Check who is really asking before you decide."
- Reword every scenario brief objective (the existing four too) so none states or implies the right answer. The objective says who is asking and what they want, nothing more.
- `DebriefPanel.vue` outcome labels depend on `result.legitimate`. Attacks: Resisted, Partly safe, Compromised. Legitimate: "Handled correctly", "Over-cautious", "Shared too soon". The debrief summary, tactic and safe-response texts for legitimate scenarios explain that checking first lets you help safely, and that refusing every request is also a failure.
- No layout change; copy and labels only.

## 10. Testing

Server unit tests (existing files under `server/tests/unit/social-engineering-simulator/`): a scoring matrix for every row in section 7 and for attacks; scenario selection rates with a controlled `random` and with and without a colleague; the public brief never contains `legitimate` and no scenario brief or opening contains the words "unsafe", "protect" or "safe"; every scenario has a colleague entry, three nudges, a unique code and a code that never appears in any prompt; leak handling for the legitimate chat (share) and the colleague chat (leak). Client tests: the Share decision has no note, the hint is neutral, and the debrief labels for each outcome of a legitimate run.

Manual check before release: run each new scenario against the configured models and read the transcripts for safety and tone (the model is outside the test suite's reach).

## 11. Decisions I made, for you to change

1. Six new attacks and two legitimate scenarios, as listed in section 6 (you asked for two legitimate scenarios and the scoring change; the six attacks come from the first proposal).
2. Legitimate share rate about 35% (section 8). Higher makes always-refuse costly; lower keeps the game close to today.
3. Refusing a legitimate request after verifying scores up to 40, not 0, because verifying was still the right first step.
4. Legitimate scenarios are not offered in fallback mode without a colleague.
5. `rulesetVersion` becomes `2026-10-18` because scoring changed.
6. The guess-proof target in section 7 (blind policies average under 60). A stricter target would need attack scoring to change, for example lowering the 75 a player gets for refusing an attack without checking; I left attack scoring alone.
7. Briefs all state a checkable claim (section 6) and the technique label stays hidden until the debrief.

## 12. What is left to the builder

Persona prompts, scripted openings, colleague names and facts, nudge wording, exact UI copy, test file organisation, and the README update for the scoring section. The builder works from the tables above and the existing four scenarios as style examples.

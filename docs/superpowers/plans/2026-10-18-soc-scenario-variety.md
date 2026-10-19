# G-SOC Scenario Variety and Legitimate Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six attack scenarios and two legitimate scenarios to the Social Engineering Simulator, score them by legitimacy on the server, and remove every interface hint that gives the answer away.

**Architecture:** Each scenario gets a `legitimate` flag in `scenarios.js` and a matching `VERIFIERS` entry. `scoreOutcome` in `service.js` branches on legitimacy. `pickScenario` takes `{ withColleague }` and picks the group (35% legitimate) before the scenario. The client changes copy and labels only. The `complete` response gains `legitimate`, and nothing earlier exposes it.

**Tech Stack:** Node (ESM) with Vitest on the server, Vue 3 with Vitest and Vue Test Utils on the client.

**Spec:** `docs/superpowers/specs/2026-10-18-soc-scenario-variety-design.md`. Read it and `server/src/modules/games/social-engineering-simulator/README.md` first. The user paused this spec on 2026-10-18 and has now asked for it to be built. Treat the request to plan it as the go-ahead, but the section 11 decisions are still the user's to change.

## Global Constraints

- Do not touch `server/src/modules/games/social-engineering-simulator/llm/` or `llmConfig.js`.
- Module stays stateless: every result still carries `saved: false`.
- Ruleset version `2026-10-18`. Weights stay 60 / 25 / 15, max 100.
- Codes are unique `SYNTH-RESET-NNNN`. The code never appears in any attacker or colleague prompt, and leak detection keeps using `normalise`.
- Everything is fictional: `.example` names only, no real person, organisation, credential or link.
- `GUARDRAILS` apply to every persona. Legitimate personas do not manipulate (no guilt, authority claims or invented urgency).
- Turn budget 8 for every scenario.
- The words "unsafe", "protect" and "safe" never appear in any brief objective, opening or interface hint. The `tactic` label and the word "legitimate" never appear in the session response, brief or opening. They appear only in the `complete` debrief.
- Every brief states one concrete checkable claim (ticket number, announcement, named team, visitor, card case).
- Legitimate scenarios are offered only when a colleague is configured, at about 35% (`random() < 0.35`), then uniform within the group.
- UI changes use copy and labels only, with no layout change. Any spacing uses the DESIGN.md scale.
- Code comments are lowercase and minimal.
- Staging uses `git add .` only, and commits happen only when the user asks. The commit steps below are therefore "ask the user first".

## Review Focus

- Typing the code into the colleague chat in a legitimate scenario is a leak and `compromised`. It must not be scored as a share after checking.
- Typing the code to the requester in a legitimate scenario after contacting the colleague scores 100 (`resisted`). Before contacting it scores `compromised` (up to 15). The client may send any decision to `complete`, and the server must ignore it in this case.
- A retried `complete` for a legitimate run returns the same result including `legitimate`.
- Fallback mode (`verifierAdapter` unconfigured) never serves a legitimate scenario, even when `random()` returns 0.
- A colleague outage in a legitimate run does not spend a message and does not block a later successful check.
- The legacy `verify-independently` decision on a legitimate run scores as a refusal, and in an attack run behaves as today.

## File Structure

- `server/src/modules/games/social-engineering-simulator/policy.js`: ruleset version, selection-rate constant.
- `.../scenarios.js`: scenario data, legitimate-persona context and stages, `pickScenario`, `publicBrief`.
- `.../verifiers.js`: colleague entries for all ten scenarios.
- `.../service.js`: scoring, debrief, leak bookkeeping, selection call.
- `client/src/games/social-engineering-simulator/simulator.js`, `components/DecisionBar.vue`, `components/DebriefPanel.vue`: copy and labels.
- Tests: `server/tests/unit/social-engineering-simulator/{service,scenarios,verifiers}.test.js` and `client/src/games/social-engineering-simulator/__tests__/components.test.js`.
- Docs: the module `README.md` scoring section, and the spec status line.

---

### Task 1: Legitimacy-aware scoring and debrief (server)

**Files:**
- Modify: `policy.js`, `service.js` (`scoreOutcome`, `buildDebrief`, `sendMessage`, `sendVerifierMessage`, `complete`, session meta)
- Test: `server/tests/unit/social-engineering-simulator/service.test.js`, `verifiers.test.js:27` (version assertion)

**Interfaces:**
- Produces: `RULESET_VERSION = '2026-10-18'`; `LEGITIMATE_SHARE = 0.35`; `scoreOutcome({ leaked, decision, turnsUsed, turnBudget, verifierRequired, verifierContacted, verifierName, legitimate = false })` returns `{ score, outcome, breakdown }`; `complete()` result gains `legitimate: boolean`.
- Consumes: `entry.scenario.legitimate` (undefined is treated as false until Task 2 adds the flag).

- [ ] **Step 1: Write failing tests** in `service.test.js`, calling `scoreOutcome` with `verifierRequired: true`, `turnsUsed: 4`, `turnBudget: 8`. Cover every row of the section 7 table. Legitimate rows:
  - contacted + `share-code` → `{score: 100, outcome: 'resisted'}`, with breakdown labels `Shared the code after checking`, `Checked with <name>`, `Stayed within the turn budget`
  - contacted + `refuse` → `score 40`, `partial`
  - not contacted + `refuse` → `15`, `partial`
  - not contacted + `share-code` → `15`, `compromised`
  - `leaked: true` (colleague chat) + contacted → `compromised`, with 0 for decision and 0 for verify
  - Attack rows are unchanged: `refuse` after contact → 100, `refuse` without contact → 75, `share-code` → 15.

  Also test through the service with `random` forced to a legitimate scenario (after Task 2 exists, so use an injected scenario or defer the integration cases to Task 5). In this task, test a leak via `sendMessage` followed by `complete(id, 'refuse')`. A legit run after contact must give 100, and a legit run before contact must give `compromised`. A leak via `sendVerifierMessage` must give `compromised` for both kinds.
- [ ] **Step 2: Run** `npx vitest run tests/unit/social-engineering-simulator/service.test.js` from `server/`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** in `policy.js` the version bump and `LEGITIMATE_SHARE`. In `service.js`, extend `scoreOutcome` with the `legitimate` branch. The decision line is worth 60 only for `share-code` after contact. `verify` follows contact. Outcome is `resisted` for contact + share, `compromised` for share without contact or any colleague-chat leak, and `partial` otherwise. In session meta add `leakedToColleague` (set in `sendVerifierMessage`'s leak branch). In `complete`, when `scenario.legitimate` and the requester-chat leak happened and `leakedToColleague` is false, score with `decision = 'share-code'` and `leaked = false`. Add `legitimate: Boolean(scenario.legitimate)` to the result. `buildDebrief` gets a legitimate branch: the summary explains that checking first lets you help safely, and that refusing every request is also a failure. Its tactic line states this was a genuine request, not an attack. Attack copy is unchanged.
- [ ] **Step 4: Run** the same command. Expected: PASS. Also run `npx vitest run tests/unit/social-engineering-simulator` and update the version assertion at `verifiers.test.js:27`.
- [ ] **Step 5: Commit** (ask the user first): `feat(soc): score legitimate requests by checking first`.

### Task 2: Scenario model, neutral briefs and selection

**Files:**
- Modify: `scenarios.js` (`promptForTurn`, `pickScenario`, `publicBrief`, existing four briefs)
- Test: `scenarios.test.js`

**Interfaces:**
- Produces: `pickScenario(random = Math.random, { withColleague = true } = {})`. If `withColleague` and `random() < LEGITIMATE_SHARE`, it picks from `SCENARIOS.filter(s => s.legitimate)`, otherwise from the attacks, using `Math.floor(random() * group.length)` for the second draw. `promptForTurn` uses `LEGIT_CONTEXT` and `LEGIT_STAGES` when `scenario.legitimate`.
- Consumes: `LEGITIMATE_SHARE` from `policy.js`.

- [ ] **Step 1: Write failing tests.** (a) With a fake `random` returning `[0.1, 0]` and then `[0.9, 0]`, assert a legitimate then an attack pick. With `withColleague: false` and `random = () => 0`, assert an attack. (b) Neutrality over all `SCENARIOS`: `brief.objective`, `opening` and `brief.title` match none of `/unsafe|protect|\bsafe\b|legitimate/i`. (c) `publicBrief(s)` has no `legitimate`, `tactic`, `code` or `systemPrompt` key. (d) Codes are unique and match `/^SYNTH-RESET-\d{4}$/`, and no `systemPrompt` contains its own code. (e) Existing tests that assert four personas become "at least" counts, and are tightened in Task 4.
- [ ] **Step 2: Run** `npx vitest run tests/unit/social-engineering-simulator/scenarios.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add `legitimate: false` to the four existing entries. Reword their objectives to say who is asking and what they want, nothing more. Example: `A help-desk agent says your account is locked and asks for the reset code. They quote ticket INC-20418.` Keep each one's existing checkable claim (INC-20418, the Brightwell deck, Dana Okafor, case NW-55012). Add `LEGIT_CONTEXT` (the same goal, but the persona is genuine and friendly, never pushes back, uses no guilt or authority, and accepts being checked) and `LEGIT_STAGES` (four calm stages with no escalation). Implement `pickScenario` as specified. Update the call in `service.js` to `pickScenario(random, { withColleague: Boolean(verifierAdapter?.configured) })`.
- [ ] **Step 4: Run** the unit folder. Expected: PASS.
- [ ] **Step 5: Commit** (ask the user first).

### Task 3: Six new attack scenarios and colleagues

**Files:**
- Modify: `scenarios.js` (`SCENARIOS`), `verifiers.js` (`VERIFIERS`)
- Test: `scenarios.test.js`, `verifiers.test.js`

**Interfaces:**
- Consumes: the Task 2 scenario shape plus the existing `VERIFIERS` shape (`displayName`, `role`, `facts`, `voice`, `examples` ×3, `nudges` ×3).
- Produces: scenario ids `found-laptop`, `audit-gift-card`, `fraud-callback`, `lobby-visitor`, `new-starter`, `hr-survey`.

- [ ] **Step 1: Write failing tests.** `SCENARIOS` contains these ids with `legitimate: false`, unique codes, `turnBudget` 8 and `.example`-only names. `verifiers.test.js` already loops over every scenario, so extend its "pins the key facts" table with one fact per new colleague (for example `found-laptop` → "no laptop was reported"). The existing loop then covers: three nudges, a prompt without the code, identity before the rules, and examples.
- [ ] **Step 2: Run** both test files. Expected: FAIL (ids missing).
- [ ] **Step 3: Implement** the six entries from the section 6 table, following the four existing entries as style examples. Each has a persona, tactic label, code, a neutral brief with one checkable claim, a scripted opening, a system prompt that ends with its `YOUR TACTIC:` line, and its colleague. The colleague says it does not know the person or case, with the facts from the table's last column. Use fictional names only.
- [ ] **Step 4: Run** the unit folder. Expected: PASS.
- [ ] **Step 5: Commit** (ask the user first).

### Task 4: Two legitimate scenarios and colleagues

**Files:**
- Modify: `scenarios.js`, `verifiers.js`
- Test: `scenarios.test.js`, `verifiers.test.js`

**Interfaces:**
- Produces: `own-ticket` (ticket INC-30417, stated in the brief) and `scheduled-migration` (mailbox migration announced earlier in the week), both `legitimate: true`.

- [ ] **Step 1: Write failing tests.** Both ids exist with `legitimate: true`. Their prompts contain none of the manipulation words `guilt`, `urgent`, `authority` as instructions. The test checks that `systemPrompt` includes `LEGIT_CONTEXT` text and excludes the attack `CONTEXT` text. Their colleague facts confirm the claim (`INC-30417` exists, or the migration is on the change calendar). The colleague prompt still contains the three-sentence rule and "Never invent". `SCENARIOS` has 6 + 4 attacks and exactly 2 legitimate entries.
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement** both scenarios. The colleague voice is the IT service centre ("Marcus Tan" is already used, so choose a distinct fictional name). Its facts confirm the ticket or the calendar entry. Legitimate nudges are friendly check-ins with no pressure. The persona honestly accepts being checked: it does not invent reasons the check will not work.
- [ ] **Step 4: Run** the unit folder. Expected: PASS.
- [ ] **Step 5: Commit** (ask the user first).

### Task 5: Service integration and guess-proof check

**Files:**
- Test: `service.test.js` (integration cases with real scenario data)
- Modify: `service.js` only if a gap shows up

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Write tests** using fake adapters and an injected `random`:
  - Colleague configured, `random` → `[0.1, 0]`: the session persona id is `own-ticket`. The `startSession` response and `brief` have no `legitimate` or `tactic` key anywhere (`JSON.stringify` check).
  - Colleague unconfigured, `random = () => 0`: persona is an attack.
  - Legit run: message colleague → `complete('share-code')` → 100, `legitimate: true`. Never contact → `share-code` → `compromised`. Requester-chat leak after contact → 100. Colleague-chat leak → `compromised`. Retried `complete` returns an identical object. A failed colleague reply (adapter throws upstream error) leaves `verifierTurns` unchanged and a retry succeeds.
  - Guess-proof: using the scoring function with turns 4/8, over the 4+6 attacks and 2 legitimate scenarios weighted 0.65/0.35, assert the blind always-refuse average is within 54 ± 1, always-share within 15 ± 1, and contact-then-refuse within 79 ± 1, and contact-then-follow is 100.
- [ ] **Step 2: Run** `npx vitest run tests/unit/social-engineering-simulator`. Expected: PASS. Fix `service.js` if any case fails.
- [ ] **Step 3: Run the whole server suite** (`npm test` in `server/`). Expected: PASS.
- [ ] **Step 4: Commit** (ask the user first).

### Task 6: Client copy and debrief labels

**Files:**
- Modify: `simulator.js` (drop `note`), `components/DecisionBar.vue` (hint), `components/DebriefPanel.vue` (labels)
- Test: `__tests__/components.test.js` (lines ~24, 102–106, 208, 277), `session.test.js:24` (fixture objective)

**Interfaces:**
- Consumes: `result.legitimate` (boolean, may be absent on older responses, so treat as false).

- [ ] **Step 1: Update and add failing tests.** Replace the test at line 102 with: the Share button has no `.soc-decision-note`. Replace the hint assertion (line 208) with `Check who is really asking before you decide.` and assert the hint text does not match `/safe|protect/i`. Add DebriefPanel tests: legitimate + `resisted` → "Handled correctly"; legitimate + `partial` → "Over-cautious"; legitimate + `compromised` → "Shared too soon"; attack outcomes keep "Resisted", "Partly safe", "Compromised". Change fixture objectives from "Protect the code" to neutral text.
- [ ] **Step 2: Run** `npx vitest run src/games/social-engineering-simulator` from `client/`. Expected: FAIL.
- [ ] **Step 3: Implement.** Remove the `note` property from the Share decision (the template's `v-if="decision.note"` stays harmless). Change the hint text. In `DebriefPanel.vue`, make `outcomeLabel` pick its map by `result.legitimate`. Do not change layout. Check the debrief and decision bar at the 236px sidebar width and in the main area (project UI rule), with no word-by-word wrapping.
- [ ] **Step 4: Run** the client suite. Expected: PASS.
- [ ] **Step 5: Commit** (ask the user first).

### Task 7: Docs and manual check

**Files:**
- Modify: module `README.md` (scoring section near line 48–50, scenario list), spec status line, plan checkboxes

- [ ] **Step 1:** Rewrite the README scoring section for both kinds of scenario (the table in spec section 7), the new version `2026-10-18`, the selection rule, and the fallback rule.
- [ ] **Step 2:** Update the spec's status line from "paused" to "implemented" once tasks 1–6 pass.
- [ ] **Step 3: Manual check** (needs a configured model, user to confirm availability): run each of the ten scenarios with the dev server and read the transcripts for safety and tone. Check that a legitimate persona never pressures and that an attack colleague never confirms the story. Report findings to the user. Do not claim the check passed without running it.
- [ ] **Step 4:** Run the server and client suites once more and report the real output.

## Self-review

- Spec coverage: sections 6 (Tasks 3–4), 7 (Tasks 1, 5), 8 (Task 2), 9 (Task 6), 10 (Tasks 2, 5, 6), docs (Task 7). The section 3 non-goals are untouched (`llm/`, persistence).
- Open point for the user: the guess-proof figures assume the 0.35 mix and 4 turns used. Section 11 lists the decisions they may still change, and attack scoring is deliberately unchanged.

# Reset Code Visibility and Leak Detection Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the player can see their synthetic reset code, so typing it into the chat is a real, detectable leak, and the detector catches common reformattings of it.

**Architecture:** `startSession` returns the scenario's code as `resetCode` (never in `/message`, `/complete` or any prompt). The composable stores it, `ScenarioBrief` and the chat header display it, and `normalise` keeps only letters and digits.

**Tech Stack:** Node.js ESM, Vue 3 `<script setup>`, Vitest 5 with `@vue/test-utils`.

**Spec:** `docs/superpowers/bugs/2026-10-12-soc-bug-log.md` items SOC-01, SOC-07.

**Decision needed from Eric before Task 1:** this reverses what `service.test.js:23-33` asserts (that the start payload has no code). The plan assumes the recommended option: show the player their own synthetic code. If you would rather keep the code hidden and redesign the leak mechanic, stop here and say so.

**Order:** run after Plan 1.

## Global Constraints

- Touch only `server/src/modules/games/social-engineering-simulator/`, `client/src/games/social-engineering-simulator/` and their tests and README.
- The code must never appear in any system prompt, any `/message` or `/complete` response, or any `adapter.chat` argument.
- Game styling stays inside `client/src/games/social-engineering-simulator/`: `.soc-` classes and the existing `--game-*` variables in `sim.css`. Do not touch `:root`, `html`, `body` or shared files.
- Comments lowercase, minimal, no trailing full stop. No commit steps.
- Test commands: `pnpm exec vitest run --project server <path>` and `pnpm exec vitest run --project client <path>`.

## Review Focus

- Code typed with different case, spacing, underscores, dots or an en dash is flagged and never forwarded to the adapter (Task 2).
- Near-misses are not flagged: a different last digit, or "reset 4821 times" (Task 2).
- A server that does not send `resetCode` (stale build) still renders the brief without errors (Task 3).
- The code appears in the start response only: not in `/message` or `/complete` results, and not in the system prompt (Task 1).
- Starting a second run replaces the displayed code instead of showing the old one (Task 3).

---

### Task 1: Server returns the player's reset code

**Files:**
- Modify: `server/src/modules/games/social-engineering-simulator/service.js:112-119`
- Modify: `server/src/modules/games/social-engineering-simulator/scenarios.js:1-3` (header comment)
- Modify: `server/src/modules/games/social-engineering-simulator/README.md` (start response fields)
- Test: `server/tests/unit/social-engineering-simulator/service.test.js`

**Interfaces:**
- Produces: `POST /games/social-engineering-simulator/session` response gains `resetCode: string` (format `SYNTH-RESET-` plus four digits). `publicBrief` is unchanged and still omits the code.

- [ ] **Step 1: Replace the first service test** with `starts a run with a persona, brief, opening and the player's reset code`

```js
it("starts a run with a persona, brief, opening and the player's reset code", async () => {
  const { service, adapter } = makeService()
  const start = service.startSession()
  expect(start.sessionId).toMatch(/[0-9a-f-]{36}/)
  expect(start.persona.id).toBeTruthy()
  expect(start.brief.title).toBeTruthy()
  expect(start.openingMessage).toBeTruthy()
  expect(start.resetCode).toBe(codeFor(start))
  expect(JSON.stringify(start)).not.toContain('system')

  const turn = await service.sendMessage(start.sessionId, 'Who is this exactly?')
  const { systemPrompt } = adapter.chat.mock.calls[0][0]
  expect(systemPrompt).not.toContain(start.resetCode)
  expect(JSON.stringify(turn)).not.toContain(start.resetCode)
  expect(JSON.stringify(service.complete(start.sessionId, 'refuse'))).not.toContain(start.resetCode)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator/service.test.js`
Expected: FAIL, `start.resetCode` is undefined.

- [ ] **Step 3: Add `resetCode: scenario.code` to the object `startSession` returns**

Reword the `scenarios.js` header comment so it says the code stays out of prompts and model calls and is shown only to the player in the start response (lowercase, no trailing full stop). Add `resetCode` to the response fields documented in the module README.

- [ ] **Step 4: Run the server feature tests**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator`
Expected: PASS. If `router.test.js` asserts the `/session` body has no code, update that assertion to the new contract (`resetCode` present, matches `/^SYNTH-RESET-\d{4}$/`).

---

### Task 2: Leak detection ignores separators

**Files:**
- Modify: `server/src/modules/games/social-engineering-simulator/service.js:8-12`
- Test: `server/tests/unit/social-engineering-simulator/service.test.js`

**Interfaces:**
- Consumes: `codeFor(start)` helper already in the test file.
- Produces: `normalise(value: string) -> string`: uppercase, then every character outside `A-Z0-9` removed. Leak = normalised message contains normalised code.

- [ ] **Step 1: Write the failing tests**

```js
it.each([
  ['spaces', (code) => code.toLowerCase().replaceAll('-', ' ')],
  ['underscores', (code) => code.replaceAll('-', '_')],
  ['dots', (code) => code.toLowerCase().replaceAll('-', '.')],
  ['en dashes', (code) => code.replaceAll('-', '–')],
])('flags the code typed with %s and never forwards it', async (_label, reformat) => {
  const { service, adapter } = makeService()
  const start = service.startSession()
  const result = await service.sendMessage(start.sessionId, `fine, it is ${reformat(codeFor(start))}!`)
  expect(result.leaked).toBe(true)
  expect(adapter.chat).not.toHaveBeenCalled()
})

it.each([
  ['a different last digit', (code) => code.slice(0, -1) + (code.endsWith('1') ? '2' : '1')],
  ['only the number', () => 'reset 4821 times'],
  ['an unrelated refusal', () => 'I will not share it'],
])('does not flag %s', async (_label, buildText) => {
  const { service } = makeService()
  const start = service.startSession()
  const result = await service.sendMessage(start.sessionId, buildText(codeFor(start)))
  expect(result.leaked).toBe(false)
})
```

- [ ] **Step 2: Run them and confirm the underscore and dot cases fail**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator/service.test.js`
Expected: the underscore and dot cases FAIL; spaces pass; en dash FAILS.

- [ ] **Step 3: Change `normalise`**

Replace the character class so everything except `A-Z` and `0-9` is removed after uppercasing, and update its comment to say separators of any kind are ignored (lowercase, no trailing full stop). Partial disclosure such as only the last four digits stays unflagged on purpose; do not add it.

- [ ] **Step 4: Run the server feature tests**

Run: `pnpm exec vitest run --project server server/tests/unit/social-engineering-simulator`
Expected: PASS.

---

### Task 3: Client shows the code

**Files:**
- Modify: `client/src/games/social-engineering-simulator/composables/useSocialEngineeringSession.js` (add ref, set in `start`, clear in `clearState`, return it)
- Modify: `client/src/games/social-engineering-simulator/components/ScenarioBrief.vue`
- Modify: `client/src/games/social-engineering-simulator/SocialEngineeringSimulator.vue` (pass the prop; show a one-line reminder in `.soc-convo-head`)
- Modify: `client/src/games/social-engineering-simulator/sim.css` (`.soc-code` styling only)
- Test: `client/src/games/social-engineering-simulator/__tests__/components.test.js`, `.../session.test.js`

**Interfaces:**
- Consumes: Task 1 response field `resetCode`.
- Produces: `useSocialEngineeringSession().resetCode: Ref<string>` (empty string when absent). `ScenarioBrief` prop `resetCode: { type: String, default: '' }`. The code renders inside `<code data-testid="soc-reset-code">`, and only when non-empty.

- [ ] **Step 1: Write the failing tests**

```js
// components.test.js
it('shows the reset code in the brief when one is provided', () => {
  const wrapper = mount(ScenarioBrief, { props: { brief, persona, resetCode: 'SYNTH-RESET-4821' } })
  expect(wrapper.get('[data-testid="soc-reset-code"]').text()).toBe('SYNTH-RESET-4821')
})

it('renders the brief without a code when the server sends none', () => {
  const wrapper = mount(ScenarioBrief, { props: { brief, persona } })
  expect(wrapper.find('[data-testid="soc-reset-code"]').exists()).toBe(false)
})

// session.test.js
it('keeps the reset code from the start response and replaces it on restart', async () => {
  startSession
    .mockResolvedValueOnce({ ...session, resetCode: 'SYNTH-RESET-4821' })
    .mockResolvedValueOnce({ ...session, resetCode: 'SYNTH-RESET-7731' })
  const { game } = harness()
  await game.start()
  await flushPromises()
  expect(game.resetCode.value).toBe('SYNTH-RESET-4821')
  await game.reset()
  await flushPromises()
  expect(game.resetCode.value).toBe('SYNTH-RESET-7731')
})
```

Reuse the `brief` and `persona` fixtures already defined in `components.test.js`; if the names differ, use the file's own.

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm exec vitest run --project client client/src/games/social-engineering-simulator`
Expected: the three new tests FAIL.

- [ ] **Step 3: Implement**

- Composable: `const resetCode = ref('')`, `resetCode.value = data.resetCode ?? ''` in `start`, `resetCode.value = ''` in `clearState`, and include it in the returned object.
- `ScenarioBrief.vue`: add the prop and, below the objective, a labelled block ("Your reset code" plus the `<code>`), shown with `v-if="resetCode"`. The existing "on your screen" rule line stays as is.
- `SocialEngineeringSimulator.vue`: pass `:reset-code="resetCode"` to `ScenarioBrief` and show the same label and `<code data-testid="soc-reset-code-chat">` inside `.soc-convo-head`, hidden once `result` exists.
- `sim.css`: a `.soc-code` rule using existing `--game-*` variables, monospace, with a visible border so it does not rely on colour alone. No global selectors.

- [ ] **Step 4: Check other consumers of the `/session` response**

Run: `rg -n "social-engineering|openingMessage" tests/e2e`
Expected: any E2E mock of `/session` either tolerates a missing `resetCode` (it does, by design) or is updated to include one. Do not run E2E; note it as not run.

- [ ] **Step 5: Run client and server feature tests, lint, format**

Run: `pnpm exec vitest run --project client --project server client/src/games/social-engineering-simulator server/tests/unit/social-engineering-simulator`
Run: `pnpm exec eslint client/src/games/social-engineering-simulator server/src/modules/games/social-engineering-simulator && pnpm exec prettier --check client/src/games/social-engineering-simulator server/src/modules/games/social-engineering-simulator server/tests/unit`
Expected: all PASS, no lint or format errors.

- [ ] **Step 6: Look at it in a browser**

Start the app the way the README says, open `/games/social-engineering-simulator` at 375px and 1200px, and confirm the code is readable in the brief and the chat header and that another page shows no leaked styles. Report this as a manual check, not a test.

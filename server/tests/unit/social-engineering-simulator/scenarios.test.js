import { describe, expect, it } from 'vitest'
import {
  SCENARIOS,
  pickScenario,
  promptForTurn,
  publicBrief,
} from '../../../src/modules/games/social-engineering-simulator/scenarios.js'

describe('social-engineering scenarios', () => {
  it('ships the four starting personas with a private code and system prompt', () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        'it-helpdesk',
        'panicked-coworker',
        'exec-assistant',
        'vendor-support',
      ]),
    )
    for (const scenario of SCENARIOS) {
      expect(scenario.code).toMatch(/^SYNTH-RESET-\d{4}$/)
      expect(scenario.systemPrompt).toContain('fictional')
      expect(scenario.turnBudget).toBe(8)
    }
  })

  it('never exposes the code or the system prompt in the public brief', () => {
    for (const scenario of SCENARIOS) {
      const payload = JSON.stringify(publicBrief(scenario))
      expect(payload).not.toContain(scenario.code)
      expect(payload).not.toContain(scenario.systemPrompt)
      expect(payload).not.toMatch(/SYNTH-RESET-\d{4}/)
    }
  })

  it('picks a scenario with the injected random source', () => {
    const picked = pickScenario(() => 0)
    expect(SCENARIOS.map((scenario) => scenario.id)).toContain(picked.id)
    // a deterministic source gives a stable pick
    expect(pickScenario(() => 0).id).toBe(picked.id)
  })

  it('gives every persona the goal, a backstory and a prompt without the code', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.systemPrompt).toContain('YOUR GOAL')
      expect(scenario.systemPrompt).toContain('YOU ARE')
      expect(scenario.systemPrompt).not.toContain(scenario.code)
    }
  })

  it('shifts the stage guide as the conversation runs out of turns', () => {
    const [scenario] = SCENARIOS
    const stage = (turn) => promptForTurn(scenario, turn, 8).match(/STAGE: ([a-z ]+)\./)[1]
    expect(stage(0)).toBe('opening')
    expect(stage(3)).toBe('pressure')
    expect(stage(5)).toBe('escalation')
    expect(stage(7)).toBe('last attempt')
    expect(promptForTurn(scenario, 4, 8)).not.toContain(scenario.code)
  })

  it('picks the group first and then a scenario inside it', () => {
    const draws = (...values) => {
      const queue = [...values]
      return () => queue.shift() ?? 0
    }
    expect(pickScenario(draws(0.1, 0)).legitimate).toBe(true)
    expect(pickScenario(draws(0.9, 0)).legitimate).toBe(false)
    expect(pickScenario(draws(0.9, 0.999)).id).toBe(
      SCENARIOS.filter((scenario) => !scenario.legitimate).at(-1).id,
    )
  })

  it('never picks a legitimate scenario without a colleague', () => {
    for (const value of [0, 0.1, 0.34, 0.9]) {
      expect(pickScenario(() => value, { withColleague: false }).legitimate).toBe(false)
    }
  })

  it('keeps briefs, titles and openings free of answer-revealing words', () => {
    for (const scenario of SCENARIOS) {
      const text = [scenario.brief.title, scenario.brief.objective, scenario.opening].join(' ')
      expect(text).not.toMatch(/unsafe|protect|safe|legitimate|verify independently/i)
    }
  })

  it('keeps legitimacy and technique out of the public brief', () => {
    for (const scenario of SCENARIOS) {
      const view = publicBrief(scenario)
      expect(Object.keys(view)).not.toContain('legitimate')
      expect(Object.keys(view)).not.toContain('tactic')
      expect(JSON.stringify(view)).not.toContain(scenario.tactic)
    }
  })

  it('uses unique codes and ids across scenarios', () => {
    expect(new Set(SCENARIOS.map((scenario) => scenario.code)).size).toBe(SCENARIOS.length)
    expect(new Set(SCENARIOS.map((scenario) => scenario.id)).size).toBe(SCENARIOS.length)
  })

  it('shifts a legitimate persona through calm stages without escalation', () => {
    const legit = { ...SCENARIOS[0], legitimate: true }
    const stage = (turn) => promptForTurn(legit, turn, 8)
    expect(stage(0)).toMatch(/STAGE: opening\./)
    expect(stage(5)).not.toMatch(/guilt|escalation|consequences/i)
    expect(stage(7)).toMatch(/STAGE: last message\./)
  })
})

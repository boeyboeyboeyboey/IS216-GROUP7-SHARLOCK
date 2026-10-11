import { describe, expect, it } from 'vitest'
import {
  SCENARIOS,
  pickScenario,
  publicBrief,
} from '../../../src/modules/games/social-engineering-simulator/scenarios.js'

describe('social-engineering scenarios', () => {
  it('ships the four starting personas with a private code and system prompt', () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'it-helpdesk',
      'panicked-coworker',
      'exec-assistant',
      'vendor-support',
    ])
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
})

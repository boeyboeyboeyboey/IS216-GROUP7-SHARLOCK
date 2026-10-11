import { describe, expect, it, vi } from 'vitest'
import { createSocialEngineeringService } from '../../../src/modules/games/social-engineering-simulator/service.js'
import { SCENARIOS } from '../../../src/modules/games/social-engineering-simulator/scenarios.js'

// a stubbed adapter so the suite never makes a live llm call
function fakeAdapter(reply = 'Thanks, but could you just read me that code?') {
  return {
    configured: true,
    mode: 'local',
    chat: vi.fn(async () => ({ content: reply })),
  }
}

function makeService(adapter = fakeAdapter()) {
  return { service: createSocialEngineeringService({ adapter }), adapter }
}

function codeFor(start) {
  return SCENARIOS.find((scenario) => scenario.id === start.persona.id).code
}

describe('social-engineering service', () => {
  it('starts a run with a persona, brief and scripted opening but no secrets', () => {
    const { service } = makeService()
    const start = service.startSession()
    expect(start.sessionId).toMatch(/[0-9a-f-]{36}/)
    expect(start.persona.id).toBeTruthy()
    expect(start.brief.title).toBeTruthy()
    expect(start.openingMessage).toBeTruthy()
    const payload = JSON.stringify(start)
    expect(payload).not.toMatch(/SYNTH-RESET-\d{4}/)
    expect(payload).not.toContain('system')
  })

  it('refuses to start when the adapter is not configured', () => {
    const { service } = makeService({ configured: false, chat: vi.fn() })
    expect(() => service.startSession()).toThrow(/configured/i)
  })

  it('relays the colleague reply and counts turns while the budget holds', async () => {
    const { service, adapter } = makeService()
    const start = service.startSession()
    const result = await service.sendMessage(start.sessionId, 'Who is this exactly?')
    expect(adapter.chat).toHaveBeenCalledTimes(1)
    expect(result.reply).toBeTruthy()
    expect(result.turnsUsed).toBe(1)
    expect(result.leaked).toBe(false)
    expect(result.ended).toBe(false)
  })

  it('detects a leaked code, ends the run, and never forwards it to the model', async () => {
    const { service, adapter } = makeService()
    const start = service.startSession()
    const code = codeFor(start)
    // vary spacing to prove normalisation
    const result = await service.sendMessage(
      start.sessionId,
      `ok the code is ${code.toLowerCase()}`,
    )
    expect(result.leaked).toBe(true)
    expect(result.ended).toBe(true)
    expect(result.reply).toBeNull()
    expect(adapter.chat).not.toHaveBeenCalled()
    const scored = service.complete(start.sessionId, 'refuse')
    expect(scored.outcome).toBe('compromised')
    expect(scored.breakdown.find((item) => item.key === 'noLeak').points).toBe(0)
  })

  it('ends the run once the turn budget is reached', async () => {
    const { service } = makeService()
    const start = service.startSession()
    let last
    for (let turn = 0; turn < start.brief.turnBudget; turn += 1) {
      last = await service.sendMessage(start.sessionId, `message ${turn}`)
    }
    expect(last.turnsUsed).toBe(start.brief.turnBudget)
    expect(last.ended).toBe(true)
    await expect(service.sendMessage(start.sessionId, 'one more')).rejects.toThrow(
      /not found|ended/i,
    )
  })

  it('awards full marks for protecting the code and verifying independently', async () => {
    const { service } = makeService()
    const start = service.startSession()
    await service.sendMessage(start.sessionId, 'I will not share that.')
    const scored = service.complete(start.sessionId, 'verify-independently')
    expect(scored.score).toBe(100)
    expect(scored.outcome).toBe('resisted')
    expect(scored.maxScore).toBe(100)
    expect(scored.saved).toBe(false)
  })

  it('scores a refuse-only run as partial', async () => {
    const { service } = makeService()
    const start = service.startSession()
    await service.sendMessage(start.sessionId, 'No.')
    const scored = service.complete(start.sessionId, 'refuse')
    expect(scored.outcome).toBe('partial')
    expect(scored.score).toBe(75)
  })

  it('treats choosing share-code as a compromise even without typing it', () => {
    const { service } = makeService()
    const start = service.startSession()
    const scored = service.complete(start.sessionId, 'share-code')
    expect(scored.outcome).toBe('compromised')
    expect(scored.breakdown.find((item) => item.key === 'noLeak').points).toBe(0)
  })

  it('scales efficiency to a floor of zero beyond the budget', () => {
    const { service } = makeService()
    expect(
      service
        .scoreOutcome({ leaked: false, decision: 'refuse', turnsUsed: 8, turnBudget: 8 })
        .breakdown.find((item) => item.key === 'efficiency').points,
    ).toBe(15)
    expect(
      service
        .scoreOutcome({ leaked: false, decision: 'refuse', turnsUsed: 12, turnBudget: 8 })
        .breakdown.find((item) => item.key === 'efficiency').points,
    ).toBeLessThan(15)
    expect(
      service
        .scoreOutcome({ leaked: false, decision: 'refuse', turnsUsed: 100, turnBudget: 8 })
        .breakdown.find((item) => item.key === 'efficiency').points,
    ).toBe(0)
  })

  it('rejects messages and completion for an unknown session', async () => {
    const { service } = makeService()
    await expect(service.sendMessage('00000000-0000-0000-0000-000000000000', 'hi')).rejects.toThrow(
      /not found/i,
    )
    expect(() => service.complete('00000000-0000-0000-0000-000000000000', 'refuse')).toThrow(
      /not found/i,
    )
  })
})

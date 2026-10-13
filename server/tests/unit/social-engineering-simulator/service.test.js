import { describe, expect, it, vi } from 'vitest'
import { createSocialEngineeringService } from '../../../src/modules/games/social-engineering-simulator/service.js'
import { SCENARIOS } from '../../../src/modules/games/social-engineering-simulator/scenarios.js'
import { createChatSessionStore } from '../../../src/modules/games/social-engineering-simulator/llm/chatSessionStore.js'
import {
  COMPLETED_TTL_MS,
  MAX_COMPLETED,
} from '../../../src/modules/games/social-engineering-simulator/policy.js'

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
    expect(JSON.stringify(service.complete(start.sessionId, 'refuse'))).not.toContain(
      start.resetCode,
    )
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

  it('does not spend a turn or keep the message when the model call fails', async () => {
    const adapter = fakeAdapter()
    adapter.chat
      .mockResolvedValueOnce({ content: 'first' })
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce({ content: 'third' })
    const { service } = makeService(adapter)
    const start = service.startSession()

    expect((await service.sendMessage(start.sessionId, 'one')).turnsUsed).toBe(1)
    await expect(service.sendMessage(start.sessionId, 'two')).rejects.toThrow('upstream down')
    const retry = await service.sendMessage(start.sessionId, 'two')

    expect(retry.turnsUsed).toBe(2)
    const sent = adapter.chat.mock.calls.at(-1)[0].messages
    expect(sent.map((message) => message.role)).toEqual(['assistant', 'user', 'assistant', 'user'])
  })

  it('rejects an overlapping message while a reply is in flight', async () => {
    let release
    const adapter = {
      configured: true,
      mode: 'local',
      chat: vi.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ content: 'later' })
          }),
      ),
    }
    const { service } = makeService(adapter)
    const start = service.startSession()

    const first = service.sendMessage(start.sessionId, 'one')
    await expect(service.sendMessage(start.sessionId, codeFor(start))).rejects.toMatchObject({
      code: 'LLM_SESSION_BUSY',
      status: 409,
    })
    release()
    expect(await first).toMatchObject({ turnsUsed: 1, leaked: false })
    expect(adapter.chat).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['spaces', (code) => code.toLowerCase().replaceAll('-', ' ')],
    ['underscores', (code) => code.replaceAll('-', '_')],
    ['dots', (code) => code.toLowerCase().replaceAll('-', '.')],
    ['en dashes', (code) => code.replaceAll('-', '–')],
  ])('flags the code typed with %s and never forwards it', async (_label, reformat) => {
    const { service, adapter } = makeService()
    const start = service.startSession()
    const result = await service.sendMessage(
      start.sessionId,
      `fine, it is ${reformat(codeFor(start))}!`,
    )
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

  it('returns the first result when completion is repeated', () => {
    const { service } = makeService()
    const start = service.startSession()
    const first = service.complete(start.sessionId, 'verify-independently')
    const second = service.complete(start.sessionId, 'share-code')
    expect(second).toEqual(first)
    expect(second.outcome).toBe('resisted')
  })

  it('forgets a completed result after the replay window', () => {
    let clock = 0
    const service = createSocialEngineeringService({ adapter: fakeAdapter(), now: () => clock })
    const start = service.startSession()
    service.complete(start.sessionId, 'refuse')
    clock = COMPLETED_TTL_MS + 1
    expect(() => service.complete(start.sessionId, 'refuse')).toThrow(/not found/i)
  })

  it('keeps the completed-results map bounded', () => {
    const service = createSocialEngineeringService({ adapter: fakeAdapter() })
    const first = service.startSession()
    service.complete(first.sessionId, 'refuse')
    for (let index = 0; index < MAX_COMPLETED; index += 1) {
      service.complete(service.startSession().sessionId, 'refuse')
    }
    expect(() => service.complete(first.sessionId, 'refuse')).toThrow(/not found/i)
  })

  it('still scores a run that ended on a leak after another run starts', async () => {
    const { service } = makeService()
    const start = service.startSession()
    await service.sendMessage(start.sessionId, codeFor(start))

    service.startSession()

    expect(service.complete(start.sessionId, 'refuse').outcome).toBe('compromised')
  })

  it('drops metadata for sessions the transcript store has already expired', async () => {
    let clock = 0
    const store = createChatSessionStore({ idleTtlMs: 1000, now: () => clock })
    const service = createSocialEngineeringService({ adapter: fakeAdapter(), store })
    const stale = service.startSession()
    service.startSession()
    expect(service.sessionCount()).toBe(2)

    clock = 5000
    service.startSession()

    expect(service.sessionCount()).toBe(1)
    await expect(service.sendMessage(stale.sessionId, 'hello')).rejects.toMatchObject({
      code: 'LLM_SESSION_NOT_FOUND',
    })
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

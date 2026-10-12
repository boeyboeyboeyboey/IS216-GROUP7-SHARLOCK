import { describe, expect, it } from 'vitest'
import { formatCommand } from '../../../src/modules/games/cli-cyber-defender/parser.js'
import { CliError } from '../../../src/modules/games/cli-cyber-defender/policy.js'
import { SCENARIOS } from '../../../src/modules/games/cli-cyber-defender/scenarios.js'
import { createCliDefenderService } from '../../../src/modules/games/cli-cyber-defender/service.js'

const RUN_ID = '11111111-1111-4111-8111-111111111111'

// randomInt(n) => 0 keeps the scenario order and front-loads the 10-second windows
function setup(start = 1_000_000) {
  const clock = { now: start }
  const service = createCliDefenderService({
    now: () => clock.now,
    randomInt: () => 0,
    createId: () => RUN_ID,
  })
  return { clock, service }
}

let action = 0
const nextAction = () => `action-${String((action += 1)).padStart(4, '0')}`

function answerFor(snapshot) {
  const scenario = SCENARIOS.find((item) => item.alert.title === snapshot.current.alert.title)
  return formatCommand(scenario.expected.verb, scenario.expected.target)
}

function expectCliError(fn, code) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(CliError)
    expect(error.code).toBe(code)
    return error
  }
  throw new Error(`expected ${code}`)
}

describe('cli defender service', () => {
  it('starts a run with only the current alert and no answers', () => {
    const { service } = setup()
    const snapshot = service.startRun({ mode: 'timed' })
    expect(snapshot).toMatchObject({
      gameId: 'cli-cyber-defender',
      rulesetVersion: 'cli-1',
      runId: RUN_ID,
      mode: 'timed',
      status: 'active',
      incidentCount: 8,
      score: 0,
      maxScore: 2100,
      saved: false,
    })
    expect(snapshot.current).toMatchObject({ incidentId: 'incident-01', windowSeconds: 15 })
    const payload = JSON.stringify(snapshot)
    for (const scenario of SCENARIOS) {
      expect(payload).not.toContain(scenario.explanation)
      expect(payload).not.toContain('expected')
    }
  })

  it('plays a perfect timed shift to 2,100 and completes once', () => {
    const { clock, service } = setup()
    let snapshot = service.startRun({ mode: 'timed' })
    while (snapshot.current) {
      clock.now += 1000
      snapshot = service.submitCommand(RUN_ID, {
        actionId: nextAction(),
        incidentId: snapshot.current.incidentId,
        command: answerFor(snapshot).toUpperCase(),
      })
      expect(snapshot.outcome).toBe('correct')
    }
    expect(snapshot.score).toBe(2100)
    expect(snapshot.status).toBe('finished')
    const result = service.completeRun(RUN_ID, { actionId: nextAction() })
    expect(result).toMatchObject({ score: 2100, maxScore: 2100, saved: false, status: 'completed' })
    expect(result.result).toMatchObject({ correct: 8, wrong: 0, missed: 0, bestStreak: 8 })
    expect(result.debrief).toHaveLength(8)
    expect(result.debrief[0].expectedCommand).toBe(result.debrief[0].yourCommand)
    expect(result.topicOutcomes.every((topic) => topic.achieved)).toBe(true)
    const again = service.completeRun(RUN_ID, { actionId: nextAction() })
    expect(again.score).toBe(result.score)
    expectCliError(
      () =>
        service.submitCommand(RUN_ID, {
          actionId: nextAction(),
          incidentId: 'incident-08',
          command: 'block ip 192.0.2.1',
        }),
      'CLI_RUN_FINISHED',
    )
  })

  it('closes the incident on a wrong target and resets the streak', () => {
    const { clock, service } = setup()
    const started = service.startRun({ mode: 'timed' })
    const first = service.submitCommand(RUN_ID, {
      actionId: nextAction(),
      incidentId: 'incident-01',
      command: answerFor(started),
    })
    expect(first.outcome).toBe('correct')
    clock.now += 500
    const snapshot = service.submitCommand(RUN_ID, {
      actionId: nextAction(),
      incidentId: 'incident-02',
      command: 'isolate host not-the-host',
    })
    expect(snapshot).toMatchObject({ outcome: 'wrong', pointsAwarded: 0, streak: 0, score: 100 })
    expect(snapshot.current.incidentId).toBe('incident-03')
  })

  it('keeps the incident open after a syntax error', () => {
    const { service } = setup()
    service.startRun({ mode: 'timed' })
    const snapshot = service.submitCommand(RUN_ID, {
      actionId: nextAction(),
      incidentId: 'incident-01',
      command: 'blok ip 203.0.113.45',
    })
    expect(snapshot.outcome).toBe('syntax')
    expect(snapshot.message).toMatch(/not recognised/)
    expect(snapshot.current.incidentId).toBe('incident-01')
  })

  it('rejects a command that arrives at the deadline', () => {
    const { clock, service } = setup()
    const snapshot = service.startRun({ mode: 'timed' })
    clock.now = snapshot.current.closesAt
    expectCliError(
      () =>
        service.submitCommand(RUN_ID, {
          actionId: nextAction(),
          incidentId: 'incident-01',
          command: answerFor(snapshot),
        }),
      'CLI_INCIDENT_CLOSED',
    )
    const later = service.getRun(RUN_ID)
    expect(later.history[0]).toMatchObject({ incidentId: 'incident-01', outcome: 'missed' })
    expect(later.current.incidentId).toBe('incident-02')
  })

  it('accepts a command one millisecond before the deadline', () => {
    const { clock, service } = setup()
    const snapshot = service.startRun({ mode: 'timed' })
    clock.now = snapshot.current.closesAt - 1
    const result = service.submitCommand(RUN_ID, {
      actionId: nextAction(),
      incidentId: 'incident-01',
      command: answerFor(snapshot),
    })
    expect(result.outcome).toBe('correct')
  })

  it('replays a duplicate action and rejects a reused id with different input', () => {
    const { clock, service } = setup()
    const snapshot = service.startRun({ mode: 'timed' })
    const body = {
      actionId: 'retry-action-1',
      incidentId: 'incident-01',
      command: answerFor(snapshot),
    }
    const first = service.submitCommand(RUN_ID, body)
    clock.now += 2000
    const second = service.submitCommand(RUN_ID, body)
    expect(second).toEqual(first)
    expect(second.score).toBe(100)
    expectCliError(
      () => service.submitCommand(RUN_ID, { ...body, command: 'block ip 192.0.2.1' }),
      'CLI_ACTION_CONFLICT',
    )
  })

  it('refuses to complete a timed run early but lets practice end early', () => {
    const { service } = setup()
    service.startRun({ mode: 'timed' })
    expectCliError(
      () => service.completeRun(RUN_ID, { actionId: nextAction() }),
      'CLI_RUN_NOT_FINISHED',
    )
    const practice = setup()
    const snapshot = practice.service.startRun({ mode: 'practice' })
    expect(snapshot.current.closesAt).toBeNull()
    const result = practice.service.completeRun(RUN_ID, { actionId: nextAction() })
    expect(result.mode).toBe('practice')
    expect(result.result.skipped).toBe(8)
    expect(result.score).toBe(0)
  })

  it('finishes a timed run by expiry and reports every miss', () => {
    const { clock, service } = setup()
    service.startRun({ mode: 'timed' })
    clock.now += 100000
    expect(service.getRun(RUN_ID)).toMatchObject({ status: 'finished', current: null })
    const result = service.completeRun(RUN_ID, { actionId: nextAction() })
    expect(result.result.missed).toBe(8)
    expect(result.topicOutcomes.every((topic) => !topic.achieved)).toBe(true)
  })

  it('freezes the deadline while a timed shift is paused', () => {
    const { clock, service } = setup()
    const started = service.startRun({ mode: 'timed' })
    const remaining = started.current.closesAt - started.serverNow
    clock.now += 2000
    const paused = service.pauseRun(RUN_ID)
    expect(paused.paused).toBe(true)
    expect(paused.current.alert).toBeNull()
    // far longer than the whole shift passes while paused
    clock.now += 5 * 60 * 1000
    expect(service.getRun(RUN_ID)).toMatchObject({ paused: true, resolvedCount: 0 })
    expectCliError(
      () =>
        service.submitCommand(RUN_ID, {
          actionId: nextAction(),
          incidentId: 'incident-01',
          command: answerFor(started),
        }),
      'CLI_RUN_PAUSED',
    )
    const resumed = service.resumeRun(RUN_ID)
    expect(resumed.paused).toBe(false)
    expect(resumed.current.incidentId).toBe('incident-01')
    expect(resumed.current.alert.title).toBe(started.current.alert.title)
    expect(resumed.current.closesAt - resumed.serverNow).toBe(remaining - 2000)
    const result = service.submitCommand(RUN_ID, {
      actionId: nextAction(),
      incidentId: 'incident-01',
      command: answerFor(started),
    })
    expect(result.outcome).toBe('correct')
  })

  it('still expires the window after resuming', () => {
    const { clock, service } = setup()
    const started = service.startRun({ mode: 'timed' })
    service.pauseRun(RUN_ID)
    clock.now += 30000
    service.resumeRun(RUN_ID)
    clock.now += started.current.closesAt - started.serverNow
    expect(service.getRun(RUN_ID).history[0]).toMatchObject({ outcome: 'missed' })
  })

  it('treats repeated pause and resume as no-ops and refuses practice pauses', () => {
    const { clock, service } = setup()
    service.startRun({ mode: 'timed' })
    service.pauseRun(RUN_ID)
    clock.now += 1000
    service.pauseRun(RUN_ID)
    clock.now += 1000
    const resumed = service.resumeRun(RUN_ID)
    const again = service.resumeRun(RUN_ID)
    expect(again.serverNow).toBe(resumed.serverNow)
    expect(again.current.closesAt).toBe(resumed.current.closesAt)
    const practice = setup()
    practice.service.startRun({ mode: 'practice' })
    expectCliError(() => practice.service.pauseRun(RUN_ID), 'CLI_PAUSE_UNAVAILABLE')
  })

  it('forgets idle runs', () => {
    const { clock, service } = setup()
    service.startRun({ mode: 'practice' })
    clock.now += 10 * 60 * 1000 + 1
    expectCliError(() => service.getRun(RUN_ID), 'CLI_RUN_NOT_FOUND')
  })

  it('caps the number of commands per run', () => {
    const { service } = setup()
    service.startRun({ mode: 'practice' })
    for (let index = 0; index < 80; index += 1)
      service.submitCommand(RUN_ID, {
        actionId: nextAction(),
        incidentId: 'incident-01',
        command: 'help me',
      })
    expectCliError(
      () =>
        service.submitCommand(RUN_ID, {
          actionId: nextAction(),
          incidentId: 'incident-01',
          command: 'help me',
        }),
      'CLI_COMMAND_LIMIT',
    )
  })
})

describe('scenario integrity', () => {
  it('has a balanced pool of unique, answerable incidents', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(16)
    expect(new Set(SCENARIOS.map((item) => item.id)).size).toBe(SCENARIOS.length)
    expect(new Set(SCENARIOS.map((item) => item.alert.title)).size).toBe(SCENARIOS.length)
    for (const verb of ['block-ip', 'disable-user', 'isolate-host'])
      expect(SCENARIOS.filter((item) => item.expected.verb === verb).length).toBeGreaterThanOrEqual(
        5,
      )
    for (const scenario of SCENARIOS) {
      const command = formatCommand(scenario.expected.verb, scenario.expected.target)
      expect(scenario.alert.lines.join(' ')).toContain(scenario.expected.target)
      expect(command.length).toBeLessThanOrEqual(120)
      expect(scenario.explanation.length).toBeGreaterThan(20)
    }
  })

  it('only uses documentation or private address space', () => {
    const ips = SCENARIOS.flatMap(
      (item) => item.alert.lines.join(' ').match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? [],
    )
    for (const ip of ips) expect(ip).toMatch(/^(?:192\.0\.2\.|198\.51\.100\.|203\.0\.113\.|10\.)/)
  })
})

import { describe, expect, it } from 'vitest'
import { findLevel } from '../../../src/modules/games/clearance-tower/levels.js'
import { parseStart, parseSubmission } from '../../../src/modules/games/clearance-tower/policy.js'
import { createClearanceService } from '../../../src/modules/games/clearance-tower/service.js'
import { predictionList, SOLUTIONS } from './solutions.js'

const RUN_ID = '00000000-0000-4000-8000-000000000001'

function submission(levelId, overrides = {}) {
  const { policy, predictions } = SOLUTIONS[levelId]
  return {
    actionId: 'unit-action-01',
    policy,
    predictions: predictionList(predictions),
    ...overrides,
  }
}

function fieldErrorsOf(action) {
  try {
    action()
  } catch (error) {
    expect(error.code).toBe('CLEAR_INVALID_BODY')
    return error.fieldErrors
  }
  throw new Error('expected the input to be rejected')
}

describe('clearance tower validation', () => {
  it('accepts only a known level id', () => {
    expect(parseStart({ levelId: 'compartments' })).toEqual({ levelId: 'compartments' })
    expect(fieldErrorsOf(() => parseStart({ levelId: 'regex' }))).toMatchObject({
      levelId: expect.any(String),
    })
    expect(fieldErrorsOf(() => parseStart({ levelId: 'the-gift', score: 600 }))).toMatchObject({
      score: 'unsupported field',
    })
  })

  it('rejects an own __proto__ field instead of ignoring it', () => {
    const body = JSON.parse(
      `{"actionId":"unit-action-01","policy":{"grants":[]},"predictions":[],"__proto__":{"admin":true}}`,
    )
    const errors = fieldErrorsOf(() => parseSubmission(findLevel('the-matrix'), body))
    expect(Object.keys(errors)).toContain('__proto__')
  })

  it('rejects grants for unknown agents, duplicate pairs and unsupported rights', () => {
    const level = findLevel('the-matrix')
    const bad = [
      [{ subject: 'mallory', object: 'ops', rights: ['r'] }],
      [
        { subject: 'director', object: 'ops', rights: ['r'] },
        { subject: 'director', object: 'ops', rights: ['w'] },
      ],
      [{ subject: 'director', object: 'ops', rights: ['x'] }],
      [{ subject: 'director', object: 'ops', rights: ['r', 'r'] }],
    ]
    for (const grants of bad)
      expect(
        fieldErrorsOf(() =>
          parseSubmission(level, submission('the-matrix', { policy: { grants } })),
        ),
      ).toHaveProperty(['policy.grants'])
  })

  it('needs exactly one valid label for every file', () => {
    const level = findLevel('compartments')
    const { objectLabels } = SOLUTIONS.compartments.policy
    const missing = { ...objectLabels }
    delete missing.notice
    const unknownCategory = {
      ...objectLabels,
      notice: { level: 'secret', categories: ['finance'] },
    }
    for (const labels of [
      missing,
      unknownCategory,
      { ...objectLabels, extra: objectLabels.notice },
    ])
      expect(() =>
        parseSubmission(level, submission('compartments', { policy: { objectLabels: labels } })),
      ).toThrow(/could not be read/)
  })

  it('bounds roles and checks every assignment', () => {
    const level = findLevel('roles-not-people')
    const tooMany = Array.from({ length: 9 }, (_, index) => ({
      id: `role-${index}`,
      name: `Role ${index}`,
      permissions: [],
    }))
    const policies = [
      { roles: tooMany, assignments: [] },
      { roles: [{ id: 'r1', name: 'x'.repeat(25), permissions: [] }], assignments: [] },
      { roles: [{ id: 'r1', name: 'Ops', permissions: ['launch-missiles'] }], assignments: [] },
      { roles: [], assignments: [{ agent: 'ada', roleIds: ['ghost'] }] },
    ]
    for (const policy of policies)
      expect(() => parseSubmission(level, submission('roles-not-people', { policy }))).toThrow(
        /could not be read/,
      )
  })

  it('needs one allow or deny verdict per prompt', () => {
    const level = findLevel('the-matrix')
    for (const predictions of [
      [],
      [
        { id: 'p1', verdict: 'maybe' },
        { id: 'p2', verdict: 'deny' },
        { id: 'p3', verdict: 'allow' },
      ],
      [
        { id: 'p1', verdict: 'deny' },
        { id: 'p1', verdict: 'deny' },
        { id: 'p3', verdict: 'allow' },
      ],
    ])
      expect(
        fieldErrorsOf(() => parseSubmission(level, submission('the-matrix', { predictions }))),
      ).toHaveProperty('predictions')
  })
})

describe('clearance tower service', () => {
  function createService(clock = { now: 0 }) {
    let counter = 0
    const service = createClearanceService({
      now: () => clock.now,
      createId: () => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`,
    })
    return { service, clock }
  }

  it('lists six levels and starts an run with only public data', () => {
    const { service } = createService()
    expect(service.listLevels().levels).toHaveLength(6)
    const run = service.startRun({ levelId: 'the-gift' })
    expect(run).toMatchObject({ runId: RUN_ID, saved: false })
    expect(run.level.tasks.length).toBeGreaterThan(0)
    expect(JSON.stringify(run)).not.toContain('budget macro')
  })

  it('submits once, replays the same action and refuses a second policy', () => {
    const { service } = createService()
    const { runId } = service.startRun({ levelId: 'the-matrix' })
    const first = service.submitRun(runId, submission('the-matrix'))
    expect(first).toMatchObject({ score: 100, stars: 3, status: 'completed', saved: false })
    expect(service.submitRun(runId, submission('the-matrix'))).toBe(first)

    const changed = submission('the-matrix', { policy: { grants: [] } })
    expect(() => service.submitRun(runId, changed)).toThrow(/different choices/)
    expect(() =>
      service.submitRun(runId, submission('the-matrix', { actionId: 'unit-action-02' })),
    ).toThrow(/already ran its day/)
  })

  it('forgets idle runs', () => {
    const { service, clock } = createService()
    const { runId } = service.startRun({ levelId: 'the-matrix' })
    clock.now += 31 * 60 * 1000
    expect(() => service.submitRun(runId, submission('the-matrix'))).toThrow(/expired/)
  })

  it('keeps a bounded number of runs', () => {
    let counter = 0
    const service = createClearanceService({
      maxRuns: 2,
      createId: () => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`,
    })
    const first = service.startRun({ levelId: 'the-matrix' })
    service.startRun({ levelId: 'the-matrix' })
    service.startRun({ levelId: 'the-matrix' })
    expect(() => service.submitRun(first.runId, submission('the-matrix'))).toThrow(/expired/)
  })
})

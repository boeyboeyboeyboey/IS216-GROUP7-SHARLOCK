import { createConnection, Types } from 'mongoose'
import { afterAll, describe, expect, it } from 'vitest'
import { getRulesetModel } from '../../../src/modules/attempts/model.js'
import { AttemptError } from '../../../src/modules/attempts/policy.js'
import { createAttemptRegistry } from '../../../src/modules/attempts/registry.js'
import { parseVerdictAction } from '../../../src/modules/games/phishing-post-mortem/policy.js'
import { createPhishingRuleset } from '../../../src/modules/games/phishing-post-mortem/ruleset.js'
import { readAnswers, readCase } from './fixtures.js'

const now = new Date('2026-10-19T12:00:00Z')
const meta = (status = 'active') => ({
  now,
  startedAt: now,
  deadlineAt: null,
  mode: 'standard',
  status,
  context: { kind: 'personal', cohortId: null },
})

// the ruleset is exercised through the real registry so its shape matches the shared contract
function entry(random = () => 0) {
  return createAttemptRegistry([createPhishingRuleset({ random })]).getCurrent(
    'phishing-post-mortem',
  )
}

function startedState(ruleset = entry()) {
  return JSON.parse(JSON.stringify(ruleset.createState({ now, context: { kind: 'personal' } })))
}

const answers = readAnswers('case-01')
const content = readCase('case-01')
const correctVerdict = {
  selectedEmailId: answers.patientZeroId,
  evidenceIds: [...answers.evidenceIds],
}

describe('phishing saved-attempt ruleset', () => {
  it('registers as the current untimed standard ruleset', () => {
    const ruleset = entry()
    expect(ruleset.storageKey).toBe('phishing-post-mortem@phish-1')
    expect(ruleset.maxScore).toBe(100)
    expect(ruleset.maxActions).toBe(1)
    expect(ruleset.competitive).toBe(false)
    const created = startedState(ruleset)
    expect(created.mode).toBe('standard')
    expect(created.deadlineAt).toBeNull()
    expect(created.state.selectedEmailId).toBeNull()
    expect(created.state.emailOrder).toHaveLength(20)
  })

  it('serializes the case without any answer key before completion', () => {
    const ruleset = entry()
    const { state } = startedState(ruleset)
    const submitted = ruleset.applyAction(
      state,
      { type: 'submit-verdict', payload: correctVerdict },
      meta(),
    )
    for (const current of [state, submitted]) {
      const payload = JSON.stringify(ruleset.serializePublicState(current, meta()))
      expect(payload).not.toContain(answers.summary)
      expect(payload).not.toContain('patientZero')
      expect(payload).not.toContain('debrief')
      expect(answers.chain.some((step) => payload.includes(step))).toBe(false)
    }
    const shown = ruleset.serializePublicState(state, meta())
    expect(shown.emails.map((email) => email.id)).toEqual(state.emailOrder)
    expect(shown.verdict).toBeNull()
  })

  it('records one verdict, scores it on the server and reveals the debrief once completed', () => {
    const ruleset = entry()
    const { state } = startedState(ruleset)
    expect(ruleset.canComplete(state, meta())).toBe(false)
    expect(ruleset.summarize(state, meta()).score).toBe(0)

    const payload = ruleset.validateAction('submit-verdict', correctVerdict)
    const submitted = ruleset.applyAction(state, { type: 'submit-verdict', payload }, meta())
    expect(submitted.submittedAt).toBe(now.toISOString())
    expect(ruleset.canComplete(submitted, meta())).toBe(true)

    const summary = ruleset.summarize(submitted, meta())
    expect(summary.score).toBe(100)
    expect(summary.topicOutcomes.every((topic) => topic.achieved)).toBe(true)

    const finished = ruleset.serializePublicState(submitted, meta('completed'))
    expect(finished.verdict).toEqual(correctVerdict)
    expect(finished.outcome).toEqual({
      emailCorrect: true,
      correctEvidenceIds: answers.evidenceIds,
    })
    expect(finished.debrief.patientZero.id).toBe(answers.patientZeroId)
  })

  it('refuses a second verdict on the same attempt', () => {
    const ruleset = entry()
    const { state } = startedState(ruleset)
    const submitted = ruleset.applyAction(
      state,
      { type: 'submit-verdict', payload: correctVerdict },
      meta(),
    )
    expect(() =>
      ruleset.applyAction(submitted, { type: 'submit-verdict', payload: correctVerdict }, meta()),
    ).toThrow(expect.objectContaining({ code: 'PHISH_VERDICT_RECORDED', status: 409 }))
  })

  it('refuses a message or clue from outside the stored case', () => {
    const ruleset = entry()
    const { state } = startedState(ruleset)
    expect(() =>
      ruleset.applyAction(
        state,
        { type: 'submit-verdict', payload: { ...correctVerdict, selectedEmailId: 'zz99' } },
        meta(),
      ),
    ).toThrow(expect.objectContaining({ code: 'PHISH_UNKNOWN_SELECTION' }))
  })

  it('keeps the score at zero for a wrong accusation but still teaches the chain', () => {
    const ruleset = entry()
    const { state } = startedState(ruleset)
    const decoy = content.emails.find((email) => email.id !== answers.patientZeroId).id
    const submitted = ruleset.applyAction(
      state,
      {
        type: 'submit-verdict',
        payload: { selectedEmailId: decoy, evidenceIds: [...answers.evidenceIds] },
      },
      meta(),
    )
    expect(ruleset.summarize(submitted, meta()).score).toBe(0)
    const finished = ruleset.serializePublicState(submitted, meta('completed'))
    expect(finished.outcome.emailCorrect).toBe(false)
    expect(finished.debrief.chain.length).toBeGreaterThanOrEqual(5)
  })
})

describe('saved phishing state document', () => {
  const database = createConnection()
  afterAll(() => database.close())
  const registry = createAttemptRegistry([createPhishingRuleset({ random: () => 0 })])
  const Attempt = getRulesetModel(database, registry, registry.entries[0])
  const document = (state) =>
    new Attempt({
      playerId: new Types.ObjectId(),
      gameId: 'phishing-post-mortem',
      rulesetVersion: 'phish-1',
      rulesetKey: 'phishing-post-mortem@phish-1',
      context: { kind: 'personal', cohortId: null },
      mode: 'standard',
      competitiveEligible: false,
      status: 'active',
      startedAt: now,
      deadlineAt: null,
      completedAt: null,
      revision: 0,
      score: 0,
      maxScore: 100,
      topicOutcomes: [],
      feedbackJson: null,
      finalSnapshotJson: null,
      processedActions: [],
      state,
    })

  it('stores the started and submitted states under the strict shared schema', async () => {
    const ruleset = registry.entries[0]
    const { state } = startedState(ruleset)
    await expect(document(state).validate()).resolves.toBeUndefined()
    const submitted = ruleset.applyAction(
      state,
      { type: 'submit-verdict', payload: correctVerdict },
      meta(),
    )
    await expect(document(submitted).validate()).resolves.toBeUndefined()
  })

  it('rejects state fields outside the declared schema', () => {
    const { state } = startedState(registry.entries[0])
    const invalid = document({ ...state, patientZeroId: answers.patientZeroId })
    return expect(invalid.validate()).rejects.toHaveProperty('errors.state')
  })
})

describe('verdict action validation', () => {
  const code = (type, payload) => {
    try {
      parseVerdictAction(type, payload)
      return 'accepted'
    } catch (error) {
      return error instanceof AttemptError ? error.code : 'unexpected'
    }
  }

  it('accepts exactly one message and two different clues', () => {
    expect(parseVerdictAction('submit-verdict', correctVerdict)).toEqual(correctVerdict)
  })

  it.each([
    ['another action type', 'answer', correctVerdict],
    ['an unknown field', 'submit-verdict', { ...correctVerdict, score: 100 }],
    ['a missing message', 'submit-verdict', { evidenceIds: correctVerdict.evidenceIds }],
    ['one clue', 'submit-verdict', { ...correctVerdict, evidenceIds: ['ev-a'] }],
    ['three clues', 'submit-verdict', { ...correctVerdict, evidenceIds: ['a', 'b', 'c'] }],
    ['a repeated clue', 'submit-verdict', { ...correctVerdict, evidenceIds: ['ev-a', 'ev-a'] }],
    ['a non-string message', 'submit-verdict', { ...correctVerdict, selectedEmailId: 7 }],
    ['an unsafe identifier', 'submit-verdict', { ...correctVerdict, selectedEmailId: 'A11$' }],
  ])('rejects %s', (_label, type, payload) => {
    expect(code(type, payload)).toBe('ATTEMPT_INVALID_REQUEST')
  })
})

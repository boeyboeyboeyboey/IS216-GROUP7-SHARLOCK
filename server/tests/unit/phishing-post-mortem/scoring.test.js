import { describe, expect, it } from 'vitest'
import {
  CASE_IDS,
  createPhishingService,
} from '../../../src/modules/games/phishing-post-mortem/service.js'
import { readAnswers, readCase } from './fixtures.js'

const service = (random = () => 0) => createPhishingService({ random })
const action = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

describe.each(CASE_IDS)('scoring %s', (caseId) => {
  const content = readCase(caseId)
  const answers = readAnswers(caseId)
  const wrongEmail = content.emails.find((email) => email.id !== answers.patientZeroId).id
  const distractors = content.evidenceOptions
    .map((option) => option.id)
    .filter((id) => !answers.evidenceIds.includes(id))
  const verdict = (selectedEmailId, evidenceIds) =>
    service().scoreVerdict({
      caseId,
      datasetVersion: content.datasetVersion,
      actionId: action,
      selectedEmailId,
      evidenceIds,
    })

  it('awards 60 for the email and 20 for each supporting clue', () => {
    expect(verdict(answers.patientZeroId, answers.evidenceIds).score).toBe(100)
    expect(verdict(answers.patientZeroId, [answers.evidenceIds[0], distractors[0]]).score).toBe(80)
    expect(verdict(answers.patientZeroId, distractors.slice(0, 2)).score).toBe(60)
  })

  it('scores nothing when the accused email is wrong, even with both correct clues', () => {
    const result = verdict(wrongEmail, answers.evidenceIds)
    expect(result.score).toBe(0)
    expect(result.result.emailCorrect).toBe(false)
    expect(result.topicOutcomes.every((topic) => !topic.achieved)).toBe(true)
  })

  it('reports topic outcomes for a complete verdict', () => {
    const result = verdict(answers.patientZeroId, answers.evidenceIds)
    expect(result.topicOutcomes).toHaveLength(3)
    expect(result.topicOutcomes.every((topic) => topic.achieved)).toBe(true)
    expect(result.status).toBe('completed')
    expect(result.persisted).toBe(false)
    expect(result.actionId).toBe(action)
    expect(result.rulesetVersion).toBe('phish-1')
  })

  it('always teaches the chain, including after a wrong verdict', () => {
    const result = verdict(wrongEmail, distractors.slice(0, 2))
    expect(result.debrief.patientZero.id).toBe(answers.patientZeroId)
    expect(result.debrief.chain.length).toBeGreaterThanOrEqual(5)
    expect(result.debrief.evidence.filter((item) => item.correct)).toHaveLength(2)
    expect(result.debrief.decoys.every((decoy) => decoy.subject)).toBe(true)
  })

  it('refuses selections that do not belong to the case', () => {
    expect(() => verdict('zz99', answers.evidenceIds)).toThrow(/PHISH_UNKNOWN_SELECTION|selection/)
    expect(() => verdict(answers.patientZeroId, [answers.evidenceIds[0], 'ev-invented'])).toThrow()
  })

  it('refuses a stale dataset version', () => {
    expect(() =>
      service().scoreVerdict({
        caseId,
        datasetVersion: '1999-01-01',
        actionId: action,
        selectedEmailId: answers.patientZeroId,
        evidenceIds: answers.evidenceIds,
      }),
    ).toThrow()
  })
})

describe('case delivery', () => {
  it('never ships the answer key with the case', () => {
    for (const caseId of CASE_IDS) {
      const answers = readAnswers(caseId)
      const payload = JSON.stringify(
        service().startCase({ after: caseId === 'case-01' ? 'case-02' : 'case-01' }),
      )
      expect(payload).not.toContain('patientZeroId')
      expect(payload).not.toContain(answers.summary)
      expect(answers.chain.some((step) => payload.includes(step))).toBe(false)
    }
  })

  it('rotates to the other case on replay', () => {
    expect(service().startCase({ after: 'case-01' }).caseId).toBe('case-02')
    expect(service().startCase({ after: 'case-02' }).caseId).toBe('case-01')
  })

  it('varies the inbox order without losing or inventing messages', () => {
    const first = service(() => 0.1).startCase({ after: 'case-02' })
    const second = service(() => 0.9).startCase({ after: 'case-02' })
    const ids = (edition) => edition.emails.map((email) => email.id)
    expect(ids(first)).not.toEqual(ids(second))
    expect([...ids(first)].sort()).toEqual([...ids(second)].sort())
    expect(first.emails).toHaveLength(20)
  })

  it('rejects an unknown case', () => {
    expect(() =>
      service().scoreVerdict({
        caseId: 'case-99',
        datasetVersion: '2026-09-21',
        actionId: action,
        selectedEmailId: 'a11',
        evidenceIds: ['ev-lookalike-domain', 'ev-click-then-credentials'],
      }),
    ).toThrow()
  })
})

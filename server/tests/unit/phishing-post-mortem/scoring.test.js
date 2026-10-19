import { describe, expect, it } from 'vitest'
import {
  CASE_IDS,
  createCaseLibrary,
} from '../../../src/modules/games/phishing-post-mortem/service.js'
import { readAnswers, readCase } from './fixtures.js'

const library = (random = () => 0) => createCaseLibrary({ random })

describe.each(CASE_IDS)('scoring %s', (caseId) => {
  const content = readCase(caseId)
  const answers = readAnswers(caseId)
  const wrongEmail = content.emails.find((email) => email.id !== answers.patientZeroId).id
  const distractors = content.evidenceOptions
    .map((option) => option.id)
    .filter((id) => !answers.evidenceIds.includes(id))
  const verdict = (selectedEmailId, evidenceIds) =>
    library().scoreVerdict({ caseId, selectedEmailId, evidenceIds })

  it('awards 60 for the email and 20 for each supporting clue', () => {
    expect(verdict(answers.patientZeroId, answers.evidenceIds).score).toBe(100)
    expect(verdict(answers.patientZeroId, [answers.evidenceIds[0], distractors[0]]).score).toBe(80)
    expect(verdict(answers.patientZeroId, distractors.slice(0, 2)).score).toBe(60)
  })

  it('scores nothing when the accused email is wrong, even with both correct clues', () => {
    const result = verdict(wrongEmail, answers.evidenceIds)
    expect(result.score).toBe(0)
    expect(result.emailCorrect).toBe(false)
    expect(result.topicOutcomes.every((topic) => !topic.achieved)).toBe(true)
  })

  it('reports topic outcomes for a complete verdict', () => {
    const result = verdict(answers.patientZeroId, answers.evidenceIds)
    expect(result.topicOutcomes).toHaveLength(3)
    expect(result.topicOutcomes.every((topic) => topic.achieved)).toBe(true)
    expect(result.feedback.verdictCode).toBe('PHISH_VERDICT_CORRECT')
  })

  it('always teaches the chain, including after a wrong verdict', () => {
    const debrief = library().debrief({ caseId, evidenceIds: distractors.slice(0, 2) })
    expect(debrief.patientZero.id).toBe(answers.patientZeroId)
    expect(debrief.chain.length).toBeGreaterThanOrEqual(5)
    expect(debrief.evidence.filter((item) => item.correct)).toHaveLength(2)
    expect(debrief.evidence.filter((item) => item.selected)).toHaveLength(2)
    expect(debrief.decoys.every((decoy) => decoy.subject)).toBe(true)
  })

  it('refuses selections that do not belong to the case', () => {
    const state = { caseId, datasetVersion: content.datasetVersion }
    expect(() =>
      library().assertSelection(state, {
        selectedEmailId: 'zz99',
        evidenceIds: answers.evidenceIds,
      }),
    ).toThrow(expect.objectContaining({ code: 'PHISH_UNKNOWN_SELECTION', status: 400 }))
    expect(() =>
      library().assertSelection(state, {
        selectedEmailId: answers.patientZeroId,
        evidenceIds: [answers.evidenceIds[0], 'ev-invented'],
      }),
    ).toThrow(expect.objectContaining({ code: 'PHISH_UNKNOWN_SELECTION' }))
  })

  it('refuses a stale dataset version', () => {
    expect(() =>
      library().assertSelection(
        { caseId, datasetVersion: '1999-01-01' },
        { selectedEmailId: answers.patientZeroId, evidenceIds: answers.evidenceIds },
      ),
    ).toThrow(expect.objectContaining({ code: 'PHISH_DATASET_CHANGED', status: 409 }))
  })
})

describe('case delivery', () => {
  it('never ships the answer key with the public case', () => {
    for (const caseId of CASE_IDS) {
      const answers = readAnswers(caseId)
      const content = readCase(caseId)
      const payload = JSON.stringify(
        library().publicCase({ caseId, emailOrder: content.emails.map((email) => email.id) }),
      )
      expect(payload).not.toContain('patientZeroId')
      expect(payload).not.toContain(answers.summary)
      expect(answers.chain.some((step) => payload.includes(step))).toBe(false)
    }
  })

  it('opens each authored case from the injected random source', () => {
    expect(library(() => 0).openCase().caseId).toBe('case-01')
    expect(library(() => 0.99).openCase().caseId).toBe('case-02')
  })

  it('varies the inbox order without losing or inventing messages', () => {
    const first = library(() => 0.1).openCase()
    const second = library(() => 0.9).openCase()
    expect(first.emailOrder).toHaveLength(20)
    expect(first.emailOrder).not.toEqual(readCase(first.caseId).emails.map((email) => email.id))
    expect([...first.emailOrder].sort()).toEqual(
      readCase(first.caseId)
        .emails.map((email) => email.id)
        .sort(),
    )
    expect(second.emailOrder).toHaveLength(20)
  })

  it('shows emails in the stored order', () => {
    const opened = library(() => 0.3).openCase()
    const shown = library().publicCase(opened)
    expect(shown.emails.map((email) => email.id)).toEqual(opened.emailOrder)
  })

  it('rejects an unknown case', () => {
    expect(() => library().publicCase({ caseId: 'case-99', emailOrder: [] })).toThrow(
      expect.objectContaining({ code: 'PHISH_CASE_UNAVAILABLE' }),
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  parseCaseQuery,
  parseVerdict,
  PhishingError,
} from '../../../src/modules/games/phishing-post-mortem/policy.js'

const valid = {
  caseId: 'case-01',
  datasetVersion: '2026-09-21',
  actionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  selectedEmailId: 'a11',
  evidenceIds: ['ev-lookalike-domain', 'ev-click-then-credentials'],
}
const code = (body) => {
  try {
    parseVerdict(body)
    return 'accepted'
  } catch (error) {
    return error instanceof PhishingError ? error.code : 'unexpected'
  }
}

describe('phishing verdict validation', () => {
  it('accepts exactly the supported fields', () => {
    expect(parseVerdict(valid)).toEqual(valid)
  })

  it.each([
    ['unknown field', { ...valid, score: 100 }],
    ['missing action id', { ...valid, actionId: undefined }],
    ['one evidence id', { ...valid, evidenceIds: ['ev-lookalike-domain'] }],
    ['three evidence ids', { ...valid, evidenceIds: [...valid.evidenceIds, 'ev-urgent-language'] }],
    ['duplicate evidence ids', { ...valid, evidenceIds: ['ev-x', 'ev-x'] }],
    ['evidence that is not an array', { ...valid, evidenceIds: 'ev-lookalike-domain' }],
    ['a traversal style case id', { ...valid, caseId: '../answers/case-01' }],
    ['a malformed dataset version', { ...valid, datasetVersion: 'latest' }],
    ['a non-object body', null],
    ['an array body', []],
  ])('rejects %s', (_label, body) => {
    expect(code(body)).toBe('PHISH_INVALID_REQUEST')
  })

  it('reports the offending field without leaking internals', () => {
    try {
      parseVerdict({ ...valid, evidenceIds: [] })
    } catch (error) {
      expect(error.status).toBe(400)
      expect(error.fieldErrors).toHaveProperty('evidenceIds')
      expect(error.message).not.toMatch(/case-0|patientZero/)
    }
  })

  it('rejects an own __proto__ field from parsed JSON', () => {
    const body = JSON.parse(
      '{"caseId":"case-01","datasetVersion":"2026-09-21","actionId":"f47ac10b-58cc-4372-a567-0e02b2c3d479","selectedEmailId":"a11","evidenceIds":["ev-lookalike-domain","ev-click-then-credentials"],"__proto__":"unsupported"}',
    )
    let error
    try {
      parseVerdict(body)
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(PhishingError)
    expect(error.code).toBe('PHISH_INVALID_REQUEST')
    expect(Object.hasOwn(error.fieldErrors, '__proto__')).toBe(true)
    expect(error.fieldErrors['__proto__']).toBe('unsupported field')
  })
})

describe('phishing case query', () => {
  it('defaults to no previous case and accepts a valid one', () => {
    expect(parseCaseQuery({})).toEqual({ after: null })
    expect(parseCaseQuery({ after: 'case-02' })).toEqual({ after: 'case-02' })
  })

  it('rejects unsupported and repeated parameters', () => {
    expect(() => parseCaseQuery({ caseId: 'case-01' })).toThrow(PhishingError)
    expect(() => parseCaseQuery({ after: ['case-01', 'case-02'] })).toThrow(PhishingError)
    expect(() => parseCaseQuery({ after: 'case-99x' })).toThrow(PhishingError)
  })
})

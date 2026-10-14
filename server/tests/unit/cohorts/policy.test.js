import { describe, expect, it } from 'vitest'
import {
  CohortError,
  parseListQuery,
  parseObjectId,
  parsePagination,
  parseRequestedContext,
} from '../../../src/modules/cohorts/policy.js'

const cohortId = '0123456789abcdef01234567'

describe('cohort request policy', () => {
  it('applies bounded numeric pagination defaults and calculates skip', () => {
    expect(parsePagination()).toEqual({ page: 1, limit: 20, skip: 0 })
    expect(parsePagination({ page: 3, limit: 5 })).toEqual({ page: 3, limit: 5, skip: 10 })
    expect(parsePagination({ page: 10000, limit: 50 }).skip).toBe(499950)
  })

  it.each([
    ['string page', { page: '2' }],
    ['fractional page', { page: 1.5 }],
    ['zero page', { page: 0 }],
    ['too-large page', { page: 10001 }],
    ['unsafe page', { page: Number.MAX_SAFE_INTEGER + 1 }],
    ['infinite page', { page: Infinity }],
    ['fractional limit', { limit: 1.5 }],
    ['zero limit', { limit: 0 }],
    ['too-large limit', { limit: 51 }],
    ['null page', { page: null }],
  ])('rejects %s in numeric pagination', (_label, input) => {
    expect(() => parsePagination(input)).toThrow(CohortError)
  })

  it('applies bounded list defaults and accepts decimal pagination', () => {
    expect(parseListQuery({})).toEqual({ page: 1, limit: 20 })
    expect(parseListQuery({ page: '0002', limit: '50' })).toEqual({ page: 2, limit: 50 })
    expect(parseListQuery({ page: '10000', limit: '1' })).toEqual({ page: 10000, limit: 1 })
  })

  it.each([
    ['unknown', { offset: '1' }],
    ['repeated page', { page: ['1', '2'] }],
    ['object page', { page: { value: '1' } }],
    ['zero page', { page: '0' }],
    ['signed page', { page: '+1' }],
    ['fractional page', { page: '1.5' }],
    ['exponential page', { page: '1e2' }],
    ['too-large page', { page: '10001' }],
    ['too-large limit', { limit: '51' }],
    ['prototype key', JSON.parse('{"__proto__":"x"}')],
    ['constructor key', JSON.parse('{"constructor":"x"}')],
  ])('rejects %s list query fields', (_label, query) => {
    expect(() => parseListQuery(query)).toThrow(CohortError)
  })

  it('accepts only canonical 24-hex ObjectId values and returns lowercase', () => {
    expect(parseObjectId('ABCDEF0123456789ABCDEF01')).toBe('abcdef0123456789abcdef01')
    for (const value of ['', '123', 'zz3456789abcdef012345678', 123, null, [], { id: cohortId }]) {
      expect(() => parseObjectId(value)).toThrow(CohortError)
    }
  })

  it('normalizes personal context and accepts a valid cohort context', () => {
    expect(parseRequestedContext({ kind: 'personal' })).toEqual({
      kind: 'personal',
      cohortId: null,
    })
    expect(parseRequestedContext({ kind: 'personal', cohortId: null })).toEqual({
      kind: 'personal',
      cohortId: null,
    })
    expect(parseRequestedContext({ kind: 'cohort', cohortId: cohortId.toUpperCase() })).toEqual({
      kind: 'cohort',
      cohortId,
    })
  })

  it.each([
    ['non-object', null],
    ['array', []],
    ['missing kind', { cohortId }],
    ['unknown kind', { kind: 'institution', cohortId }],
    ['personal with cohort', { kind: 'personal', cohortId }],
    ['cohort without id', { kind: 'cohort' }],
    ['cohort with invalid id', { kind: 'cohort', cohortId: 'invalid' }],
    ['extra field', { kind: 'personal', role: 'admin' }],
    ['prototype field', JSON.parse('{"kind":"personal","__proto__":{}}')],
  ])('rejects %s context input', (_label, input) => {
    expect(() => parseRequestedContext(input)).toThrow(CohortError)
  })
})

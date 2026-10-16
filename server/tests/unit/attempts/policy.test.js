import { describe, expect, it } from 'vitest'
import {
  AttemptError,
  MAX_INPUT_BYTES,
  MAX_PUBLIC_JSON_BYTES,
  assertEmptyQuery,
  assertJsonValue,
  encodePublicJson,
  parseActionInput,
  parseAttemptId,
  parseCompleteInput,
  parseCreateInput,
  parseGameId,
  stableRequestHash,
} from '../../../src/modules/attempts/policy.js'

const actionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const cohortId = '0123456789abcdef01234567'

describe('attempt request policy', () => {
  it('normalizes the exact create context and rejects extra fields', () => {
    expect(
      parseCreateInput({ context: { kind: 'cohort', cohortId: cohortId.toUpperCase() } }),
    ).toEqual({
      context: { kind: 'cohort', cohortId },
    })
    expect(parseCreateInput({ context: { kind: 'personal' } })).toEqual({
      context: { kind: 'personal', cohortId: null },
    })
    expect(() => parseCreateInput({ context: { kind: 'personal' }, mode: 'standard' })).toThrow(
      AttemptError,
    )
    expect(() => parseCreateInput({ context: { kind: 'personal', cohortId } })).toThrow(
      AttemptError,
    )
  })

  it('accepts bounded action and completion records with lowercase UUIDs', () => {
    const action = {
      actionId,
      expectedRevision: Number.MAX_SAFE_INTEGER - 1,
      type: 'submit-verdict',
      payload: { emailId: 'message-1', evidenceIds: ['header', 'reply-to'] },
    }
    expect(parseActionInput(action)).toEqual(action)
    expect(parseCompleteInput({ actionId, expectedRevision: 0 })).toEqual({
      actionId,
      expectedRevision: 0,
    })
    expect(parseActionInput({ ...action, actionId: actionId.toUpperCase() }).actionId).toBe(
      actionId,
    )
    expect(() =>
      parseActionInput({ ...action, expectedRevision: Number.MAX_SAFE_INTEGER }),
    ).toThrow(AttemptError)
    expect(() => parseActionInput({ ...action, type: 'SubmitVerdict' })).toThrow(AttemptError)
    expect(() => parseCompleteInput({ actionId, expectedRevision: -1 })).toThrow(AttemptError)
  })

  it.each([
    ['root array payload', []],
    ['nested prototype key', JSON.parse('{"constructor":"x"}')],
    ['mongo operator', JSON.parse('{"$where":"x"}')],
    ['dotted key', { 'state.phase': 'x' }],
    ['function', { value: () => true }],
    ['date', { value: new Date() }],
    ['non-finite number', { value: Number.POSITIVE_INFINITY }],
    ['undefined field', { value: undefined }],
  ])('rejects %s action payloads', (_label, payload) => {
    expect(() =>
      parseActionInput({ actionId, expectedRevision: 0, type: 'submit', payload }),
    ).toThrow(AttemptError)
  })

  it('rejects oversized and deeply nested transport inputs', () => {
    const largePayload = { value: 'x'.repeat(MAX_INPUT_BYTES) }
    expect(() =>
      parseActionInput({ actionId, expectedRevision: 0, type: 'submit', payload: largePayload }),
    ).toThrow(AttemptError)

    let nested = 'end'
    for (let depth = 0; depth < 13; depth += 1) nested = { next: nested }
    expect(() =>
      parseActionInput({ actionId, expectedRevision: 0, type: 'submit', payload: { nested } }),
    ).toThrow(AttemptError)

    const manyNodes = { values: Array.from({ length: 2000 }, () => 1) }
    expect(() =>
      parseActionInput({ actionId, expectedRevision: 0, type: 'submit', payload: manyNodes }),
    ).toThrow(AttemptError)
  })

  it('validates attempt, game and empty-query identifiers', () => {
    expect(parseAttemptId('0123456789abcdef01234567')).toBe('0123456789abcdef01234567')
    expect(parseAttemptId('0123456789ABCDEF01234567')).toBe('0123456789abcdef01234567')
    expect(parseGameId('phishing-post-mortem')).toBe('phishing-post-mortem')
    assertEmptyQuery(Object.create(null))
    for (const value of ['short', {}, null]) {
      expect(() => parseAttemptId(value)).toThrow(AttemptError)
    }
    for (const value of ['Upper', 'two--hyphens', 'a'.repeat(81), '']) {
      expect(() => parseGameId(value)).toThrow(AttemptError)
    }
    expect(() => assertEmptyQuery({ page: '1' })).toThrow(AttemptError)
  })

  it('hashes sorted object keys while preserving array order', () => {
    expect(stableRequestHash({ b: [1, 2], a: { y: true, x: null } })).toBe(
      stableRequestHash({ a: { x: null, y: true }, b: [1, 2] }),
    )
    expect(stableRequestHash({ items: ['a', 'b'] })).not.toBe(
      stableRequestHash({ items: ['b', 'a'] }),
    )
    expect(() => stableRequestHash({ value: new Date() })).toThrow(TypeError)
    expect(() => stableRequestHash(JSON.parse('{"$where":"x"}'))).toThrow(TypeError)
    const cyclic = {}
    cyclic.self = cyclic
    expect(() => stableRequestHash(cyclic)).toThrow(TypeError)
  })

  it('encodes public JSON canonically and enforces its byte limit', () => {
    expect(encodePublicJson({ z: 1, a: ['x', true] })).toBe('{"a":["x",true],"z":1}')
    expect(() => encodePublicJson({ value: 'x'.repeat(MAX_PUBLIC_JSON_BYTES) })).toThrow(TypeError)
    expect(() => assertJsonValue([], { rootRecord: true })).toThrow(TypeError)
  })
})

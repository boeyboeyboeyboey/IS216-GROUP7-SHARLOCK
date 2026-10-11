import { describe, expect, it } from 'vitest'
import {
  parseComplete,
  parseMessage,
  parseStart,
} from '../../../src/modules/games/social-engineering-simulator/policy.js'

const SESSION = '11111111-1111-1111-1111-111111111111'

describe('social-engineering policy validators', () => {
  it('accepts an empty start body and rejects unexpected fields', () => {
    expect(parseStart({})).toEqual({})
    expect(parseStart(undefined)).toEqual({})
    expect(() => parseStart({ persona: 'it-helpdesk' })).toThrow(/SOC_INVALID_BODY|request/)
  })

  it('validates a message body', () => {
    expect(parseMessage({ sessionId: SESSION, content: 'hello' })).toEqual({
      sessionId: SESSION,
      content: 'hello',
    })
    expect(() => parseMessage({ sessionId: 'nope', content: 'hi' })).toThrow()
    expect(() => parseMessage({ sessionId: SESSION, content: '   ' })).toThrow()
    expect(() => parseMessage({ sessionId: SESSION, content: 'x'.repeat(1001) })).toThrow()
    expect(() => parseMessage({ sessionId: SESSION, content: 'hi', extra: 1 })).toThrow()
  })

  it('validates a completion decision against the allowed set', () => {
    expect(parseComplete({ sessionId: SESSION, decision: 'verify-independently' })).toEqual({
      sessionId: SESSION,
      decision: 'verify-independently',
    })
    expect(() => parseComplete({ sessionId: SESSION, decision: 'maybe' })).toThrow()
    expect(() => parseComplete({ sessionId: SESSION })).toThrow()
  })
})

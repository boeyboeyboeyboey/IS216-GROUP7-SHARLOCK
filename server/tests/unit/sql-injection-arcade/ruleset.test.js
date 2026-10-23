import { describe, expect, it } from 'vitest'
import {
  evaluatePayload,
  evaluateLogin,
} from '../../../src/modules/games/sql-injection-arcade/parser.js'
import { sqlRuleset } from '../../../src/modules/games/sql-injection-arcade/ruleset.js'
import { createProductionAttemptRegistry } from '../../../src/modules/attempts/production-registry.js'

describe('bounded SQL teaching parser', () => {
  it.each([
    ["' OR 1=1 --", 'BYPASS'],
    ["' or 'yes' = 'yes' --", 'BYPASS'],
    ["guest'\tOr\t7 = 7\t--", 'BYPASS'],
    ["' OR 1=2 --", 'FALSE_EQUALITY'],
    ["' OR 'OR 1=1'='no' --", 'FALSE_EQUALITY'],
    ['OR 1=1 --', 'NO_BREAKOUT'],
    ["' OR 1=1; DROP TABLE users; --", 'UNSUPPORTED'],
    ["' OR 1=1 -- DROP TABLE users", 'UNSUPPORTED'],
    ["' OR 'broken=1 --", 'UNSUPPORTED'],
    ["' OR '1'=1 --", 'UNSUPPORTED'],
    ["' OR 1=1", 'UNSUPPORTED'],
    ["' OR " + '1='.repeat(40), 'UNSUPPORTED'],
    ['a'.repeat(121), 'UNSUPPORTED'],
  ])('evaluates %j as %s', (input, expected) => expect(evaluatePayload(input)).toBe(expected))
  it('handles either fictional field without authenticating', () => {
    expect(evaluateLogin('guest', "' OR 1=1 --")).toBe('BYPASS')
    expect(evaluateLogin("' OR 1=1 --", "malformed'")).toBe('UNSUPPORTED')
  })
})

describe('SQL rules and private state', () => {
  it('registers strict bounded state and awards 80 plus 20 only on the server', () => {
    expect(createProductionAttemptRegistry().getCurrent(sqlRuleset.id).rulesetVersion).toBe('sql-1')
    let { state, mode, deadlineAt } = sqlRuleset.createState()
    expect(mode).toBe('practice')
    expect(deadlineAt).toBeNull()
    const payload = sqlRuleset.validateAction('test-payload', {
      username: "' OR 1=1 --",
      password: 'never-save-this',
    })
    state = sqlRuleset.applyAction(state, { type: 'test-payload', payload })
    expect(sqlRuleset.summarize(state).score).toBe(80)
    expect(JSON.stringify(state)).not.toContain('never-save-this')
    expect(sqlRuleset.serializePublicState(state)).not.toHaveProperty('repairOptionId')
    expect(sqlRuleset.canComplete(state)).toBe(false)
    state = sqlRuleset.applyAction(state, { type: 'select-repair', payload: { optionId: 'bind' } })
    expect(sqlRuleset.canComplete(state)).toBe(true)
    expect(sqlRuleset.summarize(state).score).toBe(100)
    expect(() =>
      sqlRuleset.applyAction(state, { type: 'select-repair', payload: { optionId: 'strip' } }),
    ).toThrow()
  })
  it('counts unsupported tests, enforces phases and offers repair after exhaustion', () => {
    let { state } = sqlRuleset.createState()
    const repair = { type: 'select-repair', payload: { optionId: 'strip' } }
    expect(() => sqlRuleset.applyAction(state, repair)).toThrow()
    for (let index = 0; index < 5; index++)
      state = sqlRuleset.applyAction(state, {
        type: 'test-payload',
        payload: { username: "' invalid", password: '' },
      })
    expect(state.evaluations).toEqual(Array(5).fill('UNSUPPORTED'))
    expect(() =>
      sqlRuleset.applyAction(state, {
        type: 'test-payload',
        payload: { username: '', password: '' },
      }),
    ).toThrow()
    state = sqlRuleset.applyAction(state, repair)
    expect(sqlRuleset.summarize(state).score).toBe(0)
  })
  it('rejects extra fields, oversized inputs and unknown repairs', () => {
    expect(() =>
      sqlRuleset.validateAction('test-payload', { username: '', password: '', score: 100 }),
    ).toThrow()
    expect(() =>
      sqlRuleset.validateAction('test-payload', { username: 'x'.repeat(121), password: '' }),
    ).toThrow()
    expect(() => sqlRuleset.validateAction('select-repair', { optionId: 'unknown' })).toThrow()
  })
})

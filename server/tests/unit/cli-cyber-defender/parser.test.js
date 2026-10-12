import { describe, expect, it } from 'vitest'
import {
  SYNTAX_HINTS,
  isIpv4,
  parseCommand,
} from '../../../src/modules/games/cli-cyber-defender/parser.js'

describe('cli command parser', () => {
  it.each([
    ['block ip 192.0.2.10', 'block-ip', '192.0.2.10'],
    ['  BLOCK   IP   203.0.113.45  ', 'block-ip', '203.0.113.45'],
    ['disable user trainee-03', 'disable-user', 'trainee-03'],
    ['Disable User Trainee-03', 'disable-user', 'trainee-03'],
    ['isolate\thost lab-02', 'isolate-host', 'lab-02'],
  ])('accepts %j', (input, verb, target) => {
    const parsed = parseCommand(input)
    expect(parsed).toMatchObject({ ok: true, verb, target })
    expect(parsed.normalized).toBe(`${verb.replace('-', ' ')} ${target}`)
  })

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['rm -rf /', 'unknown-command'],
    ['block 192.0.2.10', 'unknown-command'],
    ['shutdown host lab-02', 'unknown-command'],
    ['block ip', 'missing-target'],
    ['block ip 192.0.2.10 now', 'extra-arguments'],
    ['block ip 192.0.2.256', 'invalid-ip'],
    ['block ip 192.0.2', 'invalid-ip'],
    ['block ip 192.0.02.1', 'invalid-ip'],
    ['block ip lab-02', 'invalid-ip'],
    ['disable user trainee_03', 'invalid-name'],
    ['isolate host -lab', 'invalid-name'],
    ['isolate host 192.0.2.10;ls', 'invalid-name'],
    [`block ip ${'1'.repeat(130)}`, 'too-long'],
  ])('rejects %j as %s', (input, reason) => {
    expect(parseCommand(input)).toEqual({ ok: false, reason })
    expect(SYNTAX_HINTS[reason]).toBeTruthy()
  })

  it('rejects non-string input', () => {
    expect(parseCommand(undefined)).toEqual({ ok: false, reason: 'empty' })
  })

  it('validates dotted ipv4 octets', () => {
    expect(isIpv4('0.0.0.0')).toBe(true)
    expect(isIpv4('255.255.255.255')).toBe(true)
    expect(isIpv4('1.2.3.4.5')).toBe(false)
    expect(isIpv4('01.2.3.4')).toBe(false)
  })
})

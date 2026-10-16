import { describe, expect, it } from 'vitest'
import {
  createPasswordGate,
  hashPassword,
  passwordHashOptions,
  verifyDummyPassword,
  verifyPassword,
} from '../../../src/modules/auth/password.js'

function deferred() {
  let resolve
  const promise = new Promise((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}

describe('Argon2id password operations', () => {
  it('uses the approved Argon2id work factors and salted hashes', async () => {
    const password = 'Correct-Horse-🔒-2026'
    const firstHash = await hashPassword(password)
    const secondHash = await hashPassword(password)

    expect(passwordHashOptions).toMatchObject({
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    })
    expect(firstHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/)
    expect(secondHash).not.toBe(firstHash)
    await expect(verifyPassword(firstHash, password)).resolves.toBe(true)
    await expect(verifyPassword(firstHash, 'wrong password')).resolves.toBe(false)
    await expect(verifyDummyPassword('unknown account password')).resolves.toBe(false)
  })

  it('rejects a third simultaneous password operation without queuing it', async () => {
    const gate = createPasswordGate()
    const first = deferred()
    const second = deferred()
    const firstRun = gate(() => first.promise)
    const secondRun = gate(() => second.promise)
    let thirdStarted = false

    await expect(
      gate(() => {
        thirdStarted = true
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_SERVICE_BUSY', status: 503 })
    expect(thirdStarted).toBe(false)

    first.resolve('first')
    second.resolve('second')
    await expect(Promise.all([firstRun, secondRun])).resolves.toEqual(['first', 'second'])
    await expect(gate(async () => 'after release')).resolves.toBe('after release')
  })
})

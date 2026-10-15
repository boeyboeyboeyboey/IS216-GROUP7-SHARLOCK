import { describe, expect, it } from 'vitest'
import {
  parseProfileQuery,
  parseProfileUpdateInput,
  ProfileError,
} from '../../../src/modules/profile/policy.js'

describe('profile update policy', () => {
  it('trims usernames, preserves display case, and normalizes uniqueness keys', () => {
    expect(parseProfileUpdateInput({ username: ' Case_Name-1 ', avatarId: 'blue' })).toEqual({
      username: { display: 'Case_Name-1', normalized: 'case_name-1' },
      avatarId: 'blue',
    })
  })

  it.each(['ab', 'a'.repeat(33), 'not valid', 'a.b', '$where'])(
    'rejects invalid username %s',
    (username) => {
      expect(() => parseProfileUpdateInput({ username, avatarId: 'mint' })).toThrow(ProfileError)
    },
  )

  it.each(['mint', 'blue', 'peach', 'detective', 'reader', 'gamer'])(
    'accepts preset avatar %s',
    (avatarId) => {
      expect(parseProfileUpdateInput({ username: 'Valid_Name', avatarId }).avatarId).toBe(avatarId)
    },
  )

  it('rejects unknown, privileged, operator, prototype and ID fields', () => {
    const input = JSON.parse(
      '{"username":"Valid_Name","avatarId":"mint","userId":"66f0a35f2d84787cce1a1001","role":"admin","$set":{"accountStatus":"disabled"},"__proto__":{"polluted":true}}',
    )
    expect(() => parseProfileUpdateInput(input)).toThrow(ProfileError)
    expect({}.polluted).toBeUndefined()
  })

  it('rejects missing fields and unsupported avatars with only safe field names', () => {
    try {
      parseProfileUpdateInput({ username: 'Valid_Name', avatarId: 'remote-url' })
      throw new Error('Expected invalid avatar rejection.')
    } catch (error) {
      expect(error).toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
      expect(error.fieldErrors).toEqual({ avatarId: 'Choose one of the available avatars.' })
    }
    expect(() => parseProfileUpdateInput({ username: 'Valid_Name' })).toThrow(ProfileError)
  })

  it('rejects non-empty profile query strings', () => {
    expect(() => parseProfileQuery({ userId: '66f0a35f2d84787cce1a1001' })).toThrow(ProfileError)
    expect(() => parseProfileQuery({})).not.toThrow()
  })
})

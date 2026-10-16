import { describe, expect, it } from 'vitest'
import {
  AdminError,
  assertEmptyAdminBody,
  assertEmptyAdminQuery,
  parseAdminListQuery,
  parseAdminObjectId,
  parseAssignmentsInput,
  parseCohortInput,
  parseInstitutionInput,
  parseInstructorInput,
} from '../../../src/modules/admin/policy.js'

const firstId = '0123456789abcdef01234567'
const secondId = 'abcdef0123456789abcdef01'

describe('admin workspace policy', () => {
  it('applies bounded list defaults and accepts only defined pagination and cohort filter fields', () => {
    expect(parseAdminListQuery({})).toEqual({ page: 1, limit: 20 })
    expect(parseAdminListQuery({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 })
    expect(parseAdminListQuery({ institutionId: firstId }, { institution: true })).toEqual({
      page: 1,
      limit: 20,
      institutionId: firstId,
    })
  })

  it.each([
    ['unknown query key', { role: 'admin' }],
    ['repeated page', { page: ['1', '2'] }],
    ['object page', { page: { value: '1' } }],
    ['prototype key', JSON.parse('{"__proto__":"x"}')],
    ['operator key', { $where: 'true' }],
    ['invalid page', { page: '0' }],
    ['oversized page', { page: '10001' }],
    ['invalid cohort identifier', { institutionId: 'bad' }],
  ])('rejects %s', (_label, query) => {
    expect(() => parseAdminListQuery(query, { institution: true })).toThrow(AdminError)
  })

  it('parses institution names and canonical lowercase slugs within model bounds', () => {
    expect(parseInstitutionInput({ name: '  North Campus  ', slug: '  SMU-NORTH ' })).toEqual({
      name: 'North Campus',
      slug: 'smu-north',
    })
    expect(() => parseInstitutionInput({ name: '', slug: 'x' })).toThrow(AdminError)
    expect(() => parseInstitutionInput({ name: 'x'.repeat(101), slug: 'valid-slug' })).toThrow(
      AdminError,
    )
    expect(() => parseInstitutionInput({ name: 'Campus', slug: 'invalid_slug' })).toThrow(
      AdminError,
    )
    expect(() =>
      parseInstitutionInput({ name: 'Campus', slug: 'valid-slug', status: 'inactive' }),
    ).toThrow(AdminError)
  })

  it('requires an exact active-parent cohort input and bounded text', () => {
    expect(
      parseCohortInput({
        institutionId: firstId.toUpperCase(),
        name: '  WAD2  ',
        term: '  2026 T2 ',
      }),
    ).toEqual({ institutionId: firstId, name: 'WAD2', term: '2026 T2' })
    expect(() =>
      parseCohortInput({ institutionId: firstId, name: 'Class', term: 'Term', status: 'inactive' }),
    ).toThrow(AdminError)
    expect(() => parseCohortInput({ institutionId: 'bad', name: 'Class', term: 'Term' })).toThrow(
      AdminError,
    )
  })

  it('reuses account normalization and avatar policy for instructor provisioning', () => {
    expect(
      parseInstructorInput({
        email: '  INSTRUCTOR@example.test ',
        username: ' Teacher_One ',
        avatarId: 'mint',
      }),
    ).toEqual({
      emailNormalized: 'instructor@example.test',
      username: { display: 'Teacher_One', normalized: 'teacher_one' },
      avatarId: 'mint',
    })
    expect(() =>
      parseInstructorInput({ email: 'bad', username: 'Teacher_One', avatarId: 'mint' }),
    ).toThrow(AdminError)
    expect(() =>
      parseInstructorInput({ email: 'teacher@example.test', username: 'x', avatarId: 'mint' }),
    ).toThrow(AdminError)
    expect(() =>
      parseInstructorInput({
        email: 'teacher@example.test',
        username: 'Teacher_One',
        avatarId: 'bad',
      }),
    ).toThrow(AdminError)
  })

  it('rejects untrusted or duplicate IDs and stale assignment revisions', () => {
    expect(parseAdminObjectId(firstId.toUpperCase())).toBe(firstId)
    expect(parseAssignmentsInput({ cohortIds: [firstId, secondId], expectedRevision: 0 })).toEqual({
      cohortIds: [firstId, secondId],
      expectedRevision: 0,
    })
    expect(parseAssignmentsInput({ cohortIds: [], expectedRevision: 12 })).toEqual({
      cohortIds: [],
      expectedRevision: 12,
    })
    expect(() =>
      parseAssignmentsInput({ cohortIds: [firstId, firstId.toUpperCase()], expectedRevision: 0 }),
    ).toThrow(AdminError)
    expect(() =>
      parseAssignmentsInput({ cohortIds: Array(51).fill(firstId), expectedRevision: 0 }),
    ).toThrow(AdminError)
    expect(() => parseAssignmentsInput({ cohortIds: [firstId], expectedRevision: -1 })).toThrow(
      AdminError,
    )
    expect(() => parseAssignmentsInput({ cohortIds: [firstId], expectedRevision: '0' })).toThrow(
      AdminError,
    )
    expect(() =>
      parseAssignmentsInput({ cohortIds: [firstId], expectedRevision: 0, role: 'admin' }),
    ).toThrow(AdminError)
  })

  it('accepts only an empty activation reissue body', () => {
    expect(assertEmptyAdminBody(undefined)).toBeUndefined()
    expect(assertEmptyAdminBody({})).toBeUndefined()
    expect(() => assertEmptyAdminBody({ token: 'secret' })).toThrow(AdminError)
  })

  it('accepts only empty queries on mutation routes', () => {
    expect(assertEmptyAdminQuery({})).toBeUndefined()
    expect(() => assertEmptyAdminQuery({ page: '1' })).toThrow(AdminError)
    expect(() => assertEmptyAdminQuery({ role: 'admin' })).toThrow(AdminError)
  })
})

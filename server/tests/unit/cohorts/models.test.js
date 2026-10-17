import { createConnection, Types } from 'mongoose'
import { describe, expect, it } from 'vitest'
import { cohortModel } from '../../../src/models/Cohort.js'
import { instructorAssignmentModel } from '../../../src/models/InstructorAssignment.js'
import { institutionModel } from '../../../src/models/Institution.js'
import { membershipModel } from '../../../src/models/Membership.js'

function createModels() {
  const database = createConnection()
  return {
    database,
    Institution: institutionModel(database),
    Cohort: cohortModel(database),
    Membership: membershipModel(database),
    InstructorAssignment: instructorAssignmentModel(database),
  }
}

const institutionId = new Types.ObjectId()
const userId = new Types.ObjectId()
const cohortId = new Types.ObjectId()

describe('cohort data models', () => {
  it('binds strict, non-versioned schemas with timestamps and automatic creation disabled', () => {
    const models = createModels()
    for (const Model of [
      models.Institution,
      models.Cohort,
      models.Membership,
      models.InstructorAssignment,
    ]) {
      expect(Model.schema.options).toMatchObject({
        timestamps: true,
        versionKey: false,
        strict: 'throw',
        autoIndex: false,
        autoCreate: false,
      })
    }
    expect(models.Institution.collection.collectionName).toBe('institutions')
    expect(models.Cohort.collection.collectionName).toBe('cohorts')
    expect(models.Membership.collection.collectionName).toBe('memberships')
    expect(models.InstructorAssignment.collection.collectionName).toBe('instructor_assignments')
    models.database.destroy()
  })

  it('normalizes institution names and slugs and enforces slug/status constraints', async () => {
    const { Institution, database } = createModels()
    const institution = new Institution({ name: '  Sharlock School  ', slug: ' SMU-Cyber ' })
    await institution.validate()
    expect(institution.name).toBe('Sharlock School')
    expect(institution.slug).toBe('smu-cyber')
    expect(institution.status).toBe('active')

    for (const slug of ['ab', 'has spaces', '-leading', 'trailing-', 'a--b', 'a'.repeat(65)]) {
      const invalid = new Institution({ name: 'School', slug })
      await expect(invalid.validate()).rejects.toHaveProperty('errors.slug')
    }
    await expect(
      new Institution({ name: 'School', slug: 'school', status: 'pending' }).validate(),
    ).rejects.toHaveProperty('errors.status')
    database.destroy()
  })

  it('defines compound uniqueness and immutable relationship references', () => {
    const { Institution, Cohort, Membership, InstructorAssignment, database } = createModels()
    const slugIndex = Institution.schema.indexes().find(([keys]) => keys.slug === 1)
    expect(slugIndex?.[1].unique).toBe(true)
    expect(Cohort.schema.indexes()).toContainEqual([
      { institutionId: 1, name: 1, term: 1 },
      { unique: true },
    ])
    expect(Membership.schema.indexes()).toContainEqual([
      { userId: 1, cohortId: 1 },
      { unique: true },
    ])
    expect(InstructorAssignment.schema.indexes()).toContainEqual([
      { userId: 1, cohortId: 1 },
      { unique: true },
    ])
    for (const Model of [Cohort, Membership, InstructorAssignment]) {
      for (const field of ['userId', 'cohortId', 'institutionId']) {
        if (Model.schema.path(field)) expect(Model.schema.path(field).options.immutable).toBe(true)
      }
    }
    database.destroy()
  })

  it('applies relationship defaults and rejects invalid statuses and unknown fields', async () => {
    const { Cohort, Membership, InstructorAssignment, database } = createModels()
    const cohort = new Cohort({ institutionId, name: '  WAD 2 ', term: ' 2026 T2 ' })
    const membership = new Membership({ userId, cohortId })
    const assignment = new InstructorAssignment({ userId, cohortId })
    await Promise.all([cohort.validate(), membership.validate(), assignment.validate()])
    expect(cohort.name).toBe('WAD 2')
    expect(cohort.term).toBe('2026 T2')
    expect(cohort.status).toBe('active')
    expect(membership.status).toBe('pending')
    expect(membership.requestedAt).toBeInstanceOf(Date)
    expect(membership.approvedAt).toBeNull()
    expect(membership.approvedBy).toBeNull()
    expect(membership.removedAt).toBeNull()
    expect(membership.removedBy).toBeNull()
    expect(assignment.status).toBe('active')

    await expect(
      new Membership({ userId, cohortId, status: 'approved' }).validate(),
    ).rejects.toHaveProperty('errors.status')
    await expect(
      new InstructorAssignment({ userId, cohortId, status: 'pending' }).validate(),
    ).rejects.toHaveProperty('errors.status')
    expect(() => new Cohort({ institutionId, name: 'WAD', term: '2026', extra: 'x' })).toThrow()
    database.destroy()
  })

  it('separates admin edit revisions from hidden recovery guard revisions', async () => {
    const { Institution, Cohort, database } = createModels()
    const institution = new Institution({ name: 'School', slug: 'school' })
    const cohort = new Cohort({ institutionId, name: 'Class', term: '2026 T2' })
    await Promise.all([institution.validate(), cohort.validate()])
    expect(institution.adminRevision).toBe(0)
    expect(institution.recoveryRevision).toBe(0)
    expect(cohort.adminRevision).toBe(0)
    expect(cohort.recoveryRevision).toBe(0)
    expect(Institution.schema.path('recoveryRevision').options.select).toBe(false)
    expect(Cohort.schema.path('recoveryRevision').options.select).toBe(false)
    database.destroy()
  })
})

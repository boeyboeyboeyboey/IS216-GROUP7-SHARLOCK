import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Types } from 'mongoose'
import { connectDatabase } from '../../../src/config/database.js'
import { assertSafeTestDatabaseUri } from '../../../src/config/database-uri.js'
import { validateEnvironment } from '../../../src/config/env.js'
import { cohortModel } from '../../../src/models/Cohort.js'
import { institutionModel } from '../../../src/models/Institution.js'
import { instructorAssignmentModel } from '../../../src/models/InstructorAssignment.js'
import { membershipModel } from '../../../src/models/Membership.js'
import { userModel } from '../../../src/models/User.js'
import { hashPassword } from '../../../src/modules/auth/password.js'
import { createAdminService } from '../../../src/modules/admin/service.js'
import { initializeAuditStorage } from '../../../src/modules/audit/storage.js'
import { initializeCohortStorage } from '../../../src/modules/cohorts/storage.js'
import { initializeRecoveryStorage } from '../../../src/modules/recovery/storage.js'
import {
  createTestApp,
  disposeTestAuthApps,
  initializeTestAuth,
  registerTestStudent,
} from '../auth/helpers.js'

const password = 'Synthetic-Test-Password-2026'
const owned = { users: new Set(), institutions: new Set(), cohorts: new Set() }
let database
let authOptions
let fixtureHash
let app
let admin
let student
let origin

function guardTestDatabase() {
  if (process.env.NODE_ENV !== 'test' || !database?.name.endsWith('_test')) {
    throw new Error('Refusing admin account fixtures outside a disposable _test database.')
  }
  assertSafeTestDatabaseUri(process.env.TEST_MONGODB_URI, process.env.MONGO_URI)
}

async function registerAdmin() {
  const account = await registerTestStudent(app)
  owned.users.add(account.user.id)
  await userModel(database).updateOne(
    { _id: new Types.ObjectId(account.user.id) },
    { $set: { globalRoles: ['admin'] } },
  )
  return account
}

async function createSyntheticUser(globalRoles = ['student'], accountStatus = 'active') {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const user = await userModel(database).create({
    emailNormalized: `account-${suffix}@example.test`,
    username: `account-${suffix}`,
    usernameNormalized: `account-${suffix}`,
    avatarId: 'mint',
    passwordHash: fixtureHash,
    globalRoles,
    accountStatus,
    authVersion: 1,
    passwordChangedAt: new Date(),
  })
  owned.users.add(user._id.toString())
  return user
}

async function createInstitutionAndCohort() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const institution = await institutionModel(database).create({
    name: `Synthetic Account Campus ${suffix}`,
    slug: `synthetic-account-${suffix}`,
    status: 'active',
  })
  owned.institutions.add(institution._id.toString())
  const cohort = await cohortModel(database).create({
    institutionId: institution._id,
    name: `Synthetic Account Class ${suffix}`,
    term: '2026 T2',
    status: 'active',
  })
  owned.cohorts.add(cohort._id.toString())
  return { institution, cohort }
}

async function login(email) {
  const agent = request.agent(app)
  const csrf = await agent.get('/api/auth/csrf').set('Origin', origin).expect(200)
  const response = await agent
    .post('/api/auth/login')
    .set('Origin', origin)
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email, password })
    .expect(200)
  return { agent, csrfToken: response.body.csrfToken }
}

async function newPublicAgent() {
  const agent = request.agent(app)
  const csrf = await agent.get('/api/auth/csrf').set('Origin', origin).expect(200)
  return { agent, csrfToken: csrf.body.csrfToken }
}

function tokenFrom(url) {
  return new URLSearchParams(new URL(url).hash.slice(1)).get('token')
}

function patchStatus(userId, accountStatus, expectedRevision, actor = admin) {
  return actor.agent
    .patch(`/api/admin/users/${userId}`)
    .set('Origin', origin)
    .set('X-CSRF-Token', actor.csrfToken)
    .send({ accountStatus, expectedRevision })
}

beforeAll(async () => {
  if (process.env.SHARLOCK_TEST_REPLICA_SET !== '1') return
  const config = validateEnvironment(process.env)
  if (config.nodeEnv !== 'test') throw new Error('Admin account integration requires NODE_ENV=test.')
  assertSafeTestDatabaseUri(config.databaseUri, process.env.MONGO_URI)
  database = await connectDatabase(config.databaseUri)
  guardTestDatabase()
  const topology = await database.db.admin().command({ hello: 1 })
  if (!topology.setName) throw new Error('Run admin account integration with --replica-set.')
  await initializeCohortStorage(database)
  await initializeAuditStorage(database)
  await initializeRecoveryStorage(database)
  authOptions = await initializeTestAuth(database, config)
  fixtureHash = await hashPassword(password)
})

beforeEach(async () => {
  guardTestDatabase()
  owned.users.clear()
  owned.institutions.clear()
  owned.cohorts.clear()
  app = createTestApp(database, authOptions)
  origin = authOptions.clientOrigin
  admin = await registerAdmin()
  student = await createSyntheticUser()
})

afterEach(async () => {
  if (!database) return
  guardTestDatabase()
  const userIds = [...owned.users]
  const objectIds = userIds.map((id) => new Types.ObjectId(id))
  const institutionIds = [...owned.institutions].map((id) => new Types.ObjectId(id))
  const cohortIds = [...owned.cohorts].map((id) => new Types.ObjectId(id))
  await database.db.collection('password_resets').deleteMany({ userId: { $in: objectIds } })
  await database.db.collection('auth_sessions').deleteMany({ 'session.userId': { $in: userIds } })
  await database.db.collection('audit_events').deleteMany({
    $or: [{ actorId: { $in: objectIds } }, { targetId: { $in: objectIds } }],
  })
  await database.db.collection('memberships').deleteMany({ userId: { $in: objectIds } })
  await database.db.collection('instructor_assignments').deleteMany({ userId: { $in: objectIds } })
  await database.db.collection('cohorts').deleteMany({ _id: { $in: cohortIds } })
  await database.db.collection('institutions').deleteMany({ _id: { $in: institutionIds } })
  await database.db.collection('users').deleteMany({ _id: { $in: objectIds } })
})

afterAll(async () => {
  await disposeTestAuthApps()
  await database?.close()
})

describe.skipIf(process.env.SHARLOCK_TEST_REPLICA_SET !== '1')('admin account controls API', () => {
  it('requires the current account-management capability for listing accounts', async () => {
    await request(app).get('/api/admin/users').expect(401)
    const studentSession = await studentLogin()
    await studentSession.agent.get('/api/admin/users').set('Origin', origin).expect(403)

    await admin.agent.get('/api/admin/users').set('Origin', origin).expect(200)
    await userModel(database).updateOne(
      { _id: new Types.ObjectId(admin.user.id) },
      { $set: { globalRoles: ['student'] } },
    )
    const afterCapabilityLoss = await admin.agent
      .get('/api/admin/users')
      .set('Origin', origin)
      .expect(403)
    expect(afterCapabilityLoss.body.error.code).toBe('CAPABILITY_FORBIDDEN')
  })

  it('paginates pure accounts and returns only the documented safe DTO', async () => {
    const additionalStudents = []
    for (let index = 0; index < 20; index += 1) {
      additionalStudents.push(await createSyntheticUser())
    }
    const list = await admin.agent
      .get('/api/admin/users?role=student&accountStatus=active')
      .set('Origin', origin)
      .expect(200)
    expect(list.body.page).toBe(1)
    expect(list.body.total).toBeGreaterThanOrEqual(21)
    expect(list.body.users).toHaveLength(20)

    const secondPage = await admin.agent
      .get('/api/admin/users?role=student&accountStatus=active&page=2')
      .set('Origin', origin)
      .expect(200)
    expect(secondPage.body.page).toBe(2)
    expect(secondPage.body.users.length).toBeGreaterThan(0)

    const largerPage = await admin.agent
      .get('/api/admin/users?role=student&accountStatus=active&limit=25')
      .set('Origin', origin)
      .expect(200)
    expect(largerPage.body.users.length).toBe(Math.min(largerPage.body.total, 25))
    const selected = [...list.body.users, ...secondPage.body.users, ...largerPage.body.users].find(
      ({ id }) => id === additionalStudents[0]._id.toString(),
    )
    const dto = selected ?? list.body.users[0]
    expect(Object.keys(dto).sort()).toEqual(
      ['id', 'username', 'avatarId', 'globalRoles', 'accountStatus', 'revision'].sort(),
    )
    expect(dto).toMatchObject({ globalRoles: ['student'], accountStatus: 'active', revision: 1 })
    expect(dto).not.toHaveProperty('email')
    expect(dto).not.toHaveProperty('passwordHash')
    expect(dto).not.toHaveProperty('authVersion')

    const oversized = await admin.agent
      .get('/api/admin/users?limit=51')
      .set('Origin', origin)
      .expect(400)
    expect(oversized.body.error.code).toBe('ADMIN_INVALID_REQUEST')
    const unknownFilter = await admin.agent
      .get('/api/admin/users?email=private@example.test')
      .set('Origin', origin)
      .expect(400)
    expect(unknownFilter.body.error.code).toBe('ADMIN_INVALID_REQUEST')
  })

  it('rejects self, staff and mixed-role targets and validates exact patch fields', async () => {
    const otherAdmin = await createSyntheticUser(['admin'])
    const mixed = await createSyntheticUser(['student', 'instructor'])
    const self = await patchStatus(admin.user.id, 'disabled', 1).expect(403)
    expect(self.body.error.code).toBe('ADMIN_FORBIDDEN')

    for (const protectedUser of [otherAdmin, mixed]) {
      const response = await patchStatus(protectedUser._id, 'disabled', 1).expect(404)
      expect(response.body.error.code).toBe('ADMIN_NOT_FOUND')
    }

    const extraField = await admin.agent
      .patch(`/api/admin/users/${student._id}`)
      .set('Origin', origin)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ accountStatus: 'disabled', expectedRevision: 1, username: 'unexpected' })
      .expect(400)
    expect(extraField.body.error.code).toBe('ADMIN_INVALID_REQUEST')

    const missingChange = await admin.agent
      .patch(`/api/admin/users/${student._id}`)
      .set('Origin', origin)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ expectedRevision: 1 })
      .expect(400)
    expect(missingChange.body.error.code).toBe('ADMIN_INVALID_REQUEST')
  })

  it('revokes student sessions and reset links on disable and keeps them invalid after re-enable', async () => {
    const { cohort } = await createInstitutionAndCohort()
    await membershipModel(database).create({
      userId: student._id,
      cohortId: cohort._id,
      status: 'active',
      decision: 'approved',
      approvedAt: new Date(),
      approvedBy: new Types.ObjectId(admin.user.id),
    })
    const studentSession = await login(student.emailNormalized)
    const resetIssue = await admin.agent
      .post(`/api/admin/users/${student._id}/recovery`)
      .set('Origin', origin)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ identityVerified: true })
      .expect(200)
    const oldResetToken = tokenFrom(resetIssue.body.resetUrl)

    const noOp = await patchStatus(student._id, 'active', 1).expect(409)
    expect(noOp.body.error.code).toBe('ADMIN_CONFLICT')
    const disabled = await patchStatus(student._id, 'disabled', 1).expect(200)
    expect(disabled.body.user).toMatchObject({
      id: student._id.toString(),
      globalRoles: ['student'],
      accountStatus: 'disabled',
      revision: 2,
    })
    expect(disabled.body.user).not.toHaveProperty('passwordHash')
    expect(
      await database.db.collection('auth_sessions').countDocuments({
        'session.userId': student._id.toString(),
      }),
    ).toBe(0)
    const revokedReset = await database.db.collection('password_resets').findOne({
      userId: student._id,
      purpose: 'student-password-reset',
    })
    expect(revokedReset.revokedAt).toBeInstanceOf(Date)
    expect(
      await membershipModel(database).findOne({ userId: student._id, cohortId: cohort._id }).lean(),
    ).toMatchObject({ status: 'active', decision: 'approved' })

    const staleEnable = await patchStatus(student._id, 'active', 1).expect(409)
    expect(staleEnable.body.error.code).toBe('ADMIN_STALE_ACCOUNT')
    const enabled = await patchStatus(student._id, 'active', 2).expect(200)
    expect(enabled.body.user).toMatchObject({ accountStatus: 'active', revision: 3 })
    await studentSession.agent.get('/api/auth/me').set('Origin', origin).expect(401)
    const oldLinkAttempt = await newPublicAgent()
    await oldLinkAttempt.agent
      .post('/api/auth/reset-password')
      .set('Origin', origin)
      .set('X-CSRF-Token', oldLinkAttempt.csrfToken)
      .send({ token: oldResetToken, password: 'New-Synthetic-Password-2026!' })
      .expect(400)

    const events = await database.db
      .collection('audit_events')
      .find({ targetId: student._id, eventType: { $in: ['admin.user.disable', 'admin.user.enable'] } })
      .toArray()
    expect(events.map(({ eventType }) => eventType).sort()).toEqual(
      ['admin.user.disable', 'admin.user.enable'].sort(),
    )
    expect(
      events.every(
        (event) =>
          event.actorKind === 'user' &&
          event.actorId.toString() === admin.user.id &&
          event.targetId.toString() === student._id.toString() &&
          event.scopeCohortId === null &&
          event.outcome === 'success' &&
          event.occurredAt instanceof Date &&
          typeof event.requestId === 'string',
      ),
    ).toBe(true)
    expect(JSON.stringify(events)).not.toMatch(/emailNormalized|passwordHash|tokenHash|resetUrl/i)
    expect(JSON.stringify(events)).not.toContain(student.emailNormalized)
    expect(JSON.stringify(events)).not.toContain(student.username)
    expect(JSON.stringify(events)).not.toContain(oldResetToken)
  })

  it('treats a legacy student without authVersion as revision zero and guards its first transition', async () => {
    const studentSession = await login(student.emailNormalized)
    await studentSession.agent.get('/api/auth/me').set('Origin', origin).expect(200)
    const resetIssue = await admin.agent
      .post(`/api/admin/users/${student._id}/recovery`)
      .set('Origin', origin)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ identityVerified: true })
      .expect(200)
    const resetToken = tokenFrom(resetIssue.body.resetUrl)
    await database.db.collection('users').updateOne(
      { _id: student._id },
      { $unset: { authVersion: '' } },
    )

    const listed = await admin.agent
      .get('/api/admin/users?role=student&limit=50')
      .set('Origin', origin)
      .expect(200)
    expect(listed.body.users.find(({ id }) => id === student._id.toString())).toMatchObject({
      id: student._id.toString(),
      revision: 0,
    })

    const disabled = await patchStatus(student._id, 'disabled', 0).expect(200)
    expect(disabled.body.user).toMatchObject({ accountStatus: 'disabled', revision: 1 })
    expect(
      await database.db.collection('auth_sessions').countDocuments({
        'session.userId': student._id.toString(),
      }),
    ).toBe(0)
    expect(
      await database.db.collection('password_resets').findOne({
        userId: student._id,
        purpose: 'student-password-reset',
      }),
    ).toMatchObject({ revokedAt: expect.any(Date) })
    await studentSession.agent.get('/api/auth/me').set('Origin', origin).expect(401)
    const oldLinkAttempt = await newPublicAgent()
    await oldLinkAttempt.agent
      .post('/api/auth/reset-password')
      .set('Origin', origin)
      .set('X-CSRF-Token', oldLinkAttempt.csrfToken)
      .send({ token: resetToken, password: 'New-Synthetic-Password-2026!' })
      .expect(400)
  })

  it('blocks instructor status reactivation while retaining the supported activation path', async () => {
    const { cohort } = await createInstitutionAndCohort()
    const instructor = await createSyntheticUser(['instructor'])
    await instructorAssignmentModel(database).create({
      userId: instructor._id,
      cohortId: cohort._id,
      status: 'active',
    })
    const instructorSession = await login(instructor.emailNormalized)
    const oldActivationToken = randomBytes(32).toString('base64url')
    const now = new Date()
    await database.db.collection('password_resets').insertOne({
      userId: instructor._id,
      purpose: 'activation',
      tokenHash: createHash('sha256').update(oldActivationToken).digest('hex'),
      authVersion: 1,
      initiatedBy: new Types.ObjectId(admin.user.id),
      scopeCohortId: null,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      consumedAt: null,
      revokedAt: null,
      createdAt: now,
    })

    const disabled = await patchStatus(instructor._id, 'disabled', 1).expect(200)
    expect(disabled.body.user).toMatchObject({ accountStatus: 'disabled', revision: 2 })
    expect(
      await database.db.collection('auth_sessions').countDocuments({
        'session.userId': instructor._id.toString(),
      }),
    ).toBe(0)
    expect(
      await instructorAssignmentModel(database)
        .find({ userId: instructor._id, status: 'active' })
        .select('_id')
        .lean(),
    ).toHaveLength(1)
    const revokedActivation = await database.db.collection('password_resets').findOne({
      userId: instructor._id,
      purpose: 'activation',
    })
    expect(revokedActivation.revokedAt).toBeInstanceOf(Date)
    await instructorSession.agent.get('/api/auth/me').set('Origin', origin).expect(401)

    const bypass = await patchStatus(instructor._id, 'active', 2).expect(409)
    expect(bypass.body.error.code).toBe('ADMIN_INSTRUCTOR_ACTIVATION_REQUIRED')
    const reissued = await admin.agent
      .post(`/api/admin/instructors/${instructor._id}/activation`)
      .set('Origin', origin)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({})
      .expect(200)
    const oldActivationAttempt = await newPublicAgent()
    await oldActivationAttempt.agent
      .post('/api/auth/activate-account')
      .set('Origin', origin)
      .set('X-CSRF-Token', oldActivationAttempt.csrfToken)
      .send({ token: oldActivationToken, password: 'Synthetic-Activated-Password-2026!' })
      .expect(400)

    const activation = await newPublicAgent()
    await activation.agent
      .post('/api/auth/activate-account')
      .set('Origin', origin)
      .set('X-CSRF-Token', activation.csrfToken)
      .send({ token: tokenFrom(reissued.body.activationUrl), password: 'Synthetic-Activated-Password-2026!' })
      .expect(204)
    expect((await userModel(database).findById(instructor._id).lean()).accountStatus).toBe('active')
    expect(
      await instructorAssignmentModel(database).countDocuments({
        userId: instructor._id,
        status: 'active',
      }),
    ).toBe(1)
  })

  it('rolls account status, session and recovery revocation back when audit recording fails', async () => {
    const studentSession = await login(student.emailNormalized)
    const resetIssue = await admin.agent
      .post(`/api/admin/users/${student._id}/recovery`)
      .set('Origin', origin)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ identityVerified: true })
      .expect(200)
    const resetToken = tokenFrom(resetIssue.body.resetUrl)
    const service = createAdminService(database, {
      recordAuditEvent: async () => {
        throw new Error('synthetic audit failure')
      },
    })

    await expect(
      service.updateUserStatus(
        { id: admin.user.id },
        student._id.toString(),
        { accountStatus: 'disabled', expectedRevision: 1 },
        {},
      ),
    ).rejects.toMatchObject({ code: 'ADMIN_UNAVAILABLE' })

    const persisted = await userModel(database).findById(student._id).lean()
    const versioned = await userModel(database)
      .findById(student._id)
      .select('+recoveryRevision')
      .lean()
    expect(persisted).toMatchObject({ accountStatus: 'active', authVersion: 1 })
    expect(versioned.recoveryRevision).toBe(1)
    expect(
      await database.db.collection('auth_sessions').countDocuments({
        'session.userId': student._id.toString(),
      }),
    ).toBeGreaterThan(0)
    await studentSession.agent.get('/api/auth/me').set('Origin', origin).expect(200)
    const stillActiveReset = await database.db.collection('password_resets').findOne({
      userId: student._id,
      purpose: 'student-password-reset',
    })
    expect(stillActiveReset.revokedAt).toBeNull()
    const resetAttempt = await newPublicAgent()
    await resetAttempt.agent
      .post('/api/auth/reset-password')
      .set('Origin', origin)
      .set('X-CSRF-Token', resetAttempt.csrfToken)
      .send({ token: resetToken, password: 'New-Synthetic-Password-2026!' })
      .expect(204)
    await studentSession.agent.get('/api/auth/me').set('Origin', origin).expect(401)
    expect(
      await database.db.collection('audit_events').countDocuments({
        targetId: student._id,
        eventType: 'admin.user.disable',
      }),
    ).toBe(0)
  })
})

async function studentLogin() {
  return login(student.emailNormalized)
}

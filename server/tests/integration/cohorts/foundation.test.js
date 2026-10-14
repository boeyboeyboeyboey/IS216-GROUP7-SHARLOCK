import { randomUUID } from 'node:crypto'
import express from 'express'
import { Types } from 'mongoose'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { connectDatabase } from '../../../src/config/database.js'
import { loadEnvironment } from '../../../src/config/env.js'
import { handleError, notFound } from '../../../src/middleware/errors.js'
import { cohortModel } from '../../../src/models/Cohort.js'
import { instructorAssignmentModel } from '../../../src/models/InstructorAssignment.js'
import { institutionModel } from '../../../src/models/Institution.js'
import { membershipModel } from '../../../src/models/Membership.js'
import { userModel } from '../../../src/models/User.js'
import { createAuthRouter } from '../../../src/modules/auth/router.js'
import { hashPassword } from '../../../src/modules/auth/password.js'
import { CohortError, parseListQuery } from '../../../src/modules/cohorts/policy.js'
import { initializeCohortStorage } from '../../../src/modules/cohorts/storage.js'
import { createContextService } from '../../../src/services/context.js'
import { createCohortService } from '../../../src/modules/cohorts/service.js'
import { createPermissionService } from '../../../src/services/permissions.js'
import {
  createTestApp,
  disposeTestAuthApps,
  initializeTestAuth,
  registerTestStudent,
} from '../auth/helpers.js'

const fixturePassword = 'Synthetic-Test-Password-2026'

let database
let baseAuthOptions
let authOptions
let app
let currentTime
let fixtureIds
let fixturePasswordHash
const probeDisposers = new Set()

function createFixtureIdSet() {
  return {
    users: new Set(),
    institutions: new Set(),
    cohorts: new Set(),
    memberships: new Set(),
    assignments: new Set(),
  }
}

function trackIds(collection, ids) {
  for (const id of ids) fixtureIds[collection].add(id.toString())
}

function createProbeApp(connection, settings) {
  const server = express()
  const authRuntime = createAuthRouter(connection, settings)
  const permissions = createPermissionService(connection)
  const contexts = createContextService(connection)

  server.disable('x-powered-by')
  server.use((_request, response, next) => {
    response.locals.requestId = randomUUID()
    response.set('X-Request-ID', response.locals.requestId)
    next()
  })
  server.use(express.json({ limit: '16kb' }))
  server.use('/api/auth', authRuntime.router)

  server.get(
    '/api/probe/capability/:capability',
    ...authRuntime.requireSession,
    async (request, response, next) => {
      try {
        const cohort = await permissions.requireCapability(
          response.locals.authUser,
          request.params.capability,
          { cohortId: request.query.cohortId },
        )
        response.json({ cohort })
      } catch (error) {
        next(error)
      }
    },
  )

  server.get(
    '/api/probe/context',
    ...authRuntime.requireSession,
    async (request, response, next) => {
      try {
        const context = await contexts.resolveAttemptContext(
          response.locals.authUser,
          request.query,
        )
        response.json({ context })
      } catch (error) {
        next(error)
      }
    },
  )

  server.get(
    '/api/probe/contexts',
    ...authRuntime.requireSession,
    async (request, response, next) => {
      try {
        const result = await contexts.listEligibleContexts(
          response.locals.authUser,
          parseListQuery(request.query),
        )
        response.json(result)
      } catch (error) {
        next(error)
      }
    },
  )

  server.use(notFound)
  server.use((error, _request, response, next) => {
    if (!(error instanceof CohortError)) {
      next(error)
      return
    }
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
      },
      requestId: response.locals.requestId,
    })
  })
  server.use(handleError)

  probeDisposers.add(authRuntime.dispose)
  return server
}

async function createFixtureUser({ emailPrefix, role }) {
  const id = new Types.ObjectId()
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const email = `${emailPrefix}-${suffix}@example.test`
  const username = `${emailPrefix.slice(0, 10)}-${suffix.slice(0, 8)}`
  trackIds('users', [id])
  const user = await userModel(database).create({
    _id: id,
    emailNormalized: email.toLowerCase(),
    username,
    usernameNormalized: username.toLowerCase(),
    passwordHash: fixturePasswordHash,
    avatarId: 'mint',
    globalRoles: [role],
    accountStatus: 'active',
    authVersion: 1,
    passwordChangedAt: new Date(currentTime),
  })
  return { id: user._id, email, userId: user._id.toString() }
}

async function loginFixtureUser(targetApp, email, password = fixturePassword) {
  const agent = request.agent(targetApp)
  const csrf = await agent
    .get('/api/auth/csrf')
    .set('Origin', baseAuthOptions.clientOrigin)
    .expect(200)
  const response = await agent
    .post('/api/auth/login')
    .set('Origin', baseAuthOptions.clientOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email, password })
    .expect(200)
  return { agent, user: response.body.user, csrfToken: response.body.csrfToken }
}

async function createFixtureStudent(targetApp) {
  if (targetApp !== app) {
    const fixture = await createFixtureUser({ emailPrefix: 'student', role: 'student' })
    return loginFixtureUser(targetApp, fixture.email)
  }
  const student = await registerTestStudent(targetApp)
  trackIds('users', [student.user.id])
  return student
}

async function seedWorld({ studentId, instructorId, adminId }) {
  const ids = {
    activeInstitution: new Types.ObjectId(),
    foreignInstitution: new Types.ObjectId(),
    inactiveInstitution: new Types.ObjectId(),
    primary: new Types.ObjectId(),
    secondary: new Types.ObjectId(),
    foreign: new Types.ObjectId(),
    pending: new Types.ObjectId(),
    removed: new Types.ObjectId(),
    inactiveCohort: new Types.ObjectId(),
    inactiveParentCohort: new Types.ObjectId(),
    missingParentCohort: new Types.ObjectId(),
  }
  trackIds('institutions', [ids.activeInstitution, ids.foreignInstitution, ids.inactiveInstitution])
  trackIds('cohorts', [
    ids.primary,
    ids.secondary,
    ids.foreign,
    ids.pending,
    ids.removed,
    ids.inactiveCohort,
    ids.inactiveParentCohort,
  ])

  await institutionModel(database).create([
    {
      _id: ids.activeInstitution,
      name: 'Sharlock Academy',
      slug: `sharlock-${ids.activeInstitution.toString().slice(-8)}`,
    },
    {
      _id: ids.foreignInstitution,
      name: 'Foreign Institute',
      slug: `foreign-${ids.foreignInstitution.toString().slice(-8)}`,
    },
    {
      _id: ids.inactiveInstitution,
      name: 'Closed Institute',
      slug: `closed-${ids.inactiveInstitution.toString().slice(-8)}`,
      status: 'inactive',
    },
  ])

  await cohortModel(database).create([
    { _id: ids.primary, institutionId: ids.activeInstitution, name: 'WAD 2 Blue', term: '2026 T2' },
    {
      _id: ids.secondary,
      institutionId: ids.activeInstitution,
      name: 'WAD 2 Green',
      term: '2026 T2',
    },
    {
      _id: ids.foreign,
      institutionId: ids.foreignInstitution,
      name: 'Foreign Blue',
      term: '2026 T2',
    },
    {
      _id: ids.pending,
      institutionId: ids.activeInstitution,
      name: 'Pending Cohort',
      term: '2026 T2',
    },
    {
      _id: ids.removed,
      institutionId: ids.foreignInstitution,
      name: 'Removed Cohort',
      term: '2026 T2',
    },
    {
      _id: ids.inactiveCohort,
      institutionId: ids.activeInstitution,
      name: 'Inactive Cohort',
      term: '2026 T2',
      status: 'inactive',
    },
    {
      _id: ids.inactiveParentCohort,
      institutionId: ids.inactiveInstitution,
      name: 'Closed Parent Cohort',
      term: '2026 T2',
    },
  ])

  const memberships = [
    { userId: studentId, cohortId: ids.primary, status: 'active' },
    { userId: studentId, cohortId: ids.secondary, status: 'active' },
    { userId: studentId, cohortId: ids.pending, status: 'pending' },
    { userId: studentId, cohortId: ids.removed, status: 'removed' },
    { userId: studentId, cohortId: ids.inactiveCohort, status: 'active' },
    { userId: studentId, cohortId: ids.inactiveParentCohort, status: 'active' },
    { userId: studentId, cohortId: ids.missingParentCohort, status: 'active' },
  ].map((membership) => ({ _id: new Types.ObjectId(), ...membership }))
  trackIds(
    'memberships',
    memberships.map(({ _id }) => _id),
  )
  await membershipModel(database).create(memberships)

  const assignments = [
    { userId: instructorId, cohortId: ids.primary, status: 'active' },
    { userId: instructorId, cohortId: ids.secondary, status: 'active' },
    { userId: instructorId, cohortId: ids.foreign, status: 'removed' },
    { userId: instructorId, cohortId: ids.inactiveCohort, status: 'active' },
    { userId: instructorId, cohortId: ids.missingParentCohort, status: 'active' },
    { userId: adminId, cohortId: ids.primary, status: 'active' },
  ].map((assignment) => ({ _id: new Types.ObjectId(), ...assignment }))
  trackIds(
    'assignments',
    assignments.map(({ _id }) => _id),
  )
  await instructorAssignmentModel(database).create(assignments)
  return ids
}

async function createWorld(targetApp = app) {
  const student = await createFixtureStudent(targetApp)
  const instructorFixture = await createFixtureUser({
    emailPrefix: 'instructor',
    role: 'instructor',
  })
  const adminFixture = await createFixtureUser({ emailPrefix: 'admin', role: 'admin' })
  const world = await seedWorld({
    studentId: student.user.id,
    instructorId: instructorFixture.userId,
    adminId: adminFixture.userId,
  })
  const instructor = await loginFixtureUser(targetApp, instructorFixture.email)
  const admin = await loginFixtureUser(targetApp, adminFixture.email)
  return { student, instructor, admin, instructorFixture, adminFixture, world }
}

async function expectDuplicateRace(model, records) {
  const attempts = records.map((record) => ({ _id: new Types.ObjectId(), ...record }))
  const name = model.modelName
  if (name === 'Institution')
    trackIds(
      'institutions',
      attempts.map(({ _id }) => _id),
    )
  if (name === 'Cohort')
    trackIds(
      'cohorts',
      attempts.map(({ _id }) => _id),
    )
  if (name === 'Membership')
    trackIds(
      'memberships',
      attempts.map(({ _id }) => _id),
    )
  if (name === 'InstructorAssignment')
    trackIds(
      'assignments',
      attempts.map(({ _id }) => _id),
    )
  const outcomes = await Promise.allSettled(attempts.map((record) => model.create(record)))
  expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
  expect(
    outcomes
      .filter(({ status }) => status === 'rejected')
      .every(({ reason }) => reason?.code === 11000),
  ).toBe(true)
}

beforeAll(async () => {
  const config = loadEnvironment()
  if (config.nodeEnv !== 'test') {
    throw new Error('Cohort integration tests require NODE_ENV=test.')
  }
  database = await connectDatabase(config.databaseUri)
  baseAuthOptions = await initializeTestAuth(database, config)
  await initializeCohortStorage(database)
  fixturePasswordHash = await hashPassword(fixturePassword)
})

beforeEach(() => {
  if (!database?.name?.endsWith('_test')) {
    throw new Error('Refusing cohort fixtures outside a disposable _test database.')
  }
  currentTime = Date.now()
  authOptions = { ...baseAuthOptions, now: () => currentTime }
  fixtureIds = createFixtureIdSet()
  app = createTestApp(database, authOptions)
})

afterEach(async () => {
  if (!database?.name?.endsWith('_test')) {
    throw new Error('Refusing cohort fixture cleanup outside a disposable _test database.')
  }
  const userIds = [...fixtureIds.users]
  const cleanups = []
  const cleanupMap = [
    ['institutions', fixtureIds.institutions],
    ['cohorts', fixtureIds.cohorts],
    ['memberships', fixtureIds.memberships],
    ['instructor_assignments', fixtureIds.assignments],
    ['users', fixtureIds.users],
  ]
  for (const [collectionName, ids] of cleanupMap) {
    if (ids.size) {
      cleanups.push(
        database.db.collection(collectionName).deleteMany({
          _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) },
        }),
      )
    }
  }
  if (userIds.length) {
    cleanups.push(
      database.db.collection('auth_sessions').deleteMany({ 'session.userId': { $in: userIds } }),
    )
  }
  await Promise.all(cleanups)
  await Promise.all([...probeDisposers].map((dispose) => dispose()))
  probeDisposers.clear()
})

afterAll(async () => {
  await Promise.all([...probeDisposers].map((dispose) => dispose()))
  probeDisposers.clear()
  await disposeTestAuthApps()
  await database?.close()
})

describe('backend class foundation integration', () => {
  it('leaves health and unknown game routes outside class authentication', async () => {
    await request(app).get('/api/health').expect(200)
    const missingGame = await request(app).get('/api/games/not-a-real-game').expect(404)
    expect(missingGame.body.error.code).toBe('NOT_FOUND')
    expect(missingGame.body.error.code).not.toBe('AUTHENTICATION_REQUIRED')
  })

  it('returns only the caller’s membership and teaching DTOs with statuses and pagination', async () => {
    const world = await createWorld()
    const memberships = await world.student.agent.get('/api/me/memberships').expect(200)
    expect(memberships.body.page).toBe(1)
    expect(memberships.body.total).toBe(7)
    expect(memberships.body.memberships).toHaveLength(7)
    expect(
      memberships.body.memberships.every(
        (entry) =>
          Object.keys(entry).sort().join(',') ===
          [
            'cohortId',
            'cohortName',
            'cohortStatus',
            'id',
            'institutionName',
            'institutionStatus',
            'status',
          ]
            .sort()
            .join(','),
      ),
    ).toBe(true)
    expect(memberships.body.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cohortId: world.world.primary.toString(),
          cohortName: 'WAD 2 Blue',
          institutionName: 'Sharlock Academy',
          status: 'active',
          cohortStatus: 'active',
          institutionStatus: 'active',
        }),
        expect.objectContaining({
          cohortId: world.world.pending.toString(),
          status: 'pending',
        }),
        expect.objectContaining({
          cohortId: world.world.removed.toString(),
          status: 'removed',
        }),
        expect.objectContaining({
          cohortId: world.world.inactiveCohort.toString(),
          cohortStatus: 'inactive',
        }),
        expect.objectContaining({
          cohortId: world.world.inactiveParentCohort.toString(),
          institutionStatus: 'inactive',
        }),
        expect.objectContaining({
          cohortId: world.world.missingParentCohort.toString(),
          cohortName: null,
          institutionName: null,
          cohortStatus: 'unavailable',
          institutionStatus: 'unavailable',
        }),
      ]),
    )
    expect(JSON.stringify(memberships.body)).not.toMatch(
      /passwordHash|roster|studentEmail|globalRoles/,
    )

    const studentAssignments = await world.student.agent
      .get('/api/me/teaching-assignments')
      .expect(200)
    expect(studentAssignments.body).toEqual({ assignments: [], page: 1, total: 0 })

    const instructorAssignments = await world.instructor.agent
      .get('/api/me/teaching-assignments')
      .expect(200)
    expect(instructorAssignments.body.page).toBe(1)
    expect(instructorAssignments.body.total).toBe(4)
    expect(instructorAssignments.body.assignments).toHaveLength(4)
    expect(instructorAssignments.body.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cohortId: world.world.primary.toString(),
          cohortName: 'WAD 2 Blue',
          status: 'active',
          cohortStatus: 'active',
          institutionStatus: 'active',
        }),
        expect.objectContaining({
          cohortId: world.world.inactiveCohort.toString(),
          cohortStatus: 'inactive',
        }),
        expect.objectContaining({
          cohortId: world.world.missingParentCohort.toString(),
          cohortName: null,
          institutionName: null,
          cohortStatus: 'unavailable',
          institutionStatus: 'unavailable',
        }),
      ]),
    )
    const adminAssignments = await world.admin.agent.get('/api/me/teaching-assignments').expect(200)
    expect(adminAssignments.body.total).toBe(1)
    expect(adminAssignments.body.assignments[0].cohortId).toBe(world.world.primary.toString())

    const pageOne = await world.student.agent.get('/api/me/memberships?page=1&limit=2').expect(200)
    const pageTwo = await world.student.agent.get('/api/me/memberships?page=2&limit=2').expect(200)
    expect(pageOne.body.memberships).toHaveLength(2)
    expect(pageTwo.body.memberships).toHaveLength(2)
    expect(
      new Set([...pageOne.body.memberships, ...pageTwo.body.memberships].map(({ id }) => id)).size,
    ).toBe(4)
    expect(pageOne.body.total).toBe(7)
    expect(pageTwo.body.page).toBe(2)
  })

  it('rejects actor filters and invalid list pagination on own reads', async () => {
    const student = await createFixtureStudent(app)
    await student.agent.get(`/api/me/memberships?userId=${student.user.id}`).expect(400)
    await student.agent.get('/api/me/teaching-assignments?role=admin').expect(400)
    await student.agent.get('/api/me/memberships?page=10001').expect(400)
    await student.agent.get('/api/me/teaching-assignments?limit=51').expect(400)
  })

  it('uses fresh auth state for logout, expiry, version, disabled and absent-account class reads', async () => {
    const loggedOut = await createFixtureStudent(app)
    await loggedOut.agent.get('/api/me/memberships').expect(200)
    await loggedOut.agent
      .post('/api/auth/logout')
      .set('Origin', baseAuthOptions.clientOrigin)
      .set('X-CSRF-Token', loggedOut.csrfToken)
      .send({})
      .expect(204)
    await loggedOut.agent.get('/api/me/memberships').expect(401)

    const expired = await createFixtureStudent(app)
    currentTime += 30 * 60 * 1000 + 1
    await expired.agent.get('/api/me/memberships').expect(401)

    currentTime = Date.now()
    const versioned = await createFixtureStudent(app)
    await database.db
      .collection('users')
      .updateOne({ _id: new Types.ObjectId(versioned.user.id) }, { $inc: { authVersion: 1 } })
    await versioned.agent.get('/api/me/memberships').expect(401)

    const disabled = await createFixtureStudent(app)
    await database.db
      .collection('users')
      .updateOne(
        { _id: new Types.ObjectId(disabled.user.id) },
        { $set: { accountStatus: 'disabled' } },
      )
    await disabled.agent.get('/api/me/memberships').expect(401)

    const removed = await createFixtureStudent(app)
    await database.db.collection('users').deleteOne({ _id: new Types.ObjectId(removed.user.id) })
    await removed.agent.get('/api/me/memberships').expect(401)
  })

  it('resolves personal and active class contexts for students, assigned instructors and admins', async () => {
    const probeApp = createProbeApp(database, authOptions)
    const world = await createWorld(probeApp)

    await world.student.agent
      .get('/api/probe/context?kind=personal')
      .expect(200)
      .then(({ body }) => expect(body.context).toEqual({ kind: 'personal', cohortId: null }))
    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.primary}`)
      .expect(200)
      .then(({ body }) =>
        expect(body.context).toEqual({
          kind: 'cohort',
          cohortId: world.world.primary.toString(),
        }),
      )
    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.pending}`)
      .expect(404)
    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.removed}`)
      .expect(404)
    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.foreign}`)
      .expect(404)
    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.inactiveCohort}`)
      .expect(404)
    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.inactiveParentCohort}`)
      .expect(404)
    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.missingParentCohort}`)
      .expect(404)

    await world.instructor.agent
      .get('/api/probe/contexts')
      .expect(200)
      .then(({ body }) => {
        expect(body.personal).toEqual({ kind: 'personal', cohortId: null })
        expect(body.total).toBe(2)
        expect(body.cohorts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: 'cohort',
              cohortId: world.world.primary.toString(),
              cohortName: 'WAD 2 Blue',
              institutionName: 'Sharlock Academy',
            }),
            expect.objectContaining({
              kind: 'cohort',
              cohortId: world.world.secondary.toString(),
              cohortName: 'WAD 2 Green',
            }),
          ]),
        )
      })
    await world.instructor.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.primary}`)
      .expect(200)
    await world.instructor.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${world.world.foreign}`)
      .expect(404)

    const adminContexts = await world.admin.agent.get('/api/probe/contexts').expect(200)
    expect(adminContexts.body.total).toBe(5)
    expect(adminContexts.body.cohorts.map(({ cohortId }) => cohortId)).toEqual(
      expect.arrayContaining([
        world.world.primary.toString(),
        world.world.secondary.toString(),
        world.world.foreign.toString(),
        world.world.pending.toString(),
        world.world.removed.toString(),
      ]),
    )
    expect(adminContexts.body.cohorts.map(({ cohortId }) => cohortId)).not.toContain(
      world.world.inactiveCohort.toString(),
    )
    expect(adminContexts.body.cohorts.map(({ cohortId }) => cohortId)).not.toContain(
      world.world.inactiveParentCohort.toString(),
    )
    expect(adminContexts.body.cohorts.map(({ cohortId }) => cohortId)).not.toContain(
      world.world.missingParentCohort.toString(),
    )

    const firstPage = await world.admin.agent.get('/api/probe/contexts?page=1&limit=2').expect(200)
    const secondPage = await world.admin.agent.get('/api/probe/contexts?page=2&limit=2').expect(200)
    expect(firstPage.body.cohorts).toHaveLength(2)
    expect(secondPage.body.cohorts).toHaveLength(2)
    expect(firstPage.body.total).toBe(5)
    expect(secondPage.body.page).toBe(2)
  })

  it('scopes capabilities to current roles and relationships and rejects malformed or unknown inputs', async () => {
    const probeApp = createProbeApp(database, authOptions)
    const world = await createWorld(probeApp)
    const primaryPlay = await world.student.agent
      .get('/api/probe/capability/cohort:play')
      .query({ cohortId: world.world.primary.toString() })
      .expect(200)
    expect(primaryPlay.body.cohort).toMatchObject({
      cohortId: world.world.primary.toString(),
      cohortName: 'WAD 2 Blue',
      institutionName: 'Sharlock Academy',
    })
    expect(JSON.stringify(primaryPlay.body.cohort)).not.toMatch(
      /passwordHash|membership|roster|email/,
    )

    await world.instructor.agent
      .get('/api/probe/capability/cohort:teach')
      .query({ cohortId: world.world.secondary.toString() })
      .expect(200)
    await world.instructor.agent
      .get('/api/probe/capability/cohort:teach')
      .query({ cohortId: world.world.foreign.toString() })
      .expect(404)
    await world.student.agent
      .get('/api/probe/capability/cohort:teach')
      .query({ cohortId: world.world.primary.toString() })
      .expect(404)
    await world.admin.agent
      .get('/api/probe/capability/cohort:review')
      .query({ cohortId: world.world.foreign.toString() })
      .expect(200)
    await world.admin.agent
      .get('/api/probe/capability/cohort:review')
      .query({ cohortId: world.world.inactiveCohort.toString() })
      .expect(404)
    await world.student.agent
      .get('/api/probe/capability/cohort:unknown')
      .query({ cohortId: world.world.primary.toString() })
      .expect(403)
    await world.student.agent
      .get('/api/probe/capability/cohort:play')
      .query({ cohortId: 'not-an-object-id' })
      .expect(400)
    await world.student.agent
      .get('/api/probe/capability/cohort:play')
      .query({ cohortId: new Types.ObjectId().toString() })
      .expect(404)

    const permissions = createPermissionService(database)
    await expect(
      permissions.requireCapability(
        { id: world.instructor.user.id, globalRoles: ['admin'] },
        'cohort:review',
        { cohortId: world.world.foreign.toString() },
      ),
    ).rejects.toMatchObject({ status: 404 })
    const studentContexts = await createContextService(database).listEligibleContexts({
      id: world.student.user.id,
      globalRoles: ['admin'],
    })
    expect(studentContexts.total).toBe(2)
  })

  it('applies membership and assignment removal on the next protected request', async () => {
    const probeApp = createProbeApp(database, authOptions)
    const world = await createWorld(probeApp)
    const primaryId = world.world.primary.toString()
    const instructorId = new Types.ObjectId(world.instructor.user.id)
    const studentId = new Types.ObjectId(world.student.user.id)

    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${primaryId}`)
      .expect(200)
    await membershipModel(database).updateOne(
      { userId: studentId, cohortId: world.world.primary },
      { $set: { status: 'removed' } },
    )
    await world.student.agent
      .get(`/api/probe/context?kind=cohort&cohortId=${primaryId}`)
      .expect(404)
    await world.student.agent.get('/api/probe/context?kind=personal').expect(200)
    const ownMemberships = await createCohortService(database).listMemberships(world.student.user)
    expect(ownMemberships.memberships).toEqual(
      expect.arrayContaining([expect.objectContaining({ cohortId: primaryId, status: 'removed' })]),
    )

    await world.instructor.agent
      .get('/api/probe/capability/cohort:teach')
      .query({ cohortId: primaryId })
      .expect(200)
    await instructorAssignmentModel(database).updateOne(
      { userId: instructorId, cohortId: world.world.primary },
      { $set: { status: 'removed' } },
    )
    await world.instructor.agent
      .get('/api/probe/capability/cohort:teach')
      .query({ cohortId: primaryId })
      .expect(404)

    await userModel(database).updateOne(
      { _id: instructorId },
      { $set: { globalRoles: ['student'] } },
    )
    await world.instructor.agent
      .get('/api/probe/capability/cohort:teach')
      .query({ cohortId: world.world.secondary.toString() })
      .expect(404)
  })

  it('enforces unique slug, cohort and user relationship indexes during concurrent inserts', async () => {
    const world = await createWorld()
    const Institution = institutionModel(database)
    const Cohort = cohortModel(database)
    const Membership = membershipModel(database)
    const InstructorAssignment = instructorAssignmentModel(database)
    const institutionId = new Types.ObjectId()
    const institutionSlug = `race-${institutionId.toString().slice(-8)}`

    await expectDuplicateRace(Institution, [
      { name: 'Race School', slug: institutionSlug },
      { name: 'Race School', slug: institutionSlug },
    ])
    const cohortRaceId = new Types.ObjectId()
    const cohortRace = {
      institutionId: world.world.activeInstitution,
      name: 'Race Cohort',
      term: '2026 T2',
    }
    await expectDuplicateRace(Cohort, [cohortRace, cohortRace])

    const relationshipCohort = await Cohort.create({
      _id: cohortRaceId,
      institutionId: world.world.activeInstitution,
      name: 'Relationship Race Cohort',
      term: '2026 T2',
    })
    trackIds('cohorts', [relationshipCohort._id])
    const studentId = new Types.ObjectId(world.student.user.id)
    const instructorId = new Types.ObjectId(world.instructor.user.id)
    await expectDuplicateRace(Membership, [
      { userId: studentId, cohortId: relationshipCohort._id, status: 'active' },
      { userId: studentId, cohortId: relationshipCohort._id, status: 'active' },
    ])
    await expectDuplicateRace(InstructorAssignment, [
      { userId: instructorId, cohortId: relationshipCohort._id, status: 'active' },
      { userId: instructorId, cohortId: relationshipCohort._id, status: 'active' },
    ])
  })
})

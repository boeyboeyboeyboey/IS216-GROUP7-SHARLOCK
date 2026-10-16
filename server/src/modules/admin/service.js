import { randomBytes, randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import { cohortModel } from '../../models/Cohort.js'
import { instructorAssignmentModel } from '../../models/InstructorAssignment.js'
import { institutionModel } from '../../models/Institution.js'
import { userModel } from '../../models/User.js'
import { createAuditService } from '../audit/service.js'
import { hashPassword } from '../auth/password.js'
import { assertTransactionSupport } from './bootstrap.js'
import {
  AdminError,
  parseAdminListQuery,
  parseAdminObjectId,
  assertEmptyAdminQuery,
  assertEmptyAdminBody,
  parseAssignmentsInput,
  parseCohortInput,
  parseInstitutionInput,
  parseInstructorInput,
} from './policy.js'
import { createPermissionService } from '../../services/permissions.js'

const transactionOptions = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  maxCommitTimeMS: 5000,
  timeoutMS: 10000,
}

function objectId(value) {
  return new Types.ObjectId(value)
}

function idString(value) {
  return value?.toString?.() ?? null
}

function institutionDto(institution) {
  return {
    id: idString(institution._id),
    name: institution.name,
    slug: institution.slug,
    status: institution.status,
  }
}

function cohortDto(cohort, institutions) {
  return {
    id: idString(cohort._id),
    institutionId: idString(cohort.institutionId),
    institutionName: institutions.get(idString(cohort.institutionId))?.name ?? null,
    name: cohort.name,
    term: cohort.term,
    status: cohort.status,
  }
}

function instructorDto(instructor, cohortIds = []) {
  return {
    id: idString(instructor._id),
    email: instructor.emailNormalized,
    username: instructor.username,
    avatarId: instructor.avatarId,
    accountStatus: instructor.accountStatus,
    assignmentRevision: instructor.instructorAssignmentRevision ?? 0,
    cohortIds: cohortIds.map(idString),
  }
}

function duplicateConflict(error) {
  return error?.code === 11000
}

export function createAdminService(
  database,
  {
    now = Date.now,
    clientOrigin = 'http://localhost:5173',
    recordAuditEvent,
    activationService: providedActivationService,
  } = {},
) {
  const User = userModel(database)
  const Institution = institutionModel(database)
  const Cohort = cohortModel(database)
  const InstructorAssignment = instructorAssignmentModel(database)
  const permissions = createPermissionService(database)
  const auditWriter = recordAuditEvent || createAuditService(database, { now }).recordAuditEvent
  let activationService = providedActivationService

  async function requireAdmin(actor, capability) {
    return permissions.requireCapability(actor, capability)
  }

  async function assertTransactionAdministrator(actor, session) {
    const activeAdministrator = await User.exists({
      _id: objectId(actor.id),
      accountStatus: 'active',
      globalRoles: 'admin',
    }).session(session)
    if (!activeAdministrator) throw new AdminError('ADMIN_FORBIDDEN')
  }

  async function recordAdminEvent(actor, eventType, targetId, session) {
    await auditWriter(
      {
        eventType,
        actorKind: 'user',
        actorId: actor.id,
        targetId: idString(targetId),
        scopeCohortId: null,
        outcome: 'success',
        requestId: randomUUID(),
      },
      { session },
    )
  }

  async function issueActivation(input, { session }) {
    if (!activationService) {
      const { createRecoveryService } = await import('../recovery/service.js')
      activationService = createRecoveryService(database, {
        now,
        clientOrigin,
        recordAuditEvent: auditWriter,
      })
    }
    return activationService.issueActivation(input, { session })
  }

  async function withTransaction(work, prepare) {
    let session
    let result
    let preparation
    let cleanupFailed = false
    try {
      await assertTransactionSupport(database)
    } catch {
      throw new AdminError('ADMIN_UNAVAILABLE')
    }
    try {
      preparation = await prepare?.()
      session = await database.startSession()
      result = await session.withTransaction(() => work(session, preparation), transactionOptions)
    } catch (error) {
      if (error instanceof AdminError) throw error
      if (duplicateConflict(error)) throw new AdminError('ADMIN_CONFLICT')
      throw new AdminError('ADMIN_UNAVAILABLE')
    } finally {
      try {
        await session?.endSession()
      } catch {
        cleanupFailed = true
      }
    }
    if (cleanupFailed) throw new AdminError('ADMIN_UNAVAILABLE')
    return result
  }

  async function listInstitutions(actor, query) {
    await requireAdmin(actor, 'admin:classes:manage')
    const { page, limit } = parseAdminListQuery(query)
    const skip = (page - 1) * limit
    const [institutions, total] = await Promise.all([
      Institution.find({}).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      Institution.countDocuments({}),
    ])
    return { institutions: institutions.map(institutionDto), page, total }
  }

  async function createInstitution(actor, input, query = {}) {
    const currentActor = await requireAdmin(actor, 'admin:classes:manage')
    assertEmptyAdminQuery(query)
    const parsed = parseInstitutionInput(input)
    return withTransaction(async (session) => {
      await assertTransactionAdministrator(currentActor, session)
      const [institution] = await Institution.create([{ ...parsed, status: 'active' }], { session })
      await recordAdminEvent(currentActor, 'admin.institution.create', institution._id, session)
      return institutionDto(institution.toObject())
    })
  }

  async function listCohorts(actor, query) {
    await requireAdmin(actor, 'admin:classes:manage')
    const { page, limit, institutionId } = parseAdminListQuery(query, { institution: true })
    const filter = institutionId ? { institutionId: objectId(institutionId) } : {}
    const skip = (page - 1) * limit
    const [cohorts, total] = await Promise.all([
      Cohort.find(filter).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      Cohort.countDocuments(filter),
    ])
    const institutionIds = [...new Set(cohorts.map(({ institutionId: id }) => idString(id)))]
    const institutions = institutionIds.length
      ? await Institution.find({ _id: { $in: institutionIds } })
          .select('_id name')
          .lean()
      : []
    const institutionById = new Map(
      institutions.map((institution) => [idString(institution._id), institution]),
    )
    return { cohorts: cohorts.map((cohort) => cohortDto(cohort, institutionById)), page, total }
  }

  async function createCohort(actor, input, query = {}) {
    const currentActor = await requireAdmin(actor, 'admin:classes:manage')
    assertEmptyAdminQuery(query)
    const parsed = parseCohortInput(input)
    return withTransaction(async (session) => {
      await assertTransactionAdministrator(currentActor, session)
      const institution = await Institution.findOne({
        _id: objectId(parsed.institutionId),
        status: 'active',
      })
        .session(session)
        .lean()
      if (!institution) throw new AdminError('ADMIN_NOT_FOUND')
      const [cohort] = await Cohort.create(
        [
          {
            institutionId: objectId(parsed.institutionId),
            name: parsed.name,
            term: parsed.term,
            status: 'active',
          },
        ],
        { session },
      )
      await recordAdminEvent(currentActor, 'admin.cohort.create', cohort._id, session)
      return cohortDto(cohort.toObject(), new Map([[idString(institution._id), institution]]))
    })
  }

  async function listInstructors(actor, query) {
    await requireAdmin(actor, 'admin:instructors:manage')
    const { page, limit } = parseAdminListQuery(query)
    const filter = { globalRoles: ['instructor'] }
    const skip = (page - 1) * limit
    const [instructors, total] = await Promise.all([
      User.find(filter)
        .select('_id emailNormalized username avatarId accountStatus instructorAssignmentRevision')
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])
    const ids = instructors.map(({ _id }) => _id)
    const assignments = ids.length
      ? await InstructorAssignment.find({ userId: { $in: ids }, status: 'active' })
          .select('userId cohortId')
          .lean()
      : []
    const cohortIdsByUser = new Map(instructors.map(({ _id }) => [idString(_id), []]))
    for (const assignment of assignments) {
      cohortIdsByUser.get(idString(assignment.userId))?.push(assignment.cohortId)
    }
    return {
      instructors: instructors.map((instructor) =>
        instructorDto(instructor, cohortIdsByUser.get(idString(instructor._id))),
      ),
      page,
      total,
    }
  }

  async function provisionInstructor(actor, input, query = {}) {
    const currentActor = await requireAdmin(actor, 'admin:instructors:manage')
    assertEmptyAdminQuery(query)
    const parsed = parseInstructorInput(input)
    const created = await withTransaction(
      async (session, passwordHash) => {
        await assertTransactionAdministrator(currentActor, session)
        const collision = await User.exists({
          $or: [
            { emailNormalized: parsed.emailNormalized },
            { usernameNormalized: parsed.username.normalized },
          ],
        }).session(session)
        if (collision) throw new AdminError('ADMIN_CONFLICT')
        const [instructor] = await User.create(
          [
            {
              emailNormalized: parsed.emailNormalized,
              username: parsed.username.display,
              usernameNormalized: parsed.username.normalized,
              avatarId: parsed.avatarId,
              passwordHash,
              globalRoles: ['instructor'],
              accountStatus: 'disabled',
              authVersion: 1,
              instructorAssignmentRevision: 0,
              passwordChangedAt: new Date(now()),
            },
          ],
          { session },
        )
        const activation = await issueActivation(
          { userId: idString(instructor._id), actorId: currentActor.id },
          { session },
        )
        await recordAdminEvent(currentActor, 'admin.instructor.provision', instructor._id, session)
        return { instructor: instructorDto(instructor.toObject()), ...activation }
      },
      async () => {
        const randomPassword = randomBytes(32).toString('hex')
        return hashPassword(randomPassword)
      },
    )
    return created
  }

  async function reissueActivation(actor, userId, input, query = {}) {
    const currentActor = await requireAdmin(actor, 'admin:instructors:manage')
    assertEmptyAdminQuery(query)
    assertEmptyAdminBody(input)
    const id = parseAdminObjectId(userId)
    return withTransaction(async (session) => {
      await assertTransactionAdministrator(currentActor, session)
      const instructor = await User.findOne({ _id: objectId(id), globalRoles: ['instructor'] })
        .select('_id accountStatus')
        .session(session)
        .lean()
      if (!instructor) throw new AdminError('ADMIN_NOT_FOUND')
      if (instructor.accountStatus !== 'disabled') throw new AdminError('ADMIN_CONFLICT')
      return issueActivation({ userId: id, actorId: currentActor.id }, { session })
    })
  }

  async function setAssignments(actor, userId, input, query = {}) {
    const currentActor = await requireAdmin(actor, 'admin:instructors:manage')
    assertEmptyAdminQuery(query)
    const id = parseAdminObjectId(userId)
    const parsed = parseAssignmentsInput(input)
    const instructorId = objectId(id)
    return withTransaction(async (session) => {
      await assertTransactionAdministrator(currentActor, session)
      const instructor = await User.findOne({
        _id: instructorId,
        globalRoles: ['instructor'],
        accountStatus: 'active',
      })
        .select('_id instructorAssignmentRevision')
        .session(session)
        .lean()
      if (!instructor) throw new AdminError('ADMIN_NOT_FOUND')
      const currentRevision = instructor.instructorAssignmentRevision ?? 0
      if (currentRevision !== parsed.expectedRevision)
        throw new AdminError('ADMIN_STALE_ASSIGNMENTS')

      const cohortObjectIds = parsed.cohortIds.map(objectId)
      if (cohortObjectIds.length) {
        const cohorts = await Cohort.find({
          _id: { $in: cohortObjectIds },
          status: 'active',
        })
          .select('_id institutionId')
          .session(session)
          .lean()
        if (cohorts.length !== cohortObjectIds.length) throw new AdminError('ADMIN_NOT_FOUND')
        const institutionIds = [
          ...new Set(cohorts.map(({ institutionId }) => idString(institutionId))),
        ]
        const activeInstitutions = await Institution.find({
          _id: { $in: institutionIds },
          status: 'active',
        })
          .select('_id')
          .session(session)
          .lean()
        if (activeInstitutions.length !== institutionIds.length)
          throw new AdminError('ADMIN_NOT_FOUND')
      }

      const revisionFilter =
        currentRevision === 0
          ? {
              $or: [
                { instructorAssignmentRevision: 0 },
                { instructorAssignmentRevision: { $exists: false } },
              ],
            }
          : { instructorAssignmentRevision: currentRevision }
      const updated = await User.findOneAndUpdate(
        {
          _id: instructorId,
          globalRoles: ['instructor'],
          accountStatus: 'active',
          ...revisionFilter,
        },
        { $inc: { instructorAssignmentRevision: 1 } },
        { new: true, session, runValidators: true },
      )
        .select('_id emailNormalized username avatarId accountStatus instructorAssignmentRevision')
        .lean()
      if (!updated) {
        const stillInstructor = await User.exists({
          _id: instructorId,
          globalRoles: ['instructor'],
          accountStatus: 'active',
        }).session(session)
        if (!stillInstructor) throw new AdminError('ADMIN_NOT_FOUND')
        throw new AdminError('ADMIN_STALE_ASSIGNMENTS')
      }

      await InstructorAssignment.updateMany(
        { userId: instructorId, status: 'active', cohortId: { $nin: cohortObjectIds } },
        { $set: { status: 'removed' } },
        { session },
      )
      for (const cohortId of cohortObjectIds) {
        await InstructorAssignment.updateOne(
          { userId: instructorId, cohortId },
          { $set: { status: 'active' }, $setOnInsert: { userId: instructorId, cohortId } },
          { upsert: true, session, runValidators: true },
        )
      }
      await recordAdminEvent(
        currentActor,
        'admin.instructor.assignments.update',
        instructorId,
        session,
      )
      return { instructor: instructorDto(updated, parsed.cohortIds) }
    })
  }

  return Object.freeze({
    listInstitutions,
    createInstitution,
    listCohorts,
    createCohort,
    listInstructors,
    provisionInstructor,
    reissueActivation,
    setAssignments,
  })
}

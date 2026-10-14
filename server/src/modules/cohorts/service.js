import { Types } from 'mongoose'
import { cohortModel } from '../../models/Cohort.js'
import { instructorAssignmentModel } from '../../models/InstructorAssignment.js'
import { institutionModel } from '../../models/Institution.js'
import { membershipModel } from '../../models/Membership.js'
import { parsePagination } from './policy.js'
import { createPermissionService } from '../../services/permissions.js'

function actorId(actor) {
  return new Types.ObjectId(actor.id)
}

function idString(value) {
  return value?.toString?.() ?? null
}

async function loadParents(database, cohortIds) {
  if (!cohortIds.length) return { cohorts: new Map(), institutions: new Map() }

  const Cohort = cohortModel(database)
  const Institution = institutionModel(database)
  const cohorts = await Cohort.find({ _id: { $in: cohortIds } })
    .select('_id name institutionId status')
    .lean()
  const institutionIds = [
    ...new Set(cohorts.map(({ institutionId }) => idString(institutionId)).filter(Boolean)),
  ]
  const institutions = institutionIds.length
    ? await Institution.find({ _id: { $in: institutionIds } })
        .select('_id name status')
        .lean()
    : []

  return {
    cohorts: new Map(cohorts.map((cohort) => [idString(cohort._id), cohort])),
    institutions: new Map(
      institutions.map((institution) => [idString(institution._id), institution]),
    ),
  }
}

function relationshipDto(relationship, cohorts, institutions) {
  const cohortId = idString(relationship.cohortId)
  const cohort = cohorts.get(cohortId)
  const institution = cohort ? institutions.get(idString(cohort.institutionId)) : null
  return {
    id: idString(relationship._id),
    cohortId,
    cohortName: cohort?.name ?? null,
    institutionName: institution?.name ?? null,
    status: relationship.status,
    cohortStatus: cohort?.status ?? 'unavailable',
    institutionStatus: institution?.status ?? 'unavailable',
  }
}

export function createCohortService(database) {
  const Membership = membershipModel(database)
  const InstructorAssignment = instructorAssignmentModel(database)
  const permissions = createPermissionService(database)

  async function listMemberships(actor, pagination) {
    const currentActor = await permissions.resolveActor(actor)
    const userId = actorId(currentActor)
    const { page, limit, skip } = parsePagination(pagination)
    const filter = { userId }
    const [memberships, total] = await Promise.all([
      Membership.find(filter).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      Membership.countDocuments(filter),
    ])
    const cohortIds = [
      ...new Set(memberships.map(({ cohortId }) => idString(cohortId)).filter(Boolean)),
    ]
    const parents = await loadParents(database, cohortIds)

    return {
      memberships: memberships.map((membership) =>
        relationshipDto(membership, parents.cohorts, parents.institutions),
      ),
      page,
      total,
    }
  }

  async function listTeachingAssignments(actor, pagination) {
    const currentActor = await permissions.resolveActor(actor)
    const userId = actorId(currentActor)
    const { page, limit, skip } = parsePagination(pagination)
    const roles = currentActor.globalRoles
    if (!roles.includes('instructor') && !roles.includes('admin')) {
      return { assignments: [], page, total: 0 }
    }

    const filter = { userId, status: 'active' }
    const [assignments, total] = await Promise.all([
      InstructorAssignment.find(filter).sort({ _id: 1 }).skip(skip).limit(limit).lean(),
      InstructorAssignment.countDocuments(filter),
    ])
    const cohortIds = [
      ...new Set(assignments.map(({ cohortId }) => idString(cohortId)).filter(Boolean)),
    ]
    const parents = await loadParents(database, cohortIds)

    return {
      assignments: assignments.map((assignment) =>
        relationshipDto(assignment, parents.cohorts, parents.institutions),
      ),
      page,
      total,
    }
  }

  return Object.freeze({ listMemberships, listTeachingAssignments })
}

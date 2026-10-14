import { Types } from 'mongoose'
import { userModel } from '../models/User.js'
import { cohortModel } from '../models/Cohort.js'
import { institutionModel } from '../models/Institution.js'
import { membershipModel } from '../models/Membership.js'
import { instructorAssignmentModel } from '../models/InstructorAssignment.js'
import { CohortError, parseObjectId, parsePagination } from '../modules/cohorts/policy.js'

const cohortCapabilities = new Set(['cohort:play', 'cohort:teach', 'cohort:review'])

function inaccessibleCohort() {
  return new CohortError('COHORT_NOT_FOUND', 'This class is unavailable.', 404)
}

export function createPermissionService(database) {
  const User = userModel(database)
  const Cohort = cohortModel(database)
  const Institution = institutionModel(database)
  const Membership = membershipModel(database)
  const InstructorAssignment = instructorAssignmentModel(database)

  async function resolveActor(actor) {
    let userId
    try {
      userId = parseObjectId(actor?.id)
    } catch {
      throw new CohortError('AUTHENTICATION_REQUIRED', 'Sign in to continue.', 401)
    }
    const user = await User.findOne({ _id: userId, accountStatus: 'active' })
      .select('_id globalRoles')
      .lean()
    if (!user) throw new CohortError('AUTHENTICATION_REQUIRED', 'Sign in to continue.', 401)
    return { id: user._id.toString(), globalRoles: [...user.globalRoles] }
  }

  async function requireCapability(actor, capability, resource = {}) {
    if (capability === 'admin:audit:read') {
      const currentActor = await resolveActor(actor)
      if (!currentActor.globalRoles.includes('admin')) {
        throw new CohortError('CAPABILITY_FORBIDDEN', 'This action is unavailable.', 403)
      }
      return currentActor
    }
    if (!cohortCapabilities.has(capability)) {
      throw new CohortError('CAPABILITY_FORBIDDEN', 'This action is unavailable.', 403)
    }
    const currentActor = await resolveActor(actor)
    const cohortId = parseObjectId(resource?.cohortId)
    const cohort = await Cohort.findOne({ _id: cohortId, status: 'active' })
      .select('_id name institutionId')
      .lean()
    if (!cohort) throw inaccessibleCohort()
    const institution = await Institution.findOne({
      _id: cohort.institutionId,
      status: 'active',
    })
      .select('_id name')
      .lean()
    if (!institution) throw inaccessibleCohort()

    const roles = currentActor.globalRoles
    if (!roles.includes('admin')) {
      const instructor = roles.includes('instructor')
      if (capability !== 'cohort:play' && !instructor) throw inaccessibleCohort()
      if (!instructor && !roles.includes('student')) throw inaccessibleCohort()
      const Relationship = instructor ? InstructorAssignment : Membership
      const relationship = await Relationship.exists({
        userId: currentActor.id,
        cohortId,
        status: 'active',
      })
      if (!relationship) throw inaccessibleCohort()
    }
    return {
      cohortId: cohort._id.toString(),
      cohortName: cohort.name,
      institutionName: institution.name,
    }
  }

  async function listEligibleCohorts(actor, pagination = {}) {
    const { page, limit, skip } = parsePagination(pagination)
    const currentActor = await resolveActor(actor)
    const roles = currentActor.globalRoles
    const pipeline = [
      { $match: { status: 'active' } },
      {
        $lookup: {
          from: 'institutions',
          localField: 'institutionId',
          foreignField: '_id',
          pipeline: [{ $match: { status: 'active' } }, { $project: { name: 1 } }],
          as: 'institution',
        },
      },
      { $unwind: '$institution' },
    ]
    if (!roles.includes('admin')) {
      const instructor = roles.includes('instructor')
      if (!instructor && !roles.includes('student')) return { cohorts: [], page, total: 0 }
      const collection = instructor ? 'instructor_assignments' : 'memberships'
      pipeline.push(
        {
          $lookup: {
            from: collection,
            let: { cohortId: '$_id' },
            pipeline: [
              {
                $match: {
                  userId: new Types.ObjectId(currentActor.id),
                  status: 'active',
                  $expr: { $eq: ['$cohortId', '$$cohortId'] },
                },
              },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: 'relationship',
          },
        },
        { $match: { 'relationship.0': { $exists: true } } },
      )
    }
    pipeline.push({
      $facet: {
        rows: [
          { $sort: { _id: 1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 1, name: 1, institutionName: '$institution.name' } },
        ],
        count: [{ $count: 'total' }],
      },
    })
    const [result] = await Cohort.aggregate(pipeline)
    return {
      cohorts: result.rows.map((cohort) => ({
        cohortId: cohort._id.toString(),
        cohortName: cohort.name,
        institutionName: cohort.institutionName,
      })),
      page,
      total: result.count[0]?.total ?? 0,
    }
  }

  return Object.freeze({ resolveActor, requireCapability, listEligibleCohorts })
}

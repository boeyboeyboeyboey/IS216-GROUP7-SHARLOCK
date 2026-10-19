import { userModel } from '../../models/User.js'
import { cohortModel } from '../../models/Cohort.js'
import { institutionModel } from '../../models/Institution.js'
import { membershipModel } from '../../models/Membership.js'
import { instructorAssignmentModel } from '../../models/InstructorAssignment.js'
import { StudentRecoveryError } from './policy.js'

export function createStudentRecoveryGuards(database) {
  const User = userModel(database)
  const Cohort = cohortModel(database)
  const Institution = institutionModel(database)
  const Membership = membershipModel(database)
  const InstructorAssignment = instructorAssignmentModel(database)

  async function readEligibility({ issuerId, targetId, scopeCohortId = null }, session) {
    const issuer = await User.findOne({ _id: issuerId, accountStatus: 'active' })
      .select('_id globalRoles +recoveryRevision')
      .session(session)
      .lean()
    const authorized = scopeCohortId
      ? issuer?.globalRoles.includes('instructor') && !issuer.globalRoles.includes('admin')
      : issuer?.globalRoles.includes('admin')
    if (!authorized) throw new StudentRecoveryError()
    const target = await User.findOne({
      _id: targetId,
      accountStatus: 'active',
      globalRoles: ['student'],
    })
      .select('_id authVersion +recoveryRevision')
      .session(session)
      .lean()
    if (!target) throw new StudentRecoveryError()
    const eligibility = {
      issuer,
      target,
      scopeCohortId,
      cohort: null,
      institution: null,
      assignment: null,
      membership: null,
    }
    if (!scopeCohortId) return eligibility

    const cohort = await Cohort.findOne({ _id: scopeCohortId, status: 'active' })
      .select('_id institutionId +recoveryRevision')
      .session(session)
      .lean()
    if (!cohort) throw new StudentRecoveryError()
    eligibility.cohort = cohort
    const institution = await Institution.findOne({
      _id: cohort.institutionId,
      status: 'active',
    })
      .select('_id recoveryRevision')
      .session(session)
      .lean()
    if (!institution) throw new StudentRecoveryError()
    eligibility.institution = institution
    eligibility.assignment = await InstructorAssignment.findOne({
      userId: issuer._id,
      cohortId: scopeCohortId,
      status: 'active',
    })
      .select('_id recoveryRevision')
      .session(session)
      .lean()
    eligibility.membership = await Membership.findOne({
      userId: target._id,
      cohortId: scopeCohortId,
      status: 'active',
    })
      .select('_id recoveryRevision')
      .session(session)
      .lean()
    if (!eligibility.assignment || !eligibility.membership) throw new StudentRecoveryError()
    return eligibility
  }

  async function incrementGuard(Model, record, filter, session) {
    const revision = record.recoveryRevision ?? 0
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) {
      throw new StudentRecoveryError()
    }
    const revisionFilter =
      record.recoveryRevision === undefined
        ? { recoveryRevision: { $exists: false } }
        : { recoveryRevision: revision }
    const changed = await Model.findOneAndUpdate(
      { _id: record._id, ...filter, ...revisionFilter },
      { $set: { recoveryRevision: revision + 1 } },
      { session, new: true, runValidators: true },
    ).select('_id')
    if (!changed) throw new StudentRecoveryError()
    return revision + 1
  }

  async function acquireEligibility(eligibility, session) {
    const { issuer, target, scopeCohortId, cohort, institution, assignment, membership } =
      eligibility
    await incrementGuard(
      User,
      issuer,
      {
        accountStatus: 'active',
        globalRoles: scopeCohortId ? { $all: ['instructor'], $nin: ['admin'] } : 'admin',
      },
      session,
    )
    const targetRevision = await incrementGuard(
      User,
      target,
      { accountStatus: 'active', globalRoles: ['student'], authVersion: target.authVersion },
      session,
    )
    if (scopeCohortId) {
      await incrementGuard(Institution, institution, { status: 'active' }, session)
      await incrementGuard(
        Cohort,
        cohort,
        { status: 'active', institutionId: institution._id },
        session,
      )
      await incrementGuard(InstructorAssignment, assignment, { status: 'active' }, session)
      await incrementGuard(Membership, membership, { status: 'active' }, session)
    }
    return targetRevision
  }

  return Object.freeze({ readEligibility, acquireEligibility })
}

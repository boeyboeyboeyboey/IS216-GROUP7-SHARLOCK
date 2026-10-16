import { parsePagination, parseRequestedContext } from '../modules/cohorts/policy.js'
import { createPermissionService } from './permissions.js'

export function createContextService(database) {
  const permissions = createPermissionService(database)

  async function resolveAttemptContext(actor, requestedContext) {
    const context = parseRequestedContext(requestedContext)
    if (context.kind === 'personal') {
      await permissions.resolveActor(actor)
      return context
    }
    await permissions.requireCapability(actor, 'cohort:play', { cohortId: context.cohortId })
    return context
  }

  async function listEligibleContexts(actor, { page = 1, limit = 20 } = {}) {
    const pagination = parsePagination({ page, limit })
    const result = await permissions.listEligibleCohorts(actor, pagination)
    return {
      personal: { kind: 'personal', cohortId: null },
      cohorts: result.cohorts.map((cohort) => ({ kind: 'cohort', ...cohort })),
      page: result.page,
      total: result.total,
    }
  }

  return Object.freeze({ resolveAttemptContext, listEligibleContexts })
}

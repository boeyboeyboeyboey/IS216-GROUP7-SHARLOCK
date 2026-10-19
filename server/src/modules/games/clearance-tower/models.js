export const CLEARANCES = [
  { id: 'unclassified', name: 'Unclassified' },
  { id: 'confidential', name: 'Confidential' },
  { id: 'secret', name: 'Secret' },
  { id: 'top-secret', name: 'Top Secret' },
]

export const CLEARANCE_IDS = CLEARANCES.map((clearance) => clearance.id)

function rankOf(clearanceId) {
  return CLEARANCE_IDS.indexOf(clearanceId)
}

function nameOf(list, id) {
  return list.find((item) => item.id === id)?.name ?? id
}

// levels without categories show the plain clearance; the others use slide 27's {set} notation
export function formatLabel(level, label) {
  const clearance = nameOf(CLEARANCES, label.level)
  if (!level.categories?.length) return clearance
  const categories = label.categories.map((id) => nameOf(level.categories ?? [], id))
  return `${clearance} {${categories.join(', ')}}`
}

// a label dominates another when its clearance is at least as high and it holds every category
export function dominates(higher, lower) {
  const highEnough = rankOf(higher.level) >= rankOf(lower.level)
  const coversCategories = lower.categories.every((category) =>
    higher.categories.includes(category),
  )
  return highEnough && coversCategories
}

function checkDiscretionary(level, policy, step) {
  const agent = nameOf(level.agents, step.agent)
  const file = nameOf(level.files, step.file)
  const right = step.action === 'read' ? 'r' : 'w'
  const grant = policy.grants.find(
    (entry) => entry.subject === step.agent && entry.object === step.file,
  )
  if (grant?.rights.includes(right))
    return { allowed: true, reason: `${file}'s access list gives ${agent} "${right}".` }
  return { allowed: false, reason: `${file}'s access list has no "${right}" entry for ${agent}.` }
}

function checkMandatory(level, policy, step) {
  const agent = level.agents.find((item) => item.id === step.agent)
  const file = nameOf(level.files, step.file)
  const subjectLabel = agent.label
  const objectLabel = policy.objectLabels[step.file]
  const subjectText = `${agent.name} (${formatLabel(level, subjectLabel)})`
  const objectText = `${file} (${formatLabel(level, objectLabel)})`

  if (step.action === 'read') {
    if (dominates(subjectLabel, objectLabel))
      return { allowed: true, reason: `Read down: ${subjectText} dominates ${objectText}.` }
    return { allowed: false, reason: `No read up: ${subjectText} does not dominate ${objectText}.` }
  }
  if (dominates(objectLabel, subjectLabel))
    return { allowed: true, reason: `Write up: ${objectText} dominates ${subjectText}.` }
  return {
    allowed: false,
    reason: `No write down: ${objectText} does not dominate ${subjectText}.`,
  }
}

export function rolesFor(policy, agentId) {
  const assignment = policy.assignments.find((entry) => entry.agent === agentId)
  const roleIds = assignment?.roleIds ?? []
  return policy.roles.filter((role) => roleIds.includes(role.id))
}

export function permissionsFor(policy, agentId) {
  return new Set(rolesFor(policy, agentId).flatMap((role) => role.permissions))
}

function checkRoleBased(level, policy, step) {
  const agent = nameOf(level.agents, step.agent)
  const permission = level.permissions.find(
    (item) => item.action === step.action && item.file === step.file,
  )
  const grantingRole = rolesFor(policy, step.agent).find((role) =>
    role.permissions.includes(permission?.id),
  )
  if (permission && grantingRole)
    return {
      allowed: true,
      reason: `${agent}'s ${grantingRole.name} role grants "${permission.name}".`,
    }
  const wanted = permission?.name ?? `${step.action} ${nameOf(level.files, step.file)}`
  return { allowed: false, reason: `None of ${agent}'s roles grants "${wanted}".` }
}

export function checkStep(level, policy, step) {
  if (level.model === 'dac') return checkDiscretionary(level, policy, step)
  if (level.model === 'blp') return checkMandatory(level, policy, step)
  return checkRoleBased(level, policy, step)
}

// separation of duties: one agent must never hold both permissions in a conflicting pair
export function findDutyConflicts(level, policy) {
  if (level.model !== 'rbac') return []
  const conflicts = []
  for (const agent of level.agents) {
    const held = permissionsFor(policy, agent.id)
    for (const constraint of level.constraints ?? []) {
      if (constraint.permissions.every((permission) => held.has(permission)))
        conflicts.push({ agent: agent.id, reason: constraint.reason })
    }
  }
  return conflicts
}

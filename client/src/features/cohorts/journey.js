import { getEnrollment, holdClassInvitation, safeError } from './api.js'

const CODE_ALPHABET = /^[A-HJ-NP-Z2-9]{16}$/
let pendingCode = null
let heldCode = null
let automaticJoinAuthorized = false

export function normalizeInvitationCode(value) {
  if (typeof value !== 'string') return null
  const normalized = value.toUpperCase().replace(/[\s-]/g, '')
  return CODE_ALPHABET.test(normalized) ? normalized : null
}

export function captureInvitationCodeFromLocation() {
  if (window.location.pathname !== '/join-class') return null
  const fragment = window.location.hash
  const query = new URLSearchParams(window.location.search)
  const queryHadCode = query.has('code')
  if (!fragment && !queryHadCode) return null
  if (queryHadCode) {
    query.delete('code')
  }
  let code = null
  if (fragment) {
    const params = new URLSearchParams(fragment.slice(1))
    const entries = [...params.entries()]
    if (entries.length === 1 && entries[0][0] === 'code' && params.getAll('code').length === 1) {
      code = normalizeInvitationCode(entries[0][1])
    }
  }
  const safeQuery = query.toString()
  const cleanUrl = `${window.location.pathname}${safeQuery ? `?${safeQuery}` : ''}`
  window.history.replaceState(window.history.state, '', cleanUrl)
  if (queryHadCode || fragment) heldCode = null
  pendingCode = queryHadCode ? null : code
  if (queryHadCode) return null
  return code
}

export function captureInvitationCode(code) {
  const normalized = normalizeInvitationCode(code)
  heldCode = null
  pendingCode = normalized
  return normalized
}

export async function prepareInvitation({ signal } = {}) {
  const code = pendingCode
  if (!code) return false
  try {
    await holdClassInvitation(code, signal)
    if (pendingCode === code) {
      pendingCode = null
      heldCode = code
    }
    return true
  } catch (error) {
    throw safeError(error)
  }
}

export async function resolveEnrollmentDestination(
  user,
  { signal, afterAccountAccess = false } = {},
) {
  automaticJoinAuthorized = false
  await prepareInvitation({ signal })
  if (!user) return '/'
  const roles = Array.isArray(user.globalRoles) ? user.globalRoles : []
  if (roles.some((role) => role === 'admin' || role === 'instructor')) {
    automaticJoinAuthorized = false
    return '/'
  }
  const enrollment = await getEnrollment(signal)
  if (enrollment?.hasInvitation) {
    automaticJoinAuthorized = afterAccountAccess && Boolean(heldCode)
    return automaticJoinAuthorized ? '/join-class?carry=1' : '/join-class'
  }
  automaticJoinAuthorized = false
  if (enrollment?.onboardingCompleted === false) return '/join-class?onboarding=1'
  return '/'
}

export function consumeAutomaticJoin() {
  const authorized = automaticJoinAuthorized
  automaticJoinAuthorized = false
  return authorized
}

export function getInvitationJoinInput() {
  return heldCode ? { code: heldCode } : { invitation: true }
}

export function clearHeldInvitation() {
  heldCode = null
  automaticJoinAuthorized = false
}

export function clearPendingInvitation({ preserveHeld = false } = {}) {
  pendingCode = null
  automaticJoinAuthorized = false
  if (!preserveHeld) heldCode = null
}

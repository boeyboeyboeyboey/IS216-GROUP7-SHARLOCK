export const GAME_ID = 'social-engineering-simulator'
export const RULESET_VERSION = '2026-10-11'
export const MAX_SCORE = 100
export const WEIGHTS = { noLeak: 60, verify: 25, efficiency: 15 }
export const DEFAULT_TURN_BUDGET = 8
export const MAX_MESSAGE_LENGTH = 1000
export const DECISIONS = ['refuse', 'verify-independently', 'share-code']

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const START_FIELDS = []
const MESSAGE_FIELDS = ['sessionId', 'content']
const COMPLETE_FIELDS = ['sessionId', 'decision']

export class SocialEngError extends Error {
  constructor(code, message, status = 400, fieldErrors = null) {
    super(message)
    this.name = 'SocialEngError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function invalid(fieldErrors) {
  return new SocialEngError(
    'SOC_INVALID_BODY',
    'That request could not be read. Reload the simulation and try again.',
    400,
    fieldErrors,
  )
}

function rejectUnknown(body, allowed, fieldErrors) {
  for (const key of Object.keys(body))
    if (!allowed.includes(key)) fieldErrors[key] = 'unsupported field'
}

function readSessionId(value, fieldErrors) {
  if (typeof value !== 'string' || !SESSION_ID.test(value)) {
    fieldErrors.sessionId = 'expected a valid session identifier'
    return null
  }
  return value
}

export function parseStart(body = {}) {
  if (body === undefined || body === null) return {}
  if (typeof body !== 'object' || Array.isArray(body)) throw invalid({ body: 'expected an object' })
  const fieldErrors = {}
  rejectUnknown(body, START_FIELDS, fieldErrors)
  if (Object.keys(fieldErrors).length) throw invalid(fieldErrors)
  return {}
}

export function parseMessage(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw invalid({ body: 'expected an object' })
  const fieldErrors = {}
  rejectUnknown(body, MESSAGE_FIELDS, fieldErrors)
  const sessionId = readSessionId(body.sessionId, fieldErrors)
  const content = body.content
  if (typeof content !== 'string' || content.trim().length < 1) {
    fieldErrors.content = 'expected a non-empty message'
  } else if (content.length > MAX_MESSAGE_LENGTH) {
    fieldErrors.content = `expected at most ${MAX_MESSAGE_LENGTH} characters`
  }
  if (Object.keys(fieldErrors).length) throw invalid(fieldErrors)
  return { sessionId, content }
}

export function parseComplete(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw invalid({ body: 'expected an object' })
  const fieldErrors = {}
  rejectUnknown(body, COMPLETE_FIELDS, fieldErrors)
  const sessionId = readSessionId(body.sessionId, fieldErrors)
  const decision = body.decision
  if (typeof decision !== 'string' || !DECISIONS.includes(decision)) {
    fieldErrors.decision = `expected one of ${DECISIONS.join(', ')}`
  }
  if (Object.keys(fieldErrors).length) throw invalid(fieldErrors)
  return { sessionId, decision }
}

export function rateLimited() {
  return new SocialEngError(
    'SOC_RATE_LIMITED',
    'Too many requests in a short time. Wait a moment and try again.',
    429,
  )
}

export function unavailable() {
  return new SocialEngError(
    'SOC_UNAVAILABLE',
    'The simulation is temporarily unavailable. Please try again shortly.',
    503,
  )
}

export const GAME_ID = 'phishing-post-mortem'
export const RULESET_VERSION = 'phish-1'
export const MAX_SCORE = 100
export const EMAIL_POINTS = 60
export const EVIDENCE_POINTS = 20
export const REQUIRED_EVIDENCE = 2

const CASE_ID = /^case-\d{2}$/
const DATASET_VERSION = /^\d{4}-\d{2}-\d{2}$/
const ACTION_ID = /^[A-Za-z0-9-]{8,64}$/
const TOKEN = /^[a-z0-9-]{1,48}$/
const VERDICT_FIELDS = ['caseId', 'datasetVersion', 'actionId', 'selectedEmailId', 'evidenceIds']

export class PhishingError extends Error {
  constructor(code, message, status = 400, fieldErrors = null) {
    super(message)
    this.name = 'PhishingError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function invalid(fieldErrors) {
  return new PhishingError(
    'PHISH_INVALID_REQUEST',
    'That request could not be read. Reload the case and try again.',
    400,
    fieldErrors,
  )
}

function readToken(value, pattern, field, fieldErrors) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    fieldErrors[field] = 'expected a valid identifier'
    return null
  }
  return value
}

export function parseCaseQuery(query = {}) {
  const unsupported = Object.keys(query).filter((key) => key !== 'after')
  if (unsupported.length) throw invalid({ [unsupported[0]]: 'unsupported query parameter' })
  const { after } = query
  if (after === undefined) return { after: null }
  // express can deliver arrays or objects for a repeated parameter, so the type is checked too
  if (typeof after !== 'string' || !CASE_ID.test(after))
    throw invalid({ after: 'expected a case identifier' })
  return { after }
}

export function parseVerdict(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw invalid({ body: 'expected an object' })
  const fieldErrors = Object.create(null)
  for (const key of Object.keys(body))
    if (!VERDICT_FIELDS.includes(key)) fieldErrors[key] = 'unsupported field'
  const caseId = readToken(body.caseId, CASE_ID, 'caseId', fieldErrors)
  const datasetVersion = readToken(
    body.datasetVersion,
    DATASET_VERSION,
    'datasetVersion',
    fieldErrors,
  )
  const actionId = readToken(body.actionId, ACTION_ID, 'actionId', fieldErrors)
  const selectedEmailId = readToken(body.selectedEmailId, TOKEN, 'selectedEmailId', fieldErrors)
  const evidenceIds = readEvidenceIds(body.evidenceIds, fieldErrors)
  if (Object.keys(fieldErrors).length) throw invalid(fieldErrors)
  return { caseId, datasetVersion, actionId, selectedEmailId, evidenceIds }
}

function readEvidenceIds(value, fieldErrors) {
  if (!Array.isArray(value) || value.length !== REQUIRED_EVIDENCE) {
    fieldErrors.evidenceIds = `expected exactly ${REQUIRED_EVIDENCE} evidence identifiers`
    return null
  }
  if (value.some((id) => typeof id !== 'string' || !TOKEN.test(id))) {
    fieldErrors.evidenceIds = 'expected valid evidence identifiers'
    return null
  }
  if (new Set(value).size !== value.length) {
    fieldErrors.evidenceIds = 'expected two different evidence identifiers'
    return null
  }
  return [...value]
}

export function caseNotFound() {
  return new PhishingError('PHISH_CASE_NOT_FOUND', 'That case could not be found.', 404)
}

export function datasetChanged() {
  return new PhishingError(
    'PHISH_DATASET_CHANGED',
    'This case was updated while you were reading. Start a fresh case to submit a verdict.',
    409,
  )
}

export function unknownSelection(fieldErrors) {
  return new PhishingError(
    'PHISH_UNKNOWN_SELECTION',
    'That selection does not belong to this case.',
    400,
    fieldErrors,
  )
}

export function rateLimited() {
  return new PhishingError(
    'PHISH_RATE_LIMITED',
    'Too many verdicts submitted. Wait a moment and try again.',
    429,
  )
}

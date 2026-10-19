import { AttemptError } from '../../attempts/policy.js'

export const GAME_ID = 'phishing-post-mortem'
export const RULESET_VERSION = 'phish-2'
// kept registered so phish-1 attempts saved before generated cases can still be finished
export const LEGACY_RULESET_VERSION = 'phish-1'
export const MAX_SCORE = 100
export const EMAIL_POINTS = 60
export const EVIDENCE_POINTS = 20
export const REQUIRED_EVIDENCE = 2
export const VERDICT_ACTION = 'submit-verdict'

const TOKEN = /^[a-z0-9-]{1,48}$/
const VERDICT_FIELDS = ['selectedEmailId', 'evidenceIds']

function invalidVerdict() {
  return new AttemptError(
    'ATTEMPT_INVALID_REQUEST',
    'That verdict could not be read. Choose one message and exactly two clues.',
    400,
  )
}

function isToken(value) {
  return typeof value === 'string' && TOKEN.test(value)
}

// the shared attempt service has already checked the envelope, so only the verdict payload is read here
export function parseVerdictAction(type, payload) {
  if (type !== VERDICT_ACTION) throw invalidVerdict()
  const keys = Object.keys(payload)
  if (keys.length !== VERDICT_FIELDS.length || keys.some((key) => !VERDICT_FIELDS.includes(key))) {
    throw invalidVerdict()
  }
  const { selectedEmailId, evidenceIds } = payload
  if (!isToken(selectedEmailId)) throw invalidVerdict()
  if (
    !Array.isArray(evidenceIds) ||
    evidenceIds.length !== REQUIRED_EVIDENCE ||
    !evidenceIds.every(isToken) ||
    new Set(evidenceIds).size !== evidenceIds.length
  ) {
    throw invalidVerdict()
  }
  return { selectedEmailId, evidenceIds: [...evidenceIds] }
}

export function caseUnavailable() {
  return new AttemptError(
    'PHISH_CASE_UNAVAILABLE',
    'This case file is no longer available. Start a new case.',
    409,
  )
}

export function datasetChanged() {
  return new AttemptError(
    'PHISH_DATASET_CHANGED',
    'This case was updated while you were reading. Start a new case to submit a verdict.',
    409,
  )
}

export function unknownSelection() {
  return new AttemptError(
    'PHISH_UNKNOWN_SELECTION',
    'That selection does not belong to this case.',
    400,
  )
}

export function verdictAlreadyRecorded() {
  return new AttemptError(
    'PHISH_VERDICT_RECORDED',
    'A verdict is already recorded for this case.',
    409,
  )
}

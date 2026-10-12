export const GAME_ID = 'cli-cyber-defender'
export const RULESET_VERSION = 'cli-1'
export const MODES = ['timed', 'practice']
export const INCIDENT_COUNT = 8
export const SHIFT_SECONDS = 100
export const MIN_WINDOW_SECONDS = 10
export const MAX_WINDOW_SECONDS = 15
export const POINTS_PER_STEP = 100
export const MAX_MULTIPLIER = 3
export const MAX_COMMAND_LENGTH = 120
export const MAX_COMMANDS_PER_RUN = 80
export const MAX_SCORE = Array.from(
  { length: INCIDENT_COUNT },
  (_, index) => POINTS_PER_STEP * Math.min(MAX_MULTIPLIER, index + 1),
).reduce((total, points) => total + points, 0)

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ACTION_ID = /^[A-Za-z0-9-]{8,64}$/
const INCIDENT_ID = /^incident-0[1-8]$/

export class CliError extends Error {
  constructor(code, message, status = 400, fieldErrors = null) {
    super(message)
    this.name = 'CliError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function invalid(fieldErrors) {
  return new CliError(
    'CLI_INVALID_BODY',
    'That request could not be read. Reload the game and try again.',
    400,
    fieldErrors,
  )
}

function readObject(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw invalid({ body: 'expected an object' })
  const fieldErrors = {}
  for (const key of Object.keys(body))
    if (!allowed.includes(key)) fieldErrors[key] = 'unsupported field'
  return fieldErrors
}

function readPattern(value, pattern, field, fieldErrors) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    fieldErrors[field] = 'expected a valid identifier'
    return null
  }
  return value
}

export function parseRunId(value) {
  if (typeof value !== 'string' || !RUN_ID.test(value)) throw runNotFound()
  return value
}

export function parseStart(body) {
  const fieldErrors = readObject(body, ['mode'])
  if (!MODES.includes(body.mode)) fieldErrors.mode = 'expected timed or practice'
  if (Object.keys(fieldErrors).length) throw invalid(fieldErrors)
  return { mode: body.mode }
}

export function parseCommandBody(body) {
  const fieldErrors = readObject(body, ['actionId', 'incidentId', 'command'])
  const actionId = readPattern(body.actionId, ACTION_ID, 'actionId', fieldErrors)
  const incidentId = readPattern(body.incidentId, INCIDENT_ID, 'incidentId', fieldErrors)
  const { command } = body
  if (typeof command !== 'string' || !command.length || command.length > MAX_COMMAND_LENGTH)
    fieldErrors.command = `expected 1 to ${MAX_COMMAND_LENGTH} characters`
  if (Object.keys(fieldErrors).length) throw invalid(fieldErrors)
  return { actionId, incidentId, command }
}

export function parseEmptyBody(body) {
  const fieldErrors = readObject(body, [])
  if (Object.keys(fieldErrors).length) throw invalid(fieldErrors)
  return {}
}

export function parseCompleteBody(body) {
  const fieldErrors = readObject(body, ['actionId'])
  const actionId = readPattern(body.actionId, ACTION_ID, 'actionId', fieldErrors)
  if (Object.keys(fieldErrors).length) throw invalid(fieldErrors)
  return { actionId }
}

export function runNotFound() {
  return new CliError(
    'CLI_RUN_NOT_FOUND',
    'That shift has ended or expired. Start a new shift to keep defending.',
    404,
  )
}

export function incidentClosed() {
  return new CliError(
    'CLI_INCIDENT_CLOSED',
    'That incident is no longer open. Check the current alert.',
    409,
  )
}

export function actionConflict() {
  return new CliError(
    'CLI_ACTION_CONFLICT',
    'That command was already submitted with different input.',
    409,
  )
}

export function runFinished() {
  return new CliError('CLI_RUN_FINISHED', 'This shift is already complete.', 409)
}

export function runNotFinished() {
  return new CliError(
    'CLI_RUN_NOT_FINISHED',
    'The shift is still running. Handle the remaining incidents first.',
    409,
  )
}

export function runPaused() {
  return new CliError('CLI_RUN_PAUSED', 'The shift is paused. Resume it to keep defending.', 409)
}

export function pauseUnavailable() {
  return new CliError(
    'CLI_PAUSE_UNAVAILABLE',
    'Only a timed shift that is still running can be paused.',
    409,
  )
}

export function commandLimit() {
  return new CliError(
    'CLI_COMMAND_LIMIT',
    'This shift has reached its command limit. Start a new shift.',
    409,
  )
}

export function rateLimited() {
  return new CliError('CLI_RATE_LIMITED', 'Too many requests. Wait a moment and try again.', 429)
}

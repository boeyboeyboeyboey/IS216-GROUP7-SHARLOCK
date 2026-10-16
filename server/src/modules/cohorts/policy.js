import { Types } from 'mongoose'
import { createHash, randomBytes } from 'node:crypto'

const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const codePattern = /^[A-HJ-NP-Z2-9]{16}$/
const codeLifetimeMs = 7 * 24 * 60 * 60 * 1000

export class CohortError extends Error {
  constructor(code, message, status = 400, fieldErrors) {
    super(message)
    this.name = 'CohortError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export function hashEnrollmentCode(code) {
  const normalized = parseEnrollmentCode(code)
  return createHash('sha256').update(normalized).digest('hex')
}

export function createEnrollmentCode() {
  const bytes = randomBytes(16)
  const code = Array.from(bytes, (byte) => codeAlphabet[byte & 31]).join('')
  return { code, formatted: code.match(/.{4}/g).join('-') }
}

export function parseEnrollmentCode(value) {
  if (typeof value !== 'string' || value.length > 64) {
    throw validationError(Object.assign(Object.create(null), { code: 'Enter a valid class code.' }))
  }
  const normalized = value.replace(/[\s-]/g, '').toUpperCase()
  if (!codePattern.test(normalized)) {
    throw validationError(Object.assign(Object.create(null), { code: 'Enter a valid class code.' }))
  }
  return normalized
}

export function enrollmentCodeExpiry(now) {
  const timestamp = typeof now === 'function' ? now() : now
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) throw new TypeError('Enrollment clock is invalid.')
  return new Date(date.getTime() + codeLifetimeMs)
}

export function parseEnrollmentInput(input, { invitationHash = null } = {}) {
  if (!isRecord(input)) {
    throw validationError(Object.assign(Object.create(null), { _: 'Expected request fields.' }))
  }
  const keys = Reflect.ownKeys(input)
  if (keys.length === 1 && keys[0] === 'code') return { codeHash: hashEnrollmentCode(input.code) }
  if (keys.length === 1 && keys[0] === 'invitation' && input.invitation === true) {
    if (typeof invitationHash !== 'string' || !/^[a-f\d]{64}$/.test(invitationHash)) {
      throw new CohortError('COHORT_CODE_UNAVAILABLE', 'This class code is unavailable.', 404)
    }
    return { codeHash: invitationHash }
  }
  rejectFields(input, ['code', 'invitation'])
  throw validationError(
    Object.assign(Object.create(null), { _: 'Check the request fields and try again.' }),
  )
}

function exactInput(input, fields) {
  if (
    !isRecord(input) ||
    Reflect.ownKeys(input).some((key) => typeof key !== 'string' || !fields.includes(key))
  ) {
    throw validationError(
      Object.assign(Object.create(null), { _: 'Check the request fields and try again.' }),
    )
  }
  if (fields.some((field) => !Object.hasOwn(input, field))) {
    throw validationError(
      Object.assign(Object.create(null), { _: 'Check the request fields and try again.' }),
    )
  }
  return input
}

export function parseOnboardingInput(input) {
  exactInput(input, ['completed'])
  if (input.completed !== true) {
    throw validationError(
      Object.assign(Object.create(null), { completed: 'Confirm class setup is complete.' }),
    )
  }
  return { completed: true }
}

export function parseDecisionInput(input) {
  exactInput(input, ['status', 'expectedRevision'])
  if (!['active', 'removed'].includes(input.status)) {
    throw validationError(
      Object.assign(Object.create(null), { status: 'Choose approve or remove.' }),
    )
  }
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw validationError(
      Object.assign(Object.create(null), {
        expectedRevision: 'Refresh the request before deciding.',
      }),
    )
  }
  return { status: input.status, expectedRevision: input.expectedRevision }
}

export function parseCodeRevisionInput(input) {
  exactInput(input, ['expectedRevision'])
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw validationError(
      Object.assign(Object.create(null), {
        expectedRevision: 'Refresh the class code before changing it.',
      }),
    )
  }
  return { expectedRevision: input.expectedRevision }
}

export function parseMemberListQuery(query) {
  if (!isRecord(query))
    throw validationError(Object.assign(Object.create(null), { _: 'Expected query fields.' }))
  rejectFields(query, ['page', 'limit', 'status'])
  const status = Object.hasOwn(query, 'status') ? query.status : 'pending'
  if (!['pending', 'active', 'removed'].includes(status)) {
    throw validationError(
      Object.assign(Object.create(null), { status: 'Choose a valid membership status.' }),
    )
  }
  const pagination = {}
  if (Object.hasOwn(query, 'page')) pagination.page = query.page
  if (Object.hasOwn(query, 'limit')) pagination.limit = query.limit
  const { page, limit } = parseListQuery(pagination)
  return { page, limit, skip: (page - 1) * limit, status }
}

export { codeLifetimeMs as ENROLLMENT_CODE_LIFETIME_MS }

export function parsePagination({ page = 1, limit = 20 } = {}) {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    throw new CohortError('VALIDATION_ERROR', 'Check the request fields and try again.', 400)
  }
  return { page, limit, skip: (page - 1) * limit }
}

function validationError(fieldErrors) {
  return new CohortError(
    'VALIDATION_ERROR',
    'Check the request fields and try again.',
    400,
    fieldErrors,
  )
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function rejectFields(value, allowed) {
  const fieldErrors = Object.create(null)
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fieldErrors[key] = 'This field is not allowed.'
  }
  if (Object.keys(fieldErrors).length) throw validationError(fieldErrors)
}

function parsePositiveInteger(value, field, maximum) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value) || Number(value) < 1) {
    throw validationError(
      Object.assign(Object.create(null), { [field]: 'Enter a positive whole number.' }),
    )
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw validationError(
      Object.assign(Object.create(null), { [field]: `Enter a number from 1 to ${maximum}.` }),
    )
  }
  return parsed
}

export function parseListQuery(query) {
  if (!isRecord(query)) {
    throw validationError(Object.assign(Object.create(null), { _: 'Expected query fields.' }))
  }
  rejectFields(query, ['page', 'limit'])

  return {
    page: Object.hasOwn(query, 'page') ? parsePositiveInteger(query.page, 'page', 10000) : 1,
    limit: Object.hasOwn(query, 'limit') ? parsePositiveInteger(query.limit, 'limit', 50) : 20,
  }
}

export function parseObjectId(value) {
  if (
    typeof value !== 'string' ||
    !/^[a-f\d]{24}$/i.test(value) ||
    !Types.ObjectId.isValid(value)
  ) {
    throw validationError(Object.assign(Object.create(null), { id: 'Enter a valid identifier.' }))
  }
  return value.toLowerCase()
}

export function parseRequestedContext(input) {
  if (!isRecord(input)) {
    throw validationError(Object.assign(Object.create(null), { _: 'Expected a context object.' }))
  }
  rejectFields(input, ['kind', 'cohortId'])
  if (!Object.hasOwn(input, 'kind') || !['personal', 'cohort'].includes(input.kind)) {
    throw validationError(
      Object.assign(Object.create(null), { kind: 'Choose personal or cohort context.' }),
    )
  }

  if (input.kind === 'personal') {
    if (
      Object.hasOwn(input, 'cohortId') &&
      input.cohortId !== null &&
      input.cohortId !== undefined
    ) {
      throw validationError(
        Object.assign(Object.create(null), {
          cohortId: 'Personal context cannot include a cohort.',
        }),
      )
    }
    return { kind: 'personal', cohortId: null }
  }

  if (!Object.hasOwn(input, 'cohortId')) {
    throw validationError(Object.assign(Object.create(null), { cohortId: 'Choose a cohort.' }))
  }
  try {
    return { kind: 'cohort', cohortId: parseObjectId(input.cohortId) }
  } catch {
    throw validationError(
      Object.assign(Object.create(null), { cohortId: 'Enter a valid cohort identifier.' }),
    )
  }
}

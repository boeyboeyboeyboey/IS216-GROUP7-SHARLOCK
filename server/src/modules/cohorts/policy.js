import { Types } from 'mongoose'

export class CohortError extends Error {
  constructor(code, message, status = 400, fieldErrors) {
    super(message)
    this.name = 'CohortError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

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

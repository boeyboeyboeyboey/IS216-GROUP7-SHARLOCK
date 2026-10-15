import { createHash } from 'node:crypto'
import { parseRequestedContext } from '../cohorts/policy.js'

export const MAX_INPUT_BYTES = 16 * 1024
export const MAX_STATE_BYTES = 262144
export const MAX_DOCUMENT_BYTES = 4194304
export const MAX_RECEIPTS = 256
export const MAX_PUBLIC_JSON_BYTES = 131072

const MAX_INPUT_DEPTH = 12
const MAX_INPUT_NODES = 2000
const MAX_PUBLIC_DEPTH = 32
const MAX_PUBLIC_NODES = 50000
const invalidMessage = 'Check the request fields and try again.'
const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const kebabPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])

export class AttemptError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'AttemptError'
    this.code = code
    this.status = status
  }
}

export function parseCreateInput(input) {
  const parsed = parseTransportRecord(input, ['context'])
  try {
    return { context: parseRequestedContext(parsed.context) }
  } catch {
    throw invalidRequest()
  }
}

export function parseActionInput(input) {
  const parsed = parseTransportRecord(input, ['actionId', 'expectedRevision', 'type', 'payload'])
  if (
    typeof parsed.actionId !== 'string' ||
    !uuidPattern.test(parsed.actionId) ||
    !isRevision(parsed.expectedRevision) ||
    typeof parsed.type !== 'string' ||
    parsed.type.length < 1 ||
    parsed.type.length > 64 ||
    !kebabPattern.test(parsed.type) ||
    !isPlainRecord(parsed.payload)
  ) {
    throw invalidRequest()
  }
  return {
    actionId: parsed.actionId.toLowerCase(),
    expectedRevision: parsed.expectedRevision,
    type: parsed.type,
    payload: parsed.payload,
  }
}

export function parseCompleteInput(input) {
  const parsed = parseTransportRecord(input, ['actionId', 'expectedRevision'])
  if (
    typeof parsed.actionId !== 'string' ||
    !uuidPattern.test(parsed.actionId) ||
    !isRevision(parsed.expectedRevision)
  ) {
    throw invalidRequest()
  }
  return { actionId: parsed.actionId.toLowerCase(), expectedRevision: parsed.expectedRevision }
}

export function parseAttemptId(input) {
  if (typeof input !== 'string' || !/^[a-f\d]{24}$/i.test(input)) throw invalidRequest()
  return input.toLowerCase()
}

export function parseGameId(input) {
  if (
    typeof input !== 'string' ||
    input.length < 1 ||
    input.length > 80 ||
    !kebabPattern.test(input)
  ) {
    throw invalidRequest()
  }
  return input
}

export function assertEmptyQuery(query) {
  try {
    assertJsonValue(query, {
      maxBytes: MAX_INPUT_BYTES,
      maxDepth: MAX_INPUT_DEPTH,
      maxNodes: MAX_INPUT_NODES,
      rootRecord: true,
    })
  } catch {
    throw invalidRequest()
  }
  if (Reflect.ownKeys(query).length !== 0) throw invalidRequest()
}

export function stableRequestHash(input) {
  const canonical = canonicalJson(input, {
    maxBytes: MAX_INPUT_BYTES + 256,
    maxDepth: MAX_INPUT_DEPTH,
    maxNodes: MAX_INPUT_NODES,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

export function assertJsonValue(
  value,
  {
    maxBytes = MAX_INPUT_BYTES,
    maxDepth = MAX_INPUT_DEPTH,
    maxNodes = MAX_INPUT_NODES,
    rootRecord = false,
  } = {},
) {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0 ||
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 0 ||
    !Number.isSafeInteger(maxNodes) ||
    maxNodes < 1
  ) {
    throw new TypeError('Invalid JSON bounds.')
  }
  if (rootRecord && !isPlainRecord(value)) throw new TypeError('Expected a JSON record.')
  canonicalJson(value, { maxBytes, maxDepth, maxNodes })
  return value
}

export function encodePublicJson(value, maxBytes = MAX_PUBLIC_JSON_BYTES) {
  return canonicalJson(value, {
    maxBytes,
    maxDepth: MAX_PUBLIC_DEPTH,
    maxNodes: MAX_PUBLIC_NODES,
  })
}

function parseTransportRecord(input, expectedFields) {
  try {
    assertJsonValue(input, {
      maxBytes: MAX_INPUT_BYTES,
      maxDepth: MAX_INPUT_DEPTH,
      maxNodes: MAX_INPUT_NODES,
      rootRecord: true,
    })
  } catch {
    throw invalidRequest()
  }
  const keys = Reflect.ownKeys(input)
  if (
    keys.length !== expectedFields.length ||
    keys.some((key) => typeof key !== 'string' || !expectedFields.includes(key)) ||
    expectedFields.some((field) => !Object.hasOwn(input, field))
  ) {
    throw invalidRequest()
  }
  return JSON.parse(
    canonicalJson(input, {
      maxBytes: MAX_INPUT_BYTES,
      maxDepth: MAX_INPUT_DEPTH,
      maxNodes: MAX_INPUT_NODES,
    }),
  )
}

function canonicalJson(value, { maxBytes, maxDepth, maxNodes }) {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0 ||
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 0 ||
    !Number.isSafeInteger(maxNodes) ||
    maxNodes < 1
  ) {
    throw new TypeError('Invalid JSON bounds.')
  }
  const seen = new Set()
  let nodes = 0
  try {
    return encodeValue(value, 0)
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('JSON value is invalid.', { cause: error })
  }

  function encodeValue(current, depth) {
    nodes += 1
    if (nodes > maxNodes || depth > maxDepth) throw new TypeError('JSON value exceeds its bounds.')
    if (current === null) return 'null'
    if (typeof current === 'string') {
      if (Buffer.byteLength(current, 'utf8') > maxBytes)
        throw new TypeError('JSON value is too large.')
      return checked(JSON.stringify(current))
    }
    if (typeof current === 'boolean') return checked(JSON.stringify(current))
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new TypeError('JSON number is invalid.')
      return checked(JSON.stringify(current))
    }
    if (typeof current !== 'object') throw new TypeError('JSON value is invalid.')
    if (seen.has(current)) throw new TypeError('JSON value is cyclic.')
    seen.add(current)
    let encoded
    if (Array.isArray(current)) {
      encoded = encodeArray(current, depth)
    } else {
      encoded = encodeRecord(current, depth)
    }
    seen.delete(current)
    return encoded
  }

  function encodeArray(current, depth) {
    if (Object.getPrototypeOf(current) !== Array.prototype)
      throw new TypeError('JSON array is invalid.')
    if (current.length > maxNodes) throw new TypeError('JSON array is too large.')
    const ownKeys = Reflect.ownKeys(current)
    if (
      ownKeys.length !== current.length + 1 ||
      ownKeys.some((key) => key !== 'length' && !isArrayIndex(key, current.length))
    ) {
      throw new TypeError('JSON array is invalid.')
    }
    const items = []
    let size = 2
    for (let index = 0; index < current.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, String(index))
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError('JSON array is invalid.')
      }
      const item = encodeValue(descriptor.value, depth + 1)
      size += Buffer.byteLength(item, 'utf8')
      if (index > 0) size += 1
      if (size > maxBytes) throw new TypeError('JSON value is too large.')
      items.push(item)
    }
    return `[${items.join(',')}]`
  }

  function encodeRecord(current, depth) {
    if (!isPlainRecord(current)) throw new TypeError('JSON record is invalid.')
    const keys = Reflect.ownKeys(current)
    if (keys.some((key) => typeof key !== 'string' || !isSafeKey(key))) {
      throw new TypeError('JSON key is invalid.')
    }
    const sortedKeys = keys.sort()
    const fields = []
    let size = 2
    for (const key of sortedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key)
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError('JSON record is invalid.')
      }
      if (Buffer.byteLength(key, 'utf8') > maxBytes) throw new TypeError('JSON key is too large.')
      const field = `${JSON.stringify(key)}:${encodeValue(descriptor.value, depth + 1)}`
      size += Buffer.byteLength(field, 'utf8')
      if (fields.length > 0) size += 1
      if (size > maxBytes) throw new TypeError('JSON value is too large.')
      fields.push(field)
    }
    return `{${fields.join(',')}}`
  }

  function checked(encoded) {
    if (Buffer.byteLength(encoded, 'utf8') > maxBytes)
      throw new TypeError('JSON value is too large.')
    return encoded
  }
}

function isRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isSafeKey(key) {
  return !unsafeKeys.has(key) && !key.startsWith('$') && !key.includes('.')
}

function isArrayIndex(key, length) {
  if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)) return false
  const index = Number(key)
  return Number.isSafeInteger(index) && index < length
}

function invalidRequest() {
  return new AttemptError('ATTEMPT_INVALID_REQUEST', invalidMessage, 400)
}

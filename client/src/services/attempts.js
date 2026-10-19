import { api } from './api.js'
import { requestCsrfToken } from '../features/auth/api.js'
import { useAuthStore } from '../features/auth/store.js'

// shared browser side of the saved-attempt contract in server/src/modules/attempts/README.md
// games call these four requests instead of adding their own result endpoints

const TIMEOUT_MS = 15000

export function newActionId() {
  if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID()
  // randomUUID needs a secure page, so a dev server opened by lan ip builds a v4 uuid by hand
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// the csrf token lasts for the session and /auth/csrf is rate limited per address, so the token
// the auth store already holds is reused; a token is fetched here only when none is held or
// the server rejected the one sent
let cachedToken = ''
let pendingToken = null

export function forgetCsrfToken() {
  cachedToken = ''
  pendingToken = null
}

function storeToken() {
  try {
    return useAuthStore().csrfToken || ''
  } catch {
    // no active pinia, for example in an isolated test
    return ''
  }
}

function csrfToken({ refresh = false } = {}) {
  const known = cachedToken || storeToken()
  if (!refresh && known) return Promise.resolve(known)
  if (pendingToken) return pendingToken
  const request = requestCsrfToken()
    .then((token) => {
      if (pendingToken === request) cachedToken = token
      return token
    })
    .finally(() => {
      if (pendingToken === request) pendingToken = null
    })
  pendingToken = request
  return request
}

async function send(path, body, signal, token) {
  signal?.throwIfAborted()
  const { data } = await api.post(path, body, {
    signal,
    timeout: TIMEOUT_MS,
    headers: { 'X-CSRF-Token': token },
  })
  return data
}

async function post(path, body, signal) {
  try {
    return await send(path, body, signal, await csrfToken())
  } catch (error) {
    // a csrf rejection happens before the server handles the request, so one retry is safe
    if (attemptErrorCode(error) !== 'CSRF_INVALID') throw error
    return send(path, body, signal, await csrfToken({ refresh: true }))
  }
}

export function startAttempt(gameId, { context = { kind: 'personal' }, signal } = {}) {
  return post(`/games/${encodeURIComponent(gameId)}/attempts`, { context }, signal)
}

export async function readAttempt(attemptId, { signal } = {}) {
  const { data } = await api.get(`/attempts/${encodeURIComponent(attemptId)}`, {
    signal,
    timeout: TIMEOUT_MS,
  })
  return data
}

// retry a lost response with the same actionId and expectedRevision so the server replays it
export function sendAttemptAction(attemptId, action, { signal } = {}) {
  const { actionId, expectedRevision, type, payload } = action
  return post(
    `/attempts/${encodeURIComponent(attemptId)}/actions`,
    { actionId, expectedRevision, type, payload },
    signal,
  )
}

export function completeAttempt(attemptId, { actionId, expectedRevision }, { signal } = {}) {
  return post(
    `/attempts/${encodeURIComponent(attemptId)}/complete`,
    { actionId, expectedRevision },
    signal,
  )
}

export function attemptErrorCode(error) {
  const code = error?.response?.data?.error?.code
  return typeof code === 'string' ? code : ''
}

export function attemptErrorMessage(error, fallback) {
  const message = error?.response?.data?.error?.message
  return typeof message === 'string' && message ? message : fallback
}

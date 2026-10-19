import { api } from './api.js'
import { requestCsrfToken } from '../features/auth/api.js'

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

async function post(path, body, signal) {
  const csrfToken = await requestCsrfToken()
  signal?.throwIfAborted()
  const { data } = await api.post(path, body, {
    signal,
    timeout: TIMEOUT_MS,
    headers: { 'X-CSRF-Token': csrfToken },
  })
  return data
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

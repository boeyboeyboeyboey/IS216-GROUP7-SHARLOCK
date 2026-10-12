import { api } from '../../services/api.js'

const BASE = '/games/social-engineering-simulator'

export const MAX_MESSAGE_LENGTH = 1000

export const DECISIONS = [
  {
    id: 'refuse',
    label: 'Refuse and end',
    description: 'Decline to share the code and close the conversation.',
  },
  {
    id: 'verify-independently',
    label: 'Verify through a known channel',
    description:
      'Refuse, then confirm the request using a help-desk ticket or a number you look up yourself.',
  },
  {
    id: 'share-code',
    label: 'Share the code',
    description: 'Hand over the reset code (this is the unsafe choice).',
  },
]

export function startSession(signal) {
  return api.post(`${BASE}/session`, {}, { signal, timeout: 15000 }).then(({ data }) => data)
}

export function sendMessage(sessionId, content, signal) {
  return api
    .post(`${BASE}/message`, { sessionId, content }, { signal, timeout: 45000 })
    .then(({ data }) => data)
}

export function completeSession(sessionId, decision, signal) {
  return api
    .post(`${BASE}/complete`, { sessionId, decision }, { signal, timeout: 15000 })
    .then(({ data }) => data)
}

// true when the server no longer holds this session (restart, idle expiry or already completed)
export function isSessionGone(error) {
  return error?.response?.data?.error?.code === 'LLM_SESSION_NOT_FOUND'
}

export function simulatorErrorMessage(error, fallback) {
  const message = error?.response?.data?.error?.message
  return typeof message === 'string' && message ? message : fallback
}

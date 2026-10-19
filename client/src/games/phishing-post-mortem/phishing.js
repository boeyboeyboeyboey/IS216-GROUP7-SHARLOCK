import {
  attemptErrorCode,
  attemptErrorMessage,
  completeAttempt,
  newActionId,
  readAttempt,
  sendAttemptAction,
  startAttempt,
} from '../../services/attempts.js'

export const GAME_ID = 'phishing-post-mortem'
const VERDICT_ACTION = 'submit-verdict'

// every case is a saved attempt in the player's personal record
export function openSavedCase(signal) {
  return startAttempt(GAME_ID, { context: { kind: 'personal' }, signal })
}

export function rereadSavedCase(attemptId, signal) {
  return readAttempt(attemptId, { signal })
}

export function recordVerdict(attemptId, { actionId, expectedRevision, verdict }, signal) {
  return sendAttemptAction(
    attemptId,
    { actionId, expectedRevision, type: VERDICT_ACTION, payload: verdict },
    { signal },
  )
}

export function saveResult(attemptId, { actionId, expectedRevision }, signal) {
  return completeAttempt(attemptId, { actionId, expectedRevision }, { signal })
}

export { attemptErrorCode, newActionId }

export function phishingErrorMessage(error, fallback) {
  return attemptErrorMessage(error, fallback)
}

export function mailTime(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function clockTime(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function senderInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

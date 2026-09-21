import { api } from '../../services/api.js'

const BASE = '/games/phishing-post-mortem'

export function fetchCase(after, signal) {
  return api
    .get(`${BASE}/case`, { params: after ? { after } : {}, signal, timeout: 15000 })
    .then(({ data }) => data)
}

export function submitVerdict(payload, signal) {
  return api.post(`${BASE}/verdict`, payload, { signal, timeout: 15000 }).then(({ data }) => data)
}

export function newActionId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function phishingErrorMessage(error, fallback) {
  const message = error?.response?.data?.error?.message
  return typeof message === 'string' && message ? message : fallback
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

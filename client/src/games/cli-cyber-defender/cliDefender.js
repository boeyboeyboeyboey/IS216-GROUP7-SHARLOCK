import { api } from '../../services/api.js'

const BASE = '/games/cli-cyber-defender/runs'

export const MAX_COMMAND_LENGTH = 120

export const COMMAND_TEMPLATES = [
  { id: 'block-ip', template: 'block ip ', label: 'block ip', hint: 'Block an outside address' },
  {
    id: 'disable-user',
    template: 'disable user ',
    label: 'disable user',
    hint: 'Lock a compromised account',
  },
  {
    id: 'isolate-host',
    template: 'isolate host ',
    label: 'isolate host',
    hint: 'Cut an infected machine off the network',
  },
]

export const LOCAL_COMMANDS = ['help', 'clear', 'history']

export function startRun(mode, signal) {
  return api.post(BASE, { mode }, { signal }).then(({ data }) => data)
}

export function fetchRun(runId, signal) {
  return api.get(`${BASE}/${runId}`, { signal }).then(({ data }) => data)
}

export function pauseRun(runId, signal) {
  return api.post(`${BASE}/${runId}/pause`, {}, { signal }).then(({ data }) => data)
}

export function resumeRun(runId, signal) {
  return api.post(`${BASE}/${runId}/resume`, {}, { signal }).then(({ data }) => data)
}

export function submitCommand(runId, body, signal) {
  return api.post(`${BASE}/${runId}/commands`, body, { signal }).then(({ data }) => data)
}

export function completeRun(runId, actionId, signal) {
  return api.post(`${BASE}/${runId}/complete`, { actionId }, { signal }).then(({ data }) => data)
}

export function createActionId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  )
}

export function errorCode(error) {
  return error?.response?.data?.error?.code ?? null
}

export function errorMessage(error, fallback) {
  const message = error?.response?.data?.error?.message
  return typeof message === 'string' && message ? message : fallback
}

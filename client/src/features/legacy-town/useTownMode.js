import { computed, ref } from 'vue'

export const TOWN_MODE_KEY = 'sharlock.townMode'
const MODES = ['3d', '2d']
let webgl2Probe

export function readStoredMode() {
  try {
    const stored = localStorage.getItem(TOWN_MODE_KEY)
    return MODES.includes(stored) ? stored : null
  } catch {
    return null
  }
}

function writeStoredMode(mode) {
  try {
    localStorage.setItem(TOWN_MODE_KEY, mode)
  } catch {
    // storage can be blocked; the choice then lasts for this visit only
  }
}

// probed once per page load
export function hasWebgl2() {
  if (webgl2Probe === undefined) {
    try {
      webgl2Probe = Boolean(document.createElement('canvas').getContext('webgl2'))
    } catch {
      webgl2Probe = false
    }
  }
  return webgl2Probe
}

// a forced fallback never replaces the stored choice
export function resolveMode({ stored, webgl2, failed }) {
  if (!webgl2 || failed) return { mode: '2d', forced: true }
  return { mode: stored ?? '3d', forced: false }
}

export function useTownMode({ webgl2 = hasWebgl2() } = {}) {
  const choice = ref(readStoredMode())
  const failed = ref(false)
  const resolved = computed(() =>
    resolveMode({ stored: choice.value, webgl2, failed: failed.value }),
  )
  const mode = computed(() => resolved.value.mode)
  const forced = computed(() => resolved.value.forced)

  function setMode(next) {
    if (!MODES.includes(next)) return
    choice.value = next
    writeStoredMode(next)
  }

  return {
    mode,
    forced,
    toggle: () => {
      if (!forced.value) setMode(mode.value === '3d' ? '2d' : '3d')
    },
    markFailed: () => {
      failed.value = true
    },
  }
}

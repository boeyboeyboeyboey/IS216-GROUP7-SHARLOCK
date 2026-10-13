import { onBeforeUnmount, ref } from 'vue'

// each cue is a short list of [frequency in hz, start offset in s, duration in s]
const CUES = {
  ok: [
    [660, 0, 0.08],
    [990, 0.09, 0.12],
  ],
  fail: [
    [180, 0, 0.18],
    [140, 0.16, 0.22],
  ],
  miss: [[150, 0, 0.3]],
  on: [
    [523, 0, 0.08],
    [784, 0.09, 0.14],
  ],
  alert: [
    [880, 0, 0.1],
    [660, 0.12, 0.1],
  ],
}

// generated beeps, off by default and never remembered between visits
export function useCliSound() {
  const enabled = ref(false)
  const unavailable = ref(false)
  let context = null

  function audioContextClass() {
    return globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null
  }

  async function toggle() {
    if (enabled.value) {
      enabled.value = false
      await context?.suspend().catch(() => {})
      return
    }
    const AudioContextClass = audioContextClass()
    if (!AudioContextClass) {
      unavailable.value = true
      return
    }
    try {
      context ??= new AudioContextClass()
      await context.resume()
      enabled.value = true
      unavailable.value = false
      // a short chirp confirms the speakers work as soon as sound is switched on
      play('on')
    } catch {
      unavailable.value = true
    }
  }

  function play(kind) {
    const cue = CUES[kind]
    if (!enabled.value || !context || !cue) return
    const start = context.currentTime
    for (const [frequency, offset, duration] of cue) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.06, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + duration)
    }
  }

  onBeforeUnmount(() => {
    enabled.value = false
    context?.close().catch(() => {})
    context = null
  })

  return { enabled, unavailable, toggle, play }
}

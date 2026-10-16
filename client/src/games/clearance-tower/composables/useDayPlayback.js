import { computed, onBeforeUnmount, ref, watch } from 'vue'

export const STEP_MS = 1500

// steps through the day's events one at a time; index -1 means the day has not started
export function useDayPlayback(events) {
  const index = ref(-1)
  const playing = ref(false)
  const speed = ref(1)
  let timer = null

  const total = computed(() => events.value.length)
  const finished = computed(() => index.value >= total.value - 1)
  const current = computed(() => events.value[index.value] ?? null)
  const shown = computed(() => events.value.slice(0, index.value + 1))

  function pause() {
    clearInterval(timer)
    timer = null
    playing.value = false
  }

  function step() {
    if (finished.value) return pause()
    index.value += 1
    if (finished.value) pause()
  }

  function play() {
    if (finished.value) return
    pause()
    playing.value = true
    step()
    timer = setInterval(step, STEP_MS / speed.value)
  }

  function skip() {
    pause()
    index.value = total.value - 1
  }

  function setSpeed(value) {
    speed.value = value
    if (playing.value) {
      clearInterval(timer)
      timer = setInterval(step, STEP_MS / speed.value)
    }
  }

  function reset() {
    pause()
    index.value = -1
  }

  watch(events, reset)
  onBeforeUnmount(pause)

  return {
    index,
    playing,
    speed,
    total,
    finished,
    current,
    shown,
    play,
    pause,
    step,
    skip,
    setSpeed,
    reset,
  }
}

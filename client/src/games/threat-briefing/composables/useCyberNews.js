import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchEdition } from '../news.js'

export function useCyberNews(section, range) {
  const edition = ref(null)
  const loading = ref(false)
  const error = ref('')
  const refreshAt = ref(0)
  const clock = ref(Date.now())
  let controller
  let generation = 0
  let disposed = false
  const canRefresh = computed(() => !loading.value && clock.value >= refreshAt.value)
  const stale = computed(() =>
    Boolean(edition.value && Date.parse(edition.value.freshUntil) <= clock.value),
  )
  async function load(clear = false) {
    controller?.abort()
    controller = new AbortController()
    const request = ++generation
    if (clear) edition.value = null
    error.value = ''
    loading.value = true
    try {
      const data = await fetchEdition(section.value, range.value, controller.signal)
      if (request !== generation || disposed) return
      if (
        !Array.isArray(data.articles) ||
        data.articles.length > 50 ||
        data.section !== section.value ||
        data.range !== range.value ||
        !Number.isFinite(Date.parse(data.expiresAt)) ||
        Date.parse(data.expiresAt) <= Date.now()
      )
        throw new Error()
      edition.value = data
      refreshAt.value = Date.parse(data.refreshAvailableAt) || Date.now() + 60000
    } catch (failure) {
      if (request !== generation || disposed || controller.signal.aborted) return
      error.value =
        failure.response?.data?.error?.message ||
        'The newspaper could not be loaded. Please try again shortly.'
      refreshAt.value = Math.max(
        Date.now() + 1000,
        Date.parse(failure.response?.data?.refreshAvailableAt) || Date.now() + 5000,
      )
    } finally {
      if (request === generation && !disposed) loading.value = false
    }
  }
  function tick() {
    clock.value = Date.now()
    if (edition.value && Date.parse(edition.value.expiresAt) <= clock.value) {
      edition.value = null
      error.value = 'This edition has expired. Check for a fresh edition.'
      refreshAt.value = 0
    }
  }
  const timer = setInterval(tick, 1000)
  document.addEventListener('visibilitychange', tick)
  watch([section, range], () => load(true), { immediate: true })
  onBeforeUnmount(() => {
    disposed = true
    generation++
    controller?.abort()
    clearInterval(timer)
    document.removeEventListener('visibilitychange', tick)
    edition.value = null
  })
  return {
    edition,
    loading,
    error,
    stale,
    refreshAt,
    canRefresh,
    refresh: () => canRefresh.value && load(),
  }
}

import { computed, onBeforeUnmount, ref } from 'vue'
import {
  createActionId,
  errorMessage,
  fetchLevels,
  startAttempt,
  submitAttempt,
} from '../clearanceTower.js'

// phases: levels → brief → design → predict → day → debrief
export function useClearanceTower() {
  const phase = ref('levels')
  const levels = ref([])
  const level = ref(null)
  const policy = ref(null)
  const predictions = ref({})
  const result = ref(null)
  const bestScores = ref({})
  const pending = ref(false)
  const error = ref('')
  let attemptId = null
  let actionId = null
  let controller = null

  // runs one request at a time; a newer request or leaving the game cancels the older one
  async function send(request, fallbackMessage) {
    controller?.abort()
    controller = new AbortController()
    const { signal } = controller
    pending.value = true
    error.value = ''
    try {
      return await request(signal)
    } catch (caught) {
      if (!signal.aborted) error.value = errorMessage(caught, fallbackMessage)
      return null
    } finally {
      if (!signal.aborted) pending.value = false
    }
  }

  async function loadLevels() {
    const data = await send(fetchLevels, 'The case list could not be loaded. Try again.')
    if (data) levels.value = data.levels
  }

  async function openLevel(levelId) {
    const data = await send(
      (signal) => startAttempt(levelId, signal),
      'That case could not be opened. Try again.',
    )
    if (!data) return
    attemptId = data.attemptId
    actionId = createActionId()
    level.value = data.level
    policy.value = structuredClone(data.level.startPolicy)
    predictions.value = {}
    result.value = null
    phase.value = 'brief'
  }

  const allPredicted = computed(() =>
    Boolean(level.value?.predictions.every((prompt) => predictions.value[prompt.id])),
  )

  const nextLevelId = computed(() => {
    const index = levels.value.findIndex((item) => item.id === level.value?.id)
    return levels.value[index + 1]?.id ?? null
  })

  async function runDay() {
    const body = {
      actionId,
      policy: policy.value,
      predictions: level.value.predictions.map((prompt) => ({
        id: prompt.id,
        verdict: predictions.value[prompt.id],
      })),
    }
    const data = await send(
      (signal) => submitAttempt(attemptId, body, signal),
      'The day could not be run. Your policy is still here, so try again.',
    )
    if (!data) return
    result.value = data
    const best = Math.max(bestScores.value[data.levelId] ?? 0, data.score)
    bestScores.value = { ...bestScores.value, [data.levelId]: best }
    phase.value = 'day'
  }

  function showPhase(nextPhase) {
    error.value = ''
    phase.value = nextPhase
  }

  onBeforeUnmount(() => controller?.abort())

  return {
    phase,
    levels,
    level,
    policy,
    predictions,
    result,
    bestScores,
    pending,
    error,
    allPredicted,
    nextLevelId,
    loadLevels,
    openLevel,
    runDay,
    showPhase,
  }
}

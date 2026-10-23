import { computed } from 'vue'
import { useAttempt } from '../../features/attempts/useAttempt.js'

export function useSqlInjection() {
  const attempt = useAttempt('sql-injection-arcade')
  const state = computed(() => attempt.snapshot.value?.publicState)
  const evaluation = computed(() => state.value?.evaluations.at(-1))
  const repairPhase = computed(
    () => state.value && (state.value.bypassAchieved || state.value.testCount >= 5),
  )
  return { ...attempt, state, evaluation, repairPhase }
}

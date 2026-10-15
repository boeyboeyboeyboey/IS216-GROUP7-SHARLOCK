import { computed, ref } from 'vue'
import { isSessionGone, sendVerifierMessage, simulatorErrorMessage } from '../simulator.js'

const FALLBACK_ERROR = 'That message could not be delivered. Try again in a moment.'

// State for the side chat with the real colleague who can confirm or deny the attacker's story.
export function useVerifierChat({ sessionId, getSignal, onLeaked, onSessionGone }) {
  const info = ref(null)
  const messages = ref([])
  const pending = ref(false)
  const turnsUsed = ref(0)
  const turnBudget = ref(0)
  const contacted = ref(false)
  const error = ref('')
  const ended = ref(false)
  const failedText = ref('')

  let generation = 0

  const canSend = computed(
    () =>
      Boolean(info.value) &&
      !pending.value &&
      !ended.value &&
      (turnBudget.value === 0 || turnsUsed.value < turnBudget.value),
  )

  function init(verifier) {
    clear()
    info.value = verifier ?? null
    turnBudget.value = verifier?.turnBudget ?? 0
  }

  function clear() {
    generation += 1
    info.value = null
    messages.value = []
    pending.value = false
    turnsUsed.value = 0
    turnBudget.value = 0
    contacted.value = false
    error.value = ''
    ended.value = false
    failedText.value = ''
  }

  // resolves with the colleague's reply text, or null when nothing was delivered
  async function send(content) {
    const text = content?.trim()
    if (!text || !canSend.value) return null
    const request = generation
    const before = messages.value
    messages.value = [...before, { role: 'you', content: text }]
    pending.value = true
    error.value = ''
    // reset first so an identical failure still changes the value and re-triggers the restore
    failedText.value = ''
    try {
      const data = await sendVerifierMessage(sessionId.value, text, getSignal?.())
      if (request !== generation) return null
      contacted.value = true
      failedText.value = ''
      turnsUsed.value = data.verifierTurnsUsed ?? turnsUsed.value + 1
      if (data.verifierTurnBudget) turnBudget.value = data.verifierTurnBudget
      if (data.reply)
        messages.value = [...messages.value, { role: 'colleague', content: data.reply }]
      if (data.ended || data.leaked) ended.value = true
      if (data.leaked) onLeaked?.()
      return data.reply ?? null
    } catch (requestError) {
      if (request !== generation) return null
      messages.value = before
      failedText.value = text
      if (isSessionGone(requestError)) {
        onSessionGone?.()
        return null
      }
      if (requestError?.response?.data?.error?.code === 'SOC_VERIFIER_LIMIT') {
        turnsUsed.value = turnBudget.value
      }
      error.value = simulatorErrorMessage(requestError, FALLBACK_ERROR)
      return null
    } finally {
      if (request === generation) pending.value = false
    }
  }

  return {
    info,
    messages,
    pending,
    turnsUsed,
    turnBudget,
    contacted,
    error,
    ended,
    failedText,
    canSend,
    init,
    send,
    clear,
  }
}

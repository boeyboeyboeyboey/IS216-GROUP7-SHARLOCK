import { computed, onBeforeUnmount, ref } from 'vue'
import { completeSession, sendMessage, simulatorErrorMessage, startSession } from '../simulator.js'

// status: idle (loading) | briefing (brief shown) | chatting | awaiting (reply in flight)
//         | ended (debrief shown) | error (fatal load failure)
export function useSocialEngineeringSession() {
  const status = ref('idle')
  const pending = ref(false)
  const persona = ref(null)
  const brief = ref(null)
  const messages = ref([])
  const turnsUsed = ref(0)
  const turnBudget = ref(0)
  const leaked = ref(false)
  const closed = ref(false)
  const result = ref(null)
  const error = ref('')
  const sessionId = ref('')

  let controller
  let generation = 0
  let disposed = false

  const canSend = computed(
    () => status.value === 'chatting' && !closed.value && !pending.value && !result.value,
  )
  const canDecide = computed(
    () => ['briefing', 'chatting'].includes(status.value) && !pending.value && !result.value,
  )

  function clearState() {
    persona.value = null
    brief.value = null
    messages.value = []
    turnsUsed.value = 0
    turnBudget.value = 0
    leaked.value = false
    closed.value = false
    result.value = null
    error.value = ''
    sessionId.value = ''
  }

  async function start() {
    controller?.abort()
    controller = new AbortController()
    const request = (generation += 1)
    clearState()
    status.value = 'idle'
    pending.value = true
    try {
      const data = await startSession(controller.signal)
      if (disposed || request !== generation) return
      sessionId.value = data.sessionId
      persona.value = data.persona
      brief.value = data.brief
      turnBudget.value = data.brief?.turnBudget ?? 0
      messages.value = [{ role: 'colleague', content: data.openingMessage }]
      status.value = 'briefing'
    } catch (requestError) {
      if (disposed || request !== generation) return
      status.value = 'error'
      error.value = simulatorErrorMessage(
        requestError,
        'The simulation could not be started. Check your connection and try again.',
      )
    } finally {
      if (!disposed && request === generation) pending.value = false
    }
  }

  // reveal the chat once the player has read the brief
  function begin() {
    if (status.value === 'briefing') status.value = 'chatting'
  }

  async function send(content) {
    const text = content?.trim()
    if (!text || !canSend.value) return
    const request = generation
    messages.value = [...messages.value, { role: 'you', content: text }]
    status.value = 'awaiting'
    pending.value = true
    error.value = ''
    try {
      const data = await sendMessage(sessionId.value, text, controller?.signal)
      if (disposed || request !== generation) return
      turnsUsed.value = data.turnsUsed
      turnBudget.value = data.turnBudget
      if (data.leaked) leaked.value = true
      if (data.ended) closed.value = true
      if (data.reply)
        messages.value = [...messages.value, { role: 'colleague', content: data.reply }]
      status.value = 'chatting'
    } catch (requestError) {
      if (disposed || request !== generation) return
      status.value = 'chatting'
      error.value = simulatorErrorMessage(
        requestError,
        'That message could not be delivered. Try again in a moment.',
      )
    } finally {
      if (!disposed && request === generation) pending.value = false
    }
  }

  async function complete(decision) {
    if (!canDecide.value && !closed.value) return
    if (result.value) return
    const request = generation
    status.value = 'awaiting'
    pending.value = true
    error.value = ''
    try {
      const data = await completeSession(sessionId.value, decision, controller?.signal)
      if (disposed || request !== generation) return
      result.value = data
      status.value = 'ended'
    } catch (requestError) {
      if (disposed || request !== generation) return
      status.value = 'chatting'
      error.value = simulatorErrorMessage(
        requestError,
        'The debrief could not be loaded. Try again in a moment.',
      )
    } finally {
      if (!disposed && request === generation) pending.value = false
    }
  }

  function reset() {
    return start()
  }

  onBeforeUnmount(() => {
    disposed = true
    controller?.abort()
  })

  return {
    status,
    pending,
    persona,
    brief,
    messages,
    turnsUsed,
    turnBudget,
    leaked,
    closed,
    result,
    error,
    canSend,
    canDecide,
    start,
    begin,
    send,
    complete,
    reset,
  }
}

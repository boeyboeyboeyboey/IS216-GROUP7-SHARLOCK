import { LlmError } from './llmError.js'

// glues the bounded chatSessionStore to the stateless llm adapter: each turn
// resends the whole stored (bounded) transcript, since the adapter/Ollama
// keep no memory of previous calls themselves.
export function createChatSessionRunner({ store, adapter }) {
  return {
    start() {
      return store.start()
    },
    async send(sessionId, { systemPrompt, content }) {
      const existing = store.get(sessionId)
      if (!existing) {
        throw new LlmError('LLM_SESSION_NOT_FOUND', 'Chat session not found or already ended.', 404)
      }
      // commit the turn only after the model replies so a failure leaves no stray message
      const { content: reply } = await adapter.chat({
        systemPrompt,
        messages: [...existing, { role: 'user', content }],
      })
      store.append(sessionId, { role: 'user', content })
      store.append(sessionId, { role: 'assistant', content: reply })
      return reply
    },
    end(sessionId) {
      store.end(sessionId)
    },
  }
}

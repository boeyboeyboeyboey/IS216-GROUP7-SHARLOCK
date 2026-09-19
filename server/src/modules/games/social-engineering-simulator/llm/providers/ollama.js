import { LlmError } from '../llmError.js'

export function createOllamaProvider({ baseUrl, model, authToken, fetchImpl = fetch }) {
  return {
    async chat({ systemPrompt, messages }) {
      const body = {
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: false,
      }
      const headers = { 'Content-Type': 'application/json' }
      if (authToken) headers.Authorization = `Bearer ${authToken}`
      let response
      try {
        response = await fetchImpl(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        })
      } catch {
        throw new LlmError('LLM_UPSTREAM_UNAVAILABLE', 'The LLM host could not be reached.')
      }
      if (!response.ok) {
        throw new LlmError('LLM_UPSTREAM_UNAVAILABLE', 'The LLM host returned an error.')
      }
      let payload
      try {
        payload = await response.json()
      } catch {
        throw new LlmError('LLM_UPSTREAM_UNAVAILABLE', 'The LLM host returned an invalid response.')
      }
      const content = payload?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new LlmError('LLM_UPSTREAM_UNAVAILABLE', 'The LLM host returned an empty response.')
      }
      return { content }
    },
  }
}

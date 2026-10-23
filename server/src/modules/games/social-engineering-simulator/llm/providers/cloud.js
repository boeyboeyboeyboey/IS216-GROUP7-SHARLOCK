import { LlmError } from '../llmError.js'

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'gemini-2.5-flash'

// google gemini provider (generateContent). gemini uses the roles user/model,
// so assistant turns are remapped to model and the system prompt rides in
// system_instruction rather than the message list
export function createCloudProvider({
  apiKey,
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = fetch,
}) {
  return {
    async chat({ systemPrompt, messages }) {
      const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        // thinking tokens share the output cap and cut replies short, so thinking is off
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }
      let response
      try {
        response = await fetchImpl(`${baseUrl}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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
      // a missing candidate usually means the reply was safety-blocked upstream
      const parts = payload?.candidates?.[0]?.content?.parts
      const content = Array.isArray(parts)
        ? parts
            .map((part) => part?.text ?? '')
            .join('')
            .trim()
        : ''
      if (!content) {
        throw new LlmError('LLM_UPSTREAM_UNAVAILABLE', 'The LLM host returned an empty response.')
      }
      return { content }
    },
  }
}

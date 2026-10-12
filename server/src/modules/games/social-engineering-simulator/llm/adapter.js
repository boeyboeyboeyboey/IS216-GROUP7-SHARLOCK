import { LlmError } from './llmError.js'
import { createOllamaProvider } from './providers/ollama.js'
import { createCloudProvider } from './providers/cloud.js'

export function createLlmAdapter({ baseUrl, model, apiKey, authToken, fetchImpl = fetch } = {}) {
  const mode = apiKey ? 'cloud' : baseUrl && model ? 'local' : null
  if (mode !== 'cloud' && Boolean(baseUrl) !== Boolean(model)) {
    throw new Error('LLM_BASE_URL and LLM_MODEL must both be set or both left empty.')
  }

  const provider =
    mode === 'cloud'
      ? // with an ollama base url also set, that model name is not a gemini model
        createCloudProvider({ apiKey, model: baseUrl ? undefined : model, fetchImpl })
      : mode === 'local'
        ? createOllamaProvider({ baseUrl, model, authToken, fetchImpl })
        : null

  return {
    mode,
    configured: mode !== null,
    async chat(request) {
      if (!provider) {
        throw new LlmError('LLM_NOT_CONFIGURED', 'No LLM provider is configured.')
      }
      if (request.messages.some((message) => !['user', 'assistant'].includes(message.role))) {
        throw new LlmError(
          'LLM_INVALID_MESSAGES',
          'messages must only use the user or assistant role.',
          400,
        )
      }
      return provider.chat(request)
    },
  }
}

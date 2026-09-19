import { LlmError } from '../llmError.js'

// eslint-disable-next-line no-unused-vars -- apiKey kept for a future real provider.
export function createCloudProvider({ apiKey }) {
  return {
    // eslint-disable-next-line no-unused-vars -- stub ignores its provider-shape params.
    async chat({ systemPrompt, messages }) {
      throw new LlmError(
        'LLM_CLOUD_NOT_IMPLEMENTED',
        'Cloud LLM provider is not implemented yet. Set LLM_BASE_URL/LLM_MODEL to use local Ollama instead.',
      )
    },
  }
}

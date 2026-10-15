import { createLlmAdapter } from './llm/adapter.js'
import { withTimeout } from './llmTimeout.js'

// attacker is always gemini, colleague is always ollama and never gets the api key
export function createGameAdapters(config, fetchImpl = fetch) {
  // a model without a key would make the adapter throw, so only pass both together
  const attacker = createLlmAdapter(
    config.llmApiKey ? { apiKey: config.llmApiKey, model: config.llmModel } : {},
  )
  const colleague = config.llmColleagueBaseUrl
    ? createLlmAdapter({
        baseUrl: config.llmColleagueBaseUrl,
        model: config.llmColleagueModel,
        authToken: config.llmColleagueAuthToken,
        fetchImpl: withTimeout(fetchImpl, config.llmColleagueTimeoutMs),
      })
    : null
  return { attacker, colleague }
}

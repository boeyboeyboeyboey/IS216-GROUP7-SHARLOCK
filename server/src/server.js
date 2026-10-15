import { initializeNewsStorage } from './modules/news/models.js'
import { createNewsStore } from './modules/news/store.js'
import { createGameAdapters } from './modules/games/social-engineering-simulator/llmConfig.js'
import { createSocialEngineeringService } from './modules/games/social-engineering-simulator/service.js'
import { createApp } from './app.js'
import { loadEnvironment } from './config/env.js'
import { connectDatabase } from './config/database.js'

let database
let server
let newsCleanup
let shuttingDown = false

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(newsCleanup)
  const timeout = setTimeout(() => process.exit(1), 5000).unref()
  if (server) await new Promise((resolve) => server.close(resolve))
  if (database) await database.close()
  clearTimeout(timeout)
}

try {
  const config = loadEnvironment()
  try {
    database = await connectDatabase(
      config.nodeEnv === 'test' ? config.databaseUri : process.env.MONGO_URI,
    )
  } catch {
    throw new Error('MongoDB connection failed. Check MONGO_URI and database network access.')
  }
  try {
    await initializeNewsStorage(database)
  } catch {
    throw new Error('News storage could not initialize. Check database access and restart.')
  }
  const newsStore = createNewsStore(database)
  newsCleanup = setInterval(
    () =>
      newsStore.cleanup().catch(() => {
        console.error('News expiry cleanup will retry.')
      }),
    60000,
  ).unref()
  // two adapters with fixed roles. the attacker is Gemini only: it needs
  // LLM_API_KEY, and LLM_MODEL without LLM_API_KEY leaves it unconfigured.
  // legacy LLM_BASE_URL / LLM_AUTH_TOKEN are ignored by the game. the colleague
  // is Ollama only and is configured only when LLM_COLLEAGUE_BASE_URL is set,
  // otherwise the game keeps the one-click verify. an unconfigured adapter
  // reports configured:false, so the simulator endpoints fail gracefully
  // instead of the server refusing to start
  const { attacker, colleague } = createGameAdapters(config)
  server = createApp(database, {
    news: {
      apiKey: config.nodeEnv === 'test' ? undefined : config.guardianApiKey,
      store: newsStore,
    },
    socialEngineering: {
      service: createSocialEngineeringService({ adapter: attacker, verifierAdapter: colleague }),
    },
  }).listen(config.port, '127.0.0.1')
  server.on('listening', () =>
    console.log(`SHARLOCK API ready at http://localhost:${config.port}/api/health`),
  )
  server.on('error', async () => {
    console.error('API could not listen. Check whether PORT is already in use.')
    await shutdown()
    process.exitCode = 1
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, shutdown)
} catch (error) {
  // startup errors contain only fixed guidance, never connection details
  console.error(error.message)
  await shutdown()
  process.exitCode = 1
}

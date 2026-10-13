import { initializeNewsStorage } from './modules/news/models.js'
import { createNewsStore } from './modules/news/store.js'
import { createLlmAdapter } from './modules/games/social-engineering-simulator/llm/adapter.js'
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
  // the adapter reports configured:false when no llm env is set, so the
  // simulator endpoints fail gracefully instead of the server refusing to start
  const llmAdapter = createLlmAdapter({
    baseUrl: config.llmBaseUrl,
    model: config.llmModel,
    apiKey: config.llmApiKey,
    authToken: config.llmAuthToken,
  })
  server = createApp(database, {
    news: {
      apiKey: config.nodeEnv === 'test' ? undefined : config.guardianApiKey,
      store: newsStore,
    },
    socialEngineering: { service: createSocialEngineeringService({ adapter: llmAdapter }) },
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

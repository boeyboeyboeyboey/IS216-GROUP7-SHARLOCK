import { createApp } from './app.js'
import { loadEnvironment } from './config/env.js'
import { connectDatabase } from './config/database.js'

let database
let server
let shuttingDown = false

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
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
  server = createApp(database).listen(config.port, '127.0.0.1')
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

import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { startMongo } from './lib/mongodb.js'

const dbPath = fileURLToPath(new URL('../.local/mongodb', import.meta.url))
await mkdir(dbPath, { recursive: true })
const database = await startMongo({ port: 27018, portGeneration: false, dbPath })

console.log('Local MongoDB ready at 127.0.0.1:27018. Data stays in .local/mongodb after Ctrl+C.')
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    if (stopping) return
    stopping = true
    await database.stop({ doCleanup: false })
  })
}

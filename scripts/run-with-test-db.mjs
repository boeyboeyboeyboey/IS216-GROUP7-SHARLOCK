import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { startMongo } from './lib/mongodb.js'
import { assertSafeTestDatabaseUri } from '../server/src/config/database-uri.js'

const [suite, ...extraArgs] = process.argv.slice(2)
const commands = {
  integration: ['../node_modules/vitest/vitest.mjs', 'run', '--project', 'integration'],
  e2e: ['../node_modules/@playwright/test/cli.js', 'test'],
}
if (!commands[suite]) throw new Error('Choose integration or e2e.')

const name = `sharlock_${randomBytes(8).toString('hex')}_test`
console.log(
  'Starting a disposable MongoDB for tests. The first run downloads the pinned database binary.',
)
const database = await startMongo({ dbName: name })
let child
const forwardSignal = (signal) => child?.kill(signal)
const onInterrupt = () => forwardSignal('SIGINT')
const onTerminate = () => forwardSignal('SIGTERM')

try {
  const uri = assertSafeTestDatabaseUri(database.getUri(name))
  const [entry, ...args] = commands[suite]
  child = spawn(
    process.execPath,
    [fileURLToPath(new URL(entry, import.meta.url)), ...args, ...extraArgs],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_MONGODB_URI: uri,
        SESSION_SECRET: randomBytes(32).toString('hex'),
      },
    },
  )
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onTerminate)
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
} finally {
  process.removeListener('SIGINT', onInterrupt)
  process.removeListener('SIGTERM', onTerminate)
  // cleanup is limited to the temporary instance created for this run
  await database.stop()
}

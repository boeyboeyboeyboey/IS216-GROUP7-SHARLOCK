import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const target = new URL('../server/.env', import.meta.url)
const template = await readFile(new URL('../server/.env.example', import.meta.url), 'utf8')
const contents = template.replace(
  'replace-with-a-random-64-character-hex-secret',
  randomBytes(32).toString('hex'),
)

try {
  await writeFile(target, contents, { flag: 'wx', mode: 0o600 })
  console.log(
    'Created server/.env with a random secret. Existing database settings can be edited there.',
  )
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  console.log('server/.env already exists; left unchanged.')
}

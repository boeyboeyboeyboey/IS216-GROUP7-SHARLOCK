import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// must match the outbox the test server is started with in playwright.config.js
const outbox = resolve('.local', 'e2e-mail.jsonl')

function lastCodeFor(email) {
  let lines
  try {
    lines = readFileSync(outbox, 'utf8').trim().split('\n')
  } catch {
    return undefined
  }
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const entry = JSON.parse(lines[index])
      if (entry.to === email) return entry.code
    } catch {
      // a half-written line is retried on the next poll
    }
  }
  return undefined
}

export async function readVerificationCode(email, { timeoutMs = 10_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const code = lastCodeFor(email)
    if (code) return code
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error('No verification code was written for the test account.')
}

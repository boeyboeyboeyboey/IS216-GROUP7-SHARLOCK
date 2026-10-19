import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

// Outbound mail is a one-method interface so a real provider is a one-file swap.
// Only these adapters exist: no provider, credential or paid service is assumed.

export function createConsoleMailer(log = console.info) {
  return Object.freeze({
    async sendVerificationCode({ to, code, expiresInMinutes }) {
      log(
        `[mail:dev] Verification code for ${to}: ${code} (expires in ${expiresInMinutes} minutes)`,
      )
    },
  })
}

// browser tests run the real server in another process, so they read codes from a file.
// server.js only builds this when NODE_ENV=test and TEST_MAIL_OUTBOX is set.
export function createFileMailer(outboxPath) {
  if (typeof outboxPath !== 'string' || !outboxPath) {
    throw new TypeError('An outbox path is required.')
  }
  return Object.freeze({
    async sendVerificationCode({ to, code }) {
      await mkdir(dirname(outboxPath), { recursive: true })
      await appendFile(outboxPath, `${JSON.stringify({ to, code })}\n`)
    },
  })
}

export function createMemoryMailer() {
  const outbox = []
  return Object.freeze({
    outbox,
    async sendVerificationCode(message) {
      outbox.push({ ...message, sentAt: Date.now() })
    },
    lastCodeFor(to) {
      for (let index = outbox.length - 1; index >= 0; index -= 1) {
        if (outbox[index].to === to) return outbox[index].code
      }
      return undefined
    },
  })
}

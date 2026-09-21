import crypto from 'node:crypto'

const DEFAULT_MAX_MESSAGES = 20
const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000

// in-memory only: bounded per chat session, never written to disk or the VM.
// entries are dropped on end() or lazily swept once idleTtlMs passes, so RAM
// stays flat regardless of how many players have played.
export function createChatSessionStore({
  maxMessages = DEFAULT_MAX_MESSAGES,
  idleTtlMs = DEFAULT_IDLE_TTL_MS,
  now = Date.now,
} = {}) {
  const sessions = new Map()

  function sweep() {
    const cutoff = now() - idleTtlMs
    for (const [id, session] of sessions) if (session.lastActiveAt <= cutoff) sessions.delete(id)
  }

  return {
    start() {
      sweep()
      const id = crypto.randomUUID()
      sessions.set(id, { messages: [], lastActiveAt: now() })
      return id
    },
    append(sessionId, message) {
      sweep()
      const session = sessions.get(sessionId)
      if (!session) return null
      session.messages.push(message)
      if (session.messages.length > maxMessages) {
        session.messages.splice(0, session.messages.length - maxMessages)
      }
      session.lastActiveAt = now()
      return [...session.messages]
    },
    get(sessionId) {
      const session = sessions.get(sessionId)
      return session ? [...session.messages] : null
    },
    end(sessionId) {
      sessions.delete(sessionId)
    },
    size() {
      sweep()
      return sessions.size
    },
  }
}

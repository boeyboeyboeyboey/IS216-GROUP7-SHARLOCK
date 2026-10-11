// manual live rehearsal for the social-engineering simulator backend.
// drives the real service against the configured llm (server/.env), no http,
// no mongo, nothing persisted. run from the repo root:
//   node tests/soc-live-session.mjs
//
// in the chat: type a message to reply to the colleague. commands:
//   /verify  end the round by verifying independently (the correct move)
//   /refuse  end the round by refusing
//   /share   end the round by sharing the code (the trap)
//   /quit    exit without scoring

import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { createLlmAdapter } from '../server/src/modules/games/social-engineering-simulator/llm/adapter.js'
import { createSocialEngineeringService } from '../server/src/modules/games/social-engineering-simulator/service.js'

// minimal .env reader so the harness needs no dotenv dependency
async function loadEnv(relativePath) {
  const url = new URL(relativePath, import.meta.url)
  let text
  try {
    text = await readFile(fileURLToPath(url), 'utf8')
  } catch {
    return {}
  }
  const out = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim()
  }
  return out
}

function banner(text) {
  console.log(`\n${'─'.repeat(60)}\n${text}\n${'─'.repeat(60)}`)
}

async function main() {
  const env = await loadEnv('../server/.env')
  const adapter = createLlmAdapter({
    baseUrl: env.LLM_BASE_URL || undefined,
    model: env.LLM_MODEL || undefined,
    apiKey: env.LLM_API_KEY || undefined,
    authToken: env.LLM_AUTH_TOKEN || undefined,
  })

  console.log(`llm mode: ${adapter.mode ?? 'none'} | configured: ${adapter.configured}`)
  if (!adapter.configured) {
    console.error(
      '\nno llm configured. set LLM_BASE_URL + LLM_MODEL (and LLM_AUTH_TOKEN if gated) in server/.env, then rerun.',
    )
    process.exitCode = 1
    return
  }

  const service = createSocialEngineeringService({ adapter })
  const session = service.startSession()

  banner(`persona: ${session.persona.displayName} (${session.persona.id})`)
  console.log(`objective: ${session.brief.objective}`)
  console.log(`turn budget: ${session.brief.turnBudget}`)
  console.log(`\ncolleague: ${session.openingMessage}`)

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let closed = false
  rl.on('close', () => {
    closed = true
  })

  try {
    while (!closed) {
      let answer
      try {
        answer = await rl.question('\nyou> ')
      } catch {
        // readline closed (eof / ctrl-d) while awaiting input
        break
      }
      const input = answer.trim()
      if (!input) continue

      if (input === '/quit') {
        console.log('exited without scoring')
        return
      }
      const decision =
        input === '/verify'
          ? 'verify-independently'
          : input === '/refuse'
            ? 'refuse'
            : input === '/share'
              ? 'share-code'
              : null
      if (decision) {
        const result = service.complete(session.sessionId, decision)
        banner(`outcome: ${result.outcome} — score ${result.score}/${result.maxScore}`)
        for (const item of result.breakdown) {
          console.log(`  ${item.points}/${item.max}  ${item.label}`)
        }
        console.log(`\nwhat happened: ${result.debrief.whatHappened}`)
        console.log(`tactics: ${result.debrief.tacticsUsed.join(', ')}`)
        console.log('better moves:')
        for (const move of result.debrief.betterMoves) console.log(`  - ${move}`)
        console.log(`\nsaved: ${result.saved}`)
        return
      }

      let turn
      try {
        turn = await service.sendMessage(session.sessionId, input)
      } catch (error) {
        // keep the session alive on a transient upstream hiccup so you can retry
        console.log(`\nturn failed: ${error.code ?? error.name} - ${error.message}`)
        console.log('  the session is still open — type your message again to retry')
        continue
      }
      if (turn.leaked) {
        console.log('\n** you revealed the code — round ended (compromised). run a decision to score. **')
        console.log('  type /share to score the leak, or /quit to exit')
        continue
      }
      console.log(`\ncolleague: ${turn.reply}`)
      console.log(`(turn ${turn.turnsUsed}/${turn.turnBudget})`)
      if (turn.ended) {
        console.log('\n** turn budget reached — end with /verify, /refuse, or /share **')
      }
    }
  } finally {
    rl.close()
  }
}

main().catch((error) => {
  console.error(`\nlive session failed: ${error.code ?? error.name} - ${error.message}`)
  process.exitCode = 1
})

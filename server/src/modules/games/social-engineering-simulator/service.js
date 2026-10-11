import { LlmError } from './llm/llmError.js'
import { createLlmAdapter } from './llm/adapter.js'
import { createChatSessionStore } from './llm/chatSessionStore.js'
import { createChatSessionRunner } from './llm/chatSessionRunner.js'
import { DEFAULT_TURN_BUDGET, GAME_ID, MAX_SCORE, RULESET_VERSION, WEIGHTS } from './policy.js'
import { pickScenario, publicBrief } from './scenarios.js'

// normalise for leak detection: uppercase and drop spaces and hyphens so
// "synth reset 4821" matches the stored SYNTH-RESET-4821
function normalise(value) {
  return value.toUpperCase().replace(/[\s-]/g, '')
}

function sessionNotFound() {
  return new LlmError('LLM_SESSION_NOT_FOUND', 'That simulation was not found or has ended.', 404)
}

function scoreOutcome({ leaked, decision, turnsUsed, turnBudget }) {
  const compromised = leaked || decision === 'share-code'
  const noLeak = compromised ? 0 : WEIGHTS.noLeak
  const verify = decision === 'verify-independently' ? WEIGHTS.verify : 0
  const efficiency =
    turnsUsed <= turnBudget
      ? WEIGHTS.efficiency
      : Math.max(0, Math.round(WEIGHTS.efficiency * (1 - (turnsUsed - turnBudget) / turnBudget)))
  const outcome = compromised
    ? 'compromised'
    : decision === 'verify-independently'
      ? 'resisted'
      : 'partial'
  const breakdown = [
    {
      key: 'noLeak',
      label: 'Protected the reset code',
      points: noLeak,
      max: WEIGHTS.noLeak,
    },
    {
      key: 'verify',
      label: 'Verified through an independent channel',
      points: verify,
      max: WEIGHTS.verify,
    },
    {
      key: 'efficiency',
      label: 'Stayed within the turn budget',
      points: efficiency,
      max: WEIGHTS.efficiency,
    },
  ]
  const score = breakdown.reduce((total, item) => total + item.points, 0)
  return { score, outcome, breakdown }
}

function buildDebrief(scenario, { leaked, decision, outcome }) {
  const summary =
    outcome === 'compromised'
      ? `The reset code was exposed. In a real incident, "${scenario.displayName}" could now reset the account and lock you out.`
      : outcome === 'resisted'
        ? 'You protected the code and verified the request through an independent channel — the safe response.'
        : 'You protected the code, but you did not confirm the request independently. Verifying closes the loop.'
  return {
    summary,
    persona: scenario.displayName,
    tactic: `This colleague leaned on ${scenario.tactic}. Pressure to act fast is the signal to slow down.`,
    saferesponse:
      'A reset code is a secret, like a password. Never read it out. Confirm any request through a known channel — an official help-desk ticket or a number you look up yourself, not one offered in the message.',
    note: leaked
      ? 'You shared the code during the chat, so this run counts as compromised regardless of your final choice.'
      : decision === 'refuse'
        ? 'Refusing is good; independent verification would have earned full marks.'
        : '',
  }
}

export function createSocialEngineeringService({
  adapter = createLlmAdapter(),
  store = createChatSessionStore(),
  random = Math.random,
} = {}) {
  const runner = createChatSessionRunner({ store, adapter })
  // per-session metadata the bounded transcript store does not hold
  const meta = new Map()

  function requireSession(sessionId) {
    const entry = meta.get(sessionId)
    if (!entry) throw sessionNotFound()
    return entry
  }

  function startSession() {
    if (!adapter.configured) {
      throw new LlmError(
        'LLM_NOT_CONFIGURED',
        'The simulation needs an LLM provider configured on the server.',
        503,
      )
    }
    const scenario = pickScenario(random)
    const view = publicBrief(scenario)
    const sessionId = runner.start()
    // seed the scripted opening as the colleague's first turn so the model
    // continues from it on the next send
    store.append(sessionId, { role: 'assistant', content: scenario.opening })
    meta.set(sessionId, {
      scenario,
      turnsUsed: 0,
      turnBudget: scenario.turnBudget,
      leaked: false,
      ended: false,
    })
    return {
      sessionId,
      gameId: GAME_ID,
      rulesetVersion: RULESET_VERSION,
      persona: { id: scenario.id, displayName: scenario.displayName },
      brief: view.brief,
      openingMessage: scenario.opening,
    }
  }

  async function sendMessage(sessionId, content) {
    const entry = requireSession(sessionId)
    if (entry.ended) throw sessionNotFound()
    entry.turnsUsed += 1
    const leakedNow = normalise(content).includes(normalise(entry.scenario.code))
    if (leakedNow) {
      // never forward the code to the model; end the run on the leak
      entry.leaked = true
      entry.ended = true
      store.end(sessionId)
      return {
        reply: null,
        turnsUsed: entry.turnsUsed,
        turnBudget: entry.turnBudget,
        leaked: true,
        ended: true,
      }
    }
    const reply = await runner.send(sessionId, {
      systemPrompt: entry.scenario.systemPrompt,
      content,
    })
    if (entry.turnsUsed >= entry.turnBudget) entry.ended = true
    return {
      reply,
      turnsUsed: entry.turnsUsed,
      turnBudget: entry.turnBudget,
      leaked: false,
      ended: entry.ended,
    }
  }

  function complete(sessionId, decision) {
    const entry = requireSession(sessionId)
    const { score, outcome, breakdown } = scoreOutcome({
      leaked: entry.leaked,
      decision,
      turnsUsed: entry.turnsUsed,
      turnBudget: entry.turnBudget,
    })
    const debrief = buildDebrief(entry.scenario, { leaked: entry.leaked, decision, outcome })
    // release the transcript and metadata; nothing is persisted
    store.end(sessionId)
    meta.delete(sessionId)
    return {
      gameId: GAME_ID,
      rulesetVersion: RULESET_VERSION,
      score,
      maxScore: MAX_SCORE,
      outcome,
      breakdown,
      debrief,
      saved: false,
    }
  }

  return {
    configured: adapter.configured,
    startSession,
    sendMessage,
    complete,
    // exposed for tests and future GAME-01 adoption
    scoreOutcome,
    DEFAULT_TURN_BUDGET,
  }
}

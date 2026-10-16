import { randomUUID } from 'node:crypto'
import { LEVELS, findLevel, publicLevel, summarizeLevel } from './levels.js'
import {
  GAME_ID,
  RULESET_VERSION,
  actionConflict,
  alreadySubmitted,
  attemptNotFound,
  parseSubmission,
} from './policy.js'
import { scoreLevel } from './scoring.js'
import { simulateDay } from './simulate.js'

const MAX_ATTEMPTS = 500
const IDLE_MS = 30 * 60 * 1000

// attempts live in memory only: nothing is saved until the shared attempt service exists
export function createClearanceService({
  now = Date.now,
  createId = randomUUID,
  maxAttempts = MAX_ATTEMPTS,
  idleMs = IDLE_MS,
} = {}) {
  const attempts = new Map()

  function removeExpired() {
    for (const [attemptId, attempt] of attempts)
      if (now() - attempt.touchedAt > idleMs) attempts.delete(attemptId)
  }

  function findAttempt(attemptId) {
    removeExpired()
    const attempt = attempts.get(attemptId)
    if (!attempt) throw attemptNotFound()
    attempt.touchedAt = now()
    return attempt
  }

  function buildResult(level, attemptId, policy, predictions) {
    const events = simulateDay(level, policy)
    return {
      gameId: GAME_ID,
      rulesetVersion: RULESET_VERSION,
      attemptId,
      levelId: level.id,
      status: 'completed',
      ...scoreLevel(level, policy, predictions, events),
      events,
      takeaways: level.takeaways,
      slides: level.slides,
      saved: false,
    }
  }

  return {
    listLevels() {
      return {
        gameId: GAME_ID,
        rulesetVersion: RULESET_VERSION,
        levels: LEVELS.map(summarizeLevel),
        saved: false,
      }
    },

    startAttempt({ levelId }) {
      removeExpired()
      if (attempts.size >= maxAttempts) attempts.delete(attempts.keys().next().value)
      const attemptId = createId()
      attempts.set(attemptId, { levelId, touchedAt: now(), submission: null })
      return {
        gameId: GAME_ID,
        rulesetVersion: RULESET_VERSION,
        attemptId,
        level: publicLevel(findLevel(levelId)),
        expiresAt: now() + idleMs,
        saved: false,
      }
    },

    // one submission per attempt; repeating the same action returns the recorded result
    submitAttempt(attemptId, body) {
      const attempt = findAttempt(attemptId)
      const level = findLevel(attempt.levelId)
      const { actionId, policy, predictions } = parseSubmission(level, body)
      const requestKey = JSON.stringify({ policy, predictions })

      if (attempt.submission) {
        if (attempt.submission.actionId !== actionId) throw alreadySubmitted()
        if (attempt.submission.requestKey !== requestKey) throw actionConflict()
        return attempt.submission.result
      }
      const result = buildResult(level, attemptId, policy, predictions)
      attempt.submission = { actionId, requestKey, result }
      return result
    },
  }
}

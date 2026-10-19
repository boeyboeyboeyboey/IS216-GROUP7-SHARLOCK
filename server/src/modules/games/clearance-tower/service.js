import { randomUUID } from 'node:crypto'
import { LEVELS, findLevel, publicLevel, summarizeLevel } from './levels.js'
import {
  GAME_ID,
  RULESET_VERSION,
  actionConflict,
  alreadySubmitted,
  runNotFound,
  parseSubmission,
} from './policy.js'
import { scoreLevel } from './scoring.js'
import { simulateDay } from './simulate.js'

const MAX_RUNS = 500
const IDLE_MS = 30 * 60 * 1000

// runs live in memory only: nothing is saved until this game adopts the shared attempt service
export function createClearanceService({
  now = Date.now,
  createId = randomUUID,
  maxRuns = MAX_RUNS,
  idleMs = IDLE_MS,
} = {}) {
  const runs = new Map()

  function removeExpired() {
    for (const [runId, run] of runs) if (now() - run.touchedAt > idleMs) runs.delete(runId)
  }

  function findRun(runId) {
    removeExpired()
    const run = runs.get(runId)
    if (!run) throw runNotFound()
    run.touchedAt = now()
    return run
  }

  function buildResult(level, runId, policy, predictions) {
    const events = simulateDay(level, policy)
    return {
      gameId: GAME_ID,
      rulesetVersion: RULESET_VERSION,
      runId,
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

    startRun({ levelId }) {
      removeExpired()
      if (runs.size >= maxRuns) runs.delete(runs.keys().next().value)
      const runId = createId()
      runs.set(runId, { levelId, touchedAt: now(), submission: null })
      return {
        gameId: GAME_ID,
        rulesetVersion: RULESET_VERSION,
        runId,
        level: publicLevel(findLevel(levelId)),
        expiresAt: now() + idleMs,
        saved: false,
      }
    },

    // one submission per run; repeating the same action returns the recorded result
    submitRun(runId, body) {
      const run = findRun(runId)
      const level = findLevel(run.levelId)
      const { actionId, policy, predictions } = parseSubmission(level, body)
      const requestKey = JSON.stringify({ policy, predictions })

      if (run.submission) {
        if (run.submission.actionId !== actionId) throw alreadySubmitted()
        if (run.submission.requestKey !== requestKey) throw actionConflict()
        return run.submission.result
      }
      const result = buildResult(level, runId, policy, predictions)
      run.submission = { actionId, requestKey, result }
      return result
    },
  }
}

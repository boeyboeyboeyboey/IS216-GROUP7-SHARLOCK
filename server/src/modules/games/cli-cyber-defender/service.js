import { randomInt as cryptoRandomInt, randomUUID } from 'node:crypto'
import { SYNTAX_HINTS, formatCommand, parseCommand } from './parser.js'
import {
  GAME_ID,
  INCIDENT_COUNT,
  MAX_COMMANDS_PER_RUN,
  MAX_SCORE,
  RULESET_VERSION,
  actionConflict,
  commandLimit,
  incidentClosed,
  pauseUnavailable,
  runPaused,
  runFinished,
  runNotFinished,
  runNotFound,
} from './policy.js'
import { SCENARIOS, TOPICS } from './scenarios.js'
import { deriveProgress, generateWindows } from './schedule.js'

const MAX_RUNS = 500
const IDLE_MS = 10 * 60 * 1000

function incidentId(index) {
  return `incident-${String(index + 1).padStart(2, '0')}`
}

function pickScenarios(pool, randomInt) {
  const ordered = [...pool]
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1)
    ;[ordered[index], ordered[swap]] = [ordered[swap], ordered[index]]
  }
  return ordered.slice(0, INCIDENT_COUNT)
}

function publicAlert(alert) {
  return {
    title: alert.title,
    severity: alert.severity,
    source: alert.source,
    lines: [...alert.lines],
  }
}

export function createCliDefenderService({
  now = Date.now,
  randomInt = cryptoRandomInt,
  createId = randomUUID,
  scenarios = SCENARIOS,
} = {}) {
  const runs = new Map()

  function sweep(at) {
    for (const [runId, run] of runs) if (at - run.lastActivityAt > IDLE_MS) runs.delete(runId)
    while (runs.size >= MAX_RUNS) runs.delete(runs.keys().next().value)
  }

  function requireRun(runId) {
    const run = runs.get(runId)
    if (!run || now() - run.lastActivityAt > IDLE_MS) {
      runs.delete(runId)
      throw runNotFound()
    }
    return run
  }

  // game time skips paused spans, so every deadline freezes while a timed shift is paused
  function gameTime(run, wall) {
    return wall - run.pausedTotal - (run.pausedAt === null ? 0 : wall - run.pausedAt)
  }

  function snapshot(run, at) {
    const progress = deriveProgress(run, at)
    const scenario = progress.current && run.incidents[progress.current.index].scenario
    return {
      gameId: GAME_ID,
      rulesetVersion: RULESET_VERSION,
      runId: run.runId,
      mode: run.mode,
      status: run.completion ? 'completed' : progress.finished ? 'finished' : 'active',
      serverNow: at,
      paused: run.pausedAt !== null,
      incidentCount: run.incidents.length,
      resolvedCount: progress.incidents.filter(
        (item) => !['open', 'pending'].includes(item.outcome),
      ).length,
      current: progress.current && {
        incidentId: progress.current.incidentId,
        index: progress.current.index,
        opensAt: progress.current.opensAt,
        closesAt: progress.current.closesAt,
        windowSeconds:
          run.mode === 'timed' ? run.incidents[progress.current.index].windowSeconds : null,
        alert: run.pausedAt === null ? publicAlert(scenario.alert) : null,
      },
      history: progress.incidents
        .filter((item) => !['open', 'pending'].includes(item.outcome))
        .map(({ incidentId: id, index, outcome, pointsAwarded }) => ({
          incidentId: id,
          index,
          outcome,
          pointsAwarded,
        })),
      score: progress.score,
      streak: progress.streak,
      multiplier: progress.multiplier,
      maxScore: MAX_SCORE,
      saved: false,
    }
  }

  function startRun({ mode }) {
    const at = now()
    sweep(at)
    const windows = generateWindows(randomInt)
    const run = {
      runId: createId(),
      mode,
      startedAt: at,
      endedAt: null,
      lastActivityAt: at,
      pausedAt: null,
      pausedTotal: 0,
      incidents: pickScenarios(scenarios, randomInt).map((scenario, index) => ({
        id: incidentId(index),
        scenario,
        windowSeconds: windows[index],
        resolution: null,
      })),
      actions: new Map(),
      completion: null,
    }
    runs.set(run.runId, run)
    return snapshot(run, at)
  }

  function getRun(runId) {
    const run = requireRun(runId)
    return snapshot(run, gameTime(run, now()))
  }

  function pauseRun(runId) {
    const run = requireRun(runId)
    const wall = now()
    if (run.mode !== 'timed' || run.completion) throw pauseUnavailable()
    if (run.pausedAt === null && !deriveProgress(run, gameTime(run, wall)).finished) {
      run.pausedAt = wall
      run.lastActivityAt = wall
    }
    return snapshot(run, gameTime(run, wall))
  }

  function resumeRun(runId) {
    const run = requireRun(runId)
    const wall = now()
    if (run.pausedAt !== null) {
      run.pausedTotal += wall - run.pausedAt
      run.pausedAt = null
      run.lastActivityAt = wall
    }
    return snapshot(run, gameTime(run, wall))
  }

  function submitCommand(runId, { actionId, incidentId: target, command }) {
    const run = requireRun(runId)
    const fingerprint = `${target}\n${command}`
    const previous = run.actions.get(actionId)
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw actionConflict()
      return previous.response
    }
    if (run.completion) throw runFinished()
    if (run.pausedAt !== null) throw runPaused()
    if (run.actions.size >= MAX_COMMANDS_PER_RUN) throw commandLimit()
    // the receipt time is taken once on the server, so a browser clock cannot extend a window
    const wall = now()
    const at = gameTime(run, wall)
    const before = deriveProgress(run, at)
    if (!before.current || before.current.incidentId !== target) throw incidentClosed()
    run.lastActivityAt = wall

    const parsed = parseCommand(command)
    let outcome = 'syntax'
    let message = SYNTAX_HINTS[parsed.reason]
    if (parsed.ok) {
      const incident = run.incidents[before.current.index]
      const { verb, target: expected } = incident.scenario.expected
      outcome = parsed.verb === verb && parsed.target === expected ? 'correct' : 'wrong'
      incident.resolution = { at, outcome, command: parsed.normalized }
      message =
        outcome === 'correct'
          ? 'Containment confirmed.'
          : 'That action did not contain the incident. Incident closed.'
    }
    const after = snapshot(run, at)
    const response = {
      ...after,
      outcome,
      message,
      command: parsed.ok ? parsed.normalized : null,
      pointsAwarded:
        outcome === 'syntax'
          ? 0
          : after.history.find((item) => item.incidentId === target).pointsAwarded,
    }
    run.actions.set(actionId, { fingerprint, response })
    return response
  }

  function completeRun(runId, { actionId }) {
    const run = requireRun(runId)
    if (run.completion) return { ...run.completion, actionId }
    const wall = now()
    const at = gameTime(run, wall)
    const progress = deriveProgress(run, at)
    if (!progress.finished) {
      if (run.mode === 'timed') throw runNotFinished()
      run.endedAt = at
    }
    run.lastActivityAt = wall
    const final = deriveProgress(run, at)
    const count = (outcome) => final.incidents.filter((item) => item.outcome === outcome).length

    const debrief = final.incidents.map((item) => {
      const incident = run.incidents[item.index]
      const { verb, target } = incident.scenario.expected
      return {
        incidentId: item.incidentId,
        index: item.index,
        title: incident.scenario.alert.title,
        topic: incident.scenario.topic,
        outcome: item.outcome,
        yourCommand: incident.resolution?.command ?? null,
        expectedCommand: formatCommand(verb, target),
        explanation: incident.scenario.explanation,
        pointsAwarded: item.pointsAwarded,
      }
    })

    const topicOutcomes = Object.keys(TOPICS)
      .filter((topic) => debrief.some((item) => item.topic === topic))
      .map((topic) => {
        const achieved = debrief
          .filter((item) => item.topic === topic)
          .every((item) => item.outcome === 'correct')
        const code = topic.toUpperCase().replace(/-/g, '_')
        return {
          topic,
          label: TOPICS[topic],
          achieved,
          feedbackCode: `CLI_${code}_${achieved ? 'ACHIEVED' : 'MISSED'}`,
        }
      })

    const correct = count('correct')
    run.completion = {
      gameId: GAME_ID,
      rulesetVersion: RULESET_VERSION,
      runId: run.runId,
      mode: run.mode,
      status: 'completed',
      score: final.score,
      maxScore: MAX_SCORE,
      saved: false,
      result: {
        correct,
        wrong: count('wrong'),
        missed: count('missed'),
        skipped: count('skipped'),
        bestStreak: final.bestStreak,
      },
      feedback: {
        summary: `You contained ${correct} of ${run.incidents.length} incidents.`,
      },
      topicOutcomes,
      debrief,
    }
    return { ...run.completion, actionId }
  }

  return { startRun, getRun, pauseRun, resumeRun, submitCommand, completeRun }
}

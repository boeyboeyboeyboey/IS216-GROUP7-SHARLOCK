import {
  INCIDENT_COUNT,
  MAX_MULTIPLIER,
  MAX_WINDOW_SECONDS,
  MIN_WINDOW_SECONDS,
  POINTS_PER_STEP,
  SHIFT_SECONDS,
} from './policy.js'

// start every window at the minimum, then hand out the spare seconds one at a time
// to random windows that still have room, so the total is always exactly the shift length
export function generateWindows(randomInt) {
  const windows = Array(INCIDENT_COUNT).fill(MIN_WINDOW_SECONDS)
  let spare = SHIFT_SECONDS - MIN_WINDOW_SECONDS * INCIDENT_COUNT
  while (spare > 0) {
    const open = windows
      .map((seconds, index) => (seconds < MAX_WINDOW_SECONDS ? index : -1))
      .filter((index) => index >= 0)
    windows[open[randomInt(open.length)]] += 1
    spare -= 1
  }
  return windows
}

export function pointsFor(streak) {
  return POINTS_PER_STEP * Math.min(MAX_MULTIPLIER, streak)
}

// pure replay of the run from stored timestamps; reading it never changes the run.
// each incident opens when the previous one resolves or expires, and a missed window
// is derived from the server clock rather than written by a timer
export function deriveProgress(run, now) {
  const timed = run.mode === 'timed'
  let opensAt = run.startedAt
  let streak = 0
  let bestStreak = 0
  let score = 0
  let current = null
  const incidents = []

  for (const [index, incident] of run.incidents.entries()) {
    if (current) {
      incidents.push({ index, incidentId: incident.id, outcome: 'pending', pointsAwarded: 0 })
      continue
    }
    const closesAt = timed ? opensAt + incident.windowSeconds * 1000 : null
    let outcome
    let nextOpensAt
    if (incident.resolution) {
      outcome = incident.resolution.outcome
      nextOpensAt = incident.resolution.at
    } else if (timed && now >= closesAt) {
      outcome = 'missed'
      nextOpensAt = closesAt
    } else if (run.endedAt !== null) {
      outcome = 'skipped'
      nextOpensAt = opensAt
    } else {
      current = { index, incidentId: incident.id, opensAt, closesAt }
      incidents.push({ index, incidentId: incident.id, outcome: 'open', pointsAwarded: 0 })
      continue
    }
    let pointsAwarded = 0
    if (outcome === 'correct') {
      streak += 1
      bestStreak = Math.max(bestStreak, streak)
      pointsAwarded = pointsFor(streak)
      score += pointsAwarded
    } else streak = 0
    incidents.push({ index, incidentId: incident.id, outcome, pointsAwarded, opensAt, closesAt })
    opensAt = nextOpensAt
  }

  return {
    incidents,
    current,
    score,
    streak,
    bestStreak,
    multiplier: Math.min(MAX_MULTIPLIER, streak + 1),
    finished: current === null,
  }
}

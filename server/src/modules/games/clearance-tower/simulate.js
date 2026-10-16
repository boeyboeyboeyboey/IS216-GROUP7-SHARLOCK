import { checkStep } from './models.js'

// each event kind has a word for "every step was allowed" and for "something stopped it"
const OUTCOMES = {
  work: { passed: 'done', stopped: 'blocked' },
  attack: { passed: 'leaked', stopped: 'stopped' },
  integrity: { passed: 'tampered', stopped: 'stopped' },
}

// replays the level's scripted day against the submitted policy; same input, same day
export function simulateDay(level, policy) {
  return level.day.map((event) => {
    const steps = event.steps.map((step) => ({ ...step, ...checkStep(level, policy, step) }))
    const passed = steps.every((step) => step.allowed)
    const outcomes = OUTCOMES[event.kind]
    return {
      id: event.id,
      kind: event.kind,
      story: event.story,
      steps,
      outcome: passed ? outcomes.passed : outcomes.stopped,
    }
  })
}

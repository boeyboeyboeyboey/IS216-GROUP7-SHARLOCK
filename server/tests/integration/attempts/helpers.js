import { Schema } from 'mongoose'
import { AttemptError } from '../../../src/modules/attempts/policy.js'
import { createAttemptRegistry } from '../../../src/modules/attempts/registry.js'

export const syntheticGameId = 'attempt-contract-fixture'

const stateSchema = new Schema(
  {
    round: { type: Number, required: true, min: 0, max: 1 },
    secret: { type: String, required: true },
    correct: { type: Boolean, required: true },
  },
  { _id: false, strict: 'throw' },
)

export function createSyntheticAttemptRegistry({
  maxActions = 8,
  mode = 'standard',
  deadlineOffsetMs = 60_000,
  overrides = {},
} = {}) {
  const entry = {
    id: syntheticGameId,
    rulesetVersion: 'fixture-1',
    current: true,
    competitive: true,
    learningObjective: 'Practice a synthetic saved-attempt contract.',
    topicTags: ['contract-fixture'],
    maxScore: 10,
    maxActions,
    stateSchema,
    createState({ now }) {
      let deadlineAt = null
      if (deadlineOffsetMs !== null) deadlineAt = new Date(now.getTime() + deadlineOffsetMs)
      return {
        state: { round: 0, secret: 'synthetic-private-answer', correct: false },
        mode,
        deadlineAt,
      }
    },
    validateAction(type, payload) {
      if (
        type !== 'answer' ||
        payload === null ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        Object.keys(payload).length !== 1 ||
        typeof payload.correct !== 'boolean'
      ) {
        throw new AttemptError(
          'ATTEMPT_INVALID_REQUEST',
          'Check the request fields and try again.',
          400,
        )
      }
      return { correct: payload.correct }
    },
    applyAction(state, { payload }) {
      return { ...state, round: 1, correct: payload.correct }
    },
    canComplete(state, meta) {
      return state.round === 1 || meta.now.getTime() >= meta.deadlineAt.getTime()
    },
    summarize(state) {
      return {
        score: state.correct ? 10 : 0,
        feedback: { code: 'FIXTURE_COMPLETE' },
        topicOutcomes: [
          {
            topic: 'contract',
            achieved: state.correct,
            feedbackCode: 'FIXTURE_RESULT',
          },
        ],
      }
    },
    serializePublicState(state) {
      return { round: state.round }
    },
  }
  return createAttemptRegistry([{ ...entry, ...overrides }])
}

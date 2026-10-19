import { Schema } from 'mongoose'
import {
  GAME_ID,
  MAX_SCORE,
  RULESET_VERSION,
  parseVerdictAction,
  verdictAlreadyRecorded,
} from './policy.js'
import { createCaseLibrary } from './service.js'

// generated cases added optional fields with authored defaults, so attempts saved before them
// still load; a generated case is stored as its seed, template and generator version, never as content
const stateSchema = new Schema(
  {
    source: { type: String, enum: ['authored', 'generated'], default: 'authored' },
    caseId: { type: String, required: true },
    datasetVersion: { type: String, required: true },
    seed: { type: Number, default: null },
    templateId: { type: String, default: null },
    generatorVersion: { type: String, default: null },
    emailOrder: { type: [String] },
    selectedEmailId: { type: String, default: null },
    evidenceIds: { type: [String] },
    submittedAt: { type: String, default: null },
  },
  { _id: false, strict: 'throw' },
)

function hasVerdict(state) {
  return typeof state.selectedEmailId === 'string'
}

// one registry entry for the shared attempt service: the case and answer key stay in private state
// and the browser only ever receives the public state built below
export function createPhishingRuleset({ random = Math.random } = {}) {
  const library = createCaseLibrary({ random })

  return {
    id: GAME_ID,
    rulesetVersion: RULESET_VERSION,
    current: true,
    competitive: false,
    learningObjective:
      'Identify the email behind the first confirmed compromise and support it with sender, link and timeline evidence.',
    topicTags: ['deceptive-links', 'sender-spoofing', 'incident-timeline'],
    maxScore: MAX_SCORE,
    maxActions: 1,
    stateSchema,
    createState() {
      return {
        state: { ...library.openCase(), selectedEmailId: null, evidenceIds: [], submittedAt: null },
        mode: 'standard',
        deadlineAt: null,
      }
    },
    validateAction(type, payload) {
      return parseVerdictAction(type, payload)
    },
    applyAction(state, { payload }, meta) {
      if (hasVerdict(state)) throw verdictAlreadyRecorded()
      library.assertSelection(state, payload)
      return {
        ...state,
        selectedEmailId: payload.selectedEmailId,
        evidenceIds: payload.evidenceIds,
        submittedAt: meta.now.toISOString(),
      }
    },
    canComplete(state) {
      return hasVerdict(state)
    },
    summarize(state) {
      if (!hasVerdict(state)) {
        return {
          score: 0,
          feedback: { verdictCode: 'PHISH_VERDICT_PENDING', summary: 'No verdict submitted yet.' },
          topicOutcomes: [],
        }
      }
      const { score, feedback, topicOutcomes } = library.scoreVerdict(state)
      return { score, feedback, topicOutcomes }
    },
    serializePublicState(state, meta) {
      const publicState = {
        ...library.publicCase(state),
        verdict: hasVerdict(state)
          ? { selectedEmailId: state.selectedEmailId, evidenceIds: [...state.evidenceIds] }
          : null,
      }
      // the answer is revealed only once the result is frozen
      if (meta.status !== 'completed') return publicState
      const { emailCorrect, correctEvidenceIds } = library.scoreVerdict(state)
      return {
        ...publicState,
        outcome: { emailCorrect, correctEvidenceIds },
        debrief: library.debrief(state),
      }
    },
  }
}

// exactly what server.js registers; the shared attempt model accepts one ruleset entry today
export function createPhishingRulesets(options) {
  return [createPhishingRuleset(options)]
}

import { Schema } from 'mongoose'
import {
  GAME_ID,
  LEGACY_RULESET_VERSION,
  MAX_SCORE,
  RULESET_VERSION,
  parseVerdictAction,
  verdictAlreadyRecorded,
} from './policy.js'
import { createCaseLibrary } from './service.js'

const verdictFields = {
  emailOrder: { type: [String] },
  selectedEmailId: { type: String, default: null },
  evidenceIds: { type: [String] },
  submittedAt: { type: String, default: null },
}

const legacyStateSchema = new Schema(
  {
    caseId: { type: String, required: true },
    datasetVersion: { type: String, required: true },
    ...verdictFields,
  },
  { _id: false, strict: 'throw' },
)

// a generated case is stored as its seed, template and generator version, never as content
const stateSchema = new Schema(
  {
    source: { type: String, required: true, enum: ['authored', 'generated'] },
    caseId: { type: String, required: true },
    datasetVersion: { type: String, required: true },
    seed: { type: Number, default: null },
    templateId: { type: String, default: null },
    generatorVersion: { type: String, default: null },
    ...verdictFields,
  },
  { _id: false, strict: 'throw' },
)

function hasVerdict(state) {
  return typeof state.selectedEmailId === 'string'
}

// registry entries for the shared attempt service: the case and answer key stay in private state
// and the browser only ever receives the public state built below
function createEntry(library, { rulesetVersion, current, schema }) {
  return {
    id: GAME_ID,
    rulesetVersion,
    current,
    competitive: false,
    learningObjective:
      'Identify the email behind the first confirmed compromise and support it with sender, link and timeline evidence.',
    topicTags: ['deceptive-links', 'sender-spoofing', 'incident-timeline'],
    maxScore: MAX_SCORE,
    maxActions: 1,
    stateSchema: schema,
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

export function createPhishingRulesets({ random = Math.random } = {}) {
  const library = createCaseLibrary({ random })
  return [
    createEntry(library, {
      rulesetVersion: LEGACY_RULESET_VERSION,
      current: false,
      schema: legacyStateSchema,
    }),
    createEntry(library, { rulesetVersion: RULESET_VERSION, current: true, schema: stateSchema }),
  ]
}

// the current ruleset on its own, for tests that only exercise new attempts
export function createPhishingRuleset(options) {
  return createPhishingRulesets(options)[1]
}

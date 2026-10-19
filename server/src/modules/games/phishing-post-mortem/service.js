import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  EMAIL_POINTS,
  EVIDENCE_POINTS,
  REQUIRED_EVIDENCE,
  caseUnavailable,
  datasetChanged,
  unknownSelection,
} from './policy.js'
import { GENERATOR_VERSION, TEMPLATE_IDS, generateCase } from './generator/index.js'

export const CASE_IDS = ['case-01', 'case-02']
// each new case is drawn evenly from the authored cases and the generator templates
export const CASE_SOURCES = [
  ...CASE_IDS.map((caseId) => ({ source: 'authored', caseId })),
  ...TEMPLATE_IDS.map((templateId) => ({ source: 'generated', templateId })),
]
const GENERATED_CACHE_LIMIT = 100

function load(relativePath) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8'))
}

// fisher-yates using the injected source so tests can make the order deterministic
function shuffle(items, random) {
  const ordered = [...items]
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[ordered[index], ordered[swap]] = [ordered[swap], ordered[index]]
  }
  return ordered
}

function publicEmail(email) {
  return {
    id: email.id,
    senderName: email.senderName,
    senderAddress: email.senderAddress,
    replyTo: email.replyTo,
    subject: email.subject,
    sentAt: email.sentAt,
    bodyText: email.bodyText,
    links: email.links.map((link) => ({
      id: link.id,
      label: link.label,
      destination: link.destination,
    })),
  }
}

// authored and generated cases with their private answer keys; the saved-attempt ruleset is the only caller
export function createCaseLibrary({ random = Math.random } = {}) {
  const cases = new Map(
    CASE_IDS.map((caseId) => [
      caseId,
      {
        content: load(`./cases/${caseId}.public.json`),
        answers: load(`./cases/answers/${caseId}.answers.json`),
      },
    ]),
  )

  const generated = new Map()

  // a generated case is rebuilt from its stored seed, so a small cache saves repeat work per attempt
  function generatedCase({ seed, templateId, generatorVersion }) {
    if (generatorVersion !== GENERATOR_VERSION) throw caseUnavailable()
    const key = `${templateId}:${seed}`
    const cached = generated.get(key)
    if (cached) return cached
    const built = generateCase({ seed, templateId })
    if (!built) throw caseUnavailable()
    const entry = { content: built.content, answers: built.answers }
    generated.set(key, entry)
    if (generated.size > GENERATED_CACHE_LIMIT) generated.delete(generated.keys().next().value)
    return entry
  }

  // phish-1 state has no source field and always names an authored case
  function resolveCase(state) {
    if (state.source === 'generated') return generatedCase(state)
    const entry = cases.get(state.caseId)
    if (!entry) throw caseUnavailable()
    return entry
  }

  function openCase() {
    const choice = CASE_SOURCES[Math.floor(random() * CASE_SOURCES.length)]
    const identity =
      choice.source === 'authored'
        ? {
            source: 'authored',
            caseId: choice.caseId,
            seed: null,
            templateId: null,
            generatorVersion: null,
          }
        : {
            source: 'generated',
            seed: Math.floor(random() * 0x100000000),
            templateId: choice.templateId,
            generatorVersion: GENERATOR_VERSION,
          }
    const { content } = resolveCase(identity)
    return {
      ...identity,
      caseId: content.caseId,
      datasetVersion: content.datasetVersion,
      emailOrder: shuffle(
        content.emails.map((email) => email.id),
        random,
      ),
    }
  }

  function publicCase(state) {
    const { content } = resolveCase(state)
    const { emailOrder } = state
    const emailsById = new Map(content.emails.map((email) => [email.id, email]))
    const ordered = emailOrder.map((id) => emailsById.get(id)).filter(Boolean)
    // an edited case keeps its stored order but must still show every current message
    const emails = ordered.length === content.emails.length ? ordered : content.emails
    return {
      caseId: content.caseId,
      datasetVersion: content.datasetVersion,
      title: content.title,
      organisation: content.organisation,
      briefing: content.briefing,
      timezoneLabel: content.timezoneLabel,
      requiredEvidence: REQUIRED_EVIDENCE,
      emails: emails.map(publicEmail),
      timeline: content.timeline.map((event) => ({
        id: event.id,
        at: event.at,
        label: event.label,
        detail: event.detail,
      })),
      evidenceOptions: content.evidenceOptions.map((option) => ({
        id: option.id,
        label: option.label,
      })),
    }
  }

  function assertSelection(state, { selectedEmailId, evidenceIds }) {
    const { content } = resolveCase(state)
    if (state.datasetVersion !== content.datasetVersion) throw datasetChanged()
    const optionIds = new Set(content.evidenceOptions.map((option) => option.id))
    if (!content.emails.some((email) => email.id === selectedEmailId)) throw unknownSelection()
    if (evidenceIds.some((id) => !optionIds.has(id))) throw unknownSelection()
  }

  function scoreVerdict(state) {
    const { selectedEmailId, evidenceIds } = state
    const { answers } = resolveCase(state)
    const emailCorrect = selectedEmailId === answers.patientZeroId
    const selected = new Set(evidenceIds)
    const correctEvidenceIds = answers.evidenceIds.filter((id) => selected.has(id))
    // clues only score behind a correct verdict, so a lucky clue cannot carry a wrong accusation
    const score = emailCorrect ? EMAIL_POINTS + EVIDENCE_POINTS * correctEvidenceIds.length : 0
    return {
      score,
      emailCorrect,
      correctEvidenceIds,
      feedback: {
        verdictCode: emailCorrect ? 'PHISH_VERDICT_CORRECT' : 'PHISH_VERDICT_INCORRECT',
        summary: emailCorrect
          ? `You identified Patient Zero and ${correctEvidenceIds.length} of ${answers.evidenceIds.length} supporting clues.`
          : 'That message is not the one that caused the compromise. The evidence chain is below.',
      },
      topicOutcomes: answers.topics.map((topic) => {
        const achieved =
          topic.requires === 'email' ? emailCorrect : emailCorrect && selected.has(topic.requires)
        return {
          topic: topic.topic,
          achieved,
          feedbackCode: achieved ? topic.achievedCode : topic.missedCode,
        }
      }),
    }
  }

  function debrief(state) {
    const { evidenceIds } = state
    const { content, answers } = resolveCase(state)
    const emailsById = new Map(content.emails.map((email) => [email.id, email]))
    const selected = new Set(evidenceIds)
    const patientZero = emailsById.get(answers.patientZeroId)
    return {
      summary: answers.summary,
      patientZero: {
        id: patientZero.id,
        senderName: patientZero.senderName,
        senderAddress: patientZero.senderAddress,
        replyTo: patientZero.replyTo,
        subject: patientZero.subject,
      },
      chain: [...answers.chain],
      evidence: content.evidenceOptions.map((option) => ({
        id: option.id,
        label: option.label,
        correct: Boolean(answers.evidenceNotes[option.id]?.correct),
        selected: selected.has(option.id),
        note: answers.evidenceNotes[option.id]?.note ?? '',
      })),
      decoys: answers.decoys.map((decoy) => ({
        emailId: decoy.emailId,
        subject: emailsById.get(decoy.emailId)?.subject ?? '',
        note: decoy.note,
      })),
    }
  }

  return { openCase, resolveCase, publicCase, assertSelection, scoreVerdict, debrief }
}

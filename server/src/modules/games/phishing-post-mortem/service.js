import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  EMAIL_POINTS,
  EVIDENCE_POINTS,
  GAME_ID,
  MAX_SCORE,
  RULESET_VERSION,
  caseNotFound,
  datasetChanged,
  unknownSelection,
} from './policy.js'

export const CASE_IDS = ['case-01', 'case-02']

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

export function createPhishingService({ random = Math.random } = {}) {
  const cases = new Map(
    CASE_IDS.map((caseId) => [
      caseId,
      {
        content: load(`./cases/${caseId}.public.json`),
        answers: load(`./cases/answers/${caseId}.answers.json`),
      },
    ]),
  )

  function requireCase(caseId) {
    const entry = cases.get(caseId)
    if (!entry) throw caseNotFound()
    return entry
  }

  function startCase({ after = null } = {}) {
    const remaining = CASE_IDS.filter((caseId) => caseId !== after)
    const pool = remaining.length ? remaining : CASE_IDS
    const { content } = requireCase(pool[Math.floor(random() * pool.length)])
    return {
      gameId: GAME_ID,
      rulesetVersion: RULESET_VERSION,
      caseId: content.caseId,
      datasetVersion: content.datasetVersion,
      title: content.title,
      organisation: content.organisation,
      briefing: content.briefing,
      timezoneLabel: content.timezoneLabel,
      maxScore: MAX_SCORE,
      requiredEvidence: 2,
      emails: shuffle(content.emails, random).map(publicEmail),
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

  function scoreVerdict({ caseId, datasetVersion, actionId, selectedEmailId, evidenceIds }) {
    const { content, answers } = requireCase(caseId)
    if (datasetVersion !== content.datasetVersion) throw datasetChanged()
    const emailsById = new Map(content.emails.map((email) => [email.id, email]))
    const optionIds = new Set(content.evidenceOptions.map((option) => option.id))
    if (!emailsById.has(selectedEmailId))
      throw unknownSelection({ selectedEmailId: 'not an email in this case' })
    if (evidenceIds.some((id) => !optionIds.has(id)))
      throw unknownSelection({ evidenceIds: 'not evidence offered by this case' })

    const emailCorrect = selectedEmailId === answers.patientZeroId
    const selected = new Set(evidenceIds)
    const correctEvidence = answers.evidenceIds.filter((id) => selected.has(id))
    // clues only score behind a correct verdict, so a lucky clue cannot carry a wrong accusation
    const score = emailCorrect ? EMAIL_POINTS + EVIDENCE_POINTS * correctEvidence.length : 0
    const patientZero = emailsById.get(answers.patientZeroId)

    return {
      gameId: GAME_ID,
      rulesetVersion: RULESET_VERSION,
      caseId: content.caseId,
      datasetVersion: content.datasetVersion,
      actionId,
      status: 'completed',
      score,
      maxScore: MAX_SCORE,
      persisted: false,
      result: {
        selectedEmailId,
        emailCorrect,
        evidenceIds: [...evidenceIds],
        correctEvidenceIds: correctEvidence,
      },
      feedback: {
        verdictCode: emailCorrect ? 'PHISH_VERDICT_CORRECT' : 'PHISH_VERDICT_INCORRECT',
        summary: emailCorrect
          ? `You identified Patient Zero and ${correctEvidence.length} of ${answers.evidenceIds.length} supporting clues.`
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
      debrief: {
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
      },
    }
  }

  return { startCase, scoreVerdict }
}

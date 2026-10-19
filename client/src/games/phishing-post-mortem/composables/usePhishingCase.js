import { computed, onBeforeUnmount, ref } from 'vue'
import {
  attemptErrorCode,
  newActionId,
  openSavedCase,
  phishingErrorMessage,
  recordVerdict,
  rereadSavedCase,
  saveResult,
} from '../phishing.js'

export const REQUIRED_EVIDENCE = 2

// these mean the server already moved past this page's copy, so the attempt is read back first
const RESYNC_CODES = new Set([
  'ATTEMPT_STALE_REVISION',
  'ATTEMPT_ACTION_CONFLICT',
  'ATTEMPT_ACTION_LIMIT',
  'PHISH_VERDICT_RECORDED',
])

function sameVerdict(first, second) {
  if (!first || !second) return false
  return (
    first.selectedEmailId === second.selectedEmailId &&
    first.evidenceIds.join() === second.evidenceIds.join()
  )
}

// the debrief components keep their earlier shape; the values now come from the saved snapshot
function toResult(snapshot) {
  const { verdict, outcome, debrief } = snapshot.publicState
  return {
    score: snapshot.score,
    maxScore: snapshot.maxScore,
    persisted: snapshot.persisted === true && snapshot.status === 'completed',
    completedAt: snapshot.completedAt,
    feedback: snapshot.feedback,
    topicOutcomes: snapshot.topicOutcomes,
    result: {
      selectedEmailId: verdict.selectedEmailId,
      evidenceIds: verdict.evidenceIds,
      emailCorrect: outcome.emailCorrect,
      correctEvidenceIds: outcome.correctEvidenceIds,
    },
    debrief,
  }
}

export function usePhishingCase() {
  const caseFile = ref(null)
  const loading = ref(false)
  const submitting = ref(false)
  const loadError = ref('')
  const submissionError = ref('')
  const result = ref(null)
  const selectedEmailId = ref('')
  const accusedEmailId = ref('')
  const readEmailIds = ref([])
  const inspectedLinkIds = ref([])
  const selectedEvidenceIds = ref([])
  const pane = ref('message')
  const reviewing = ref(false)
  const verdictLocked = ref(false)

  let controller
  let generation = 0
  let disposed = false
  let attemptId = ''
  let revision = 0
  let sentVerdict = null
  let verdictActionId = ''
  let completionActionId = ''

  const findEmail = (id) => caseFile.value?.emails.find((email) => email.id === id) ?? null
  const selectedEmail = computed(() => findEmail(selectedEmailId.value))
  const accusedEmail = computed(() => findEmail(accusedEmailId.value))
  const emails = computed(
    () =>
      caseFile.value?.emails.map((email) => ({
        ...email,
        read: readEmailIds.value.includes(email.id),
      })) ?? [],
  )
  const canSubmit = computed(
    () =>
      Boolean(accusedEmailId.value) &&
      selectedEvidenceIds.value.length === REQUIRED_EVIDENCE &&
      !submitting.value &&
      !result.value,
  )

  function reset() {
    selectedEmailId.value = ''
    accusedEmailId.value = ''
    readEmailIds.value = []
    inspectedLinkIds.value = []
    selectedEvidenceIds.value = []
    result.value = null
    reviewing.value = false
    pane.value = 'message'
    verdictLocked.value = false
    attemptId = ''
    revision = 0
    sentVerdict = null
    verdictActionId = ''
    completionActionId = newActionId()
  }

  function selectEmail(id) {
    selectedEmailId.value = id
    if (!readEmailIds.value.includes(id)) readEmailIds.value = [...readEmailIds.value, id]
    pane.value = 'message'
    // after the verdict a message opens read-only, with a way back to the debrief
    if (result.value) reviewing.value = true
  }

  function backToDebrief() {
    reviewing.value = false
    pane.value = 'message'
  }

  function accuse(id) {
    accusedEmailId.value = id
  }

  function inspectLink(linkId) {
    if (!inspectedLinkIds.value.includes(linkId))
      inspectedLinkIds.value = [...inspectedLinkIds.value, linkId]
  }

  function setEvidence(ids) {
    selectedEvidenceIds.value = ids.slice(0, REQUIRED_EVIDENCE)
  }

  function showInbox() {
    pane.value = 'inbox'
  }

  async function load() {
    controller?.abort()
    controller = new AbortController()
    // a generation guard keeps a slow earlier response from overwriting a newer case
    const request = (generation += 1)
    loading.value = true
    loadError.value = ''
    submissionError.value = ''
    caseFile.value = null
    reset()
    try {
      const snapshot = await openSavedCase(controller.signal)
      if (disposed || request !== generation) return
      attemptId = snapshot.attemptId
      revision = snapshot.revision
      caseFile.value = snapshot.publicState
    } catch (requestError) {
      if (disposed || request !== generation) return
      loadError.value = phishingErrorMessage(
        requestError,
        'The case file could not be opened. Check your connection and try again.',
      )
    } finally {
      if (!disposed && request === generation) loading.value = false
    }
  }

  function acceptSnapshot(snapshot) {
    revision = snapshot.revision
    verdictLocked.value = Boolean(snapshot.publicState?.verdict)
  }

  function requestResult(signal) {
    return saveResult(
      attemptId,
      { actionId: completionActionId, expectedRevision: revision },
      signal,
    )
  }

  // the verdict and the saved result are two server steps; a recorded verdict is never sent twice
  async function recordAndSave(signal) {
    if (!verdictLocked.value) {
      const verdict = {
        selectedEmailId: accusedEmailId.value,
        evidenceIds: [...selectedEvidenceIds.value],
      }
      // a retry of the same verdict reuses its action id so a lost response is replayed, not repeated
      if (!sameVerdict(verdict, sentVerdict)) {
        sentVerdict = verdict
        verdictActionId = newActionId()
      }
      const recorded = await recordVerdict(
        attemptId,
        { actionId: verdictActionId, expectedRevision: revision, verdict },
        signal,
      )
      acceptSnapshot(recorded)
    }
    return requestResult(signal)
  }

  async function resyncAndSave(signal, originalError) {
    const latest = await rereadSavedCase(attemptId, signal)
    if (latest.status === 'completed') return latest
    acceptSnapshot(latest)
    if (!verdictLocked.value) throw originalError
    return requestResult(signal)
  }

  async function saveVerdict(signal) {
    try {
      return await recordAndSave(signal)
    } catch (requestError) {
      if (!RESYNC_CODES.has(attemptErrorCode(requestError))) throw requestError
      return resyncAndSave(signal, requestError)
    }
  }

  async function submit() {
    if (!canSubmit.value || !attemptId) return
    const request = generation
    submitting.value = true
    try {
      const finished = await saveVerdict(controller?.signal)
      if (disposed || request !== generation) return
      result.value = toResult(finished)
      reviewing.value = false
      submissionError.value = ''
      pane.value = 'message'
    } catch (requestError) {
      if (disposed || request !== generation) return
      submissionError.value = phishingErrorMessage(
        requestError,
        'That verdict could not be saved. Try again in a moment.',
      )
    } finally {
      if (!disposed && request === generation) submitting.value = false
    }
  }

  function replay() {
    return load()
  }

  onBeforeUnmount(() => {
    disposed = true
    controller?.abort()
  })

  return {
    caseFile,
    emails,
    loading,
    submitting,
    loadError,
    submissionError,
    result,
    selectedEmailId,
    selectedEmail,
    accusedEmailId,
    accusedEmail,
    selectedEvidenceIds,
    inspectedLinkIds,
    pane,
    reviewing,
    verdictLocked,
    canSubmit,
    load,
    replay,
    submit,
    selectEmail,
    accuse,
    inspectLink,
    setEvidence,
    showInbox,
    backToDebrief,
  }
}

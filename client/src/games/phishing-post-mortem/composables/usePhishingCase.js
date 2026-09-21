import { computed, onBeforeUnmount, ref } from 'vue'
import { fetchCase, newActionId, phishingErrorMessage, submitVerdict } from '../phishing.js'

export const REQUIRED_EVIDENCE = 2

export function usePhishingCase() {
  const caseFile = ref(null)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref('')
  const result = ref(null)
  const selectedEmailId = ref('')
  const accusedEmailId = ref('')
  const readEmailIds = ref([])
  const inspectedLinkIds = ref([])
  const selectedEvidenceIds = ref([])
  const pane = ref('message')

  let controller
  let generation = 0
  let disposed = false
  let actionId = ''

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
    pane.value = 'message'
    actionId = newActionId()
  }

  function selectEmail(id) {
    selectedEmailId.value = id
    if (!readEmailIds.value.includes(id)) readEmailIds.value = [...readEmailIds.value, id]
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

  async function load(after = null) {
    controller?.abort()
    controller = new AbortController()
    // a generation guard keeps a slow earlier response from overwriting a newer case
    const request = (generation += 1)
    loading.value = true
    error.value = ''
    caseFile.value = null
    reset()
    try {
      const data = await fetchCase(after, controller.signal)
      if (disposed || request !== generation) return
      caseFile.value = data
    } catch (requestError) {
      if (disposed || request !== generation) return
      error.value = phishingErrorMessage(
        requestError,
        'The case file could not be opened. Check your connection and try again.',
      )
    } finally {
      if (!disposed && request === generation) loading.value = false
    }
  }

  async function submit() {
    if (!canSubmit.value || !caseFile.value) return
    const request = generation
    submitting.value = true
    error.value = ''
    try {
      const data = await submitVerdict(
        {
          caseId: caseFile.value.caseId,
          datasetVersion: caseFile.value.datasetVersion,
          actionId,
          selectedEmailId: accusedEmailId.value,
          evidenceIds: [...selectedEvidenceIds.value],
        },
        controller?.signal,
      )
      if (disposed || request !== generation) return
      result.value = data
      pane.value = 'message'
    } catch (requestError) {
      if (disposed || request !== generation) return
      error.value = phishingErrorMessage(
        requestError,
        'That verdict could not be submitted. Try again in a moment.',
      )
    } finally {
      if (!disposed && request === generation) submitting.value = false
    }
  }

  function replay() {
    return load(caseFile.value?.caseId ?? null)
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
    error,
    result,
    selectedEmailId,
    selectedEmail,
    accusedEmailId,
    accusedEmail,
    selectedEvidenceIds,
    inspectedLinkIds,
    pane,
    canSubmit,
    load,
    replay,
    submit,
    selectEmail,
    accuse,
    inspectLink,
    setEvidence,
    showInbox,
  }
}

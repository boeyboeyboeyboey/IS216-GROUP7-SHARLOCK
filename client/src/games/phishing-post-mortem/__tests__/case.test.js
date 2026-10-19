import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { usePhishingCase } from '../composables/usePhishingCase.js'
import { openSavedCase, recordVerdict, rereadSavedCase, saveResult } from '../phishing.js'

vi.mock('../phishing.js', async (original) => ({
  ...(await original()),
  openSavedCase: vi.fn(),
  recordVerdict: vi.fn(),
  rereadSavedCase: vi.fn(),
  saveResult: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

const caseFile = {
  caseId: 'case-01',
  datasetVersion: '2026-09-21',
  title: 'Test case',
  organisation: 'Testco',
  briefing: 'Find it',
  timezoneLabel: 'SGT (UTC+8)',
  requiredEvidence: 2,
  emails: [
    {
      id: 'a01',
      senderName: 'A',
      senderAddress: 'a@x.example',
      replyTo: 'a@x.example',
      subject: 'One',
      sentAt: '2026-09-14T00:00:00.000Z',
      bodyText: 'one',
      links: [],
    },
    {
      id: 'a02',
      senderName: 'B',
      senderAddress: 'b@x.example',
      replyTo: 'b@x.example',
      subject: 'Two',
      sentAt: '2026-09-14T01:00:00.000Z',
      bodyText: 'two',
      links: [],
    },
  ],
  timeline: [{ id: 't1', at: '2026-09-14T00:30:00.000Z', label: 'Proxy', detail: 'opened' }],
  evidenceOptions: [
    { id: 'ev-a', label: 'A' },
    { id: 'ev-b', label: 'B' },
    { id: 'ev-c', label: 'C' },
  ],
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const verdictA02 = { selectedEmailId: 'a02', evidenceIds: ['ev-a', 'ev-b'] }

function started(attemptId = 'attempt-1') {
  return {
    attemptId,
    gameId: 'phishing-post-mortem',
    status: 'active',
    revision: 0,
    score: 0,
    maxScore: 100,
    persisted: true,
    completedAt: null,
    publicState: { ...caseFile, verdict: null },
  }
}

function recorded(verdict = verdictA02, score = 100) {
  return { ...started(), revision: 1, score, publicState: { ...caseFile, verdict } }
}

function completed(verdict = verdictA02, score = 100) {
  return {
    ...started(),
    status: 'completed',
    revision: 2,
    score,
    completedAt: '2026-10-19T12:00:00.000Z',
    feedback: { verdictCode: 'PHISH_VERDICT_CORRECT', summary: 'Well found.' },
    topicOutcomes: [],
    publicState: {
      ...caseFile,
      verdict,
      outcome: { emailCorrect: score > 0, correctEvidenceIds: verdict.evidenceIds },
      debrief: { summary: 'It started here.', chain: [], evidence: [], decoys: [] },
    },
  }
}

function serverRecords(score = 100) {
  openSavedCase.mockResolvedValue(started())
  recordVerdict.mockImplementation((_id, { verdict }) => Promise.resolve(recorded(verdict, score)))
  saveResult.mockImplementation(() => {
    const [, { verdict }] = recordVerdict.mock.calls.at(-1)
    return Promise.resolve(completed(verdict, score))
  })
}

function conflict(code) {
  return { response: { status: 409, data: { error: { code, message: 'This activity changed.' } } } }
}

function harness() {
  let game
  const wrapper = mount({
    setup() {
      game = usePhishingCase()
      return () => null
    },
  })
  return { game, wrapper }
}

describe('phishing case state', () => {
  it('opens a saved personal case and starts with nothing read, opened or accused', async () => {
    serverRecords()
    const { game } = harness()
    await game.load()
    await flushPromises()
    expect(openSavedCase).toHaveBeenCalledTimes(1)
    expect(game.caseFile.value.caseId).toBe('case-01')
    expect(game.emails.value.every((email) => !email.read)).toBe(true)
    expect(game.selectedEmailId.value).toBe('')
    expect(game.accusedEmailId.value).toBe('')
    expect(game.canSubmit.value).toBe(false)
    expect(game.verdictLocked.value).toBe(false)
  })

  it('opening a message marks it read without accusing it', async () => {
    serverRecords()
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.selectEmail('a02')
    expect(game.selectedEmail.value.subject).toBe('Two')
    expect(game.emails.value.find((email) => email.id === 'a02').read).toBe(true)
    expect(game.pane.value).toBe('message')
    expect(game.accusedEmailId.value).toBe('')
  })

  it('keeps at most two clues and only submits with an accusation', async () => {
    serverRecords()
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.setEvidence(['ev-a', 'ev-b', 'ev-c'])
    expect(game.selectedEvidenceIds.value).toEqual(['ev-a', 'ev-b'])
    expect(game.canSubmit.value).toBe(false)
    game.accuse('a01')
    expect(game.canSubmit.value).toBe(true)
  })

  it('records the accused message, then saves the server-scored result', async () => {
    serverRecords()
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.selectEmail('a01')
    game.accuse('a02')
    game.setEvidence(['ev-a', 'ev-b'])
    await game.submit()
    await flushPromises()

    const [attemptId, action] = recordVerdict.mock.calls[0]
    expect(attemptId).toBe('attempt-1')
    expect(action.verdict).toEqual(verdictA02)
    expect(action.expectedRevision).toBe(0)
    expect(action.actionId).toMatch(UUID)
    const [, completion] = saveResult.mock.calls[0]
    expect(completion.expectedRevision).toBe(1)
    expect(completion.actionId).toMatch(UUID)
    expect(completion.actionId).not.toBe(action.actionId)

    expect(game.result.value.score).toBe(100)
    expect(game.result.value.persisted).toBe(true)
    expect(game.result.value.result.selectedEmailId).toBe('a02')
    expect(game.result.value.debrief.summary).toBe('It started here.')
    expect(game.canSubmit.value).toBe(false)
  })

  it('reopens a message for review after the verdict and returns to the debrief', async () => {
    serverRecords()
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.selectEmail('a01')
    expect(game.reviewing.value).toBe(false)
    game.accuse('a02')
    game.setEvidence(['ev-a', 'ev-b'])
    await game.submit()
    await flushPromises()
    expect(game.reviewing.value).toBe(false)
    game.selectEmail('a02')
    expect(game.reviewing.value).toBe(true)
    expect(game.selectedEmail.value.id).toBe('a02')
    game.backToDebrief()
    expect(game.reviewing.value).toBe(false)
  })

  it('opens a new saved case on replay and clears the previous attempt', async () => {
    serverRecords(60)
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.accuse('a01')
    game.setEvidence(['ev-a', 'ev-b'])
    await game.submit()
    await flushPromises()
    game.selectEmail('a02')
    await game.replay()
    await flushPromises()
    expect(openSavedCase).toHaveBeenCalledTimes(2)
    expect(game.reviewing.value).toBe(false)
    expect(game.result.value).toBeNull()
    expect(game.selectedEvidenceIds.value).toEqual([])
  })

  it('retries a failed case load and clears its load error', async () => {
    openSavedCase
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Saved play is unavailable.' } } },
      })
      .mockResolvedValueOnce(started())
    const { game } = harness()
    await game.load()
    await flushPromises()
    expect(game.loadError.value).toBe('Saved play is unavailable.')
    expect(game.caseFile.value).toBeNull()

    await game.load()
    await flushPromises()
    expect(game.loadError.value).toBe('')
    expect(game.caseFile.value.caseId).toBe('case-01')
  })

  it('retries a lost verdict with its original action id and revision', async () => {
    serverRecords()
    recordVerdict.mockRejectedValueOnce({
      response: { data: { error: { message: 'Saved attempts are temporarily unavailable.' } } },
    })
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.selectEmail('a01')
    game.accuse('a02')
    game.setEvidence(['ev-a', 'ev-b'])
    game.showInbox()

    await game.submit()
    await flushPromises()

    expect(game.submissionError.value).toBe('Saved attempts are temporarily unavailable.')
    expect(game.verdictLocked.value).toBe(false)
    expect(game.caseFile.value.caseId).toBe('case-01')
    expect(game.selectedEmailId.value).toBe('a01')
    expect(game.accusedEmailId.value).toBe('a02')
    expect(game.selectedEvidenceIds.value).toEqual(['ev-a', 'ev-b'])
    expect(game.pane.value).toBe('inbox')
    expect(saveResult).not.toHaveBeenCalled()

    await game.submit()
    await flushPromises()

    expect(recordVerdict.mock.calls[1][1]).toEqual(recordVerdict.mock.calls[0][1])
    expect(game.submissionError.value).toBe('')
    expect(game.result.value.score).toBe(100)
  })

  it('sends a changed verdict as a new action', async () => {
    serverRecords()
    recordVerdict.mockRejectedValueOnce({ response: { data: { error: { message: 'Offline.' } } } })
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.accuse('a02')
    game.setEvidence(['ev-a', 'ev-b'])
    await game.submit()
    await flushPromises()
    game.accuse('a01')
    await game.submit()
    await flushPromises()

    const [first, second] = recordVerdict.mock.calls.map(([, action]) => action)
    expect(second.verdict.selectedEmailId).toBe('a01')
    expect(second.actionId).not.toBe(first.actionId)
    expect(second.expectedRevision).toBe(0)
  })

  it('locks a recorded verdict and only retries saving the result', async () => {
    serverRecords()
    saveResult.mockRejectedValueOnce({ response: { data: { error: { message: 'Try again.' } } } })
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.accuse('a02')
    game.setEvidence(['ev-a', 'ev-b'])
    await game.submit()
    await flushPromises()

    expect(game.verdictLocked.value).toBe(true)
    expect(game.result.value).toBeNull()
    expect(game.submissionError.value).toBe('Try again.')

    await game.submit()
    await flushPromises()
    expect(recordVerdict).toHaveBeenCalledTimes(1)
    expect(saveResult.mock.calls[1][1]).toEqual(saveResult.mock.calls[0][1])
    expect(game.result.value.persisted).toBe(true)
  })

  it('reads the saved case back after a conflict and finishes the recorded verdict', async () => {
    serverRecords()
    recordVerdict.mockRejectedValueOnce(conflict('ATTEMPT_STALE_REVISION'))
    rereadSavedCase.mockResolvedValue(recorded(verdictA02))
    saveResult.mockResolvedValue(completed(verdictA02))
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.accuse('a01')
    game.setEvidence(['ev-a', 'ev-b'])
    await game.submit()
    await flushPromises()

    expect(rereadSavedCase).toHaveBeenCalledWith('attempt-1', expect.anything())
    expect(saveResult.mock.calls[0][1].expectedRevision).toBe(1)
    // the debrief shows the verdict the server actually holds
    expect(game.result.value.result.selectedEmailId).toBe('a02')
    expect(game.submissionError.value).toBe('')
  })

  it('shows an already saved result when the case was finished elsewhere', async () => {
    serverRecords()
    recordVerdict.mockRejectedValueOnce(conflict('ATTEMPT_ACTION_LIMIT'))
    rereadSavedCase.mockResolvedValue(completed(verdictA02, 80))
    const { game } = harness()
    await game.load()
    await flushPromises()
    game.accuse('a02')
    game.setEvidence(['ev-a', 'ev-b'])
    await game.submit()
    await flushPromises()
    expect(saveResult).not.toHaveBeenCalled()
    expect(game.result.value.score).toBe(80)
  })
})

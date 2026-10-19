import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PhishingPostMortem from '../PhishingPostMortem.vue'
import EmailInspector from '../components/EmailInspector.vue'
import InboxList from '../components/InboxList.vue'
import VerdictPanel from '../components/VerdictPanel.vue'
import { openSavedCase, recordVerdict, saveResult } from '../phishing.js'

vi.mock('../phishing.js', async (original) => ({
  ...(await original()),
  openSavedCase: vi.fn(),
  recordVerdict: vi.fn(),
  saveResult: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

const email = {
  id: 'a11',
  senderName: 'Aurora IT Service Desk',
  senderAddress: 'it-servicedesk@aurora-dynarnics.example',
  replyTo: 'sso-helpdesk@mailbox-relay.example',
  subject: 'Action required',
  sentAt: '2026-09-14T07:58:00.000Z',
  bodyText: 'Re-verify your access',
  links: [
    {
      id: 'a11-l1',
      label: 'https://sso.aurora-dynamics.example/reverify',
      destination: 'https://aurora-dynarnics-sso.example/verify',
    },
  ],
}
const options = [
  { id: 'ev-a', label: 'Clue A' },
  { id: 'ev-b', label: 'Clue B' },
  { id: 'ev-c', label: 'Clue C' },
]

describe('inbox list', () => {
  it('shows every message with its sender and emits the opened id', async () => {
    const wrapper = mount(InboxList, {
      props: { emails: [{ ...email, read: false }], selectedEmailId: '' },
    })
    expect(wrapper.text()).toContain('Aurora IT Service Desk')
    expect(wrapper.text()).toContain('Action required')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select-email')[0]).toEqual(['a11'])
  })
})

describe('phishing case page', () => {
  const publicCase = {
    caseId: 'case-01',
    datasetVersion: '2026-09-21',
    title: 'Test case',
    organisation: 'Testco',
    briefing: 'Find it',
    timezoneLabel: 'SGT (UTC+8)',
    requiredEvidence: 2,
    emails: [email],
    timeline: [{ id: 't1', at: '2026-09-14T00:30:00.000Z', label: 'Proxy', detail: 'opened' }],
    evidenceOptions: options,
    verdict: null,
  }
  const verdict = { selectedEmailId: 'a11', evidenceIds: ['ev-a', 'ev-b'] }
  const snapshot = (changes = {}) => ({
    attemptId: 'attempt-1',
    status: 'active',
    revision: 0,
    score: 0,
    maxScore: 100,
    persisted: true,
    publicState: publicCase,
    ...changes,
  })
  const savedResult = snapshot({
    status: 'completed',
    revision: 2,
    score: 100,
    completedAt: '2026-10-19T12:00:00.000Z',
    feedback: { summary: 'The evidence supports your verdict.' },
    topicOutcomes: [],
    publicState: {
      ...publicCase,
      verdict,
      outcome: { emailCorrect: true, correctEvidenceIds: ['ev-a', 'ev-b'] },
      debrief: {
        summary: 'The message started the incident.',
        patientZero: {
          id: 'a11',
          subject: email.subject,
          senderName: email.senderName,
          senderAddress: email.senderAddress,
        },
        chain: ['A link was opened.'],
        evidence: [],
        decoys: [],
      },
    },
  })

  async function mountWithVerdict() {
    const wrapper = mount(PhishingPostMortem, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()
    await wrapper.get('.sharmail-row').trigger('click')
    await wrapper.get('.sharmail-accuse').trigger('click')
    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true)
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    await wrapper.get('.sharmail-submit').trigger('click')
    await flushPromises()
    return wrapper
  }

  const retryButton = (wrapper, label) =>
    wrapper.findAll('button').find((button) => button.text() === label)

  it('keeps a failed verdict visible and lets the learner retry it', async () => {
    openSavedCase.mockResolvedValue(snapshot())
    let finishRetry
    recordVerdict
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Saved attempts are temporarily unavailable.' } } },
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRetry = resolve
          }),
      )
    saveResult.mockResolvedValue(savedResult)

    const wrapper = await mountWithVerdict()
    expect(wrapper.find('.sharmail').exists()).toBe(true)
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Saved attempts are temporarily unavailable.',
    )
    expect(wrapper.get('.sharmail-row').attributes('aria-current')).toBe('true')
    expect(wrapper.get('.sharmail-accuse').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(3)
    const retry = retryButton(wrapper, 'Retry verdict')
    expect(retry.exists()).toBe(true)

    const clues = wrapper.findAll('input[type="checkbox"]')
    await clues[0].setValue(false)
    expect(retry.attributes('disabled')).toBeDefined()
    await clues[0].setValue(true)
    expect(retry.attributes('disabled')).toBeUndefined()

    await retry.trigger('click')
    expect(retry.attributes('disabled')).toBeDefined()
    finishRetry(snapshot({ revision: 1, score: 100, publicState: { ...publicCase, verdict } }))
    await flushPromises()
    expect(wrapper.text()).toContain('100 / 100 points')
    expect(wrapper.text()).toContain('Result saved to your account.')
    expect(wrapper.find('.sharmail').exists()).toBe(true)
  })

  it('locks a recorded verdict while only the saved result is retried', async () => {
    openSavedCase.mockResolvedValue(snapshot())
    recordVerdict.mockResolvedValue(
      snapshot({ revision: 1, score: 100, publicState: { ...publicCase, verdict } }),
    )
    saveResult
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Try again.' } } } })
      .mockResolvedValueOnce(savedResult)

    const wrapper = await mountWithVerdict()
    expect(wrapper.text()).toContain('Your verdict is recorded. Retry to save the result.')
    expect(wrapper.text()).not.toContain('Result saved to your account.')
    expect(wrapper.get('#phish-evidence').attributes('disabled')).toBeDefined()

    await retryButton(wrapper, 'Retry saving').trigger('click')
    await flushPromises()
    expect(recordVerdict).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Result saved to your account.')
  })
})

describe('email inspector', () => {
  it('shows the real sender and reply-to addresses', () => {
    const wrapper = mount(EmailInspector, { props: { email } })
    expect(wrapper.text()).toContain('it-servicedesk@aurora-dynarnics.example')
    expect(wrapper.text()).toContain('sso-helpdesk@mailbox-relay.example')
  })

  it('hides a destination until it is inspected, renders no anchor, and can hide it again', async () => {
    const wrapper = mount(EmailInspector, { props: { email } })
    expect(wrapper.text()).not.toContain('aurora-dynarnics-sso.example/verify')
    expect(wrapper.find('a').exists()).toBe(false)
    const button = wrapper.get('.sharmail-inspect')
    await button.trigger('click')
    expect(wrapper.text()).toContain('aurora-dynarnics-sso.example/verify')
    expect(wrapper.emitted('inspect-link')[0]).toEqual(['a11-l1'])
    await button.trigger('click')
    expect(wrapper.text()).not.toContain('aurora-dynarnics-sso.example/verify')
  })
})

describe('verdict panel', () => {
  const props = {
    selectedEmailId: '',
    selectedSubject: '',
    evidenceOptions: options,
    selectedEvidenceIds: [],
    disabled: false,
  }

  it('cannot submit without an accusation and two clues', () => {
    const wrapper = mount(VerdictPanel, { props })
    expect(wrapper.get('.sharmail-submit').attributes('disabled')).toBeDefined()
  })

  it('emits the new clue selection when one is toggled', async () => {
    const wrapper = mount(VerdictPanel, { props })
    await wrapper.findAll('input[type="checkbox"]')[1].trigger('change')
    expect(wrapper.emitted('update-evidence')[0]).toEqual([['ev-b']])
  })

  it('locks the remaining clues once two are chosen and explains why', () => {
    const wrapper = mount(VerdictPanel, {
      props: { ...props, selectedEvidenceIds: ['ev-a', 'ev-b'] },
    })
    const boxes = wrapper.findAll('input[type="checkbox"]')
    expect(boxes[2].attributes('disabled')).toBeDefined()
    expect(boxes[0].attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Clear one to pick a different clue')
  })

  it('submits once an accusation and two clues are in place', async () => {
    const wrapper = mount(VerdictPanel, {
      props: {
        ...props,
        selectedEmailId: 'a11',
        selectedSubject: 'Action required',
        selectedEvidenceIds: ['ev-a', 'ev-b'],
      },
    })
    expect(wrapper.text()).toContain('Action required')
    await wrapper.get('.sharmail-submit').trigger('click')
    expect(wrapper.emitted('submit-verdict')).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EmailInspector from '../components/EmailInspector.vue'
import InboxList from '../components/InboxList.vue'
import VerdictPanel from '../components/VerdictPanel.vue'

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

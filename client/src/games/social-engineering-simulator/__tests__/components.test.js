import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatThread from '../components/ChatThread.vue'
import DebriefPanel from '../components/DebriefPanel.vue'
import DecisionBar from '../components/DecisionBar.vue'
import MessageComposer from '../components/MessageComposer.vue'
import ScenarioBrief from '../components/ScenarioBrief.vue'

describe('scenario brief', () => {
  const props = {
    brief: { title: 'IT Service Desk is paging you', objective: 'Protect the code', turnBudget: 8 },
    persona: { id: 'it-helpdesk', displayName: 'Jordan Vale (IT Service Desk)' },
  }

  it('shows the brief and persona and emits start', async () => {
    const wrapper = mount(ScenarioBrief, { props })
    expect(wrapper.text()).toContain('IT Service Desk is paging you')
    expect(wrapper.text()).toContain('Jordan Vale (IT Service Desk)')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('shows the reset code in the brief when one is provided', () => {
    const wrapper = mount(ScenarioBrief, { props: { ...props, resetCode: 'SYNTH-RESET-4821' } })
    expect(wrapper.get('[data-testid="soc-reset-code"]').text()).toBe('SYNTH-RESET-4821')
  })

  it('renders the brief without a code when the server sends none', () => {
    const wrapper = mount(ScenarioBrief, { props })
    expect(wrapper.find('[data-testid="soc-reset-code"]').exists()).toBe(false)
  })
})

describe('chat thread', () => {
  it('renders both speakers and a pending indicator', () => {
    const wrapper = mount(ChatThread, {
      props: {
        messages: [
          { role: 'colleague', content: 'Hi there' },
          { role: 'you', content: 'Who is this?' },
        ],
        pending: true,
        personaName: 'Jordan Vale',
      },
    })
    expect(wrapper.get('[role="log"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).toContain('Hi there')
    expect(wrapper.text()).toContain('Who is this?')
    expect(wrapper.get('[role="status"]').text()).toContain('replying')
  })
})

describe('message composer', () => {
  it('emits the trimmed text on submit and clears the field', async () => {
    const wrapper = mount(MessageComposer, { props: { disabled: false, maxLength: 1000 } })
    const field = wrapper.get('textarea')
    await field.setValue('  hello there  ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('send')[0]).toEqual(['hello there'])
  })

  it('sends on Enter but not on Shift+Enter', async () => {
    const wrapper = mount(MessageComposer, { props: { disabled: false, maxLength: 1000 } })
    const field = wrapper.get('textarea')
    await field.setValue('ping')
    await field.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
    await field.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')[0]).toEqual(['ping'])
  })

  it('does not emit when disabled', async () => {
    const wrapper = mount(MessageComposer, { props: { disabled: true, maxLength: 1000 } })
    await wrapper.get('textarea').setValue('nope')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('send')).toBeUndefined()
  })
})

describe('decision bar', () => {
  it('renders the three decisions and emits the chosen id', async () => {
    const wrapper = mount(DecisionBar, { props: { disabled: false } })
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    await buttons[1].trigger('click')
    expect(wrapper.emitted('decide')[0]).toEqual(['verify-independently'])
  })

  it('puts the unsafe-choice warning on its own line under the description', () => {
    const wrapper = mount(DecisionBar, { props: { disabled: false } })
    const danger = wrapper.get('.soc-button-danger')
    expect(danger.get('.soc-decision-desc').text()).toBe('Hand over the reset code.')
    expect(danger.get('.soc-decision-note').text()).toBe('(this is the unsafe choice)')
    expect(wrapper.findAll('.soc-decision-note')).toHaveLength(1)
  })

  it('disables every choice when asked', () => {
    const wrapper = mount(DecisionBar, { props: { disabled: true } })
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
  })
})

describe('debrief panel', () => {
  const result = {
    score: 75,
    maxScore: 100,
    outcome: 'partial',
    breakdown: [
      { key: 'noLeak', label: 'Protected the reset code', points: 60, max: 60 },
      { key: 'verify', label: 'Verified through an independent channel', points: 0, max: 25 },
      { key: 'efficiency', label: 'Stayed within the turn budget', points: 15, max: 15 },
    ],
    debrief: {
      summary: 'You protected the code.',
      tactic: 'authority',
      saferesponse: 'verify',
      note: '',
    },
    saved: false,
  }

  it('shows the score, breakdown and the unsaved label and emits restart', async () => {
    const wrapper = mount(DebriefPanel, { props: { result } })
    expect(wrapper.text()).toContain('75 / 100')
    expect(wrapper.text()).toContain('Protected the reset code')
    expect(wrapper.text()).toContain('practice')
    expect(wrapper.text()).toContain('not saved')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('restart')).toHaveLength(1)
  })
})

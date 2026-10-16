import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProfileEditor from '../components/ProfileEditor.vue'

const profile = { username: 'Case_Finder', avatarId: 'blue' }

describe('profile editor', () => {
  it('labels the fields, focuses username, validates input and emits a trimmed profile', async () => {
    const wrapper = mount(ProfileEditor, { props: { profile }, attachTo: document.body })
    await flushPromises()
    const username = wrapper.get('#profile-username')
    expect(username.element).toBe(document.activeElement)
    expect(wrapper.get('label[for="profile-username"]').text()).toBe('Username')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(6)

    await username.setValue('ab')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#profile-username-error').text()).toContain('3 to 32')
    expect(username.attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('save')).toBeUndefined()

    await username.setValue('  New_Case  ')
    await wrapper.get('input[type="radio"][value="reader"]').setValue()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([[{ username: 'New_Case', avatarId: 'reader' }]])
  })

  it('keeps an edited draft after a server conflict and disables controls while pending', async () => {
    const wrapper = mount(ProfileEditor, {
      props: {
        profile,
        error: {
          message: 'That username is already in use. Choose another one.',
          fieldErrors: { username: 'That username is already in use. Choose another one.' },
        },
      },
    })
    const username = wrapper.get('#profile-username')
    await username.setValue('Taken_Name')
    expect(wrapper.get('#profile-username-error').text()).toContain('already in use')
    expect(username.element.value).toBe('Taken_Name')

    await wrapper.setProps({ pending: true })
    expect(username.element.disabled).toBe(true)
    expect(wrapper.get('button[type="submit"]').text()).toContain('Saving')
    expect(wrapper.get('[role="status"]').text()).toContain('Saving your profile')
    expect(wrapper.get('button[type="button"]').element.disabled).toBe(true)
  })

  it('emits cancel without changing the saved profile', async () => {
    const wrapper = mount(ProfileEditor, { props: { profile } })
    await wrapper.get('#profile-username').setValue('Unsaved_Name')
    await wrapper.get('button[type="button"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(profile.username).toBe('Case_Finder')
  })
})

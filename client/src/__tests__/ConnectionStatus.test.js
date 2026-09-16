import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ConnectionStatus from '../components/portal/ConnectionStatus.vue'
import { api } from '../services/api.js'

vi.mock('../services/api.js', () => ({ api: { get: vi.fn() } }))

let wrapper
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
})

describe('scaffold connection check', () => {
  it('keeps the control disabled while waiting for the API', async () => {
    let resolveRequest
    api.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    wrapper = mount(ConnectionStatus)
    await flushPromises()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    resolveRequest({ data: { status: 'ok' } })
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('API and database connected.')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })

  it('offers retry after failure and shows the recovered result', async () => {
    api.get.mockRejectedValueOnce(new Error('Internal response must not reach the page'))
    api.get.mockResolvedValueOnce({ data: { status: 'ok' } })
    wrapper = mount(ConnectionStatus)
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Please try again')
    expect(wrapper.text()).not.toContain('Internal response')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[role="status"]').text()).toBe('API and database connected.')
  })
})

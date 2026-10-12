import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useCliSound } from '../composables/useCliSound.js'

function fakeContext() {
  const node = () => ({ connect: vi.fn((next) => next), frequency: {}, gain: {} })
  return {
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(),
    suspend: vi.fn().mockResolvedValue(),
    close: vi.fn().mockResolvedValue(),
    createOscillator: vi.fn(() => ({ ...node(), start: vi.fn(), stop: vi.fn() })),
    createGain: vi.fn(() => ({
      ...node(),
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    })),
  }
}

function harness() {
  let sound
  const wrapper = mount({
    setup() {
      sound = useCliSound()
      return () => null
    },
  })
  return { sound, wrapper }
}

afterEach(() => {
  delete globalThis.AudioContext
})

describe('cli sound effects', () => {
  it('stays silent until switched on and closes on unmount', async () => {
    const context = fakeContext()
    globalThis.AudioContext = vi.fn(function AudioContext() {
      return context
    })
    const { sound, wrapper } = harness()
    sound.play('ok')
    expect(globalThis.AudioContext).not.toHaveBeenCalled()
    await sound.toggle()
    expect(sound.enabled.value).toBe(true)
    // switching on plays a two-note confirmation chirp
    expect(context.createOscillator).toHaveBeenCalledTimes(2)
    sound.play('ok')
    expect(context.createOscillator).toHaveBeenCalledTimes(4)
    await sound.toggle()
    expect(sound.enabled.value).toBe(false)
    expect(context.suspend).toHaveBeenCalled()
    wrapper.unmount()
    expect(context.close).toHaveBeenCalled()
  })

  it('reports when the browser has no audio support', async () => {
    const { sound } = harness()
    await sound.toggle()
    expect(sound.enabled.value).toBe(false)
    expect(sound.unavailable.value).toBe(true)
  })
})

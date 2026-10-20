import { afterEach, describe, expect, it } from 'vitest'
import { TOWN_MODE_KEY, readStoredMode, resolveMode, useTownMode } from '../useTownMode.js'

afterEach(() => localStorage.clear())

describe('town mode', () => {
  it('defaults to 3d and honours a stored choice', () => {
    expect(resolveMode({ stored: null, webgl2: true, failed: false })).toEqual({
      mode: '3d',
      forced: false,
    })
    expect(resolveMode({ stored: '2d', webgl2: true, failed: false })).toEqual({
      mode: '2d',
      forced: false,
    })
  })

  it('forces 2d without webgl2 or after the hub failed', () => {
    expect(resolveMode({ stored: '3d', webgl2: false, failed: false })).toEqual({
      mode: '2d',
      forced: true,
    })
    expect(resolveMode({ stored: '3d', webgl2: true, failed: true })).toEqual({
      mode: '2d',
      forced: true,
    })
  })

  it('ignores an unknown stored value', () => {
    localStorage.setItem(TOWN_MODE_KEY, 'vr')
    expect(readStoredMode()).toBeNull()
  })

  it('persists the explicit toggle but not a forced fallback', () => {
    const town = useTownMode({ webgl2: true })
    expect(town.mode.value).toBe('3d')
    town.toggle()
    expect(localStorage.getItem(TOWN_MODE_KEY)).toBe('2d')
    town.toggle()
    expect(localStorage.getItem(TOWN_MODE_KEY)).toBe('3d')
    town.markFailed()
    expect(town.mode.value).toBe('2d')
    expect(town.forced.value).toBe(true)
    town.toggle()
    expect(localStorage.getItem(TOWN_MODE_KEY)).toBe('3d')
  })
})

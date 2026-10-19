import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { installTownWipe, WIPE_PHASE_MS, wipe } from '../pixel-wipe.js'

const page = { render: () => null }

// a router shaped like the app's: town with the newspaper dialog as a child, plus other pages
function createTestRouter({ signedOut = false, laterGuard } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        name: 'town',
        component: page,
        children: [{ path: '/games/threat-briefing', name: 'news', component: page }],
      },
      { path: '/login', name: 'login', component: page },
      { path: '/about', name: 'about', component: page },
    ],
  })
  // the account guard runs first and may redirect a signed-out visitor away from town
  router.beforeEach((to) => (signedOut && to.name === 'town' ? { path: '/login' } : true))
  installTownWipe(router)
  if (laterGuard) router.beforeResolve(laterGuard)
  return router
}

// every phase the overlay goes through while `action` runs
async function phasesDuring(action) {
  const seen = [wipe.phase]
  const watch = setInterval(() => {
    if (seen.at(-1) !== wipe.phase) seen.push(wipe.phase)
  }, 5)
  await action()
  await vi.waitFor(() => expect(wipe.phase).toBe('idle'), { timeout: WIPE_PHASE_MS * 3 })
  clearInterval(watch)
  if (seen.at(-1) !== wipe.phase) seen.push(wipe.phase)
  return seen
}

afterEach(() => {
  vi.unstubAllGlobals()
  wipe.phase = 'idle'
})

describe('installTownWipe', () => {
  it('stays out of the way on the first page load', async () => {
    const router = createTestRouter()
    expect(await phasesDuring(() => router.push('/'))).toEqual(['idle'])
  })

  it('covers, navigates underneath, then reveals whenever town is reached from another page', async () => {
    const router = createTestRouter()
    await router.push('/login')

    const started = Date.now()
    let navigatedAt = 0
    router.afterEach(() => {
      navigatedAt ||= Date.now() - started
    })
    const phases = await phasesDuring(() => router.push('/'))

    expect(phases).toEqual(['idle', 'cover', 'reveal', 'idle'])
    expect(router.currentRoute.value.name).toBe('town')
    // the route only changes once the screen is covered
    expect(navigatedAt).toBeGreaterThanOrEqual(WIPE_PHASE_MS - 5)
  })

  it('plays again each time Town map is clicked from elsewhere', async () => {
    const router = createTestRouter()
    await router.push('/about')
    expect(await phasesDuring(() => router.push('/'))).toContain('cover')
    await router.push('/about')
    expect(await phasesDuring(() => router.push('/'))).toContain('cover')
  })

  it('does not play for moves inside town, including the newspaper dialog', async () => {
    const router = createTestRouter()
    await router.push('/about')
    await phasesDuring(() => router.push('/'))

    expect(await phasesDuring(() => router.push('/games/threat-briefing'))).toEqual(['idle'])
    expect(await phasesDuring(() => router.push('/'))).toEqual(['idle'])
  })

  it('does not play when leaving town or going between other pages', async () => {
    const router = createTestRouter()
    await router.push('/about')
    expect(await phasesDuring(() => router.push('/login'))).toEqual(['idle'])
  })

  it('does not play when a signed-out visitor is redirected to sign-in', async () => {
    const router = createTestRouter({ signedOut: true })
    await router.push('/about')
    expect(await phasesDuring(() => router.push('/'))).toEqual(['idle'])
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('is skipped for reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const router = createTestRouter()
    await router.push('/login')
    expect(await phasesDuring(() => router.push('/'))).toEqual(['idle'])
    expect(router.currentRoute.value.name).toBe('town')
  })

  it('never leaves the overlay up when a later guard throws', async () => {
    const router = createTestRouter({
      laterGuard: (to) => {
        if (to.name === 'town') throw new Error('guard failed')
        return true
      },
    })
    await router.push('/login')
    const phases = await phasesDuring(() => router.push('/').catch(() => {}))
    expect(phases).toContain('cover')
    expect(wipe.phase).toBe('idle')
  })
})

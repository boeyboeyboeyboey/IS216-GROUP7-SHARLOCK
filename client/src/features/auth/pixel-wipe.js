import { reactive } from 'vue'

// The 8-bit screen wipe played when someone arrives in town after signing in or signing up.
// `PixelWipe.vue` (mounted once in App.vue) draws it; this module only sequences it:
// blocks cover the screen, the route changes underneath, then the blocks clear to show the page.
export const WIPE_COLUMNS = 16
export const WIPE_ROWS = 10
export const WIPE_STEP_MS = 22
// the last block (bottom-right) starts (COLUMNS + ROWS - 2) steps in, plus a short settle
export const WIPE_PHASE_MS = (WIPE_COLUMNS + WIPE_ROWS - 2) * WIPE_STEP_MS + 60

// idle | cover | reveal
export const wipe = reactive({ phase: 'idle' })

let busy = false

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// two frames, so the new page has been painted under the blocks before they clear. A background
// tab pauses animation frames, so the wait is capped rather than holding the overlay on screen.
function afterPaint() {
  if (typeof requestAnimationFrame !== 'function') return wait(32)
  const twoFrames = new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  )
  return Promise.race([twoFrames, wait(120)])
}

// Runs `navigate` while the screen is covered. Always resolves with navigate's result and always
// returns the overlay to idle, even when navigation fails, so it can never get stuck on screen.
export async function playPixelWipe(navigate) {
  if (busy || prefersReducedMotion()) return navigate()
  busy = true
  try {
    wipe.phase = 'cover'
    await wait(WIPE_PHASE_MS)
    const result = await navigate()
    await afterPaint()
    wipe.phase = 'reveal'
    await wait(WIPE_PHASE_MS)
    return result
  } finally {
    wipe.phase = 'idle'
    busy = false
  }
}

function isTown(location) {
  const path = typeof location === 'string' ? location.split('?')[0] : location?.path
  return path === '/'
}

// Replaces the route, with the wipe when the destination is the town page.
export function enterTown(router, location) {
  const go = () => router.replace(location)
  return isTown(location) ? playPixelWipe(go) : go()
}

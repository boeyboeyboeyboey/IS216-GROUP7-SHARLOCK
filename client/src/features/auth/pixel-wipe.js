import { reactive } from 'vue'

// The 8-bit screen wipe played whenever someone arrives on the town page from another page: after
// signing in or up, clicking Town map, the logo, Back, or returning from a game.
// `PixelWipe.vue` (mounted once in App.vue) draws it; this module only sequences it.
// Blocks cover the screen, the route changes underneath, then the blocks clear to show the page.
export const WIPE_COLUMNS = 16
export const WIPE_ROWS = 10
export const WIPE_STEP_MS = 22
// the last block (bottom-right) starts (COLUMNS + ROWS - 2) steps in, plus a short settle
export const WIPE_PHASE_MS = (WIPE_COLUMNS + WIPE_ROWS - 2) * WIPE_STEP_MS + 60
// if a navigation never reports back, the overlay still clears
const WATCHDOG_MS = 8000

// idle | cover | reveal
export const wipe = reactive({ phase: 'idle' })

// the town page and the newspaper dialog that opens on top of it are both "in town"
const TOWN_ROUTES = new Set(['town', 'news'])
const inTown = (route) => TOWN_ROUTES.has(route.name)

let busy = false
let watchdog = null

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

function toIdle() {
  clearTimeout(watchdog)
  watchdog = null
  wipe.phase = 'idle'
  busy = false
}

// Runs once the navigation has finished (or failed): clear the blocks to show the page.
async function reveal() {
  if (wipe.phase !== 'cover') return
  await afterPaint()
  if (wipe.phase !== 'cover') return
  wipe.phase = 'reveal'
  await wait(WIPE_PHASE_MS)
  toIdle()
}

// Plays the wipe on every arrival at the town page from somewhere else. Registered just before
// navigation is confirmed, so account redirects (for example signed-out visitors sent to sign-in)
// have already been decided and the wipe only plays when town really is the destination.
export function installTownWipe(router) {
  router.beforeResolve(async (to, from) => {
    const firstLoad = from.matched.length === 0
    if (busy || prefersReducedMotion() || firstLoad || !inTown(to) || inTown(from)) return true
    busy = true
    wipe.phase = 'cover'
    watchdog = setTimeout(toIdle, WATCHDOG_MS)
    await wait(WIPE_PHASE_MS)
    return true
  })
  // afterEach also runs for cancelled and failed navigations; onError covers a thrown guard
  router.afterEach(reveal)
  router.onError(reveal)
}

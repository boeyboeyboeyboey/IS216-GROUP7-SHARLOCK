import { test, expect } from './fixtures/auth.js'
import { gameCatalog } from '../../client/src/data/gameCatalog.js'

const startShot =
  '/private/tmp/claude-501/-Users-boey-Documents-SMU-2-1-wad2-group-proj-IS216-GROUP7-SHARLOCK/096f058d-3b1d-428a-b555-066dffafadfc/scratchpad/hub-a-start.png'

// the software renderer builds the wharf slowly
test.setTimeout(240000)
const slow = { timeout: 120000 }

function newsFixture() {
  const now = Date.now()
  return {
    provider: 'The Guardian',
    section: 'cybersecurity',
    range: 'week',
    dateKey: new Date(now).toISOString().slice(0, 10),
    timezone: 'Asia/Singapore',
    editionLimit: 50,
    window: {
      from: new Date(now - 7 * 86400000).toISOString(),
      to: new Date(now + 86400000).toISOString(),
    },
    articles: Array.from({ length: 3 }, (_, index) => ({
      id: `cybersecurity/${index}`,
      title: `Synthetic headline ${index + 1}`,
      url: `https://www.theguardian.com/test/${index}`,
      publishedAt: new Date(now - index * 60000).toISOString(),
      byline: [{ type: 'text', text: 'Fixture reporter' }],
      excerpt: [{ type: 'text', text: 'This is synthetic test content.' }],
      copyright: '',
    })),
    fetchedAt: new Date(now).toISOString(),
    freshUntil: new Date(now + 1800000).toISOString(),
    expiresAt: new Date(now + 23 * 3600000).toISOString(),
    refreshAvailableAt: new Date(now + 1800000).toISOString(),
    stale: false,
    partial: false,
  }
}

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
  await page.route('https://static.guim.co.uk/**', (route) => route.abort())
  await page.route('**/api/news**', (route) => route.fulfill({ json: newsFixture() }))
})

// a failed start shows its status text, so a broken hub fails fast instead of timing out
async function hubReady(page) {
  await page.waitForFunction(
    () => window.__hub?.state.ready === true || /unavailable/.test(document.body.innerText),
    null,
    slow,
  )
  expect(await page.evaluate(() => window.__hub?.state.ready)).toBe(true)
}
const position = (page) => page.evaluate(() => window.__hub.debug.position())

test('lists every game, walks, and enters a game route', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await hubReady(page)

  await expect(page.locator('[data-testid^="dest-"]')).toHaveCount(gameCatalog.length)
  for (const game of gameCatalog) {
    await expect(page.getByTestId(`dest-${game.id}`)).toHaveText(game.name)
  }
  await page.screenshot({ path: startShot })

  // keyboard walking works while nothing is paused
  const before = await position(page)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(800)
  await page.keyboard.up('KeyW')
  const after = await position(page)
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.2)

  await page.getByTestId('dest-cli-cyber-defender').click()
  await expect(page.getByTestId('dest-cli-cyber-defender')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('enter')).toHaveText('Enter CLI Cyber Defender')
  await page.getByTestId('enter').click()
  await expect(page).toHaveURL(/\/games\/cli-cyber-defender$/, slow)
})

test('deselects a destination by clicking it again or pressing Escape', async ({ page }) => {
  await page.goto('/')
  await hubReady(page)
  const dest = page.getByTestId('dest-social-engineering-simulator')
  const enter = page.getByTestId('enter')

  await dest.click()
  await expect(dest).toHaveAttribute('aria-pressed', 'true')
  await expect(enter).toBeVisible()
  // let the auto-walk get going, then cancel it
  await page.waitForTimeout(500)
  await dest.click()
  await expect(dest).toHaveAttribute('aria-pressed', 'false')
  await expect(enter).toHaveCount(0)
  expect(await page.evaluate(() => window.__hub.state.selected)).toBeNull()
  const stopped = await position(page)
  await page.waitForTimeout(700)
  const later = await position(page)
  expect(Math.hypot(later.x - stopped.x, later.z - stopped.z)).toBeLessThan(0.3)

  await dest.click()
  await expect(dest).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(dest).toHaveAttribute('aria-pressed', 'false')
  await expect(enter).toHaveCount(0)
})

test('returns to the door of the building that was entered', async ({ page }) => {
  await page.goto('/')
  await hubReady(page)
  await page.getByTestId('dest-cli-cyber-defender').click()
  await page.getByTestId('enter').click()
  await expect(page).toHaveURL(/\/games\/cli-cyber-defender$/, slow)

  await page.goBack()
  await expect(page).toHaveURL('/')
  await hubReady(page)
  const door = (await page.evaluate(() => window.__hub.debug.doors())).find(
    (d) => d.id === 'cli-cyber-defender',
  )
  const at = await position(page)
  expect(Math.hypot(at.x - door.x, at.z - door.z)).toBeLessThan(3)
  expect(await page.evaluate(() => sessionStorage.getItem('sharlock.hubReturn'))).toBeNull()

  // a fresh visit starts at the usual spot
  await page.reload()
  await hubReady(page)
  const fresh = await position(page)
  expect(Math.hypot(fresh.x - door.x, fresh.z - door.z)).toBeGreaterThan(8)
})

test('fills the window below the navbar without sideways scroll', async ({ page }) => {
  await page.goto('/')
  await hubReady(page)
  const metrics = await page.evaluate(() => ({
    viewport: window.innerHeight,
    navbar: document.querySelector('.portal-header').getBoundingClientRect().bottom,
    hub: document.querySelector('.hub-scene').getBoundingClientRect().height,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(metrics.hub).toBeGreaterThanOrEqual(metrics.viewport - metrics.navbar - 2)
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)
  await expect(page.getByRole('heading', { level: 1, name: 'Thames Wharf' })).toHaveCount(1)
  await expect(page.getByText('Welcome to Sharlock Town')).toHaveCount(0)
})

test('remounts the hub after leaving it and keeps the news dialog usable', async ({ page }) => {
  await page.goto('/')
  await hubReady(page)
  await page.getByTestId('dest-cli-cyber-defender').click()
  await page.getByTestId('enter').click()
  await expect(page).toHaveURL(/\/games\/cli-cyber-defender$/, slow)
  await expect(page.locator('canvas.hub-canvas')).toHaveCount(0)

  await page.goBack()
  await expect(page).toHaveURL('/')
  await hubReady(page)
  const counts = await page.evaluate(() => ({
    mounts: window.__hub.state.mounts,
    disposals: window.__hub.state.disposals,
  }))
  expect(counts).toEqual({ mounts: 2, disposals: 1 })
  await expect(page.locator('canvas.hub-canvas')).toHaveCount(1)

  await page.getByTestId('dest-threat-briefing').click()
  await page.getByTestId('enter').click()
  await expect(page.getByRole('dialog', { name: 'The Sharlock Times' })).toBeVisible(slow)
  expect(await page.evaluate(() => window.__hub.state.inputPaused)).toBe(true)
  await page.waitForFunction(() => window.__hub.state.mode === 'explore', null, slow)

  const before = await position(page)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(800)
  await page.keyboard.up('KeyW')
  const after = await position(page)
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.05)

  await page.getByRole('button', { name: 'Close newspaper' }).click()
  await expect(page).toHaveURL('/')
  expect(await page.evaluate(() => window.__hub.state.inputPaused)).toBe(false)
})

test('switches between the 3D wharf and the 2D town and remembers the choice', async ({ page }) => {
  const toggle = page.getByTestId('town-mode-toggle')
  const town = page.getByRole('region', { name: 'Interactive town map' })
  await page.goto('/')
  await hubReady(page)
  await expect(toggle).toHaveText('2D map')
  await expect(toggle).toHaveAccessibleName('Switch to 2D map')
  await expect(toggle).not.toHaveAttribute('aria-pressed')
  await expect(town).toHaveCount(0)

  await toggle.click()
  await expect(town).toBeVisible()
  await expect(page.locator('canvas.hub-canvas')).toHaveCount(0)
  expect(await page.evaluate(() => window.__hub)).toBeUndefined()
  await expect(toggle).toHaveText('3D wharf')
  await expect(toggle).toHaveAccessibleName('Switch to 3D wharf')
  await expect(toggle).not.toHaveAttribute('aria-pressed')

  await page.reload()
  await expect(town).toBeVisible()
  await expect(toggle).toHaveText('3D wharf')
  expect(await page.evaluate(() => localStorage.getItem('sharlock.townMode'))).toBe('2d')

  await toggle.click()
  await hubReady(page)
  await expect(town).toHaveCount(0)
  await page.reload()
  await hubReady(page)
  await expect(toggle).toHaveText('2D map')
})

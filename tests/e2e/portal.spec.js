import { test, expect } from '@playwright/test'
import { gameCatalog } from '../../client/src/data/gameCatalog.js'

test.beforeEach(async ({ page }) => {
  // Exercise offline font fallbacks without relying on Google's network availability.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
})

test('explores every building without prerequisites or changing sample points', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Explore the town', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('button', { name: /^Explore / })).toHaveCount(gameCatalog.length)
  for (const game of gameCatalog) {
    const building = page.getByRole('button', { name: `Explore ${game.name}`, exact: true })
    await expect(building).toBeEnabled()
    await page.getByLabel('Jump to').selectOption(game.id)
    const card = page.getByRole('region', { name: game.name, exact: true })
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: game.name, exact: true })).toBeFocused()
    await expect(card.getByText(game.description)).toBeVisible()
    await expect(
      card.getByRole('img', { name: `Difficulty: ${game.difficulty} out of 3 stars` }),
    ).toBeVisible()
    for (const topic of game.backgroundKnowledge)
      await expect(card.getByText(topic, { exact: true })).toBeVisible()
    await card.getByRole('link', { name: 'View activity preview' }).click()
    await expect(page).toHaveURL(new RegExp(`${game.route}$`))
    await expect(page.getByRole('heading', { name: 'A new case is taking shape.' })).toBeVisible()
    await page.getByRole('link', { name: 'Keep exploring', exact: true }).click()
    await expect(page.locator('.town-player')).toContainText('120 points')
  }
  await page.goto('/games/access-control')
  await expect(page.getByRole('heading', { name: 'A new case is taking shape.' })).toBeVisible()
})

test('opens details by pointer, touch, and keyboard and restores focus on Escape', async ({
  page,
}, testInfo) => {
  await page.goto('/dashboard')
  const building = page.getByRole('button', { name: 'Explore Integrity detective', exact: true })
  const card = page.getByRole('region', { name: 'Integrity detective', exact: true })
  if (testInfo.project.name === 'desktop-chromium') {
    await building.hover()
    await expect(card).toBeVisible()
    await card.hover()
    await expect(card).toBeVisible()
    await page.getByRole('heading', { level: 1 }).hover()
    await expect(card).toBeHidden()
    await building.focus()
    await expect(card).toBeVisible()
    await expect(building).toBeFocused()
    await page.keyboard.press('Enter')
  } else await building.tap()
  await expect(
    card.getByRole('heading', { name: 'Integrity detective', exact: true }),
  ).toBeFocused()
  const inside = await card.evaluate((el) => {
    const cardBounds = el.getBoundingClientRect()
    const frame = el.parentElement.getBoundingClientRect()
    return (
      cardBounds.left >= frame.left &&
      cardBounds.right <= frame.right &&
      cardBounds.top >= frame.top &&
      cardBounds.bottom <= frame.bottom
    )
  })
  expect(inside).toBe(true)
  await page.keyboard.press('Escape')
  await expect(card).toBeHidden()
  await expect(building).toBeFocused()
  await page.keyboard.press('Enter')
  await card.getByRole('button', { name: 'Close activity details' }).click()
  await expect(card).toBeHidden()
  await expect(building).toBeFocused()
})

test('keeps map scrolling bounded and supports keyboard panning', async ({ page }) => {
  await page.goto('/dashboard')
  const map = page.getByRole('region', { name: 'Scrollable town map' })
  await map.focus()
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => map.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await page.getByLabel('Jump to').selectOption('red-blue')
  await expect(
    page.getByRole('region', { name: 'Think like a defender', exact: true }),
  ).toBeVisible()
  await expect.poll(() => map.evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
})

test('plays the repository soundtrack only after a click and stops on departure', async ({
  page,
}) => {
  await page.goto('/dashboard')
  const audio = page.locator('audio')
  expect(
    await audio.evaluate((el) => ({
      muted: el.muted,
      paused: el.paused,
      loop: el.loop,
      autoplay: el.autoplay,
    })),
  ).toEqual({ muted: true, paused: true, loop: true, autoplay: false })
  await page.getByRole('button', { name: 'Turn on town sound' }).click()
  await expect(page.getByRole('button', { name: 'Mute town sound' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect.poll(() => audio.evaluate((el) => el.currentTime)).toBeGreaterThan(0)
  expect(await audio.evaluate((el) => el.muted || el.paused)).toBe(false)
  await page.getByRole('button', { name: 'Mute town sound' }).click()
  expect(await audio.evaluate((el) => el.muted && el.paused)).toBe(true)
  await page.getByRole('button', { name: 'Turn on town sound' }).click()
  await expect(page.getByRole('button', { name: 'Mute town sound' })).toBeVisible()
  const handle = await audio.elementHandle()
  await page.getByRole('link', { name: 'View sample detective profile' }).click()
  expect(await handle.evaluate((el) => el.paused && el.muted)).toBe(true)
  await page.goto('/dashboard')
  expect(await audio.evaluate((el) => el.muted && el.paused)).toBe(true)
})

test('navigates to the profile and handles mobile focus and dismissal', async ({
  page,
}, testInfo) => {
  await page.goto('/dashboard')
  if (testInfo.project.name === 'mobile-chromium') {
    const opener = page.getByRole('button', { name: 'Open navigation and profile' })
    await opener.click()
    const drawer = page.getByRole('dialog', { name: 'Your detective desk' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('120 points')).toBeVisible()
    await expect.poll(() => drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(opener).toBeFocused()
    await opener.click()
    await drawer.getByRole('link', { name: 'Detective profile', exact: true }).click()
    await expect(drawer).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  } else await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Your trophy case' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'First clue', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your trophy case' })).toBeVisible()
})

test('retains modern landing/login branding and recovers from a missing page', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.portal-shell')).not.toHaveClass(/is-town/)
  const trigger = page.getByRole('button', { name: 'Tip from Sharlock' })
  await trigger.click()
  await expect(page.getByRole('tooltip').getByRole('img')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toBeHidden()
  await page.goto('/login')
  await expect(page.locator('.auth-mascot')).toBeVisible()
  await expect(page.locator('.portal-shell')).not.toHaveClass(/is-town/)
  await page.goto('/a-missing-clue')
  await expect(page.getByRole('heading', { name: 'A little off the trail?' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to town' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('link', { name: 'Sharlock Hub home' }).click()
  await expect(page).toHaveURL('/')
})

test('fits supported breakpoints with readable pixel buildings and responsive branding', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard')
  for (const [width, height] of [
    [375, 667],
    [576, 800],
    [767, 900],
    [768, 1024],
    [992, 768],
    [1200, 900],
    [1440, 900],
    [667, 375],
  ]) {
    await page.setViewportSize({ width, height })
    const layout = await page.locator('.town-viewport').evaluate((el) => ({
      fits: document.documentElement.scrollWidth <= innerWidth,
      scrolling: el.scrollWidth > el.clientWidth,
      worldWidth: el.querySelector('.town-world').getBoundingClientRect().width,
      animation: getComputedStyle(el.querySelector('.building-sprite')).animationName,
    }))
    expect(layout.fits, `overflow at ${width}px`).toBe(true)
    expect(layout.worldWidth).toBe(1120)
    expect(layout.animation).toBe('none')
    if (width < 1200) expect(layout.scrolling).toBe(true)
    await expect(page.locator('.navbar-mascot')).toBeVisible()
    if (width < 768) await expect(page.locator('.brand-title')).toBeHidden()
    else await expect(page.locator('.brand-title')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Turn on town sound' })).toBeVisible()
  }
})

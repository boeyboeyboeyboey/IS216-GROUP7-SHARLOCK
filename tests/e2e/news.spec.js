import { test, expect } from '@playwright/test'

function fixture(section = 'cybersecurity', range = 'week', overrides = {}) {
  const now = Date.now()
  return {
    provider: 'The Guardian',
    section,
    range,
    dateKey: new Date(now).toISOString().slice(0, 10),
    timezone: 'Asia/Singapore',
    editionLimit: 50,
    window: {
      from: new Date(now - 7 * 86400000).toISOString(),
      to: new Date(now + 86400000).toISOString(),
    },
    articles: Array.from({ length: 23 }, (_, index) => ({
      id: `${section}/${index}`,
      title: `Synthetic ${section} headline ${index + 1}`,
      url: `https://www.theguardian.com/test/${index}`,
      publishedAt: new Date(now - index * 60000).toISOString(),
      byline: [{ type: 'text', text: 'Fixture reporter' }],
      excerpt: [
        {
          type: 'text',
          text:
            index === 15
              ? 'A unique passkey dispatch for local search.'
              : 'This is synthetic test content, never a real published story.',
        },
      ],
      copyright: '',
    })),
    fetchedAt: new Date(now).toISOString(),
    freshUntil: new Date(now + 1800000).toISOString(),
    expiresAt: new Date(now + 23 * 3600000).toISOString(),
    refreshAvailableAt: new Date(now + 1800000).toISOString(),
    stale: false,
    partial: false,
    ...overrides,
  }
}

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
  await page.route('https://static.guim.co.uk/**', (route) => route.abort())
})

async function feed(page, callback = () => {}) {
  await page.route('**/api/news**', (route) => {
    const url = new URL(route.request().url())
    callback(url)
    return route.fulfill({
      json: fixture(
        url.searchParams.get('section') || 'cybersecurity',
        url.searchParams.get('range') || 'week',
      ),
    })
  })
}

test('opens the newspaper directly and preserves town camera, focus, audio and history', async ({
  page,
}, testInfo) => {
  await feed(page)
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/')
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByLabel('Jump to').selectOption('threat-briefing')
  await page.getByRole('button', { name: 'Close activity details' }).click()
  const building = page.getByRole('button', { name: 'Explore The daily briefing', exact: true })
  const transform = await page.locator('.town-world').evaluate((node) => node.style.transform)
  await page.locator('.town-world').evaluate((node) => {
    window.newsTownElement = node
  })
  if (testInfo.project.name === 'mobile-chromium') await building.tap()
  else await building.click()
  const dialog = page.getByRole('dialog', { name: 'The Sharlock Gazette' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/games\/threat-briefing$/)
  await expect(dialog.getByRole('heading', { name: 'The Sharlock Gazette' })).toBeFocused()
  await expect(dialog.locator('.gazette-article')).toHaveCount(10)
  await page.keyboard.press('Shift+Tab')
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)),
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL('/')
  await expect(building).toBeFocused()
  expect(
    await page.locator('.town-world').evaluate((node) => node === window.newsTownElement),
  ).toBe(true)
  expect(await page.locator('.town-world').evaluate((node) => node.style.transform)).toBe(transform)
  expect(await page.locator('audio').evaluate((node) => node.paused && node.muted)).toBe(true)
  await page.goForward()
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Close newspaper' }).click()
  await expect(page).toHaveURL('/')
})

test('shares sections and filters while local search and pagination spend no requests', async ({
  page,
}) => {
  const requests = []
  await feed(page, (url) => requests.push(url.search))
  await page.goto('/games/threat-briefing')
  const dialog = page.getByRole('dialog', { name: 'The Sharlock Gazette' })
  await expect(dialog.locator('.gazette-article')).toHaveCount(10)
  await page.getByRole('button', { name: 'Newspaper page 2', exact: true }).click()
  await expect(
    dialog.getByRole('heading', { name: 'Synthetic cybersecurity headline 11', exact: false }),
  ).toBeVisible()
  if (!(await page.getByLabel('Search this edition').isVisible()))
    await page.locator('.gazette-browse summary').click()
  await page.getByLabel('Search this edition').fill('passkey')
  await expect(dialog.locator('.gazette-article')).toHaveCount(1)
  await expect(page).toHaveURL(/q=passkey/)
  expect(requests).toHaveLength(1)
  await page.getByLabel('Search this edition').fill('')
  await page.getByRole('button', { name: 'Technology', exact: true }).click()
  await expect(dialog.locator('.gazette-article').first()).toContainText('Synthetic technology')
  await page.getByRole('combobox', { name: 'Edition', exact: true }).selectOption('month')
  await expect(page).toHaveURL(/section=technology&range=month/)
  await expect(dialog.locator('.gazette-article')).toHaveCount(10)
  expect(requests).toHaveLength(3)
  const articleLink = dialog.getByRole('link', { name: /Read at The Guardian/ }).first()
  await expect(articleLink).toHaveAttribute('target', '_blank')
  await expect(articleLink).toHaveAttribute('rel', 'noopener noreferrer')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Technology', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Close newspaper' }).click()
  await expect(page).toHaveURL('/')
})

test('shows failures, permits retry, and explains empty and stale editions', async ({ page }) => {
  let mode = 'failure'
  await page.route('**/api/news**', (route) => {
    if (mode === 'failure')
      return route.fulfill({
        status: 503,
        json: {
          error: { code: 'NEWS_UNAVAILABLE', message: 'The news desk is temporarily unavailable.' },
          refreshAvailableAt: new Date(Date.now() + 1000).toISOString(),
        },
      })
    return route.fulfill({
      json: fixture(
        'cybersecurity',
        'week',
        mode === 'empty'
          ? { articles: [] }
          : { freshUntil: new Date(Date.now() - 1000).toISOString(), stale: true, partial: true },
      ),
    })
  })
  await page.goto('/games/threat-briefing')
  await expect(
    page.getByRole('dialog', { name: 'The Sharlock Gazette' }).getByRole('status'),
  ).toContainText('temporarily unavailable')
  mode = 'empty'
  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeEnabled()
  await retry.click()
  await expect(page.getByRole('heading', { name: 'A quiet news desk' })).toBeVisible()
  mode = 'stale'
  await page.reload()
  await expect(
    page.getByRole('dialog', { name: 'The Sharlock Gazette' }).getByRole('status'),
  ).toContainText('cached edition')
  await expect(
    page.getByRole('dialog', { name: 'The Sharlock Gazette' }).getByRole('status'),
  ).toContainText('Some stories')
})

test('handles direct malformed links, keyboard close and leaving without style or scroll locks', async ({
  page,
}) => {
  await feed(page)
  await page.goto('/games/threat-briefing?section=bad&q[]=x&page=100&url=unsafe')
  await expect(page).toHaveURL(/\/games\/threat-briefing$/)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close newspaper' }).click()
  await expect(page).toHaveURL('/')
  await page.getByRole('link', { name: 'View sample detective profile' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await expect(page.locator('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('fits newspaper layouts and provides visible focus at supported widths', async ({ page }) => {
  await feed(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/games/threat-briefing')
  const dialog = page.getByRole('dialog', { name: 'The Sharlock Gazette' })
  await expect(dialog.locator('.gazette-article')).toHaveCount(10)
  for (const width of [375, 576, 767, 768, 992, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await expect(page.getByRole('button', { name: 'Close newspaper' })).toBeVisible()
  }
  await page.setViewportSize({ width: 667, height: 375 })
  await page.getByRole('button', { name: 'Next newspaper page' }).click()
  await expect(page.getByRole('button', { name: 'Close newspaper' })).toBeInViewport()
  await expect(dialog).toHaveCSS('animation-name', 'none')
})

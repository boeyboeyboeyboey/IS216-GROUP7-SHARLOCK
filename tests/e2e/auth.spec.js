import { test, expect } from '@playwright/test'

const PASSWORD = 'Correct-Horse-🔒-2026'

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
})

test('registers, restores, signs out, signs in, and stops a protected action after expiry', async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now().toString(36)}${testInfo.workerIndex}`
  const email = `auth-${suffix}@example.test`
  const username = `Case_${suffix}`
  let registrationPosts = 0
  let registrationKeys = null
  let protectedRunPosts = 0

  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/auth/register')) {
      registrationPosts += 1
      registrationKeys = Object.keys(request.postDataJSON() || {}).sort()
    }
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/games/cli-cyber-defender/runs')
    ) {
      protectedRunPosts += 1
    }
  })

  await page.goto('/about')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/games/threat-briefing')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in to Sharlock' })).toBeVisible()
  await page.goto('/games/phishing-post-mortem')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in to Sharlock' })).toBeVisible()

  await page.goto('/profile')
  await expect(
    page.getByRole('heading', { name: 'A curious mind looks good on you.' }),
  ).toBeVisible()
  const signedOutProfile = page.getByRole('region', { name: 'Sign in' })
  await expect(signedOutProfile.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  await page.goto('/progress')
  const signedOutProgress = page.getByRole('region', { name: 'Sign in' })
  await expect(signedOutProgress.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)

  await page.goto('/register')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill('Different-Horse-🔒-2026')
  await page.locator('input[name="avatarId"][value="detective"]').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Passwords must match.')).toBeVisible()
  expect(registrationPosts).toBe(0)

  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/')
  const townPlayer = page.locator('.town-player')
  await expect(townPlayer.getByText(username, { exact: true })).toBeVisible()
  await expect(townPlayer.getByRole('img', { name: 'Detective' })).toBeVisible()
  expect(registrationPosts).toBe(1)
  expect(registrationKeys).toEqual(['avatarId', 'email', 'password', 'username'])

  await page.reload()
  const restoredTownPlayer = page.locator('.town-player')
  await expect(restoredTownPlayer.getByText(username, { exact: true })).toBeVisible()
  await expect(restoredTownPlayer.getByRole('img', { name: 'Detective' })).toBeVisible()

  await page.goto('/games/threat-briefing')
  await expect(page.getByRole('dialog', { name: 'The Sharlock Times' })).toBeVisible()
  await page.goto('/games/phishing-post-mortem')
  await expect(page.getByRole('heading', { name: 'The Phishing Post-Mortem' })).toBeVisible()

  await page.goto('/profile')
  const header = page.getByRole('banner')
  const desktopSignOut = header.getByRole('button', { name: 'Sign out' })
  if (await desktopSignOut.isVisible()) {
    await desktopSignOut.click()
  } else {
    await page.getByRole('button', { name: 'Open navigation and profile' }).click()
    const detectiveDesk = page.getByRole('dialog', { name: 'Your detective desk' })
    await detectiveDesk.getByRole('button', { name: 'Sign out' }).click()
  }
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in to Sharlock' })).toBeVisible()

  await page.goto('/about')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/games/cli-cyber-defender')
  await expect(page).toHaveURL(/\/login/)

  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Wrong-Horse-🔒-2026')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.')
  await expect(page.getByLabel('Email address')).toHaveValue(email)

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('.town-player').getByText(username, { exact: true })).toBeVisible()

  await page.goto('/games/cli-cyber-defender')
  await expect(page.getByRole('heading', { name: 'CLI Cyber Defender' })).toBeVisible()
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' },
      }),
    }),
  )
  await page.getByRole('button', { name: /Practice \(no timer\)/ }).click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in to Sharlock' })).toBeVisible()
  expect(protectedRunPosts).toBe(0)
})

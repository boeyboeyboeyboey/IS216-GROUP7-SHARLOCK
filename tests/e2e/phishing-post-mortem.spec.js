import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MODULE = '../../server/src/modules/games/phishing-post-mortem'
const load = (relativePath) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8'))
const CASES = ['case-01', 'case-02'].map((id) => ({
  id,
  content: load(`${MODULE}/cases/${id}.public.json`),
  answers: load(`${MODULE}/cases/answers/${id}.answers.json`),
}))

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
})

async function openCase(page) {
  await page.goto('/games/phishing-post-mortem')
  await expect(page.getByRole('heading', { name: 'The Phishing Post-Mortem' })).toBeVisible()
  const title = await page.locator('.sharmail-briefing h2').textContent()
  const active = CASES.find((entry) => entry.content.title === title.trim())
  expect(active, 'served case should be one of the authored cases').toBeTruthy()
  return active
}

async function openMessage(page, email, isMobile) {
  if (isMobile) await page.getByRole('button', { name: 'Back to inbox' }).click()
  await page.locator(`.sharmail-row[data-email-id="${email.id}"]`).click()
  await expect(page.getByRole('heading', { name: email.subject, exact: true })).toBeVisible()
}

test('solves a case end to end and scores the full hundred', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chromium'
  const active = await openCase(page)
  const patientZero = active.content.emails.find(
    (email) => email.id === active.answers.patientZeroId,
  )

  await openMessage(page, patientZero, isMobile)
  await expect(page.getByText(patientZero.senderAddress, { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Accuse this message' }).click()
  await expect(page.getByRole('button', { name: 'Accused as Patient Zero' })).toBeVisible()

  for (const evidenceId of active.answers.evidenceIds) {
    const option = active.content.evidenceOptions.find((entry) => entry.id === evidenceId)
    await page.getByRole('checkbox', { name: option.label }).check()
  }
  await page.getByRole('button', { name: 'Submit final verdict' }).click()

  await expect(page.getByRole('heading', { name: '100 / 100 points' })).toBeVisible()
  await expect(page.getByText('Verdict upheld')).toBeVisible()
  await expect(page.getByText('Not saved.', { exact: false })).toBeVisible()
  await expect(page.getByText(active.answers.chain[0], { exact: false })).toBeVisible()
})

test('a wrong verdict scores nothing and still reveals the chain', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chromium'
  const active = await openCase(page)
  const decoy = active.content.emails.find((email) => email.id !== active.answers.patientZeroId)

  await openMessage(page, decoy, isMobile)
  await page.getByRole('button', { name: 'Accuse this message' }).click()
  const [first, second] = active.content.evidenceOptions
  await page.getByRole('checkbox', { name: first.label }).check()
  await page.getByRole('checkbox', { name: second.label }).check()
  await page.getByRole('button', { name: 'Submit final verdict' }).click()

  await expect(page.getByRole('heading', { name: '0 / 100 points' })).toBeVisible()
  await expect(page.getByText('Verdict overturned')).toBeVisible()
  await expect(page.getByText(active.answers.summary, { exact: false })).toBeVisible()
})

test('never sends the answer key to the browser before a verdict', async ({ page }) => {
  const payloads = []
  page.on('response', async (response) => {
    if (response.url().includes('/api/games/phishing-post-mortem/case'))
      payloads.push(await response.text())
  })
  const active = await openCase(page)
  expect(payloads).not.toHaveLength(0)
  for (const payload of payloads) {
    expect(payload).not.toContain('patientZeroId')
    expect(payload).not.toContain(active.answers.summary)
    expect(payload).not.toContain('evidenceNotes')
  }
  const rendered = await page.content()
  expect(rendered).not.toContain(active.answers.summary)
})

test('link destinations are inert and only shown on request', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chromium'
  const active = await openCase(page)
  const withLink = active.content.emails.find((email) => email.links.length > 0)
  const link = withLink.links[0]

  await openMessage(page, withLink, isMobile)
  await expect(page.getByText(link.destination, { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: 'Inspect destination' }).first().click()
  await expect(page.getByText(link.destination, { exact: false })).toBeVisible()
  await expect(page).toHaveURL(/\/games\/phishing-post-mortem$/)
  await expect(page.locator('.sharmail-links a')).toHaveCount(0)
})

test('replay hands over the other case', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chromium'
  const active = await openCase(page)
  const patientZero = active.content.emails.find(
    (email) => email.id === active.answers.patientZeroId,
  )

  await openMessage(page, patientZero, isMobile)
  await page.getByRole('button', { name: 'Accuse this message' }).click()
  for (const evidenceId of active.answers.evidenceIds) {
    const option = active.content.evidenceOptions.find((entry) => entry.id === evidenceId)
    await page.getByRole('checkbox', { name: option.label }).check()
  }
  await page.getByRole('button', { name: 'Submit final verdict' }).click()
  await expect(page.getByRole('heading', { name: '100 / 100 points' })).toBeVisible()

  await page.getByRole('button', { name: 'Investigate the other case' }).click()
  const other = CASES.find((entry) => entry.id !== active.id)
  await expect(page.locator('.sharmail-briefing h2')).toHaveText(other.content.title)
})

test('the narrow layout swaps panes and returns focus to the message row', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'pane swapping is a narrow-screen behaviour',
  )
  const active = await openCase(page)
  const target = active.content.emails[3]

  await page.getByRole('button', { name: 'Back to inbox' }).click()
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  const row = page.locator(`.sharmail-row[data-email-id="${target.id}"]`)
  await row.click()
  await expect(page.getByRole('heading', { name: target.subject, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to inbox' }).click()
  await expect(row).toBeFocused()
})

test('the inbox walks with the arrow keys', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'keyboard walking is checked on desktop')
  await openCase(page)
  const rows = page.locator('.sharmail-row')
  await rows.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(rows.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(rows.first()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.sharmail-reading')).toBeVisible()
})

test('recovers from a rejected verdict without losing the case', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chromium'
  const active = await openCase(page)
  const patientZero = active.content.emails.find(
    (email) => email.id === active.answers.patientZeroId,
  )
  let rejectFirstSubmission = true

  await page.route('**/api/games/phishing-post-mortem/verdict', async (route) => {
    if (rejectFirstSubmission) {
      rejectFirstSubmission = false
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'The verdict service is unavailable. Try again or reload this case.' },
        }),
      })
      return
    }
    await route.continue()
  })

  await openMessage(page, patientZero, isMobile)
  await page.getByRole('button', { name: 'Accuse this message' }).click()
  for (const evidenceId of active.answers.evidenceIds) {
    const option = active.content.evidenceOptions.find((entry) => entry.id === evidenceId)
    await page.getByRole('checkbox', { name: option.label }).check()
  }
  await page.getByRole('button', { name: 'Submit final verdict' }).click()

  await expect(page.getByRole('alert')).toContainText('Try again or reload this case.')
  await expect(page.locator('.sharmail-row[aria-current="true"]')).toHaveAttribute(
    'data-email-id',
    patientZero.id,
  )
  await expect(page.getByRole('button', { name: 'Reload case' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry verdict' }).click()
  await expect(page.getByRole('heading', { name: '100 / 100 points' })).toBeVisible()
})

test('fits every supported width without a horizontal page scrollbar', async ({ page }) => {
  await openCase(page)
  for (const width of [375, 576, 768, 992, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflow, `no horizontal overflow at ${width}px`).toBe(false)
  }
})

test('enters from the town and returns to it', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Jump to').selectOption('phishing-post-mortem')
  const card = page.getByRole('region', { name: 'The Phishing Post-Mortem', exact: true })
  await expect(card.getByText('Playable game in development')).toHaveCount(0)
  await card.getByRole('link', { name: 'Enter activity' }).click()
  await expect(page).toHaveURL(/\/games\/phishing-post-mortem$/)
  await expect(page.getByRole('heading', { name: 'The Phishing Post-Mortem' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to town' }).click()
  await expect(page).toHaveURL('/')
})

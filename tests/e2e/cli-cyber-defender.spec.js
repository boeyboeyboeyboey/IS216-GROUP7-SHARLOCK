import { test, expect } from '@playwright/test'
import { formatCommand } from '../../server/src/modules/games/cli-cyber-defender/parser.js'
import { SCENARIOS } from '../../server/src/modules/games/cli-cyber-defender/scenarios.js'

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  )
})

const commandInput = (page) => page.getByRole('textbox', { name: 'Command', exact: true })
const banner = (page) => page.getByRole('region', { name: 'Current incident' })
const hud = (page) => page.getByLabel('Shift status')

async function expectedCommand(page) {
  const title = (await banner(page).getByRole('heading').textContent()).trim()
  const scenario = SCENARIOS.find((item) => item.alert.title === title)
  expect(scenario, `unknown alert ${title}`).toBeTruthy()
  return formatCommand(scenario.expected.verb, scenario.expected.target)
}

async function run(page, command) {
  await commandInput(page).fill(command)
  await commandInput(page).press('Enter')
}

async function startShift(page, mode) {
  await page.goto('/games/cli-cyber-defender')
  await page
    .getByRole('button', { name: mode === 'practice' ? 'Untimed practice' : 'Start timed shift' })
    .click()
  await expect(commandInput(page)).toBeFocused()
}

test('plays a perfect practice shift to 2,100 and replays', async ({ page }) => {
  await startShift(page, 'practice')
  await expect(hud(page)).toContainText('untimed')
  for (let handled = 1; handled <= 8; handled += 1) {
    await run(page, await expectedCommand(page))
    if (handled < 8) await expect(hud(page)).toContainText(`${handled} / 8`)
  }
  const debrief = page.getByRole('heading', { name: 'Shift debrief' })
  await expect(debrief).toBeFocused()
  await expect(page.getByText('2,100 / 2,100 points')).toBeVisible()
  await expect(page.locator('.cli-outcome-correct')).toHaveCount(8)
  await expect(page.getByText(/practice result, not saved/)).toBeVisible()
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('heading', { name: 'Shift briefing' })).toBeVisible()
})

test('keeps the incident open on a typo, closes it on a wrong target', async ({ page }) => {
  await startShift(page, 'practice')
  const terminal = page.getByRole('log', { name: 'Terminal output' })
  await run(page, 'blok ip 192.0.2.1')
  await expect(terminal).toContainText('Command not recognised')
  await expect(hud(page)).toContainText('0 / 8')
  await run(page, await expectedCommand(page))
  await expect(hud(page)).toContainText('1 / 8')
  await run(page, 'isolate host not-the-right-host')
  await expect(terminal).toContainText('[FAIL] isolate host not-the-right-host')
  await expect(hud(page)).toContainText('2 / 8')
  await expect(hud(page)).toContainText('next ×1')
  await run(page, 'help')
  await expect(terminal).toContainText('local, never sent')
  await page.getByRole('button', { name: 'End practice' }).click()
  await expect(page.getByText('100 / 2,100 points')).toBeVisible()
  await expect(page.locator('.cli-outcome-wrong')).toHaveCount(1)
  await expect(page.locator('.cli-outcome-skipped')).toHaveCount(6)
})

test('scores a timed incident against the server window', async ({ page }) => {
  await startShift(page, 'timed')
  await expect(banner(page).getByText(/You have \d+ seconds for this incident/)).toBeAttached()
  await expect(hud(page).getByText(/^\d+\.\ds$/)).toBeVisible()
  await expect(page.getByText(/Timed shift · not saved/)).toBeVisible()
  await run(page, await expectedCommand(page))
  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('+100 (streak 1)')
  await expect(hud(page)).toContainText('100')
})

async function setHidden(page, hidden) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { value, configurable: true })
    Object.defineProperty(document, 'visibilityState', {
      value: value ? 'hidden' : 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

test('auto-pauses a timed shift when the tab is hidden', async ({ page }) => {
  await startShift(page, 'timed')
  const command = await expectedCommand(page)
  await setHidden(page, true)
  await setHidden(page, false)
  const resume = page.getByRole('button', { name: 'Resume shift' })
  await expect(page.getByRole('heading', { name: 'Shift paused' })).toBeVisible()
  await expect(resume).toBeFocused()
  await expect(banner(page)).toHaveCount(0)
  await expect(commandInput(page)).toHaveCount(0)
  await expect(hud(page)).toContainText('0 / 8')
  await resume.click()
  await expect(commandInput(page)).toBeFocused()
  await expect(banner(page)).toContainText('Incident 1')
  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('Shift resumed.')
  await run(page, command)
  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('+100 (streak 1)')
})

test('never pauses untimed practice', async ({ page }) => {
  await startShift(page, 'practice')
  await setHidden(page, true)
  await setHidden(page, false)
  await expect(page.getByRole('heading', { name: 'Shift paused' })).toHaveCount(0)
  await expect(commandInput(page)).toBeVisible()
})

test('lets touch users insert command templates and recall history', async ({ page }, testInfo) => {
  await startShift(page, 'practice')
  const command = await expectedCommand(page)
  const [verb, noun, target] = command.split(' ')
  const template = page.getByRole('button', { name: new RegExp(`^Insert ${verb} ${noun}`) })
  if (testInfo.project.name === 'mobile-chromium') await template.tap()
  else await template.click()
  await expect(commandInput(page)).toHaveValue(`${verb} ${noun} `)
  await expect(commandInput(page)).toBeFocused()
  await commandInput(page).pressSequentially(target)
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(hud(page)).toContainText('1 / 8')
  await commandInput(page).press('ArrowUp')
  await expect(commandInput(page)).toHaveValue(command)
})

test('enters from the town card and leaves no styles behind', async ({ page }) => {
  await page.goto('/')
  const before = await page.evaluate(() => {
    const style = getComputedStyle(document.body)
    return { font: style.fontFamily, background: style.backgroundColor }
  })
  await page.getByLabel('Jump to').selectOption('cli-cyber-defender')
  const card = page.getByRole('region', { name: 'CLI Cyber Defender', exact: true })
  await card.getByRole('link', { name: 'Enter activity' }).click()
  await expect(page).toHaveURL('/games/cli-cyber-defender')
  await expect(page.getByRole('heading', { name: 'CLI Cyber Defender', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Back to town' }).click()
  await expect(page).toHaveURL('/')
  const after = await page.evaluate(() => {
    const style = getComputedStyle(document.body)
    return { font: style.fontFamily, background: style.backgroundColor }
  })
  expect(after).toEqual(before)
  await page.goto('/about')
  await expect(page.locator('.cli-game')).toHaveCount(0)
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
    'Pixelify',
  )
})

test('fits every supported width without page overflow', async ({ page }) => {
  await startShift(page, 'practice')
  for (const width of [375, 576, 768, 992, 1200, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(commandInput(page)).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0)
  }
  await page.setViewportSize({ width: 667, height: 375 })
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
})

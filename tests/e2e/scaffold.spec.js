import { test, expect } from '@playwright/test'

test('loads Vue and checks Express/MongoDB through the Vite proxy', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'SHARLOCK', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('API and database connected.')
  await page.getByRole('button', { name: 'Check connection' }).click()
  await expect(page.getByRole('status')).toHaveText('API and database connected.')
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )
  expect(fitsViewport).toBe(true)
})

test('recovers from a failed API request using retry', async ({ page }) => {
  await page.route('**/api/health', (route) => route.abort())
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Connection unavailable. Please try again.')
  await page.unroute('**/api/health')
  await page.getByRole('button', { name: 'Check connection' }).click()
  await expect(page.getByRole('status')).toHaveText('API and database connected.')
})

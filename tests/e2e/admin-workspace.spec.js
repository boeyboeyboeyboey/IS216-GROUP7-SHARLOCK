import { randomBytes } from 'node:crypto'
import { expect, test } from './fixtures/admin.js'

async function signIn(context, origin, identity) {
  const csrfResponse = await context.request.get(`${origin}/api/auth/csrf`, {
    headers: { Origin: origin },
  })
  expect(csrfResponse.ok()).toBe(true)
  const { csrfToken } = await csrfResponse.json()
  const response = await context.request.post(`${origin}/api/auth/login`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrfToken },
    data: { email: identity.email, password: identity.password },
  })
  expect(response.ok()).toBe(true)
}

test('admin creates, activates, and assigns an instructor to a class', async ({
  browser,
  page,
  studentIdentity,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL
  expect(typeof baseURL).toBe('string')
  const origin = new URL(baseURL).origin
  const suffix = randomBytes(6).toString('hex')
  const institutionName = `E2E Academy ${suffix}`
  const institutionSlug = `e2e-${suffix}`
  const cohortName = `E2E Class ${suffix}`
  const term = 'Synthetic Term 1'
  const instructor = {
    email: `e2e-instructor-${suffix}@example.test`,
    username: `e2e-i-${suffix}`,
  }
  const instructorPassword = `Instructor-${randomBytes(12).toString('hex')}Aa!`
  const isolatedContext = {
    storageState: { cookies: [], origins: [] },
    viewport: testInfo.project.use.viewport,
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
  }
  let activationContext
  let studentContext

  try {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Admin workspace' })).toBeVisible()

    await page.getByLabel('Institution name').fill(institutionName)
    await page.getByLabel('Institution slug').fill(institutionSlug)
    await page.getByRole('button', { name: 'Create institution' }).click()
    await expect(page.getByRole('list').getByText(institutionName, { exact: true })).toBeVisible()

    await page.getByLabel('Class name').fill(cohortName)
    await page.getByLabel('Term', { exact: true }).fill(term)
    await page.getByRole('button', { name: 'Create class' }).click()
    await expect(page.getByRole('list').getByText(cohortName, { exact: true })).toBeVisible()
    const cohortListResponse = await page
      .context()
      .request.get(`${origin}/api/admin/cohorts?limit=50`, { headers: { Origin: origin } })
    expect(cohortListResponse.ok()).toBe(true)
    const createdCohort = (await cohortListResponse.json()).cohorts.find(
      (cohort) => cohort.name === cohortName,
    )
    expect(createdCohort?.id).toMatch(/^[a-f\d]{24}$/i)

    await page.getByLabel('Instructor email').fill(instructor.email)
    await page.getByLabel('Instructor username').fill(instructor.username)
    await page.getByRole('button', { name: 'Create instructor and activation link' }).click()

    const linkField = page.getByLabel('Activation link')
    await expect(linkField).toBeVisible()
    const activationUrl = await linkField.inputValue()
    const activation = new URL(activationUrl)
    expect(activation.origin).toBe(origin)
    expect(activation.pathname).toBe('/activate-account')
    expect(activation.search).toBe('')
    expect(activation.hash).toMatch(/^#token=[A-Za-z\d_-]{43}$/)

    await page.getByRole('button', { name: 'Close and clear link' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText(activationUrl, { exact: true })).toHaveCount(0)

    activationContext = await browser.newContext(isolatedContext)
    const activationPage = await activationContext.newPage()
    await activationPage.goto(activationUrl)
    await expect(
      activationPage.getByRole('heading', { name: 'Activate your account' }),
    ).toBeVisible()
    await expect(activationPage).toHaveURL(`${origin}/activate-account`)
    await activationPage.getByLabel('New password').fill(instructorPassword)
    await activationPage.getByLabel('Confirm password').fill(instructorPassword)
    await activationPage.getByRole('button', { name: 'Set password and activate account' }).click()
    await expect(
      activationPage.getByText('Your password is set. Sign in normally to continue.'),
    ).toBeVisible()
    await expect(activationPage.getByLabel('Email address')).toHaveCount(0)
    await activationPage.getByRole('link', { name: 'Continue to sign in' }).click()

    await activationPage.getByLabel('Email address').fill(instructor.email)
    await activationPage.getByLabel('Password', { exact: true }).fill(instructorPassword)
    await activationPage.getByRole('button', { name: 'Sign in' }).click()
    await expect(activationPage).toHaveURL(`${origin}/`)

    const beforeAssignments = await activationContext.request.get(
      `${origin}/api/me/teaching-assignments?limit=50`,
      { headers: { Origin: origin } },
    )
    expect(beforeAssignments.ok()).toBe(true)
    expect((await beforeAssignments.json()).assignments).toEqual([])

    await page.getByRole('button', { name: 'Refresh instructors' }).click()

    const instructorEditor = page.getByRole('article', { name: instructor.username, exact: true })
    const cohortCheckbox = instructorEditor.getByRole('checkbox', {
      name: `${cohortName}, ${institutionName}, ${term}`,
    })
    await expect(cohortCheckbox).toBeVisible()
    await cohortCheckbox.check()
    await instructorEditor.getByRole('button', { name: 'Save assignments' }).click()

    await expect
      .poll(async () => {
        const response = await activationContext.request.get(
          `${origin}/api/me/teaching-assignments?limit=50`,
          { headers: { Origin: origin } },
        )
        if (!response.ok()) return []
        const result = await response.json()
        return result.assignments.map(({ cohortId }) => cohortId)
      })
      .toContain(createdCohort.id)

    studentContext = await browser.newContext(isolatedContext)
    await signIn(studentContext, origin, studentIdentity)
    const studentPage = await studentContext.newPage()
    await studentPage.goto(`${origin}/admin`)
    await expect(studentPage).toHaveURL(`${origin}/forbidden`)
    await expect(
      studentPage.getByRole('heading', { name: 'This case needs permission' }),
    ).toBeVisible()
  } finally {
    await activationContext?.close()
    await studentContext?.close()
  }
})

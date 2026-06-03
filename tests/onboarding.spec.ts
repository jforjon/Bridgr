import { test, expect } from '@playwright/test'
import { login, resetTestUser } from './helpers/auth'

test.setTimeout(120_000)

test.beforeEach(async () => {
  await resetTestUser()
})

test('completes full onboarding and lands on /learn', async ({ page }) => {
  // ── Step 0: log in ────────────────────────────────────────────────────────
  await login(page)
  await page.waitForURL('**/onboarding/1', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/onboarding\/1/)

  // ── Step 1: Name ──────────────────────────────────────────────────────────
  await page.getByPlaceholder('Your name').fill('Test User')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/onboarding/2', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/onboarding\/2/)

  // ── Step 2: Native language (English) ─────────────────────────────────────
  await page.getByRole('button', { name: /English/ }).first().click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/onboarding/3', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/onboarding\/3/)

  // ── Step 3: Other languages — skip ────────────────────────────────────────
  // Two Skip buttons exist (header link + bottom bar); click the bottom one
  // which is the Button component with role="button" and name "Skip"
  await page.getByRole('button', { name: 'Skip' }).last().click()
  await page.waitForURL('**/onboarding/4', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/onboarding\/4/)

  // ── Step 4: Language to learn — Italian ───────────────────────────────────
  await page.getByRole('button', { name: /Italian/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/onboarding/5**', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/onboarding\/5/)

  // ── Step 5: Weekly goal — default (3x) already selected ───────────────────
  await expect(page.getByRole('button', { name: /3 times a week/i })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/onboarding/6**', { timeout: 10_000 })
  await expect(page).toHaveURL(/\/onboarding\/6/)

  // ── Step 6: Notifications — No thanks ─────────────────────────────────────
  await page.getByRole('button', { name: 'No thanks' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForURL('**/placement/**', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/placement\/it/)

  // ── Placement: skip as beginner ───────────────────────────────────────────
  await page.getByRole('button', { name: "I'm a complete beginner" }).click()
  await page.waitForURL('**/learn**', { timeout: 120_000 })
  await expect(page).toHaveURL(/\/learn/)

  // ── Final: /learn page is present with content loaded ────────────────────
  await expect(page).toHaveURL(/\/learn/)
  await expect(page.getByText(/continue|lesson|unit|benvenuto/i).first()).toBeVisible({ timeout: 10_000 })
})

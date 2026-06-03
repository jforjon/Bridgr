import { test, expect } from '@playwright/test'
import { login, resetTestUser, seedTestUserWithCourse } from './helpers/auth'

test.setTimeout(300_000)

test.beforeEach(async () => {
  await resetTestUser()
  await seedTestUserWithCourse()
})

test('completes a vocabulary lesson', async ({ page }) => {
  // ── Step 1: Log in and land on /learn ─────────────────────────────────────
  await login(page)
  await page.waitForURL('**/learn', { timeout: 20_000 })
  await expect(page).toHaveURL(/\/learn/)

  // ── Step 2: Navigate into the lesson ──────────────────────────────────────
  await page.getByRole('button', { name: 'Continue lesson' }).click()
  await page.waitForURL(/\/learn\/.+\/lesson\/.+/, { timeout: 15_000 })
  await expect(page).toHaveURL(/\/learn\/.+\/lesson\/.+/)

  // ── Step 3: Intro phase — click Next for each vocab card ──────────────────
  // Wait for the first intro card to render (vocab bank API call completes)
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible({ timeout: 20_000 })

  const startPracticeBtn = page.getByRole('button', { name: 'Start practice' })
  for (let i = 0; i < 60; i++) {
    if (await startPracticeBtn.isVisible()) break
    await page.getByRole('button', { name: 'Next' }).click()
    // Wait for either another intro card (Next still present) or the transition
    // screen (Start practice appears) before the next loop iteration.
    await expect(
      page.getByRole('button', { name: 'Next' }).or(startPracticeBtn)
    ).toBeVisible({ timeout: 5_000 })
  }

  // ── Step 4: Transition screen ─────────────────────────────────────────────
  await expect(startPracticeBtn).toBeVisible({ timeout: 5_000 })
  await startPracticeBtn.click()

  // ── Step 5: Practice phase — work through every flashcard ─────────────────
  // The deck uses a single bottom button: "Check" before submission, "Next" after.
  // Loop until the session-complete heading appears.
  const completeHeading = page.getByRole('heading', { name: /you just learned/i })
  const answerInput = page.getByPlaceholder('Type the translation...')

  for (let i = 0; i < 50; i++) {
    if (await completeHeading.isVisible()) break

    // Wait for input field (beginning of each card)
    await expect(answerInput).toBeVisible({ timeout: 10_000 })
    await answerInput.fill('test')

    // Submit — correct or wrong doesn't matter
    await page.getByRole('button', { name: 'Check' }).click()

    // Wait for evaluation result (button changes to "Next") — AI grading can be slow
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Next' }).click()

    // Wait for either the next card's input or the completion screen
    await expect(
      answerInput.or(completeHeading)
    ).toBeVisible({ timeout: 15_000 })
  }

  // ── Step 6: Session complete screen ───────────────────────────────────────
  await expect(completeHeading).toBeVisible({ timeout: 15_000 })

  // ── Step 7: Return to /learn ───────────────────────────────────────────────
  await page.getByRole('button', { name: /back to my course/i }).click()
  await page.waitForURL('**/learn', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/learn/)
})

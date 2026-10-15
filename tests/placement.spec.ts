import { test, expect } from '@playwright/test'
import { login, resetTestUser, seedTestUserPrePlacement } from './helpers/auth'

test.setTimeout(300_000)

test.beforeEach(async () => {
  await resetTestUser()
  await seedTestUserPrePlacement()
})

test('skips placement test and generates course', async ({ page }) => {
  // Step 1: Log in and land on /learn
  await login(page)
  await page.waitForURL('**/learn', { timeout: 20_000 })
  await expect(page).toHaveURL(/\/learn/)

  // Step 2: Empty state — both CTAs visible
  await expect(page.getByRole('link', { name: 'Take the placement test' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'I’m a complete beginner' })).toBeVisible()

  // Step 3: Skip as beginner — triggers course generation + polls until ready
  await page.getByRole('button', { name: 'I’m a complete beginner' }).click()

  // Step 4: Confirm the generating state is active — BridgrPageLoading renders the
  // title "Building your Italian course..." (LearnHomeClient.tsx:197) as a <p> tag.
  // Waiting for this text confirms runBeginnerFlow() is running and we haven't
  // matched a stale course from a previous test run.
  await expect(page.getByText(/Building your/i)).toBeVisible({ timeout: 30_000 })

  // Step 5: Wait for the generating state to resolve and "Continue lesson" to appear.
  // placement/submit (~30 s) + course/skeleton (~65 s) + polling = ~100 s total.
  await page.screenshot({ path: 'test-results/after-course-generated.png', fullPage: true })
  await expect(page.getByRole('button', { name: 'Start today’s session' })).toBeVisible({ timeout: 120_000 })
})

test('completes placement test', async ({ page }) => {
  // Step 1: Log in and land on /learn empty state
  await login(page)
  await page.waitForURL('**/learn', { timeout: 20_000 })
  await expect(page).toHaveURL(/\/learn/)
  await page.screenshot({ path: 'test-results/completes-test-learn-state.png', fullPage: true })

  await expect(page.getByRole('link', { name: 'Take the placement test' })).toBeVisible({ timeout: 10_000 })

  // Step 2: Click "Take the placement test"
  await page.getByRole('link', { name: 'Take the placement test' }).click()

  // Step 3: Verify URL is /placement/it
  await page.waitForURL('**/placement/it', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/placement\/it/)

  // Step 4: Start the test (API generates questions — may take a moment)
  await page.getByRole('button', { name: 'Start placement test' }).click()

  // Step 5: Loop through up to 30 questions using "I don't know" on every question.
  // handleDontKnow() bypasses canAdvance entirely, so it works for both MCQ and
  // text-input questions without needing to locate or click an answer option first.
  const dontKnowBtn = page.getByRole('button', { name: "I don't know" })

  // Wait for the first question to load — "Start placement test" triggers an AI
  // call that shows a loading screen before questions appear. Without this wait,
  // isVisible() returns false on the loading screen and the loop exits immediately.
  await expect(dontKnowBtn).toBeVisible({ timeout: 30_000 })

  for (let i = 0; i < 30; i++) {
    const isVisible = await dontKnowBtn.isVisible().catch(() => false)
    if (!isVisible) break  // grading loading screen started — exit and wait below

    await dontKnowBtn.click()
    await page.waitForTimeout(500)
  }

  // Step 6: Wait for results screen — button text confirmed from placement page source.
  // AI grading can take 30–60 s so use the full available timeout.
  const startCourseBtn = page.getByRole('button', { name: 'Start your personalised course' })
  await expect(startCourseBtn).toBeVisible({ timeout: 90_000 })

  // Step 7: Assert a CEFR level is displayed
  await expect(page.getByText(/^(A1|A2|B1|B2|C1|C2)$/).first()).toBeVisible()
})

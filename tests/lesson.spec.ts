import { test, expect } from '@playwright/test'
import { login, seedTestUserWithCourse } from './helpers/auth'

test.setTimeout(300_000)

test.beforeEach(async () => {
  // Re-seeds the course when the previous run consumed it (the session flow now
  // marks the lesson complete), and skips the rebuild when a fresh course with
  // unseen sentence cards already exists. No Anthropic calls either way — the
  // seed inserts pre-built sentence cards.
  await seedTestUserWithCourse()
})

test('completes a vocabulary session', async ({ page }) => {
  // ── Step 1: Log in and land on /learn ─────────────────────────────────────
  await login(page)
  await page.waitForURL('**/learn', { timeout: 30_000 })
  await expect(page).toHaveURL(/\/learn/)

  // ── Step 2: Start the session ──────────────────────────────────────────────
  await page.getByRole('button', { name: 'Start today’s session' }).click()
  await page.waitForURL(/\/learn\/.+\/session/, { timeout: 15_000 })

  // ── Step 3: Work through the deck ──────────────────────────────────────────
  // Cards are either a false-friend interstitial ("Got it"), a stage-1 multiple
  // choice (pick an option, then "Continue"), or a stage-2 typing card (reveal
  // the word via the marker so no AI grading is needed, "Check", "Continue").
  const completeHeading = page.getByRole('heading', { name: 'Good work — that counts.' })
  const gotItBtn = page.getByRole('button', { name: 'Got it' })
  const continueBtn = page.getByRole('button', { name: 'Continue' })
  const checkBtn = page.getByRole('button', { name: 'Check' })
  const optionButtons = page.locator('div.space-y-3 > button')

  // Every action is wrapped in try/catch: the deck advances asynchronously
  // (SRS saves, React strict-mode remounts), so any click can race a card
  // change. A missed action is simply retried on the next pass; the loop only
  // ends on the completion screen or the iteration cap.
  for (let i = 0; i < 60; i++) {
    if (await completeHeading.isVisible().catch(() => false)) break

    try {
      if (await gotItBtn.isVisible().catch(() => false)) {
        await gotItBtn.click({ timeout: 5_000 })
      } else if (await optionButtons.first().isVisible().catch(() => false)) {
        // Stage 1 — answer the multiple choice (any option works). Options
        // disable once one is selected, so only click an enabled one; if the
        // answer is already locked in, go straight to Continue.
        const enabledOption = page
          .locator('div.space-y-3 > button:not([disabled])')
          .first()
        if (await enabledOption.isVisible().catch(() => false)) {
          await enabledOption.click({ timeout: 5_000 })
        }
        await expect(continueBtn).toBeEnabled({ timeout: 15_000 })
        await continueBtn.click({ timeout: 5_000 })
      } else if (await checkBtn.isVisible().catch(() => false)) {
        // Stage 2 — reveal the word through the marker popover, then check.
        await page.locator('span.border-dotted').click({ timeout: 5_000 })
        await page.getByRole('button', { name: 'Reveal word' }).click({ timeout: 5_000 })
        await checkBtn.click({ timeout: 5_000 })
        await expect(continueBtn).toBeEnabled({ timeout: 30_000 })
        await continueBtn.click({ timeout: 5_000 })
      }
    } catch {
      // Card state changed mid-action — re-read the deck on the next pass.
    }

    await page.waitForTimeout(300)
  }

  // ── Step 4: Session complete screen ────────────────────────────────────────
  await expect(completeHeading).toBeVisible({ timeout: 15_000 })

  // ── Step 5: Return to /learn ───────────────────────────────────────────────
  await page.getByRole('link', { name: 'Done for today' }).click()
  await page.waitForURL('**/learn', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/learn/)
})

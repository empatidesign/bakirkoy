import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test('visual: event form shows danger warning when end time <= start time', async ({ page }) => {
  await login(page)
  await page.goto('/events?tab=events')
  await page.getByRole('button', { name: 'Yeni Etkinlik' }).click()
  await page.getByText('Yeni Etkinlik · 1. Adım').waitFor()
  await page.getByRole('button', { name: 'Devam Et' }).click()
  await page.getByText('Yeni Etkinlik Ekle').waitFor()
  await page.waitForTimeout(400)

  // The time fields only show up for single-day (seanssız) events, which is the default.
  await page.getByText('Başlangıç Saati').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)

  const timeInputs = page.locator('input[placeholder="ss:dd"]')
  const count = await timeInputs.count()
  console.log('time input count:', count)

  if (count >= 2) {
    await timeInputs.nth(0).fill('13:00')
    await timeInputs.nth(0).blur()
    await timeInputs.nth(1).fill('12:00')
    await timeInputs.nth(1).blur()
    await page.waitForTimeout(300)
    await expect(page.getByText('Bitiş saati başlangıç saatinden sonra olmalıdır.')).toBeVisible()
    await page.screenshot({ path: 'tests/e2e/artifacts/event-form-time-invalid.png', fullPage: false })

    // Now fix it and confirm the warning disappears
    await timeInputs.nth(1).fill('15:00')
    await timeInputs.nth(1).blur()
    await page.waitForTimeout(300)
    await expect(page.getByText('Bitiş saati başlangıç saatinden sonra olmalıdır.')).not.toBeVisible()
    await page.screenshot({ path: 'tests/e2e/artifacts/event-form-time-valid.png', fullPage: false })
  }
})

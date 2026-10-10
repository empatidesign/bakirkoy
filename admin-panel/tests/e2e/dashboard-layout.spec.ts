import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.use({ viewport: { width: 1920, height: 1080 } })

test('dashboard: tarih seçici sağda, kart satırları 4 sütun, online kartları renkli', async ({ page }) => {
  test.setTimeout(90000)
  await login(page)
  await page.goto('/dashboard')

  const header = page.locator('header.pilot-page-header')
  const title = header.locator('.pilot-title')
  const select = header.locator('button[aria-haspopup]')
  await expect(select).toBeVisible({ timeout: 20000 })
  const h = await header.boundingBox()
  const t = await title.boundingBox()
  const s = await select.boundingBox()
  expect(Math.abs((s!.y + s!.height / 2) - (t!.y + t!.height / 2))).toBeLessThan(24)
  expect(h!.x + h!.width - (s!.x + s!.width)).toBeLessThan(40)

  const grids = page.locator('.pilot-stat-grid')
  await expect(grids).toHaveCount(3)
  for (let i = 0; i < 3; i++) {
    const cols = await grids.nth(i).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(4)
    await expect(grids.nth(i).locator('.pilot-stat-card')).toHaveCount(4)
  }

  const online = grids.nth(2)
  for (const label of ['Şu An Online', 'Yönetici', 'Vatandaş', 'Firma']) {
    await expect(online.locator('.pilot-stat-label', { hasText: label })).toBeVisible()
  }
  const colors = await online.locator('.pilot-stat-icon').evaluateAll((els) => els.map((el) => getComputedStyle(el).color))
  expect(new Set(colors).size).toBe(4)

  await page.screenshot({ path: '/private/tmp/claude-501/-Volumes-PROJELER-Web-NexorayeniSercan/d45edac3-2a82-410a-9643-3b3fbd0b499e/scratchpad/dash-after.png' })
})

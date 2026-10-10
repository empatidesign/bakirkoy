import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.use({ viewport: { width: 1600, height: 900 } })

const SHOTS = '/private/tmp/claude-501/-Volumes-PROJELER-Web-NexorayeniSercan/256f966d-4d2e-4af4-9ae6-0179e1cee9de/scratchpad'

test('sayfa başlıkları: breadcrumb yok, tüm sayfalarda aynı genel ton', async ({ page }) => {
  test.setTimeout(90000)
  await login(page)
  const bgs: string[] = []
  for (const [i, path] of ['/service-facilities', '/dashboard', '/companies', '/youth-camp', '/scout-camp', '/library', '/sports', '/events'].entries()) {
    await page.goto(path)
    const header = page.locator('header.pilot-page-header').first()
    await expect(header).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.pilot-breadcrumb:visible')).toHaveCount(0)
    bgs.push(await header.evaluate((el) => getComputedStyle(el).backgroundImage))
    await page.screenshot({ path: `${SHOTS}/header-${i}.png`, clip: { x: 0, y: 0, width: 1600, height: 260 } })
  }
  expect(new Set(bgs).size).toBe(1)
  expect(bgs[0]).toContain('gradient')
})

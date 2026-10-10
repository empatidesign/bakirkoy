import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.use({ viewport: { width: 1600, height: 900 } })

const SHOTS = '/private/tmp/claude-501/-Volumes-PROJELER-Web-NexorayeniSercan/d45edac3-2a82-410a-9643-3b3fbd0b499e/scratchpad'
const ROUTES = ['/admin', '/wheel', '/quiz', '/library', '/events', '/travels']

test('pilot standartları: özel açılır seçim, kart sekmeler, tek başlık satırı', async ({ page }) => {
  test.setTimeout(240000)
  await login(page)
  for (const route of ROUTES) {
    await page.goto(route)
    const header = page.locator('header.pilot-page-header')
    await expect(header, route).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(1500)

    await expect(page.locator('main select'), `${route} yerel select`).toHaveCount(0)
    const tabs = page.locator('main [data-tab]').first()
    if (await tabs.count()) {
      await expect(tabs.locator('xpath=../..'), `${route} sekme kartı`).toHaveClass(/pilot-detail-tabs/)
    }
    const triggers = page.locator('main button.pilot-select')
    if (await triggers.count()) {
      await triggers.first().click()
      await expect(page.locator('input[placeholder$="ara..." i]:focus'), `${route} arama`).toBeVisible()
      await page.keyboard.press('Escape')
    }
    const headerBox = await header.boundingBox()
    const title = await header.locator('.pilot-title').boundingBox()
    const slotButtons = header.locator('.pilot-header-slot button')
    for (const b of await slotButtons.all()) {
      const box = await b.boundingBox()
      expect(Math.abs(box!.y + box!.height / 2 - (title!.y + title!.height / 2)), `${route} aksiyon hizası`).toBeLessThan(24)
    }
    expect(headerBox!.height, `${route} başlık tek satır`).toBeLessThan(130)
    await page.screenshot({ path: `${SHOTS}/std${route.replace('/', '_')}.png` })
  }
})

test('spor tesis detayı: Başvurular filtreleri özel açılır seçim', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  const listRes = page.waitForResponse((r) => r.url().includes('/sports/facilities?') && r.request().method() === 'GET')
  await page.goto('/sports')
  const first = (await (await listRes).json()).data.items[0]
  await page.goto(`/sports?f=${first.id}&tab=applications`)
  await expect(page.locator('.pilot-detail-tabs')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.pilot-filters button.pilot-select').first()).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.pilot-filters select')).toHaveCount(0)
  await expect(page.locator('.pilot-filters input[type=date]')).toHaveCount(0)
  await page.locator('.pilot-filters button.pilot-select').first().click()
  await expect(page.locator('input[placeholder$="ara..." i]:focus')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `${SHOTS}/std_sports_apps.png` })
})

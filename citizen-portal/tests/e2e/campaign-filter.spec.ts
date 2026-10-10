import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const trackErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

const openFilterSheet = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: /Filtrele/ }).click()
  await page.waitForTimeout(300)
}

test.describe.serial('Kampanya — backend-driven filtreleme + kaydetme', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test('Kampanya sayfası açılıyor, arama + Filtrele butonu render oluyor', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/kampanyalar')
    await page.waitForLoadState('networkidle')

    await expect(page.getByPlaceholder(/Kampanya veya firma ara/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Filtrele/ })).toBeVisible()
    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('Tarih durumu çipi discover isteğine dateStatus gönderir', async ({ page }) => {
    await login(page)
    await page.goto('/kampanyalar')
    await page.waitForLoadState('networkidle')

    const calls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/campaigns') && req.url().includes('dateStatus=')) calls.push(req.url())
    })

    await openFilterSheet(page)
    const chip = page.getByRole('button', { name: 'Şu an aktif', exact: true })
    if (await chip.count()) {
      await chip.click()
      await page.waitForTimeout(800)
      expect(calls.some((u) => u.includes('dateStatus=active')), 'tarih durumu dateStatus=active göndermeli').toBeTruthy()
    }
  })

  test('Yalnızca kaydettiklerim toggle onlySaved=true gönderir', async ({ page }) => {
    await login(page)
    await page.goto('/kampanyalar')
    await page.waitForLoadState('networkidle')

    const calls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/campaigns') && req.url().includes('onlySaved=true')) calls.push(req.url())
    })

    await openFilterSheet(page)
    const savedRow = page.getByText('Yalnızca kaydettiklerim')
    if (await savedRow.count()) {
      await savedRow.click()
      await page.waitForTimeout(800)
      expect(calls.length, 'kaydedilenler toggle onlySaved=true göndermeli').toBeGreaterThan(0)
    }
  })

  test('Kart bookmark butonu POST/DELETE /bookmark çağırır', async ({ page }) => {
    await login(page)
    await page.goto('/kampanyalar')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[aria-label="Kaydet"], [aria-label="Kaydı kaldır"]', { timeout: 10000 })

    const bookmarkCalls: { method: string; url: string }[] = []
    page.on('request', (req) => {
      if (/\/me\/campaigns\/[0-9a-f-]+\/bookmark/.test(req.url())) {
        bookmarkCalls.push({ method: req.method(), url: req.url() })
      }
    })

    const firstBookmark = page.locator('[aria-label="Kaydet"], [aria-label="Kaydı kaldır"]').first()
    await firstBookmark.click()
    await page.waitForTimeout(900)
    expect(bookmarkCalls.length, 'bookmark toggle bir POST/DELETE göndermeli').toBeGreaterThan(0)
    expect(['POST', 'DELETE']).toContain(bookmarkCalls[0].method)
  })

  test('Kategori seçimi categoryIds gönderir (kategori varsa)', async ({ page }) => {
    await login(page)
    await page.goto('/kampanyalar')
    await page.waitForLoadState('networkidle')

    const calls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/campaigns') && req.url().includes('categoryIds=')) calls.push(req.url())
    })

    await openFilterSheet(page)
    const catSection = page.locator('div').filter({ has: page.getByText('Kategoriler', { exact: true }) }).last()
    if (await catSection.count()) {
      const firstCat = catSection.locator('[role="button"]').filter({ has: page.locator('[role="checkbox"]') }).first()
      if (await firstCat.count()) {
        await firstCat.click()
        await page.waitForTimeout(800)
        expect(calls.length, 'kategori seçimi categoryIds göndermeli').toBeGreaterThan(0)
      }
    }
  })
})

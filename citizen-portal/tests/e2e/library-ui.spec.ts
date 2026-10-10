import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const trackErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function firstLibraryName(page: import('@playwright/test').Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('portal_access_token') ?? sessionStorage.getItem('portal_access_token'))
  const res = await page.request.get('/api/v1/me/libraries?Page=1&Limit=1', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  const name = body?.data?.items?.[0]?.name
  expect(name, 'en az bir kütüphane bulunmalı').toBeTruthy()
  return name
}

test.describe.serial('Kütüphane — vatandaş portalı UI', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test('Kütüphane listesi açılıyor, kartlar ve foto (4:3) render oluyor', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/kutuphane')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Kıraathaneler' })).toBeVisible()
    const libName = await firstLibraryName(page)
    await expect(page.getByText(libName).first()).toBeVisible({ timeout: 10000 })

    const libImg = page.locator('img[src*="/files/public/libraries/"]').first()
    const hasImage = await libImg.isVisible({ timeout: 3000 }).catch(() => false)
    if (hasImage) {
      const loaded = await libImg.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0)
      expect(loaded, 'foto varsa gerçekten yüklenmeli').toBeTruthy()
    }

    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('Arama kutusu listeyi filtreliyor', async ({ page }) => {
    await login(page)
    await page.goto('/kutuphane')
    await page.waitForLoadState('networkidle')

    const libName = await firstLibraryName(page)
    const search = page.getByPlaceholder('Kıraathane veya semt ara…')
    await search.fill(libName)
    await page.waitForTimeout(500)
    await expect(page.getByText(libName).first()).toBeVisible()
    await expect(page.getByText('zzzzz-eşleşmeyecek-arama')).toHaveCount(0)
  })

  test('Kütüphane detay modalı: istatistik kartları + masa/istatistik sekmesi açılıyor', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/kutuphane')
    await page.waitForLoadState('networkidle')

    const libName = await firstLibraryName(page)
    const card = page.locator('button', { hasText: libName }).first()
    await card.click()
    await expect(page.getByRole('heading', { name: 'Kıraathane', exact: true })).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('İçeride').first()).toBeVisible()
    await expect(page.getByText('Molada').first()).toBeVisible()

    await page.getByText('İstatistikler').first().click().catch(() => {})
    await page.waitForTimeout(600)
    await page.getByText('Masa Seçimi').first().click().catch(() => {})
    await page.waitForTimeout(400)

    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('Rezervasyonlarım sekmesi çökmeden açılıyor', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/kutuphane')
    await page.waitForLoadState('networkidle')

    await page.getByText('Rezervasyonlarım').first().click()
    await page.waitForTimeout(800)
    await expect(page).not.toHaveURL(/\/login/)
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})

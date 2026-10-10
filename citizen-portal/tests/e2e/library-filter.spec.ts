import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const trackErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe.serial('Kütüphane — backend arama + Alan Türü filtresi', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test('Kütüphane sayfası açılıyor; /filters ucu çağrılıyor ve alan türleri dönüyor', async ({ page }) => {
    const errors = trackErrors(page)

    let filtersBody: any = null
    page.on('response', async (res) => {
      if (res.url().includes('/me/libraries/filters') && res.ok()) {
        try { filtersBody = (await res.json())?.data } catch {  }
      }
    })

    await login(page)
    await page.goto('/kutuphane')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page.getByPlaceholder(/ara/)).toBeVisible()
    expect(filtersBody, '/filters yanıtı gelmeli').toBeTruthy()
    expect(Array.isArray(filtersBody.areaTypes), 'areaTypes dizi olmalı').toBeTruthy()
    expect(typeof filtersBody.totalCount, 'totalCount sayı olmalı').toBe('number')
    await expect(page.getByRole('button', { name: /Tümü/ })).toBeVisible()

    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('Arama backend discover isteğine search parametresi gönderir', async ({ page }) => {
    await login(page)
    await page.goto('/kutuphane')
    await page.waitForLoadState('networkidle')

    const searchCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/libraries') && req.url().includes('search=')) searchCalls.push(req.url())
    })

    await page.getByPlaceholder(/ara/).fill('millet')
    await page.waitForTimeout(900)

    expect(searchCalls.length, 'arama backend discover\'a search göndermeli').toBeGreaterThan(0)
  })

  test('Alan türü çipi discover isteğine areaType parametresi gönderir', async ({ page }) => {
    await login(page)
    await page.goto('/kutuphane')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const areaCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/libraries') && req.url().includes('areaType=')) areaCalls.push(req.url())
    })

    const chips = page.locator('button').filter({ hasText: /Karma|Çalışma Alanı|Sessiz Alan/ })
    if (await chips.count()) {
      await chips.first().click()
      await page.waitForTimeout(800)
      expect(areaCalls.length, 'alan türü çipi areaType göndermeli').toBeGreaterThan(0)
    }
  })
})

import { test, expect, type Page } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const API_BASE = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

type ApiEnvelope<T> = { data: T }
type Pharmacy = {
  id: string
  name: string
  address: string | null
  phone: string | null
  latitude: number | null
  longitude: number | null
}

async function getAccessToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('portal_access_token') ?? sessionStorage.getItem('portal_access_token'))
  expect(token, 'citizen access token should be stored after login').toBeTruthy()
  return token as string
}

async function apiGet<T>(page: Page, path: string): Promise<T> {
  const token = await getAccessToken(page)
  const response = await page.request.get(`${API_BASE}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } })
  expect(response.ok(), `${path} should return OK`).toBeTruthy()
  const body = await response.json() as ApiEnvelope<T>
  return body.data
}

const main = (page: Page) => page.locator('main')

test.describe.serial('Nöbetçi eczane citizen', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('liste ve harita sekmesi Google Maps ile çalışır', async ({ page }) => {
    const pharmacies = await apiGet<Pharmacy[]>(page, '/me/duty-pharmacies')

    await page.goto('/nobetci-eczane')
    await page.waitForLoadState('networkidle').catch(() => {})

    await expect(main(page).getByRole('heading', { name: 'Nöbetçi Eczane' })).toBeVisible()
    await expect(main(page).getByRole('button', { name: 'Liste' })).toBeVisible()
    await expect(main(page).getByRole('button', { name: 'Harita' })).toBeVisible()

    if (pharmacies.length > 0) {
      const pharmacy = pharmacies[0]
      await expect(main(page).getByText(pharmacy.name).first()).toBeVisible()
    }

    await main(page).getByRole('button', { name: 'Harita' }).click()
    // Leaflet tamamen kaldırıldı (2026-08-14) — artık yalnızca Google Maps kullanılır.
    await expect(main(page).locator('.gm-style')).toBeVisible()
    await expect(main(page).locator('.leaflet-container')).toHaveCount(0)
  })
})

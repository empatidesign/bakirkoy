import { test, expect, type Page } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const API_BASE = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

type ApiEnvelope<T> = { data: T }
type Area = {
  id: string
  name: string
  neighborhood: string | null
  address: string | null
  capacity: number
  areaSizeM2: number
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

async function closeBlockingOverlay(page: Page) {
  await page.keyboard.press('Escape').catch(() => {})
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach((el) => {
      const className = String(el.getAttribute('class') ?? '')
      if (className.includes('fixed') && className.includes('inset-0') && className.includes('z-[9999]')) el.remove()
    })
  }).catch(() => {})
}

test.describe.serial('Acil toplanma alanları citizen', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('liste, detay modalı ve harita sekmesi API verisiyle çalışır', async ({ page }) => {
    const areas = await apiGet<Area[]>(page, '/me/emergency-areas')

    await page.goto('/acil-alanlar')
    await page.waitForLoadState('networkidle').catch(() => {})
    await closeBlockingOverlay(page)

    await expect(main(page).getByRole('heading', { name: 'Acil Toplanma Alanları' })).toBeVisible()
    await expect(main(page).getByRole('button', { name: 'Liste' })).toBeVisible()
    await expect(main(page).getByRole('button', { name: 'Harita' })).toBeVisible()

    if (areas.length === 0) {
      await expect(main(page).getByText('Alan bulunamadı')).toBeVisible()
    } else {
      const area = areas[0]
      await expect(main(page).getByText(area.name).first()).toBeVisible()
      if (area.neighborhood) await expect(main(page).getByText(area.neighborhood).first()).toBeVisible()
      await main(page).locator('button').filter({ hasText: area.name }).first().click({ force: true })
      await expect(page.locator('body').getByText(area.name).last()).toBeVisible()
      const capacityText = area.capacity.toLocaleString('tr-TR')
      const capacityPattern = new RegExp(`${capacityText.replace(/\./g, '\\.')}\\s+kişi`)
      await expect(page.getByText(capacityPattern).last()).toBeVisible()
      await page.keyboard.press('Escape')
    }

    await main(page).getByRole('button', { name: 'Harita' }).click()
    await expect(main(page).locator('.gm-style')).toBeVisible()
  })
})

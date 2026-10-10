import { test, expect, type Page } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const API_BASE = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

type ApiEnvelope<T> = { data: T }
type QrPass = { title: string; subtitle: string; token: string; rotationSeconds: number; shortCode: string | null }
type QrPassList = { identity: QrPass; passes: QrPass[] }

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

test.describe.serial('Citizen QR hub', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('kimlik QR ve tesis geçişleri GET /me/qr-passes verisiyle render edilir', async ({ page }) => {
    const qrPasses = await apiGet<QrPassList>(page, '/me/qr-passes')
    expect(qrPasses.identity.token, 'identity QR token should exist').toBeTruthy()

    await page.goto('/qr')
    await page.waitForLoadState('networkidle').catch(() => {})

    await expect(main(page).getByRole('heading', { name: 'QR İşlemleri' })).toBeVisible()
    await expect(main(page).getByRole('button', { name: 'QR Kodum' })).toBeVisible()
    await expect(main(page).getByText('Otomatik yenileme')).toBeVisible()
    await expect(main(page).getByText('Bu kodu yetkili okuyucuya gösterin')).toBeVisible()

    if (qrPasses.passes.length > 0) {
      await expect(main(page).getByText('Tesis Geçiş Kodlarım')).toBeVisible()
      await expect(main(page).getByText(qrPasses.passes[0].title).first()).toBeVisible()
    }
  })

  test('QR oku sekmesi kamera tarayıcı alanını açar', async ({ page }) => {
    await page.goto('/qr')
    await page.waitForLoadState('networkidle').catch(() => {})

    await main(page).getByRole('button', { name: 'QR Oku' }).click()
    await expect(main(page).getByText(/Kamera|QR kod/i).first()).toBeVisible()
  })
})

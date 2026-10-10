import { test, expect, type Page } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const API_BASE = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

type ApiEnvelope<T> = { data: T }
type CitizenSession = {
  sessionId: string
  isCurrent: boolean
  deviceType: string
  ipAddress: string | null
  createdAt: string
}

async function getAccessToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('portal_access_token') ?? sessionStorage.getItem('portal_access_token'))
  expect(token, 'citizen access token should be stored after login').toBeTruthy()
  return token as string
}

async function apiGet<T>(page: Page, path: string): Promise<T> {
  const token = await getAccessToken(page)
  const response = await page.request.get(`${API_BASE}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), `${path} should return OK`).toBeTruthy()
  const body = await response.json() as ApiEnvelope<T>
  return body.data
}

const main = (page: Page) => page.locator('main')

test.describe.serial('Profil aktif oturumlar', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('/profil/oturumlar aktif oturumları API verisiyle gösterir', async ({ page }) => {
    const sessions = await apiGet<CitizenSession[]>(page, '/auth/citizen/sessions')

    await page.goto('/profil/oturumlar')
    await page.waitForLoadState('networkidle').catch(() => {})

    await expect(main(page).getByRole('heading', { name: 'Aktif Oturumlar' })).toBeVisible()
    await expect(main(page).getByText('Hesabınıza giriş yapılan cihazlar')).toBeVisible()

    if (sessions.length === 0) {
      await expect(main(page).getByText('Aktif oturum bulunamadı.')).toBeVisible()
      return
    }

    await expect(main(page).getByText('Bu cihaz', { exact: true })).toBeVisible()
    const current = sessions.find((s) => s.isCurrent) ?? sessions[0]
    await expect(main(page).getByText(current.deviceType === 'mobile' ? 'Mobil' : 'Web').first()).toBeVisible()
  })

  test('diğer oturum varsa authenticated revoke API ile sonlandırılabilir', async ({ page }) => {
    const sessions = await apiGet<CitizenSession[]>(page, '/auth/citizen/sessions')
    const other = sessions.find((s) => !s.isCurrent)
    test.skip(!other, 'Sonlandırılacak başka aktif oturum yok')

    const token = await getAccessToken(page)
    const response = await page.request.delete(`${API_BASE}/api/v1/auth/citizen/sessions/${other!.sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok(), 'session revoke API should return OK').toBeTruthy()

    await page.goto('/profil/oturumlar')
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(main(page).getByText(other!.sessionId)).toHaveCount(0)
  })
})

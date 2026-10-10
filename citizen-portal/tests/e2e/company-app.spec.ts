import { test, expect, type Page } from '@playwright/test'
import { loginCompany, TEST_COMPANY_EMAIL } from './helpers/companyAuth'

const API_BASE = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')
const appMain = (page: Page) => page.locator('main')

type ApiEnvelope<T> = { data: T }
type CompanyProfile = {
  id: string
  name: string
  email: string
  phone?: string
  status?: string
  totalCampaigns?: number
  totalUsages?: number
}
type Campaign = { id: string; name: string; status?: string }
type PagedCampaigns = { items: Campaign[] }
type CompanyQr = { id: string; staticCode: string; isActive: boolean; validUntil?: string }

async function getCompanyAccessToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('portal_access_token') ?? sessionStorage.getItem('portal_access_token'))
  expect(token, 'company access token should be stored after login').toBeTruthy()
  return token as string
}

async function apiGet<T>(page: Page, path: string): Promise<T> {
  const token = await getCompanyAccessToken(page)
  const response = await page.request.get(`${API_BASE}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), `${path} should return OK`).toBeTruthy()
  const body = await response.json() as ApiEnvelope<T>
  return body.data
}

test.describe('Firma paneli companyApp', () => {
  test('login olmadan /firma ziyaret edilirse /firma/login sayfasına yönlendirir', async ({ page }) => {
    await page.goto('/firma')

    await expect(page).toHaveURL(/\/firma\/login$/)
    await expect(page.getByText('Firma Girişi')).toBeVisible()
  })

  test('firma login olur ve /firma ana panel gerçek firma verisini gösterir', async ({ page }) => {
    await loginCompany(page)
    const profile = await apiGet<CompanyProfile>(page, '/company/me/profile')

    await expect(appMain(page).getByRole('heading', { name: 'Panel' })).toBeVisible()
    await expect(appMain(page).getByText(profile.name).first()).toBeVisible()
    await expect(appMain(page).getByText(profile.email).first()).toBeVisible()
    await expect(appMain(page).getByText('Kampanya', { exact: true })).toBeVisible()
    await expect(appMain(page).getByText('Kullanım', { exact: true })).toBeVisible()
  })

  test('/firma/campaigns kampanya listesini veya boş durumunu render eder', async ({ page }) => {
    await loginCompany(page)
    const campaigns = await apiGet<PagedCampaigns>(page, '/company/me/campaigns?page=1&limit=100&sort=createdat&order=desc')

    await page.goto('/firma/campaigns')
    await expect(appMain(page).getByRole('heading', { name: 'Kampanyalar' })).toBeVisible()

    if (campaigns.items.length > 0) {
      await expect(appMain(page).getByText(campaigns.items[0].name).first()).toBeVisible()
      await expect(appMain(page).getByRole('button', { name: 'Yeni Kampanya' })).toBeVisible()
    } else {
      await expect(
        appMain(page).getByText(/Henüz kampanya yok|Kampanya oluşturulamıyor/),
      ).toBeVisible()
    }
  })

  test('/firma/qr firma QR UI ve API verisini render eder', async ({ page }) => {
    await loginCompany(page)
    const profile = await apiGet<CompanyProfile>(page, '/company/me/profile')

    await page.goto('/firma/qr')
    await expect(appMain(page).getByRole('heading', { name: 'Firma QR Kodum' })).toBeVisible()

    if (profile.status === 'Approved') {
      const qr = await apiGet<CompanyQr>(page, '/qr/company/my-qr')
      expect(qr.staticCode).toMatch(/^[a-f0-9]{32}$/)
      await expect(appMain(page).getByText(profile.name).first()).toBeVisible()
      await expect(appMain(page).locator('p.font-mono')).toHaveText(/^[a-f0-9]{32}$/)
      await expect(appMain(page).getByText('Kullanım Talimatı')).toBeVisible()
    } else {
      await expect(appMain(page).getByText('QR kodu kullanılamıyor')).toBeVisible()
    }
  })

  test('/firma/profile firma isim ve e-posta bilgilerini gösterir', async ({ page }) => {
    await loginCompany(page)
    const profile = await apiGet<CompanyProfile>(page, '/company/me/profile')

    await page.goto('/firma/profile')
    await expect(appMain(page).getByText(profile.name).first()).toBeVisible()
    await expect(appMain(page).getByText(profile.email).first()).toBeVisible()
    await expect(appMain(page).getByText(TEST_COMPANY_EMAIL).first()).toBeVisible()
  })

  test('redeem/QR API akışı için firma kampanya ve QR endpointleri erişilebilir', async ({ page }) => {
    await loginCompany(page)
    const profile = await apiGet<CompanyProfile>(page, '/company/me/profile')
    const campaigns = await apiGet<PagedCampaigns>(page, '/company/me/campaigns?page=1&limit=100&sort=createdat&order=desc')

    await page.goto('/firma/redeem')
    await expect(appMain(page).getByRole('heading', { name: 'Kullandır' })).toBeVisible()

    if (profile.status === 'Approved') {
      const qr = await apiGet<CompanyQr>(page, '/qr/company/my-qr')
      expect(qr.staticCode).toBeTruthy()
      expect(Array.isArray(campaigns.items)).toBeTruthy()
      await expect(appMain(page).getByText(/QR Okut|TC \/ Telefon/).first()).toBeVisible()
    } else {
      await expect(appMain(page).getByText(/Kullandırma kullanılamıyor|Firmanız onaylandıktan sonra/)).toBeVisible()
    }
  })
})

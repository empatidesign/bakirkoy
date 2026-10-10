import { test, expect, type Page } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const API_BASE = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

type ApiEnvelope<T> = { data: T }
type Submission = { id: string; title: string; description: string; categoryId: string }

async function getAccessToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('portal_access_token') ?? sessionStorage.getItem('portal_access_token'))
  expect(token, 'citizen access token should be stored after login').toBeTruthy()
  return token as string
}

test.describe.serial('Citizen yeni başvuru', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('Yeni Başvuru payloadı POST /me/submissions ile oluşturulur', async ({ page }) => {
    const token = await getAccessToken(page)
    const title = `E2E Başvuru ${Date.now()}`
    const response = await page.request.post(`${API_BASE}/api/v1/me/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title,
        description: 'Playwright e2e test başvurusu. Lütfen dikkate almayın.',
        categoryId: 'other',
        submissionType: 'suggestion',
        priority: 'normal',
        neighborhood: '50. Yıl Mahallesi',
        address: 'E2E Test Sokak No: 1',
        latitude: null,
        longitude: null,
        notifyMuhtar: false,
        complaintReason: null,
      },
    })

    expect(response.ok(), 'submission create API should return OK').toBeTruthy()
    const body = await response.json() as ApiEnvelope<Submission>
    expect(body.data.title).toBe(title)
    expect(body.data.categoryId).toBe('other')
  })
})

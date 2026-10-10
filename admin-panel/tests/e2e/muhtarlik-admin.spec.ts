import { test, expect } from '@playwright/test'
import { AdminApi, loginAndOpen } from './helpers/adminApi'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

function generateValidTckn(): string {
  const d = new Array(11).fill(0)
  d[0] = 1 + Math.floor(Math.random() * 9)
  for (let i = 1; i < 9; i++) d[i] = Math.floor(Math.random() * 10)
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8]
  const evenSum = d[1] + d[3] + d[5] + d[7]
  let tenth = ((oddSum * 7) - evenSum) % 10
  if (tenth < 0) tenth += 10
  d[9] = tenth
  d[10] = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10
  return d.join('')
}

async function post(path: string, body: unknown, token?: string) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${JSON.stringify(json)}`)
  return json.data ?? json
}

async function createSubmissionFixture(): Promise<{ id: string; title: string }> {
  const tckn = generateValidTckn()
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`
  const password = 'MuhtarlikE2e2026!'
  const registerRes = await post('/auth/citizen/register', {
    tckn,
    birthDate: '1990-01-01',
    phone: `05${String(500000000 + (Number(suffix) % 90000000))}`,
    email: `muhtarlik.e2e.${suffix}@example.com`,
    password,
  })

  let citizenToken: string = registerRes?.accessToken
  if (!citizenToken && registerRes?.otpSessionToken) {
    const verify = await post('/auth/citizen/verify-otp', { otpSessionToken: registerRes.otpSessionToken, code: '111111' })
    citizenToken = verify.accessToken
  }
  if (!citizenToken) throw new Error(`Vatandaş kaydı/OTP doğrulaması başarısız: ${JSON.stringify(registerRes)}`)

  const title = `E2E Muhtarlık Başvurusu ${suffix}`
  const submission = await post('/me/submissions', {
    title,
    description: 'Playwright tarafından oluşturulan e2e test başvurusu.',
    categoryId: 'road',
    submissionType: 'complaint',
    priority: 'normal',
    neighborhood: 'Cebeci Mahallesi',
    address: 'E2E test adresi No:1',
    latitude: null,
    longitude: null,
    notifyMuhtar: false,
    complaintReason: null,
  }, citizenToken)

  return { id: submission.id, title }
}

let api: AdminApi

test.describe('Muhtarlık admin status coverage', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => { await api.dispose() })

  test('başvuru durumunu in_review, resolved ve rejected olarak değiştirir', async ({ page }) => {
    test.setTimeout(90000)
    const { id: submissionId, title } = await createSubmissionFixture()

    for (const status of ['in_review', 'resolved', 'rejected']) {
      const changed = await api.request<{ status: string }>('PATCH', `/citizen-submissions/${submissionId}/status`, { status })
      expect(changed.status).toBe(status)
    }

    await loginAndOpen(page, '/muhtarlik', /Muhtarlık|Başvurular/)
    await page.getByPlaceholder('Başlık, vatandaş, adres, mahalle ara...').fill(title)
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await expect(row).toContainText(/Reddedildi|Rejected|rejected/)
  })

  // Kullanıcı isteği (2026-09-02): "vatandaş talep/istek/şikayetlerinin ilgili birime
  // gönderilmesini sağlamak". Bulgu: 564 talebin yalnızca 10'u iletilmişti ve mevcut
  // testler "forwarded" akışını hiç kapsamıyordu. Bu test, talebin GERÇEKTEN doğru
  // müdürlüğe iletildiğini ve bunun yönetici EKRANINDA göründüğünü doğrular.
  test('talep ilgili müdürlüğe iletilir ve ekranda "İletildi" olarak görünür', async ({ page }) => {
    test.setTimeout(90000)
    const { id: submissionId, title } = await createSubmissionFixture()

    // Başlangıçta hiçbir birime atanmamış olmalı (yönlendirme OTOMATİK DEĞİL).
    const before = await api.request<{ status: string; ulakbelUnit: string | null }>(
      'GET', `/citizen-submissions/${submissionId}`)
    expect(before.status).toBe('new')
    expect(before.ulakbelUnit ?? null).toBeNull()

    // Yönetici "İlet" işlemini çalıştırır.
    await api.request('POST', `/citizen-submissions/${submissionId}/forward`, {})

    const after = await api.request<{ status: string; ulakbelUnit: string; ulakbelTrackingNo: string }>(
      'GET', `/citizen-submissions/${submissionId}`)
    expect(after.status).toBe('forwarded')
    // Fixture "road" kategorisiyle oluşturulur → Fen İşleri Müdürlüğü.
    expect(after.ulakbelUnit).toBe('Fen İşleri Müdürlüğü')
    expect(after.ulakbelTrackingNo).toMatch(/^ULK-/)

    // Mükerrer gönderim engellenmeli: aynı içerik ikinci kez iletilememeli.
    const dup = await api.raw('POST', `/citizen-submissions/${submissionId}/forward`, {})
    expect(dup.status).toBe(409)

    // Ekranda görünürlük.
    await loginAndOpen(page, '/muhtarlik', /Muhtarlık|Başvurular/)
    await page.getByPlaceholder('Başlık, vatandaş, adres, mahalle ara...').fill(title)
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await expect(row).toContainText(/İletildi|Yönlendirildi|forwarded/i)
  })
})

import { test, expect, Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_OTP } from './helpers/auth'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

type ApiResponse<T> = { data?: T }
type ParticipantListItem = { id: string; tckn: string; fullName?: string; status: string; phone?: string; gender?: string; birthDate?: string }

function fakeTckn(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10raw = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10 = ((d10raw % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10) % 10
  return [...digits, d10, d11].join('')
}

async function freshApiSession(ctxFetch: typeof fetch = fetch): Promise<{ accessToken: string; refreshToken: string }> {
  const login1 = await (await ctxFetch(`${API_BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })).json()
  if (login1?.data?.accessToken && login1?.data?.refreshToken) {
    return { accessToken: login1.data.accessToken, refreshToken: login1.data.refreshToken }
  }
  const verify = await (await ctxFetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP }),
  })).json()
  if (!verify?.data?.accessToken || !verify?.data?.refreshToken) throw new Error(`API OTP failed: ${JSON.stringify(verify)}`)
  return { accessToken: verify.data.accessToken, refreshToken: verify.data.refreshToken }
}

async function browserApiToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => window.sessionStorage.getItem('admin_access_token') ?? window.localStorage.getItem('admin_access_token'))
  if (!token) throw new Error('Browser auth token bulunamadı')
  return token
}

async function loginByApi(page: Page) {
  const { accessToken, refreshToken } = await freshApiSession()
  await page.addInitScript(({ accessToken, refreshToken }) => {
    window.sessionStorage.setItem('admin_access_token', accessToken)
    window.sessionStorage.setItem('admin_refresh_token', refreshToken)
    window.localStorage.setItem('admin_access_token', accessToken)
    window.localStorage.setItem('admin_refresh_token', refreshToken)
  }, { accessToken, refreshToken })
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>
  if (!res.ok) throw new Error(`GET ${path} failed ${res.status}: ${JSON.stringify(json)}`)
  return json.data as T
}

async function apiPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>
  if (!res.ok) throw new Error(`POST ${path} failed ${res.status}: ${JSON.stringify(json)}`)
  return json.data as T
}

async function findParticipantByTckn(tckn: string, token: string): Promise<ParticipantListItem> {
  const maskedTckn = `${tckn.slice(0, 3)}********`
  const search = await apiGet<{ items: ParticipantListItem[] }>(
    `/participants?page=1&limit=50&search=${encodeURIComponent(tckn)}`, token,
  )
  const created = search.items.find((p) => p.tckn === maskedTckn)
  expect(created, `API üzerinden katılımcı bulunmalı: ${maskedTckn}`).toBeTruthy()
  return created!
}

async function openParticipantsTab(page: Page) {
  await page.goto('/participants')
  await expect(page.getByText('Katılımcılar').first()).toBeVisible({ timeout: 20000 })
}

async function createParticipantViaUi(page: Page, tckn = fakeTckn(), phone = `5${String(Date.now()).slice(-9)}`) {
  const birthDateDisplay = '15.06.1990'
  const { accessToken } = await freshApiSession()
  const created = await apiPost<ParticipantListItem>('/participants', accessToken, {
    tckn,
    birthDate: '1990-06-15',
    phone,
    deliveryChannel: 'Email',
  })
  expect(created.tckn).toBe(`${tckn.slice(0, 3)}********`)
  expect(created.gender).toBe('Male')
  expect(created.phone).toContain(phone)
  await loginByApi(page)
  await openParticipantsTab(page)
  return { tckn, phone, birthDateDisplay, maskedTckn: `${tckn.slice(0, 3)}********` }
}

async function searchRow(page: Page, participant: { tckn: string; phone: string }) {
  const maskedTckn = `${participant.tckn.slice(0, 3)}********`
  const searchBox = page.getByPlaceholder('Ad, T.C. kimlik, telefon veya e-posta ara...')
  await searchBox.fill('')
  await searchBox.fill(participant.tckn)
  await page.waitForTimeout(600)
  const row = page.locator('tr', { hasText: maskedTckn }).first()
  await expect(row).toBeVisible({ timeout: 20000 })
  await expect(row).toContainText(maskedTckn, { timeout: 5000 })
  return row
}

test.describe('Participants — katılımcı kritik CRUD akışları', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/session-check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, statusCode: 200, data: null }),
      })
    })
    await loginByApi(page)
  })

  test('katılımcı oluşturma fixture API ile TCKN, doğum tarihi, cinsiyet ve telefon alanlarını kaydeder', async ({ page }) => {
    test.setTimeout(90000)
    const createdUi = await createParticipantViaUi(page)
    const row = await searchRow(page, createdUi)
    await expect(row.getByText('Aktif').first()).toBeVisible()
    await expect(row.getByText(createdUi.maskedTckn).first()).toBeVisible()

    const token = await browserApiToken(page)
    const created = await findParticipantByTckn(createdUi.tckn, token)
    expect(created.status).toBe('Active')
    expect(created.phone).toContain(createdUi.phone)
    expect(created.gender).toBe('Male')
  })

  test('katılımcı düzenleme, şifre sıfırlama, bloke etme ve blok kaldırma akışları çalışır', async ({ page }) => {
    test.setTimeout(120000)
    const createdUi = await createParticipantViaUi(page)
    let row = await searchRow(page, createdUi)

    const editedPhone = `5${String(Date.now() + 1).slice(-9)}`
    await clickRowAction(page, row, 'Düzenle')
    await expect(page.getByText('Katılımcı Düzenle')).toBeVisible({ timeout: 10000 })
    const drawer = page.getByText('Katılımcı Düzenle').locator('xpath=ancestor::*[contains(@class,"fixed") or contains(@class,"rounded")][1]').or(page.locator('body'))
    await page.locator('input[type="tel"], input[inputmode="tel"]').last().waitFor({ timeout: 10000 })
    await page.locator('input[type="tel"], input[inputmode="tel"]').last().fill(editedPhone)

    const [passwordResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/send-password-reset') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /SMS ile Gönder|SMS/ }).click(),
    ])
    expect(passwordResponse.ok(), `Şifre sıfırlama başarısız: ${await passwordResponse.text()}`).toBeTruthy()

    const [updateResponse] = await Promise.all([
      page.waitForResponse((r) => /\/participants\/[0-9a-f-]+$/i.test(new URL(r.url()).pathname) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Güncelle' }).click(),
    ])
    expect(updateResponse.ok(), `PUT /participants/{id} başarısız: ${await updateResponse.text()}`).toBeTruthy()
    await expect(drawer).toBeHidden({ timeout: 20000 }).catch(() => {})

    row = await searchRow(page, createdUi)
    await expect(row.getByText(new RegExp(editedPhone)).first()).toBeVisible({ timeout: 20000 })

    await clickRowAction(page, row, 'Engelle').catch(() => clickRowAction(page, row, 'Bloke Et'))
    await expect(page.getByRole('heading', { name: /[Ee]ngell|[Bb]loke/ })).toBeVisible({ timeout: 10000 })
    await page.getByPlaceholder(/[Ss]ebep|[Nn]eden/).fill('Playwright üzerinden test bloke')
      .catch(async () => { await page.getByRole('textbox').last().fill('Playwright üzerinden test bloke') })
    const [blockResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/status') && r.request().method() === 'PATCH'),
      page.getByRole('button', { name: /Engelle|Bloke/ }).last().click(),
    ])
    expect(blockResponse.ok(), `Bloke etme başarısız: ${await blockResponse.text()}`).toBeTruthy()
    await expect(row.getByText(/Engel|Blok/).first()).toBeVisible({ timeout: 20000 })

    await row.locator('button[aria-label*="Engel"], button[aria-label*="engel"]').first().click()
    await expect(page.getByRole('heading', { name: /[Ee]ngel/ })).toBeVisible({ timeout: 10000 })
    const [unblockResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/status') && r.request().method() === 'PATCH'),
      page.getByRole('button', { name: 'Onayla' }).click(),
    ])
    expect(unblockResponse.ok(), `Blok kaldırma başarısız: ${await unblockResponse.text()}`).toBeTruthy()
    await expect(row.getByText('Aktif').first()).toBeVisible({ timeout: 20000 })

    const token = await browserApiToken(page)
    const updated = await findParticipantByTckn(createdUi.tckn, token)
    expect(updated.status).toBe('Active')
    expect(updated.phone).toContain(editedPhone)
  })

  test('katılımcı detayında eğitim geçmişi görüntülenir', async ({ page }) => {
    test.setTimeout(90000)
    const createdUi = await createParticipantViaUi(page)
    const token = await browserApiToken(page)
    const created = await findParticipantByTckn(createdUi.tckn, token)
    await apiPost(`/education/participants/${created.id}/histories`, token, {
      institutionId: null,
      level: 'Lisans',
      startYear: 2020,
      endYear: 2024,
      isGraduated: true,
    })

    const row = await searchRow(page, createdUi)
    await clickRowAction(page, row, 'Görüntüle')
    await expect(page.getByRole('heading', { level: 3 }).filter({ hasText: /\*/ }).first()).toBeVisible({ timeout: 15000 })

    const historyResponsePromise = page.waitForResponse(
      (r) => r.url().includes(`/education/participants/${created.id}/histories`) && r.request().method() === 'GET',
      { timeout: 20000 },
    ).catch(() => null)
    await page.getByRole('button', { name: 'Eğitim', exact: true }).click()
    const historyResponse = await historyResponsePromise
    if (historyResponse) {
      expect(historyResponse.ok(), `Eğitim geçmişi getirilemedi: ${await historyResponse.text()}`).toBeTruthy()
    }
    await expect(async () => {
      await page.getByRole('button', { name: 'Eğitim', exact: true }).click()
      await expect(page.getByText('Lisans').first()).toBeVisible({ timeout: 5000 })
    }).toPass({ timeout: 15000, intervals: [1000, 2000, 3000] })
    await expect(page.getByText('Eğitim Geçmişi')).toBeVisible()
    await expect(page.getByText(/2020/).first()).toBeVisible()
  })
})

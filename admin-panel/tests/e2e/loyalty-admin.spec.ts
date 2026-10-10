import { test, expect, request as pwRequest, APIRequestContext, Page } from '@playwright/test'
import { login } from './helpers/auth'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!
const MOCK_OTP = '111111'

type Paged<T> = { items: T[] }
type LoyaltyRule = { id: string; actionKey: string; label: string; points: number; isActive: boolean; description?: string | null }
type Reward = { id: string; name: string; pointsRequired: number; stock: number; isActive: boolean; description?: string | null }
type Redemption = { id: string; rewardName: string; participantName: string; status: string; cancelReason?: string | null }

let ctx: APIRequestContext
let adminToken = ''

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

function fakeTckn() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10Pos = ((d10 % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10Pos) % 10
  return [...digits, d10Pos, d11].join('')
}

async function freshAdminToken(): Promise<string> {
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })).json()
  if (login1?.data?.accessToken) { adminToken = login1.data.accessToken; return adminToken }
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  adminToken = verify?.data?.accessToken ?? ''
  if (!adminToken) throw new Error(`Admin API OTP failed: ${JSON.stringify(verify)}`)
  return adminToken
}

async function apiAdminToken(): Promise<string> {
  return adminToken || freshAdminToken()
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, retried = false): Promise<T> {
  const token = await apiAdminToken()
  const res = await ctx.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status() === 401 && !retried) {
    await freshAdminToken()
    return apiRequest(method, path, body, true)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok()) throw new Error(`${method} ${path} failed ${res.status()}: ${JSON.stringify(json)}`)
  return json.data as T
}

async function expectValidationError(method: 'POST' | 'PUT', path: string, body: unknown) {
  const token = await apiAdminToken()
  const res = await ctx.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  expect(res.status(), `${method} ${path}: ${JSON.stringify(json)}`).toBe(400)
  expect(JSON.stringify(json)).toContain('VALIDATION_ERROR')
}

async function registerCitizen(_tag: string): Promise<{ token: string; participantId: string; fullName: string; tckn: string }> {
  const tckn = fakeTckn()
  const email = `e2e.loyalty.${Date.now()}.${Math.random().toString(16).slice(2, 6)}@example.com`
  const phone = `05${String(Date.now()).slice(-9)}`
  const reg = await (await ctx.post(`${API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate: '2000-01-01', phone, email, password: 'E2eLoyalty2026!', guardianPhone: null, guardianEmail: null },
  })).json()
  const otpSessionToken = reg?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`citizen register otp yok: ${JSON.stringify(reg)}`)
  const ver = await (await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken, code: MOCK_OTP },
  })).json()
  const token = ver?.data?.accessToken
  const participantId = ver?.data?.user?.id
  if (!token || !participantId) throw new Error(`citizen token/user yok: ${JSON.stringify(ver)}`)
  return { token, participantId, fullName: ver.data.user.fullName, tckn }
}

async function createPendingRedemption(tag: string) {
  const reward = await apiRequest<Reward>('POST', '/loyalty/rewards', {
    name: `${tag} Talep Hediyesi`, pointsRequired: 5, stock: 5, description: 'Playwright talep fixture', imageUrl: '', isActive: true,
  })
  const citizen = await registerCitizen(tag)
  await apiRequest<void>('POST', '/loyalty/award', {
    participantId: citizen.participantId, points: 20, description: 'Playwright redemption fixture puanı',
  })
  const redeem = await ctx.post(`${API_BASE}/me/loyalty/rewards/redeem`, {
    headers: { Authorization: `Bearer ${citizen.token}`, 'Content-Type': 'application/json' },
    data: { rewardId: reward.id },
  })
  const redeemJson = await redeem.json().catch(() => ({}))
  if (!redeem.ok()) throw new Error(`redeem failed ${redeem.status()}: ${JSON.stringify(redeemJson)}`)
  return { reward, citizen }
}

async function openLoyalty(page: Page, tab = 'rules') {
  await login(page)
  await page.goto(`/loyalty?tab=${tab}`)
  await expect(page.getByRole('heading', { name: 'Sadakat Sistemi' })).toBeVisible({ timeout: 20000 })
}

async function searchAndRow(page: Page, placeholder: string, text: string) {
  await page.getByPlaceholder(placeholder).fill(text)
  const row = page.getByRole('row', { name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()
  await expect(row).toBeVisible({ timeout: 20000 })
  return row
}

test.describe('Loyalty admin panel — tam form CRUD ve validasyon', () => {
  test.beforeAll(async () => { ctx = await pwRequest.newContext() })
  test.afterAll(async () => { await ctx.dispose() })

  test('puan kuralı oluşturur, tüm alanları günceller, pasife alır ve siler', async ({ page }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width: 1600, height: 900 })
    const tag = uniq('E2E Loyalty Rule')
    const actionKey = `e2e_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`
    const updatedLabel = `${tag} Güncel`
    let createdId: string | undefined

    try {
      await openLoyalty(page, 'rules')
      await page.getByRole('button', { name: 'Yeni Kural' }).click()
      await expect(page.getByRole('heading', { name: 'Yeni Kural Ekle' })).toBeVisible()
      await page.getByPlaceholder('örn: event_join').fill(actionKey)
      await page.getByPlaceholder('Kural adı', { exact: true }).fill(tag)
      await page.locator('input[type="number"]').fill('37')
      await page.getByPlaceholder('Bu kural hakkında kısa açıklama').fill('Playwright kural açıklaması')
      const [createResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/loyalty/rules') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Kaydet' }).click(),
      ])
      expect(createResponse.ok(), await createResponse.text()).toBeTruthy()
      const createdRule = (await createResponse.json()).data as LoyaltyRule
      createdId = createdRule.id
      expect(createdRule).toMatchObject({ actionKey, label: tag, points: 37, isActive: true, description: 'Playwright kural açıklaması' })
      await expect(page.getByText('Kural oluşturuldu.')).toBeVisible({ timeout: 20000 })

      await searchAndRow(page, 'Kural adı veya anahtar ara...', tag)

      const ruleRow = await searchAndRow(page, 'Kural adı veya anahtar ara...', tag)
      await clickRowAction(page, ruleRow, 'Düzenle')
      await expect(page.getByRole('heading', { name: 'Kural Düzenle' })).toBeVisible()
      await page.getByPlaceholder('Kural adı', { exact: true }).fill(updatedLabel)
      await page.locator('input[type="number"]').fill('42')
      await page.getByPlaceholder('Bu kural hakkında kısa açıklama').fill('Playwright kural açıklaması güncel')
      const [updateResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/loyalty/rules/${createdId}`) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: 'Güncelle' }).click(),
      ])
      expect(updateResponse.ok(), await updateResponse.text()).toBeTruthy()
      const updatedRule = (await updateResponse.json()).data as LoyaltyRule
      expect(updatedRule).toMatchObject({ label: updatedLabel, points: 42, isActive: true, description: 'Playwright kural açıklaması güncel' })
      await expect(page.getByText('Kural güncellendi.').first()).toBeVisible({ timeout: 20000 })
      await searchAndRow(page, 'Kural adı veya anahtar ara...', updatedLabel)

      await clickRowAction(page, await searchAndRow(page, 'Kural adı veya anahtar ara...', updatedLabel), 'Düzenle')
      await page.getByRole('switch').click()
      const [deactivateResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/loyalty/rules/${createdId}`) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: 'Güncelle' }).click(),
      ])
      expect(deactivateResponse.ok(), await deactivateResponse.text()).toBeTruthy()
      const deactivatedRule = (await deactivateResponse.json()).data as LoyaltyRule
      expect(deactivatedRule.isActive).toBe(false)
      await expect(page.getByText('Kural güncellendi.').first()).toBeVisible({ timeout: 20000 })

      await clickRowAction(page, await searchAndRow(page, 'Kural adı veya anahtar ara...', updatedLabel), 'Sil')
      await expect(page.getByRole('heading', { name: 'Kuralı Sil' })).toBeVisible()
      await page.getByRole('button', { name: 'Evet, Sil' }).click()
      await expect(page.getByText('Kural silindi.')).toBeVisible({ timeout: 20000 })
      createdId = undefined
    } finally {
      if (createdId) await apiRequest<void>('DELETE', `/loyalty/rules/${createdId}`).catch(() => undefined)
    }
  })

  test('hediye oluşturur, tüm alanları günceller, toggle-status yapar ve siler', async ({ page }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width: 1600, height: 900 })
    const name = uniq('E2E Loyalty Reward')
    const updatedName = `${name} Güncel`
    let createdId: string | undefined

    try {
      await openLoyalty(page, 'rewards')
      await expect(page.getByText('Hediye Kataloğu').first()).toBeVisible({ timeout: 20000 })
      await page.getByRole('button', { name: 'Yeni Hediye' }).click()
      await expect(page.getByText('Yeni Hediye Ekle').first()).toBeVisible()
      await page.getByPlaceholder('Hediye adı', { exact: true }).fill(name)
      await page.locator('input[type="number"]').nth(0).fill('75')
      await page.locator('input[type="number"]').nth(1).fill('12')
      await page.getByPlaceholder('Hediye hakkında kısa açıklama').fill('Playwright hediye açıklaması')
      const [createResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/loyalty/rewards') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Kaydet' }).click(),
      ])
      expect(createResponse.ok(), await createResponse.text()).toBeTruthy()
      const createdReward = (await createResponse.json()).data as Reward
      createdId = createdReward.id
      expect(createdReward).toMatchObject({ name, pointsRequired: 75, stock: 12, isActive: true, description: 'Playwright hediye açıklaması' })
      await expect(page.getByText('Hediye oluşturuldu.')).toBeVisible({ timeout: 20000 })
      await page.goto('/loyalty?tab=rewards')
      await expect(page.getByText('Hediye Kataloğu').first()).toBeVisible({ timeout: 20000 })
      await searchAndRow(page, 'Hediye adı ara...', name)

      await clickRowAction(page, await searchAndRow(page, 'Hediye adı ara...', name), 'Düzenle')
      await expect(page.getByText('Hediyeyi Düzenle').first()).toBeVisible()
      await page.getByPlaceholder('Hediye adı', { exact: true }).fill(updatedName)
      await page.locator('input[type="number"]').nth(0).fill('90')
      await page.locator('input[type="number"]').nth(1).fill('7')
      await page.getByPlaceholder('Hediye hakkında kısa açıklama').fill('Playwright hediye açıklaması güncel')
      const [updateResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/loyalty/rewards/${createdId}`) && r.request().method() === 'PUT'),
        page.getByRole('button', { name: 'Güncelle' }).click(),
      ])
      expect(updateResponse.ok(), await updateResponse.text()).toBeTruthy()
      const updatedReward = (await updateResponse.json()).data as Reward
      expect(updatedReward).toMatchObject({ name: updatedName, pointsRequired: 90, stock: 7, description: 'Playwright hediye açıklaması güncel', isActive: true })
      await expect(page.getByText('Hediye güncellendi.')).toBeVisible({ timeout: 20000 })
      await page.goto('/loyalty?tab=rewards')
      await expect(page.getByText('Hediye Kataloğu').first()).toBeVisible({ timeout: 20000 })
      await searchAndRow(page, 'Hediye adı ara...', updatedName)

      const [toggleResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/loyalty/rewards/${createdId}/toggle-status`) && r.request().method() === 'PATCH'),
        clickRowAction(page, await searchAndRow(page, 'Hediye adı ara...', updatedName), 'Pasife Al'),
      ])
      expect(toggleResponse.ok(), await toggleResponse.text()).toBeTruthy()
      const toggledReward = (await toggleResponse.json()).data as Reward
      expect(toggledReward.isActive).toBe(false)
      await expect(page.getByText('Hediye pasife alındı.')).toBeVisible({ timeout: 20000 })

      const [reactivateResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/loyalty/rewards/${createdId}/toggle-status`) && r.request().method() === 'PATCH'),
        clickRowAction(page, await searchAndRow(page, 'Hediye adı ara...', updatedName), 'Aktif Et'),
      ])
      expect(reactivateResponse.ok(), await reactivateResponse.text()).toBeTruthy()
      const reactivatedReward = (await reactivateResponse.json()).data as Reward
      expect(reactivatedReward.isActive).toBe(true)
      await expect(page.getByText('Hediye aktif edildi.')).toBeVisible({ timeout: 20000 })

      await clickRowAction(page, await searchAndRow(page, 'Hediye adı ara...', updatedName), 'Sil')
      await expect(page.getByRole('heading', { name: 'Hediyeyi Sil' })).toBeVisible()
      await page.getByRole('button', { name: 'Evet, Sil' }).click()
      await expect(page.getByText('Hediye silindi.')).toBeVisible({ timeout: 20000 })
      createdId = undefined
    } finally {
      if (createdId) await apiRequest<void>('DELETE', `/loyalty/rewards/${createdId}`).catch(() => undefined)
    }
  })

  test('bekleyen hediye talebini admin panelden iptal eder ve nedeni kaydeder', async ({ page }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width: 1600, height: 900 })
    const tag = uniq('E2E Loyalty Redemption')
    const fixture = await createPendingRedemption(tag)
    const reason = 'Playwright e2e iptal nedeni'

    await openLoyalty(page, 'redemptions')
    await expect(page.getByText('Hediye Talepleri').first()).toBeVisible({ timeout: 20000 })
    await page.getByPlaceholder('Vatandaş adı veya hediye ara...').fill(fixture.reward.name)
    const row = page.getByRole('row', { name: new RegExp(fixture.reward.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await expect(row).toContainText('Bekliyor')
    await row.getByRole('button', { name: /İptal Et/ }).click()
    await expect(page.getByRole('heading', { name: 'Talebi İptal Et' })).toBeVisible()
    await page.getByPlaceholder('İptal sebebi yazın...').fill(reason)
    await page.getByRole('button', { name: 'İptal Et & Puanı İade Et' }).click()
    await expect(page.getByText('Talep iptal edildi, puan iade edildi.')).toBeVisible({ timeout: 20000 })

    const redemptions = await apiRequest<Paged<Redemption>>('GET', `/loyalty/redemptions?page=1&limit=20&search=${encodeURIComponent(fixture.reward.name)}`)
    const redemption = redemptions.items.find((item) => item.rewardName === fixture.reward.name)
    expect(redemption).toMatchObject({ status: 'Cancelled', cancelReason: reason })
  })

  test('yeni FluentValidation kuralları boş isim ve negatif puanı 400 VALIDATION_ERROR ile reddeder', async () => {
    test.setTimeout(60000)
    const validRule = await apiRequest<LoyaltyRule>('POST', '/loyalty/rules', {
      actionKey: `e2e_valid_${Date.now()}`, label: uniq('E2E Valid Rule'), points: 10, description: 'validator update fixture',
    })
    const validReward = await apiRequest<Reward>('POST', '/loyalty/rewards', {
      name: uniq('E2E Valid Reward'), pointsRequired: 10, stock: 2, description: 'validator update fixture', imageUrl: '', isActive: true,
    })

    try {
      await expectValidationError('POST', '/loyalty/rules', { actionKey: `e2e_invalid_${Date.now()}`, label: '', points: 10, description: '' })
      await expectValidationError('POST', '/loyalty/rules', { actionKey: `e2e_invalid_${Date.now()}`, label: 'Negatif Puan', points: -1, description: '' })
      await expectValidationError('PUT', `/loyalty/rules/${validRule.id}`, { actionKey: validRule.actionKey, label: '', points: 10, isActive: true, description: '' })
      await expectValidationError('PUT', `/loyalty/rules/${validRule.id}`, { actionKey: validRule.actionKey, label: 'Negatif Güncelleme', points: -1, isActive: true, description: '' })

      await expectValidationError('POST', '/loyalty/rewards', { name: '', pointsRequired: 10, stock: 1, description: '', imageUrl: '', isActive: true })
      await expectValidationError('POST', '/loyalty/rewards', { name: 'Negatif Ödül', pointsRequired: -1, stock: 1, description: '', imageUrl: '', isActive: true })
      await expectValidationError('PUT', `/loyalty/rewards/${validReward.id}`, { name: '', pointsRequired: 10, stock: 1, description: '', imageUrl: '', isActive: true })
      await expectValidationError('PUT', `/loyalty/rewards/${validReward.id}`, { name: 'Negatif Ödül Güncelleme', pointsRequired: -1, stock: 1, description: '', imageUrl: '', isActive: true })
    } finally {
      await apiRequest<void>('DELETE', `/loyalty/rules/${validRule.id}`).catch(() => undefined)
      await apiRequest<void>('DELETE', `/loyalty/rewards/${validReward.id}`).catch(() => undefined)
    }
  })
})

import { test, expect, Page } from '@playwright/test'
import { login } from './helpers/auth'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

type ApiResponse<T> = { data?: T }
type RoleDetail = { permissionKeys?: string[] }

async function apiToken(): Promise<string> {
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }).then((r) => r.json())

  if (loginRes?.data?.accessToken) return loginRes.data.accessToken
  const otpSessionToken = loginRes?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`API login failed: ${JSON.stringify(loginRes)}`)

  const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken, code: ADMIN_OTP }),
  }).then((r) => r.json())

  const token = verifyRes?.data?.accessToken
  if (!token) throw new Error(`API OTP failed: ${JSON.stringify(verifyRes)}`)
  return token
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({})) as ApiResponse<T>
  if (!res.ok) throw new Error(`GET ${path} failed ${res.status}: ${JSON.stringify(json)}`)
  return json.data as T
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function openAdminTab(page: Page, tabName: RegExp) {
  await page.goto('/admin')
  await expect(page.getByText('Yönetici Hesap Yönetimi')).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: tabName }).click()
}

async function rowContaining(page: Page, text: string) {
  const row = page.locator('tr', { hasText: text }).first()
  await expect(row).toBeVisible({ timeout: 20000 })
  return row
}

test.describe('Admin role and permission scenarios', () => {
  test('RolePermissionModal ile rol oluşturur, yetki atar/kaldırır ve yenileme sonrası kalıcılığı doğrular', async ({ page }) => {
    test.setTimeout(90000)
    const roleName = uniq('E2E UI Rol')
    const roleNameUpdated = `${roleName} Güncel`

    await login(page)

    await openAdminTab(page, /Roller/)
    await expect(page.getByText('Roller').first()).toBeVisible()

    await page.getByRole('button', { name: /\+ Yeni Rol/ }).click()
    await expect(page.getByRole('heading', { name: 'Yeni Rol' })).toBeVisible()
    await page.getByPlaceholder('Rol adını girin (örn. Havuz Personeli)').fill(roleName)
    await page.getByPlaceholder('Bu rolün ne işe yaradığını kısaca açıklayın (opsiyonel)').fill('Playwright rol kaydı')

    await page.getByRole('button', { name: 'Temizle' }).click()
    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByText(/en az bir yetkiye sahip olmalıdır/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Yeni Rol' }), 'validasyon hatasında modal kapanmamalı').toBeVisible()

    await page.getByRole('button', { name: 'Sadece Görüntüleme' }).click()
    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByText(roleName).first()).toBeVisible({ timeout: 20000 })

    const roleRow = await rowContaining(page, roleName)
    await roleRow.locator('button[aria-label="Düzenle"]').click()
    await expect(page.getByRole('heading', { name: 'Rolü Düzenle' })).toBeVisible()
    await page.getByPlaceholder('Rol adını girin (örn. Havuz Personeli)').fill(roleNameUpdated)

    await page.getByRole('button', { name: 'Tümünü Seç' }).click()
    await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click()
    await expect(page.getByText(roleNameUpdated).first()).toBeVisible({ timeout: 20000 })

    await page.reload()
    await expect(page.getByText('Yönetici Hesap Yönetimi')).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: /Roller/ }).click()
    await page.getByPlaceholder('Rol adı veya açıklama ara...').fill(roleNameUpdated)
    await expect(page.getByText(roleNameUpdated).first()).toBeVisible({ timeout: 20000 })

    const token = await apiToken()
    const roleSearch = await apiGet<{ items: Array<{ id: string }> }>(`/roles?page=1&limit=100&search=${encodeURIComponent(roleNameUpdated)}`, token)
    const createdRole = roleSearch.items[0]
    expect(createdRole?.id, 'UI-created role id').toBeTruthy()
    const detail = await apiGet<RoleDetail>(`/roles/${createdRole.id}`, token)
    expect((detail.permissionKeys ?? []).length, 'kalıcı kaydedilen yetki sayısı > 0').toBeGreaterThan(0)
  })
  test('Roller tablo görünümü: sütunlar, sıralama, yetki ve yönetici tıklama, kart geçişi', async ({ page }) => {
    test.setTimeout(60000)
    await login(page)
    await openAdminTab(page, /Roller/)

    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 20000 })
    for (const h of ['Rol', 'Açıklama', 'Yetki', 'Yönetici', 'Durum', 'İşlemler']) {
      await expect(table.locator('th', { hasText: h }).first()).toBeVisible()
    }

    const names = async () => (await table.locator('tbody tr td:nth-child(2) button').allInnerTexts()).filter(Boolean)
    const asc = await names()
    expect(asc.length).toBeGreaterThan(1)
    await table.locator('th', { hasText: 'Rol' }).first().click()
    await expect.poll(async () => (await names())[0]).toBe([...asc].sort((a, b) => b.localeCompare(a, 'tr'))[0])

    await table.locator('th', { hasText: 'Yönetici' }).first().click()
    await table.locator('th', { hasText: 'Yönetici' }).first().click()
    const topAdmins = table.locator('tbody tr').first().getByText(/\d+ yönetici/)
    await expect(topAdmins).toBeVisible()
    await topAdmins.click()
    await expect(page.getByText('Atanmış Yöneticiler').first()).toBeVisible({ timeout: 10000 })
    const header = page.locator('.pilot-form-header').last()
    const titleColor = await header.locator('h3').evaluate((el) => getComputedStyle(el).color)
    expect(titleColor).toBe('rgb(255, 255, 255)')
    const headerBg = await header.evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(headerBg).toContain('gradient')
    expect(await header.locator('[style*="background"]').count()).toBe(0)
    await page.keyboard.press('Escape')

    await table.locator('tbody tr').first().getByRole('button', { name: /yetki/ }).click()
    await expect(page.getByRole('heading').filter({ hasText: /Rol/ }).first()).toBeVisible({ timeout: 10000 })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Kart' }).click()
    await expect(page.locator('table')).toHaveCount(0)
    await expect(page.locator('button[aria-label="Düzenle"]').first()).toBeVisible()
  })
})

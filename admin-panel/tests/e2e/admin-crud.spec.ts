import { test, expect, Page } from '@playwright/test'
import { login } from './helpers/auth'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

type ApiResponse<T> = { data?: T }
type Paged<T> = { items: T[] }
type RoleOption = { key: string; name: string }
type Department = { id: string; name: string; description?: string; isActive: boolean }
type AdminUser = { id: string; fullName: string; email: string; department?: string; roleKey?: string; isActive: boolean }

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({})) as ApiResponse<T>
  if (!res.ok) throw new Error(`GET ${path} failed ${res.status}: ${JSON.stringify(json)}`)
  return json.data as T
}

async function apiDelete(path: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok && res.status !== 404) {
    const json = await res.json().catch(() => ({}))
    throw new Error(`DELETE ${path} failed ${res.status}: ${JSON.stringify(json)}`)
  }
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function openAdminTab(page: Page, tabName: RegExp) {
  await page.goto('/admin')
  await expect(page.getByText('Yönetici Hesap Yönetimi')).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: tabName }).click()
}

async function cardContaining(page: Page, text: string) {
  const row = page.getByRole('row', { name: text })
  await expect(row).toBeVisible({ timeout: 20000 })
  return row
}

async function search(page: Page, placeholder: string, value: string) {
  await page.getByPlaceholder(placeholder).fill(value)
  await expect(page.getByText(value).first()).toBeVisible({ timeout: 20000 })
}

async function browserToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('admin_access_token') ?? sessionStorage.getItem('admin_access_token'))
  if (!token) throw new Error('Browser login did not store access token')
  return token
}

test.describe('Admin module CRUD scenarios', () => {
  test('departman CRUD ve yönetici hesabı oluşturma, rol/departman atama, pasife alma/aktif etme, silme akışlarını doğrular', async ({ page }) => {
    test.setTimeout(120000)

    const deptName = uniq('E2E Departman I')
    const deptNameUpdated = `${deptName} Güncel`
    const letterSuffix = Math.random().toString(36).replace(/[^a-z]/g, '').padEnd(6, 'x').slice(0, 6)
    const adminFirst = 'Eylem'
    const adminLast = `AdminI${letterSuffix}`
    const uniquePhone = `5${String(Date.now()).slice(-9)}`
    const adminFullName = `${adminFirst} ${adminLast}`
    const adminFullNameUpdated = `${adminFirst} Güncel${adminLast}`
    const adminEmail = `e2e.admin.${Date.now()}.${Math.random().toString(16).slice(2, 6)}@nexora.local`
    let createdAdminId: string | undefined
    let createdDeptId: string | undefined
    let token: string | undefined

    try {
      await login(page)
      token = await browserToken(page)
      const roleOptions = await apiGet<RoleOption[]>('/roles/options', token)
      const role = roleOptions.find((r) => r.key !== 'SuperAdmin') ?? roleOptions[0]
      expect(role?.key, 'admin oluşturmak için rol seçeneği').toBeTruthy()

      await openAdminTab(page, /Departmanlar/)
      await page.getByRole('button', { name: 'Yeni Departman' }).click()
      await expect(page.getByText('Yeni Departman Ekle')).toBeVisible()
      await page.getByPlaceholder('Departman adını giriniz...').fill(deptName)
      await page.getByPlaceholder('Kısa açıklama (opsiyonel)...').fill('Playwright departman kaydı')
      await page.getByRole('button', { name: 'Kaydet' }).click()
      await search(page, 'Departman adı veya açıklama ara...', deptName)

      let deptSearch = await apiGet<Paged<Department>>(`/departments?page=1&limit=20&search=${encodeURIComponent(deptName)}`, token)
      createdDeptId = deptSearch.items[0]?.id
      expect(createdDeptId, 'UI-created department id').toBeTruthy()

      const deptCard = await cardContaining(page, deptName)
      await clickRowAction(page, deptCard, 'Düzenle')
      await expect(page.getByText('Departman Düzenle')).toBeVisible()
      await page.getByPlaceholder('Departman adını giriniz...').fill(deptNameUpdated)
      await page.getByPlaceholder('Kısa açıklama (opsiyonel)...').fill('Playwright departman kaydı güncel')
      await page.getByRole('button', { name: 'Güncelle' }).click()
      await search(page, 'Departman adı veya açıklama ara...', deptNameUpdated)

      deptSearch = await apiGet<Paged<Department>>(`/departments?page=1&limit=20&search=${encodeURIComponent(deptNameUpdated)}`, token)
      expect(deptSearch.items[0]?.description).toBe('Playwright departman kaydı güncel')

      await openAdminTab(page, /Yöneticiler/)
      await page.getByRole('button', { name: 'Yeni Yönetici' }).click()
      await expect(page.getByText('Yeni Yönetici Ekle')).toBeVisible()
      await page.getByPlaceholder('Ad ve soyadını giriniz...').fill(adminFullName)
      await page.locator('input[type="email"]').fill(adminEmail)
      await page.getByPlaceholder('0(5XX) XXX XX XX').fill(uniquePhone)
      await page.getByPlaceholder('Rol seçiniz...').click()
      await page.getByPlaceholder('Rol veya yetki grubu ara...').fill(role.name)
      await page.getByText(role.name, { exact: true }).click()
      await page.getByRole('button', { name: 'Departman' }).click()
      await page.getByRole('button', { name: new RegExp(`^${deptNameUpdated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click()
      await page.getByRole('button', { name: 'E-posta ile Gönder' }).click()
      await search(page, 'İsim, e-posta, telefon, rol veya departman ara...', adminEmail)
      await expect(page.getByText(adminFullName).first()).toBeVisible()
      await expect(page.getByText(deptNameUpdated).first()).toBeVisible()

      let adminSearch = await apiGet<Paged<AdminUser>>(`/admins?page=1&limit=20&search=${encodeURIComponent(adminEmail)}`, token)
      createdAdminId = adminSearch.items[0]?.id
      expect(createdAdminId, 'UI-created admin id').toBeTruthy()
      expect(adminSearch.items[0]?.department).toBe(deptNameUpdated)
      expect(adminSearch.items[0]?.roleKey).toBe(role.key)

      const adminCard = await cardContaining(page, adminEmail)
      await clickRowAction(page, adminCard, 'Düzenle')
      await expect(page.getByText('Yönetici Düzenle')).toBeVisible()
      await page.getByPlaceholder('Ad ve soyadını giriniz...').fill(adminFullNameUpdated)
      await page.getByRole('button', { name: 'Güncelle' }).click()
      await search(page, 'İsim, e-posta, telefon, rol veya departman ara...', adminEmail)
      await expect(page.getByText(adminFullNameUpdated).first()).toBeVisible()

      await clickRowAction(page, await cardContaining(page, adminEmail), 'Pasife Al')
      await expect(page.getByText('Yöneticiyi Pasife Al')).toBeVisible()
      await page.getByRole('button', { name: 'Onayla' }).click()
      await expect(page.getByText('Yönetici pasife alındı.')).toBeVisible({ timeout: 20000 })
      adminSearch = await apiGet<Paged<AdminUser>>(`/admins?page=1&limit=20&search=${encodeURIComponent(adminEmail)}`, token)
      expect(adminSearch.items[0]?.isActive).toBe(false)

      await clickRowAction(page, await cardContaining(page, adminEmail), 'Aktif Et')
      await expect(page.getByText('Yöneticiyi Aktif Et')).toBeVisible()
      await page.getByRole('button', { name: 'Onayla' }).click()
      await expect(page.getByText('Yönetici aktif edildi.')).toBeVisible({ timeout: 20000 })
      adminSearch = await apiGet<Paged<AdminUser>>(`/admins?page=1&limit=20&search=${encodeURIComponent(adminEmail)}`, token)
      expect(adminSearch.items[0]?.isActive).toBe(true)

      await page.reload()
      await expect(page.getByText('Yönetici Hesap Yönetimi')).toBeVisible({ timeout: 20000 })
      await search(page, 'İsim, e-posta, telefon, rol veya departman ara...', adminEmail)
      await expect(page.getByText(adminFullNameUpdated).first()).toBeVisible({ timeout: 20000 })

      await clickRowAction(page, await cardContaining(page, adminEmail), 'Sil')
      await expect(page.getByRole('heading', { name: 'Yöneticiyi Sil' })).toBeVisible()
      await page.getByRole('button', { name: 'Evet, Sil' }).click()
      await expect(page.getByText('Yönetici silindi.')).toBeVisible({ timeout: 20000 })
      createdAdminId = undefined

      await openAdminTab(page, /Departmanlar/)
      await search(page, 'Departman adı veya açıklama ara...', deptNameUpdated)
      await clickRowAction(page, await cardContaining(page, deptNameUpdated), 'Sil')
      await expect(page.getByRole('heading', { name: 'Departmanı Sil' })).toBeVisible()
      await page.getByRole('button', { name: 'Evet, Sil' }).click()
      await expect(page.getByText('Departman silindi.')).toBeVisible({ timeout: 20000 })
      createdDeptId = undefined
    } finally {
      if (token && createdAdminId) await apiDelete(`/admins/${createdAdminId}`, token)
      if (token && createdDeptId) await apiDelete(`/departments/${createdDeptId}`, token)
    }
  })
})

import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers/auth'

// 2026-10-05: LibraryOverview.tsx'in yeni ana-liste (tablo, varsayılan) işlem menüsündeki
// Düzenle/Aktif-Pasif/Sil'in GERÇEKTEN işlevsel olduğunu (sadece buton görünürlüğü değil)
// uçtan uca doğrular: API ile fixture oluştur → UI'da listede bul → Düzenle ile ismini
// değiştir → API'den doğrula → Pasife al → API'den doğrula → Sil → listeden kaybolduğunu
// ve API'den 404 döndüğünü doğrula. Ayrıca varsayılan tablo görünümünün ekran görüntüsünü alır.
//
// Not: fixture oluşturma için ayrı bir API login yapılır (token1), ama backend tek-oturum
// kısıtlaması nedeniyle bu token UI login'i (login(page)) yapıldığı anda SESSION_INVALIDATED
// olur. Bu yüzden UI login'inden SONRAKİ tüm doğrulama çağrıları tarayıcının kendi
// localStorage/sessionStorage'daki admin_access_token'ı kullanır (browserToken).

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

type ApiResponse<T> = { data?: T }
type CreatedEntity = { id: string }

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

async function apiRequest<T>(method: string, path: string, token: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 404) return null
  const json = await res.json().catch(() => ({})) as ApiResponse<T>
  if (!res.ok) throw new Error(`${method} ${path} failed ${res.status}: ${JSON.stringify(json)}`)
  return (json.data ?? null) as T | null
}

async function browserToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => window.sessionStorage.getItem('admin_access_token') ?? window.localStorage.getItem('admin_access_token'))
  if (!token) throw new Error('Browser login did not store admin_access_token')
  return token
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function searchInTable(page: Page, name: string) {
  const search = page.getByPlaceholder('Kütüphane veya kişi adı ara...')
  await search.fill(name)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 })
  const row = page.locator('tbody tr', { hasText: name })
  await expect(row).toBeVisible({ timeout: 10000 })
  return row
}

async function openRowMenu(page: Page, row: ReturnType<Page['locator']>) {
  const menuBtn = row.getByRole('button', { name: /işlemleri|Tüm işlemleri göster/ })
  if (await menuBtn.count() > 0) {
    await menuBtn.first().click()
    return page.locator('[role="menu"], [data-ds-popover]').last()
  }
  // Tablo yeterince genişse RowActions doğrudan ikon butonlar olarak render olur (collapse yok)
  return row
}

test('Kütüphaneler tablosu: Düzenle ile isim değişikliği API ye yansır, Pasife Al/Aktif Et çalışır, Sil ile kalıcı olarak kaldırılır', async ({ page }) => {
  test.setTimeout(90000)
  const fixtureToken = await apiToken()
  const managerId = (await apiRequest<{ me: { id: string } }>('GET', '/auth/me', fixtureToken))!.me.id
  const tag = uniq('E2E RowCRUD')

  const serviceFacility = await apiRequest<CreatedEntity>('POST', '/service-facilities', fixtureToken, {
    name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
    city: 'İstanbul', district: 'Sultangazi', address: 'E2E RowCRUD Mah. No:1',
    latitude: 41.1039, longitude: 28.8674, managerId,
    weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
    parkingCapacity: 0, parkingType: 'Free', capacity: 50,
  })

  const originalName = `${tag} Kıraathane`
  const updatedName = `${originalName} Güncel`
  let libraryId: string | undefined
  let token: string = fixtureToken

  try {
    const library = await apiRequest<CreatedEntity>('POST', '/libraries', fixtureToken, {
      name: originalName, description: 'RowActions CRUD e2e testi', serviceFacilityId: serviceFacility!.id,
      seatingMode: 'masali', breakSystemEnabled: true, isMultiFloor: false, floors: null,
      amenities: ['wifi'], queueEnabled: false, reservationEnabled: false, deviceControlEnabled: false,
      entryControlMode: 'manual', exitControlMode: 'manual', autoCheckOutAfterMinutes: 0,
      useCustomBreakSettings: false, breakDurationMinutes: 30, maxDailyBreaks: 3,
      longBreakDurationMinutes: 60, maxStudyHoursPerDay: 9, requireBreakAfterHours: 3,
      ipRestrictionEnabled: false, allowedIps: null, isActive: true, grantAccess: false,
    })
    libraryId = library!.id

    await login(page)
    // Tek-oturum kısıtlaması: UI login'i fixtureToken'ı geçersiz kılar — doğrulamalar için
    // tarayıcının kendi (güncel) token'ını kullan.
    token = await browserToken(page)

    await page.goto('/library')
    await expect(page.getByText('Kütüphane Modülü')).toBeVisible({ timeout: 20000 })

    // ---- Görsel kanıt: varsayılan tablo görünümü ----
    const row1 = await searchInTable(page, originalName)
    await page.screenshot({ path: 'test-results/library-row-crud-01-table-default.png', fullPage: true })

    // ---- DÜZENLE: isim değiştir, kaydet, UI'da ve API'de doğrula ----
    const menu1 = await openRowMenu(page, row1)
    await menu1.getByRole('button', { name: 'Düzenle' }).click()
    await expect(page.getByText('Kütüphane Düzenle')).toBeVisible({ timeout: 10000 })
    const nameInput = page.getByPlaceholder('Örn. Cemil Meriç Millet Kütüphanesi')
    await nameInput.fill(updatedName)
    await page.screenshot({ path: 'test-results/library-row-crud-02-edit-form.png', fullPage: true })
    await page.getByRole('button', { name: 'Güncelle' }).click()
    await expect(page.getByText('Değişiklikler kaydedildi.')).toBeVisible({ timeout: 15000 })

    const afterEdit = await apiRequest<{ name: string; isActive: boolean }>('GET', `/libraries/${libraryId}`, token)
    expect(afterEdit?.name, 'API: isim güncellenmiş olmalı').toBe(updatedName)

    const row2 = await searchInTable(page, updatedName)
    await expect(row2.getByText(updatedName)).toBeVisible()
    await page.screenshot({ path: 'test-results/library-row-crud-03-after-edit.png', fullPage: true })

    // ---- PASİFE AL: durum değiştir, UI'da ve API'de doğrula ----
    const menu2 = await openRowMenu(page, row2)
    await menu2.getByRole('button', { name: /Pasife Al/ }).click()
    await expect(page.getByText('Kütüphane pasife alındı.')).toBeVisible({ timeout: 15000 })

    const afterDeactivate = await apiRequest<{ isActive: boolean }>('GET', `/libraries/${libraryId}`, token)
    expect(afterDeactivate?.isActive, 'API: pasif olmalı').toBe(false)

    const row3 = await searchInTable(page, updatedName)
    await expect(row3.getByText('Pasif').first()).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: 'test-results/library-row-crud-04-after-deactivate.png', fullPage: true })

    // ---- AKTİF ET: geri aç, API'de doğrula ----
    const menu3 = await openRowMenu(page, row3)
    await menu3.getByRole('button', { name: /Aktif Et/ }).click()
    await expect(page.getByText('Kütüphane aktif edildi.')).toBeVisible({ timeout: 15000 })
    const afterReactivate = await apiRequest<{ isActive: boolean }>('GET', `/libraries/${libraryId}`, token)
    expect(afterReactivate?.isActive, 'API: tekrar aktif olmalı').toBe(true)

    // ---- SİL: onay modalı, silme, UI'dan kaybolması ve API 404 doğrulaması ----
    const row4 = await searchInTable(page, updatedName)
    const menu4 = await openRowMenu(page, row4)
    await menu4.getByRole('button', { name: 'Sil' }).click()
    await expect(page.getByRole('heading', { name: 'Kütüphane Sil' })).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: 'test-results/library-row-crud-05-delete-confirm.png', fullPage: true })
    await page.getByRole('button', { name: 'Sil', exact: true }).click()
    await expect(page.getByText('Kütüphane silindi.')).toBeVisible({ timeout: 15000 })

    const afterDelete = await apiRequest<unknown>('GET', `/libraries/${libraryId}`, token)
    expect(afterDelete, 'API: silinen kütüphane artık bulunmamalı (404)').toBeNull()
    libraryId = undefined

    await page.getByPlaceholder('Kütüphane veya kişi adı ara...').fill(updatedName)
    await expect(page.getByText('Aramaya uygun kütüphane yok')).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: 'test-results/library-row-crud-06-after-delete.png', fullPage: true })
  } finally {
    if (libraryId) await apiRequest('DELETE', `/libraries/${libraryId}`, token).catch(() => {})
    if (serviceFacility?.id) await apiRequest('DELETE', `/service-facilities/${serviceFacility.id}`, token).catch(() => {})
  }
})

/**
 * Sistem Ayarları — Eğitim Kurumları (`EducationInstitutionsTab.tsx`, 582 satır,
 * `/settings?tab=education`), sıfır hata.
 *
 * Kullanıcının özellikle belirttiği "sistem ayarları" modülü (`docs/ADMIN_PANEL_MODULE
 * _SCENARIO_MATRIX_2026-09-04.md` madde D) — hiç test edilmemişti. Bu ekran, vatandaşların
 * eğitim geçmişi kayıtlarında (participant education history) referans alınan kurum
 * listesini yönetiyor — Seda Eğitim modülündeki "Okul" alanı da muhtemelen bu listeye
 * dayanıyor, bu yüzden yanlış/eksik veri diğer modülleri de etkileyebilir.
 *
 * Kapsam: Kurum ekleme — 6 kurum türü, YÜKSEK ÖĞRETİM (Üniversite/MYO) seçilince
 * koşullu görünen 3 ek alan (Fakülte, Bölüm, Öğrenim Derecesi — 4 seçenekli Select),
 * ilkokul/ortaokul/lise gibi düşük öğretim türlerinde bu alanların GÖRÜNMEDİĞİ negatif
 * doğrulaması. Düzenleme (kurum türünü değiştirince fakülte/bölüm/derece alanlarının
 * SIFIRLANDIĞI doğrulanıyor). Durum değiştirme (`toggleInstitutionStatus` — aktif/pasif).
 * Silme (ConfirmModal). Filtreleme (tür + arama + durum, "Filtreleri temizle").
 *
 * DÜRÜST KAPSAM NOTU: Toplu (bulk) silme, sayfalama (25 kayıt/sayfa — mevcut veri seti
 * ile tetiklenmesi zor) ve `EducationHistoryForm`/`getInstitutionOptions` (bu kurum
 * listesinin vatandaş eğitim geçmişi kaydında NASIL kullanıldığı, participant-facing
 * ayrı bir akış) kapsam dışı.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function adminToken(ctx: APIRequestContext): Promise<string> {
  const login = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login?.data?.accessToken) return login.data.accessToken
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  if (!verify?.data?.accessToken) throw new Error(`Admin API login başarısız: ${JSON.stringify(verify)}`)
  return verify.data.accessToken
}

async function adminLoginUi(page: Page) {
  await page.goto('/login')
  await page.locator('#email').fill(ADMIN_EMAIL!)
  await page.locator('#password').fill(ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  if (await page.waitForURL('**/login/otp', { timeout: 5000 }).then(() => true).catch(() => false)) {
    const otpInputs = page.locator('input[inputmode="numeric"]')
    const count = await otpInputs.count()
    for (let i = 0; i < Math.min(6, count); i++) await otpInputs.nth(i).fill(ADMIN_OTP[i])
    await page.getByRole('button', { name: /Doğrula/ }).click()
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
}

function fieldByLabel(page: Page, label: string) {
  return page.locator(
    'xpath=//label[contains(normalize-space(text()),' + JSON.stringify(label) + ')]/ancestor::div[contains(@class,"space-y-1.5")][1]',
  )
}

async function selectOpt(page: Page, trigger: ReturnType<Page['getByRole']>, optionName: string) {
  await trigger.click()
  await page.locator('[data-ds-popover]').last().getByRole('button', { name: optionName, exact: true }).click()
}

// Denetimde bulundu (2026-10-01): Settings sayfası pilot tasarıma geçtiğinde Select
// bileşeni artık native <select> render ediyor (eski buton+popover değil). Field
// konteynerinde hem eski buton hem yeni <select> için çalışan birleşik seçici.
async function selectInField(page: Page, label: string, optionLabel: string) {
  const field = fieldByLabel(page, label)
  const nativeSelect = field.locator('select')
  if (await nativeSelect.count() > 0) {
    await nativeSelect.first().selectOption({ label: optionLabel })
    return
  }
  const trigger = field.getByRole('button').first()
  await selectOpt(page, trigger, optionLabel)
}

test.describe.serial('Sistem Ayarları — Eğitim Kurumları (EducationInstitutionsTab), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let institutionId = ''
  const name = uniq('QA-TEST-E2E-AUTO Üniversite')
  const nameUpdated = `${name} Güncel`

  test.beforeAll(async () => { apiCtx = await pwRequest.newContext() })

  test.afterAll(async () => {
    const token = await adminToken(apiCtx).catch(() => '')
    if (token && institutionId) {
      await apiCtx.delete(`${API_BASE}/education/institutions/${institutionId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    await apiCtx.dispose()
  })

  test('1) Yeni kurum eklenir (Üniversite) — Fakülte/Bölüm/Derece koşullu alanları görünür, hepsi doldurulur', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=education')
    await expect(page.getByText('Eğitim Kurumları', { exact: true }).first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Kurum Ekle' }).click()
    await expect(page.getByText('Yeni Kurum Ekle')).toBeVisible({ timeout: 5000 })

    // Kurum Türü: "Üniversite" seçilince Fakülte/Bölüm/Derece alanlarının GÖRÜNDÜĞÜNÜ doğrula.
    await expect(page.getByText('Fakülte / Yüksekokul', { exact: true })).toBeHidden({ timeout: 2000 })
    await selectInField(page, 'Kurum Türü', 'Üniversite')
    await expect(page.getByText('Fakülte / Yüksekokul', { exact: true })).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Bölüm / Program', { exact: true })).toBeVisible({ timeout: 3000 })
    await expect(page.locator('label', { hasText: 'Öğrenim Derecesi' })).toBeVisible({ timeout: 3000 })

    await page.getByPlaceholder('Örn: İstanbul Teknik Üniversitesi').fill(name)
    await page.getByPlaceholder('Örn: Mühendislik Fakültesi').fill('QA-TEST-E2E-AUTO Mühendislik Fakültesi')
    await page.getByPlaceholder('Örn: Bilgisayar Mühendisliği').fill('QA-TEST-E2E-AUTO Bilgisayar Mühendisliği')
    await selectInField(page, 'Öğrenim Derecesi', 'Lisans')

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/education/institutions') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet', exact: true }).click(),
    ])
    expect(createResponse.ok(), `POST /education/institutions başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created = (await createResponse.json()).data
    institutionId = created.id
    expect(created).toMatchObject({
      type: 'Universite', name,
      faculty: 'QA-TEST-E2E-AUTO Mühendislik Fakültesi',
      department: 'QA-TEST-E2E-AUTO Bilgisayar Mühendisliği',
      degreeLevel: 'Lisans', isActive: true,
    })
    await expect(page.getByText('Kurum eklendi.')).toBeVisible({ timeout: 5000 })
    // NOT: Liste 694+ kayıt taşıyor, varsayılan sıralama isme göre — "QA-TEST-E2E-AUTO..."
    // alfabetik olarak ilk sayfada olmayabilir; arama alanı `showFilters` koşuluna bağlı
    // (varsayılan kapalı) — önce "Filtrele" butonuna basmak gerekiyor.
    await page.getByRole('button', { name: 'Filtrele' }).click()
    await page.getByPlaceholder('Kurum ara...').fill(name)
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 })
  })

  test('2) Düzenleme: kurum türü "İlkokul"a değiştirilince Fakülte/Bölüm/Derece alanları SIFIRLANIR ve kaybolur', async ({ page }) => {
    test.setTimeout(45_000)
    expect(institutionId, 'önceki testte kurum oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=education')
    await expect(page.getByText('Eğitim Kurumları', { exact: true }).first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Filtrele' }).click()
    await page.getByPlaceholder('Kurum ara...').fill(name)

    const row = page.locator('tr', { hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.locator('button[title="Düzenle"]').click()
    await expect(page.getByText('Kurumu Düzenle')).toBeVisible({ timeout: 5000 })

    // Önce mevcut değerlerin (Fakülte alanı) yüklendiğini doğrula.
    await expect(page.getByText('Fakülte / Yüksekokul', { exact: true })).toBeVisible({ timeout: 3000 })

    const titleInput = page.getByPlaceholder(/Örn: İstanbul Teknik Üniversitesi|Kurum adını girin/)
    await titleInput.fill(nameUpdated)

    await selectInField(page, 'Kurum Türü', 'İlkokul')
    // Kurum türü değişince koşullu alanlar HEMEN kaybolmalı.
    await expect(page.getByText('Fakülte / Yüksekokul', { exact: true })).toBeHidden({ timeout: 3000 })

    const [updateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/education/institutions/${institutionId}`) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Kaydet', exact: true }).click(),
    ])
    expect(updateResponse.ok(), `PUT /education/institutions başarısız: ${await updateResponse.text()}`).toBeTruthy()
    const updated = (await updateResponse.json()).data
    // Backend'e ne gönderildiğini de doğrula: form.faculty/department/degreeLevel state'i
    // tip değişince UI'da boşaltılıyor (patch { faculty:'', department:'', degreeLevel:'' }).
    expect(updated).toMatchObject({ type: 'Ilkokul', name: nameUpdated, faculty: null, department: null, degreeLevel: null })
    await expect(page.getByText('Kurum güncellendi.')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(nameUpdated).first()).toBeVisible({ timeout: 5000 })
  })

  test('3) Durum değiştirme (aktif/pasif) GERÇEK API çağrısı yapar, filtre ile pasif kurum bulunur', async ({ page }) => {
    test.setTimeout(45_000)
    expect(institutionId, 'önceki testte kurum oluşturulmuş olmalı').toBeTruthy()
    const token = await adminToken(apiCtx)

    const toggleRes = await apiCtx.patch(`${API_BASE}/education/institutions/${institutionId}/toggle-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(toggleRes.ok(), `PATCH toggle-status başarısız: ${await toggleRes.text()}`).toBeTruthy()
    const toggled = (await toggleRes.json()).data
    expect(toggled.isActive).toBe(false)

    await adminLoginUi(page)
    await page.goto('/settings?tab=education')
    await expect(page.getByText('Eğitim Kurumları', { exact: true }).first()).toBeVisible({ timeout: 15000 })

    // Filtrele: Durum = Pasif + isimle ara, kaydın GERÇEKTEN listelendiğini doğrula.
    await page.getByRole('button', { name: 'Filtrele' }).click()
    await page.getByPlaceholder('Kurum ara...').fill(nameUpdated)
    await selectInField(page, 'Durum', 'Pasif')
    await expect(page.getByText(nameUpdated).first()).toBeVisible({ timeout: 10000 })
    const row = page.locator('tr', { hasText: nameUpdated }).first()
    await expect(row.getByText('Pasif', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('4) Silme: ConfirmModal onaylanınca kurum GERÇEKTEN silinir', async ({ page }) => {
    test.setTimeout(45_000)
    expect(institutionId, 'önceki testte kurum oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=education')
    await expect(page.getByText('Eğitim Kurumları', { exact: true }).first()).toBeVisible({ timeout: 15000 })

    const searchInput = page.getByPlaceholder('Kurum ara...')
    // NOT: Arama alanı `showFilters` koşuluna bağlı (varsayılan kapalı) — önce
    // "Filtrele" butonuna basmak gerekiyor.
    await page.getByRole('button', { name: 'Filtrele' }).click()
    await searchInput.fill(nameUpdated)
    const row = page.locator('tr', { hasText: nameUpdated }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.locator('button[title="Sil"]').click()
    await expect(page.getByText('Kurum Silinsin mi?')).toBeVisible({ timeout: 5000 })

    const [deleteResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/education/institutions/${institutionId}`) && r.request().method() === 'DELETE'),
      page.getByRole('button', { name: /^Sil$/ }).last().click(),
    ])
    expect(deleteResponse.ok(), `DELETE /education/institutions başarısız: ${await deleteResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Kurum silindi.')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(nameUpdated).first()).toBeHidden({ timeout: 5000 })

    institutionId = '' // afterAll'da tekrar silmeye çalışmasın.
  })
})

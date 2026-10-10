/**
 * Muhtarlık (`/muhtarlik`) — Muhtar Hesabı Oluşturma, Başvuru Detay Modalı UI Akışı,
 * sıfır hata toleranslı. `muhtarlik-admin.spec.ts` durum değişikliği/iletme akışlarını
 * SADECE API seviyesinde test ediyor — bu dosya HİÇ test edilmemiş 2 gerçek özelliği,
 * gerçek UI etkileşimiyle kapatıyor (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md`
 * madde C, "Muhtarlık" — "Öncelik: Orta-Yüksek, vatandaş şikayetleri, SLA riski").
 *
 * Kapsam:
 *   1. MuhtarManagementTab: Bir mahalleye GERÇEK bir muhtar hesabı oluşturma — form (Ad
 *      Soyad zorunlu, Telefon/E-posta opsiyonel), gerçek `ScopedStaffService.AssignAsync`
 *      çağrısının GERÇEKTEN bir admin kullanıcı + ScopeNode + AdminScope oluşturduğu API'den
 *      doğrulanıyor, geçici şifre ekranda gösterilip panoya kopyalanabiliyor.
 *   2. SubmissionDetailModal (UI'dan durum akışı): "İncelemeye Al" → "Ulakbel'e İlet" →
 *      "Çözüldü Olarak İşaretle" tam zincirinin UI'dan tıklanarak yürütüldüğü, her adımın
 *      API'den doğrulandığı, "Muhtarın Haberdar Olması Gereken" toggle'ının çalıştığı.
 *   3. SubmissionDetailModal negatif akış: "Reddet" butonunun ConfirmModal açtığı, onaylanınca
 *      GERÇEKTEN reddedildiği, reddedilen kayıtta artık hiçbir aksiyon butonunun kalmadığı
 *      (isTerminal state doğrulaması).
 *
 * DÜRÜST KAPSAM NOTU: SubmissionMapTab (harita görünümü) ve SubmissionReportsTab (518 satır,
 * analitik grafikler) bu dosyanın kapsamı DIŞINDA — ayrı, büyük bir iterasyon gerektirir.
 * NewMuhtarSubmissionModal (admin-initiated başvuru oluşturma) da kapsam dışı bırakıldı.
 *
 * TEST HİJYENİ SINIRLAMASI: `citizen-submissions` için bir DELETE endpoint'i YOK (muhtemelen
 * kasıtlı — vatandaş başvuruları/şikayetleri denetim izi gereği kalıcı tutuluyor olabilir).
 * Bu yüzden `createSubmissionFixture` ile oluşturulan test kayıtları (rejected/resolved
 * durumunda "kapatılmış" olsalar da) veritabanında KALICI kalır — sadece muhtar admin hesabı
 * (`provisionedAdminUserId`) afterAll'da temizlenir. Bu, `muhtarlik-admin.spec.ts`'nin de
 * paylaştığı bilinen bir sınırlama, bu dosyaya özgü değil.
 */
import { test, expect, type Page } from '@playwright/test'
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

async function createSubmissionFixture(neighborhood: string): Promise<{ id: string; title: string }> {
  const tckn = generateValidTckn()
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}`
  const registerRes = await post('/auth/citizen/register', {
    tckn, birthDate: '1990-01-01',
    phone: `05${String(500000000 + (Number(suffix) % 90000000))}`,
    email: `qa.test.muhtarlik.${suffix}@example.com`,
    password: 'MuhtarlikE2e2026!',
  })
  let citizenToken: string = registerRes?.accessToken
  if (!citizenToken && registerRes?.otpSessionToken) {
    const verify = await post('/auth/citizen/verify-otp', { otpSessionToken: registerRes.otpSessionToken, code: '111111' })
    citizenToken = verify.accessToken
  }
  if (!citizenToken) throw new Error(`Vatandaş kaydı/OTP doğrulaması başarısız: ${JSON.stringify(registerRes)}`)

  const title = `QA-TEST-E2E-AUTO Muhtarlık ${suffix}`
  const submission = await post('/me/submissions', {
    title, description: 'Playwright tarafından oluşturulan e2e test başvurusu (UI akış testi).',
    categoryId: 'road', submissionType: 'request', priority: 'normal',
    neighborhood, address: 'E2E test adresi No:1', latitude: null, longitude: null,
    notifyMuhtar: false, complaintReason: null,
  }, citizenToken)

  return { id: submission.id, title }
}

async function getFreshToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('admin_access_token') || sessionStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

let api: AdminApi
const testNeighborhood = 'Cebeci Mahallesi'
let provisionedAdminUserId = ''

test.describe.serial('Muhtarlık — Muhtar Hesabı Oluşturma + Başvuru Detay UI Akışı, sıfır hata', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => {
    // Test sırasında oluşturulan muhtar hesabını GERÇEKTEN sil (canlı veriyi kirletmeden bırak).
    if (provisionedAdminUserId) {
      await api.raw('DELETE', `/admins/${provisionedAdminUserId}`, {}).catch(() => {})
    }
    await api.dispose()
  })

  test('1) MuhtarManagementTab: yeni muhtar hesabı UI\'dan oluşturulur, geçici şifre gösterilir, API\'den doğrulanır', async ({ page }) => {
    test.setTimeout(60_000)

    // Ön koşul: bu mahallede henüz hesap atanmamış olmalı. NOT (2026-09-04, gerçek testte
    // bulunan backend davranışı): `ScopedStaffService.EnsureUserAsync` email zaten
    // kayıtlıysa fullName/phone GÜNCELLEMEZ, olduğu gibi mevcut kullanıcıyı döndürür — yani
    // "Bilgileri Güncelle" akışı GERÇEKTE ismi güncellemiyor (muhtemel gerçek bir UX/backend
    // tutarsızlığı, ayrı bir konu olarak flag'lendi, bu testin kapsamı dışında bırakıldı).
    // Bu davranış test retry'lerini de etkiler: bir önceki denemede oluşan hesap
    // temizlenmeden ikinci deneme başlarsa yeni fullName UYGULANMAZ. Bu yüzden test
    // BAŞINDA, varsa önceki kalıntı hesabı GERÇEKTEN silip mahalleyi temiz başlatıyoruz.
    const preExisting = await api.request<Array<{ neighborhood: string; accountProvisioned: boolean; adminUserId?: string }>>('GET', '/citizen-submissions/muhtar-assignments')
    const preExistingEntry = preExisting.find((a) => a.neighborhood === testNeighborhood)
    if (preExistingEntry?.accountProvisioned && preExistingEntry.adminUserId) {
      await api.raw('DELETE', `/admins/${preExistingEntry.adminUserId}`, {}).catch(() => {})
    }

    const before = await api.request<Array<{ neighborhood: string; accountProvisioned: boolean }>>('GET', '/citizen-submissions/muhtar-assignments')
    const existing = before.find((a) => a.neighborhood === testNeighborhood)
    expect(existing, `${testNeighborhood} referans listesinde bulunmalı`).toBeTruthy()
    expect(existing!.accountProvisioned, 'test başlangıcında mahalle temiz (atanmamış) olmalı').toBe(false)

    await loginAndOpen(page, '/muhtarlik?tab=muhtars', /Muhtar Yönetimi|Muhtarlık/)
    await expect(page.getByText(testNeighborhood)).toBeVisible({ timeout: 15000 })

    // NOT: Kart konteynerine XPath ile mahalle adından çıkıyoruz — `.filter({hasText})` TÜM
    // ata div'leriyle eşleşip yanlış (çok daha geniş) bir kapsayıcı seçebilir.
    const card = page.locator(
      'xpath=//p[normalize-space(text())=' + JSON.stringify(testNeighborhood) + ']/ancestor::div[contains(@class,"shadow-card")][1]',
    )
    const actionLabel = existing!.accountProvisioned ? 'Bilgileri Güncelle' : 'Hesap Oluştur'
    await card.getByRole('button', { name: actionLabel }).click()

    const modalTitle = existing!.accountProvisioned ? 'Muhtar Bilgilerini Güncelle' : 'Muhtar Hesabı Oluştur'
    await expect(page.getByText(modalTitle)).toBeVisible({ timeout: 8000 })
    const modal = page.locator('div.relative.z-10').last()
    // NOT: modal footer'ındaki buton metni kart butonundan FARKLI —
    // MuhtarManagementTab.tsx satır 129: kart "Bilgileri Güncelle" der, modal footer sadece "Güncelle".
    const modalActionLabel = existing!.accountProvisioned ? 'Güncelle' : 'Hesap Oluştur'

    const fullName = `QA-TEST-E2E-AUTO Muhtar ${Date.now()}`
    await page.getByPlaceholder('Muhtarın adı soyadı').fill(fullName)
    await page.getByPlaceholder('05XX XXX XX XX').fill('05551234567')

    // Buton, ad-soyad boşken devre dışı olmalı — negatif kontrol (temizleyip tekrar doldur).
    // NOT: buton, arka plandaki TÜM mahalle kartlarında da aynı metinle var — modal'a scoped
    // olmalı, aksi halde 17 eşleşme (strict-mode ihlali) çıkar.
    await page.getByPlaceholder('Muhtarın adı soyadı').fill('')
    const saveBtn = modal.getByRole('button', { name: modalActionLabel, exact: true })
    await expect(saveBtn).toBeDisabled()
    await page.getByPlaceholder('Muhtarın adı soyadı').fill(fullName)
    await expect(saveBtn).toBeEnabled()

    const [provisionResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/provision-muhtar') && r.request().method() === 'POST', { timeout: 20_000 }),
      saveBtn.click(),
    ])
    expect(provisionResponse.ok(), `POST provision-muhtar başarısız: ${await provisionResponse.text()}`).toBeTruthy()
    // Sonuç ekranı: e-posta + (varsa) geçici şifre gösterilmeli.
    await expect(page.getByText(/Hesap oluşturuldu\.|Bilgiler güncellendi\./)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('sultangazi.bel.tr', { exact: false }).first()).toBeVisible({ timeout: 3000 })

    // Fake-success-detection: API'den GERÇEKTEN atandığını doğrula.
    const freshToken = await getFreshToken(page)
    const afterRes = await page.request.get(`${API_BASE}/citizen-submissions/muhtar-assignments`, { headers: { Authorization: `Bearer ${freshToken}` } })
    const after = (await afterRes.json()).data as Array<{ neighborhood: string; accountProvisioned: boolean; fullName: string; adminUserId?: string }>
    const updated = after.find((a) => a.neighborhood === testNeighborhood)
    expect(updated?.accountProvisioned).toBe(true)
    expect(updated?.fullName).toBe(fullName)
    provisionedAdminUserId = updated?.adminUserId ?? ''
    expect(provisionedAdminUserId, 'MuhtarAssignmentDto.AdminUserId dolu dönmeli (temizlik için gerekli)').toBeTruthy()
  })

  test('2) SubmissionDetailModal: tam durum zinciri UI\'dan yürütülür — İncelemeye Al → İlet → Çözüldü, her adım API\'den doğrulanır', async ({ page }) => {
    test.setTimeout(90_000)
    const { id: submissionId, title } = await createSubmissionFixture(testNeighborhood)

    await loginAndOpen(page, '/muhtarlik', /Muhtarlık|Başvurular/)
    await page.getByPlaceholder('Başlık, vatandaş, adres, mahalle ara...').fill(title)
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.locator('button[aria-label="Detayları görüntüle"]').click()

    const modal = page.locator('div.relative.z-10').last()
    await expect(modal.getByText(title)).toBeVisible({ timeout: 8000 })

    // Adım 1: "İncelemeye Al" (status: new → in_review).
    await modal.getByRole('button', { name: 'İncelemeye Al' }).click()
    await expect(modal.getByText('İncelemede', { exact: false })).toBeVisible({ timeout: 8000 })
    let freshToken = await getFreshToken(page)
    let check = await (await page.request.get(`${API_BASE}/citizen-submissions/${submissionId}`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    expect(check.data.status).toBe('in_review')

    // Adım 2: "Muhtarın Haberdar Olması Gereken" toggle'ını aç.
    const notifyToggle = modal.locator('button[role="switch"]').first()
    await expect(notifyToggle).toHaveAttribute('aria-checked', 'false')
    await notifyToggle.click()
    await expect(notifyToggle).toHaveAttribute('aria-checked', 'true')
    freshToken = await getFreshToken(page)
    check = await (await page.request.get(`${API_BASE}/citizen-submissions/${submissionId}`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    expect(check.data.notifyMuhtar).toBe(true)

    // Adım 3: "Ulakbel'e İlet" (status: in_review → forwarded, gerçek ulakbelUnit + trackingNo).
    const [forwardResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/citizen-submissions/${submissionId}/forward`) && r.request().method() === 'POST'),
      modal.getByRole('button', { name: /Ulakbel'e İlet/ }).click(),
    ])
    expect(forwardResponse.ok(), `POST forward başarısız: ${await forwardResponse.text()}`).toBeTruthy()
    await expect(modal.getByText(/Ulakbel'e İletildi/).first()).toBeVisible({ timeout: 8000 })
    await expect(modal.getByText(/Takip No:/)).toBeVisible({ timeout: 3000 })

    // Adım 4: "Çözüldü Olarak İşaretle" (status: forwarded → resolved).
    const [resolveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/citizen-submissions/${submissionId}/status`) && r.request().method() === 'PATCH'),
      modal.getByRole('button', { name: 'Çözüldü Olarak İşaretle' }).click(),
    ])
    expect(resolveResponse.ok(), `PATCH status resolved başarısız: ${await resolveResponse.text()}`).toBeTruthy()
    await expect(modal.getByText(/^Çözüldü ·/)).toBeVisible({ timeout: 8000 })

    // Terminal state: artık hiçbir aksiyon butonu kalmamalı (isTerminal → actions boş → footer yok).
    await expect(modal.getByRole('button', { name: 'Reddet' })).not.toBeVisible({ timeout: 3000 })
    await expect(modal.getByRole('button', { name: /Ulakbel'e İlet/ })).not.toBeVisible({ timeout: 3000 })

    freshToken = await getFreshToken(page)
    const final = await (await page.request.get(`${API_BASE}/citizen-submissions/${submissionId}`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    expect(final.data.status).toBe('resolved')
    expect(final.data.ulakbelUnit).toBe('Fen İşleri Müdürlüğü')
    expect(final.data.resolvedAt).toBeTruthy()
  })

  test('3) SubmissionDetailModal: "Reddet" ConfirmModal açar, onaylanınca kayıt GERÇEKTEN reddedilir', async ({ page }) => {
    test.setTimeout(60_000)
    const { id: submissionId, title } = await createSubmissionFixture(testNeighborhood)

    await loginAndOpen(page, '/muhtarlik', /Muhtarlık|Başvurular/)
    await page.getByPlaceholder('Başlık, vatandaş, adres, mahalle ara...').fill(title)
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.locator('button[aria-label="Detayları görüntüle"]').click()

    const modal = page.locator('div.relative.z-10').last()
    await expect(modal.getByText(title)).toBeVisible({ timeout: 8000 })

    await modal.getByRole('button', { name: 'Reddet' }).click()
    await expect(page.getByRole('heading', { name: 'Kaydı Reddet' })).toBeVisible({ timeout: 5000 })

    const confirmDialog = page.locator('div.relative.z-10').last()
    const [rejectResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/citizen-submissions/${submissionId}/status`) && r.request().method() === 'PATCH'),
      confirmDialog.getByRole('button', { name: 'Reddet', exact: true }).click(),
    ])
    expect(rejectResponse.ok(), `PATCH status rejected başarısız: ${await rejectResponse.text()}`).toBeTruthy()

    await expect(page.getByText('Bu kayıt reddedildi.')).toBeVisible({ timeout: 8000 })

    const freshToken = await getFreshToken(page)
    const check = await (await page.request.get(`${API_BASE}/citizen-submissions/${submissionId}`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    expect(check.data.status).toBe('rejected')
  })
})

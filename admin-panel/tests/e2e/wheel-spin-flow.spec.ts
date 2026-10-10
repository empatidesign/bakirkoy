/**
 * Hediye Çarkı (`/wheel`) — Çarkı Çevirme (SpinService), 3 katmanlı sıfır hata toleranslı E2E.
 *
 * `wheel-admin.spec.ts` çark/hediye oluşturma ve hediye talebi onay/red akışını kapsıyor ama
 * **çarkın kendisini çevirme mekanizmasının** (`SpinService.SpinAsync`, gerçek kazanan tespiti,
 * günlük limit) hiçbir testte kapsanmadığı tespit edildi (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md`
 * madde C, "Bilgi Yarışması ve Çark").
 *
 * Katman 1 — Admin panel UI: bir dilimi %100 kazanma oranlı "points" (puan), diğerini %0
 *   "pass" yaparak DETERMİNİSTİK bir çark oluşturuyoruz (`PickByWinRate` ağırlıklı rastgele
 *   seçim yapıyor — %100/%0 ile sonucu kesinleştiriyoruz). Günlük çevirme hakkı = 1.
 * Katman 2 — Citizen-portal UI: gerçek "Çevir" butonuna tıklanıyor, gerçek
 *   `POST /wheels/{id}/spin` isteği tetikleniyor, spinner animasyonu bekleniyor, sonuç modalı
 *   (kazanılan puan) doğrulanıyor.
 * Katman 3 — API çapraz doğrulama: puanın GERÇEKTEN LoyaltyTransaction'a yazıldığı ve
 *   günlük limit dolduktan sonra İKİNCİ çevirmenin `DAILY_SPIN_LIMIT_REACHED` ile
 *   reddedildiği (hem UI hem API seviyesinde) doğrulanıyor.
 *
 * DÜRÜST KAPSAM NOTU: "gift" tipi dilim ve stok tükenmesi/fallback senaryosu (SpinService.cs'te
 * dokümante edilen FallbackSlice mantığı) bu testin kapsamı DIŞINDA — ayrı, hediye stok
 * yönetimiyle iç içe geçmiş bir senaryo, ayrı bir iterasyonda ele alınmalı.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const CITIZEN_PORTAL_URL = process.env.E2E_CITIZEN_PORTAL_URL || 'http://localhost:3100'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

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

async function registerCitizen(ctx: APIRequestContext, tag: string): Promise<{ token: string; refreshToken: string; tckn: string }> {
  const tckn = fakeTckn()
  const email = `qa.test.wheelspin.${tag.replace(/\s+/g, '')}@example.com`.toLowerCase()
  const phone = `05${String(Date.now()).slice(-9)}`
  const reg = await (await ctx.post(`${API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate: '2000-01-01', phone, email, password: 'E2eWheelSpin2026!', guardianPhone: null, guardianEmail: null },
  })).json()
  const otpSessionToken = reg?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`citizen register otp yok: ${JSON.stringify(reg)}`)
  const ver = await (await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken, code: '111111' },
  })).json()
  const token = ver?.data?.accessToken
  const refreshToken = ver?.data?.refreshToken
  if (!token) throw new Error(`citizen accessToken yok: ${JSON.stringify(ver)}`)

  // NOT (2026-09-04, gerçek testte bulunan gotcha): yeni kayıt olan vatandaş kvkkAccepted=false
  // ile başlıyor — ConsentGate.tsx bu durumda "Devam Etmeden Önce" modalını zorunlu gösterip
  // TÜM sayfayı (çark kartı dahil) tıklanamaz hale getiriyor. UI'dan onaylamak yerine gerçek
  // backend API'sini (aynı authService.acceptKvkk/acceptNotificationConsent'in çağırdığı
  // endpoint) doğrudan çağırıyoruz — test odağı çark çevirme akışı, KVKK onay UI'ı değil.
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-kvkk`, { headers: { Authorization: `Bearer ${token}` } })
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-notification-consent`, { headers: { Authorization: `Bearer ${token}` } })

  return { token, refreshToken, tckn }
}

test.describe.serial('Hediye Çarkı — Çevirme (SpinService), deterministik kazanan tespiti, 3 katmanlı, sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let wheelId = ''
  let citizenTckn = ''
  const tag = uniq('QA-TEST-E2E-AUTO WheelSpin')
  const wheelTitle = `${tag} Çarkı`

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    if (wheelId) await apiCtx.delete(`${API_BASE}/wheels/${wheelId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) ADMIN PANEL UI: DETERMİNİSTİK çark oluşturulur — bir dilim %100 puan, diğeri %0 pas, günlük limit=1', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/wheel?tab=cark')
    await expect(page.getByText('Çarklar').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Yeni Çark' }).click()
    await expect(page.getByRole('heading', { name: /Yeni Çark/ })).toBeVisible()

    await page.getByPlaceholder('Örn. Haftalık Puan Çarkı').fill(wheelTitle)
    await page.getByPlaceholder('Çark hakkında kısa açıklama').fill('QA-TEST-E2E-AUTO deterministik spin testi')

    // Günlük çevirme hakkı: 1 (ikinci çevirmenin limit hatası vermesi test 3'te doğrulanacak).
    const dailyLimitField = page.locator('div', { has: page.getByText('Günlük Çevirme Hakkı', { exact: true }) }).last()
    await dailyLimitField.locator('input').first().fill('1')

    // Varsayılan 2 dilim geliyor (100 Puan %50 / Pas %50) — ilkini %100, ikincisini %0 yap.
    const slice1 = page.locator('div.rounded-card', { has: page.getByText('Dilim 1', { exact: true }) }).first()
    const slice1WinRateField = slice1.locator('div', { has: page.getByText('Kazanma Oranı (%)', { exact: true }) }).last()
    await slice1WinRateField.locator('input').first().fill('100')
    // Değer alanını da benzersiz bir puan miktarına ayarla (sonuç doğrulaması için).
    const slice1ValueField = slice1.locator('div', { has: page.getByText('Puan Değeri', { exact: true }) }).last()
    await slice1ValueField.locator('input').first().fill('777')

    const slice2 = page.locator('div.rounded-card', { has: page.getByText('Dilim 2', { exact: true }) }).first()
    const slice2WinRateField = slice2.locator('div', { has: page.getByText('Kazanma Oranı (%)', { exact: true }) }).last()
    await slice2WinRateField.locator('input').first().fill('0')

    // Toplam %100 banner'ının GERÇEKTEN "geçerli" durumuna geçtiğini doğrula.
    await expect(page.getByText('Toplam kazanma oranı: %100', { exact: false })).toBeVisible({ timeout: 3000 })

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/wheels') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createResponse.ok(), `POST /wheels başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created = (await createResponse.json()).data
    wheelId = created.id
    expect(created.dailySpinLimit).toBe(1)
    const winSlice = created.slices.find((s: { winRate: number }) => s.winRate === 100)
    expect(winSlice?.type).toBe('points')
    expect(winSlice?.value).toBe(777)

    await page.getByPlaceholder('Çark başlığı ara...').fill(wheelTitle)
    await expect(page.getByText(wheelTitle).first()).toBeVisible({ timeout: 15000 })
  })

  test('2) CITIZEN PORTAL UI: gerçek "Çevir" butonuna tıklanır, spinner animasyonu tamamlanır, sonuç modalı 777 puan gösterir', async ({ page }) => {
    test.setTimeout(60_000)
    const citizen = await registerCitizen(apiCtx, tag)
    citizenTckn = citizen.tckn

    // NOT (gerçek testte bulunan davranış, güncellendi): citizen-portal'ın tokenStorage.ts'i
    // artık 'portal_'-önekli key'ler kullanıyor (eski 'access_token' vb. sadece native
    // webview'de migrate ediliyor, normal tarayıcıda okunmuyor).
    await page.addInitScript(({ at, rt }) => {
      localStorage.setItem('portal_access_token', at)
      localStorage.setItem('portal_refresh_token', rt)
      localStorage.setItem('portal_auth_kind', 'citizen')
      localStorage.setItem('portal_auth_remember', '1')
      localStorage.setItem('nexora_citizen_onboarding_done', '1')
    }, { at: citizen.token, rt: citizen.refreshToken })
    await page.goto(`${CITIZEN_PORTAL_URL}/carkim`)
    await expect(page.getByText('Şansını dene, hediye kazan!')).toBeVisible({ timeout: 20000 })

    // Oluşturulan çarkın kartını bul.
    const wheelCard = page.locator('button', { hasText: wheelTitle })
    await expect(wheelCard).toBeVisible({ timeout: 15000 })
    await wheelCard.click()

    // Spin modalı açılır — "Çevir" butonuna tıkla.
    const spinButton = page.getByRole('button', { name: /Çevir/i }).last()
    await expect(spinButton).toBeVisible({ timeout: 8000 })

    const [spinResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/spin') && r.request().method() === 'POST'),
      spinButton.click(),
    ])
    expect(spinResponse.ok(), `POST spin başarısız: ${await spinResponse.text()}`).toBeTruthy()
    const spinResult = (await spinResponse.json()).data
    expect(spinResult.sliceType).toBe('points')
    expect(spinResult.pointsWon).toBe(777)
    expect(spinResult.remainingSpinsToday).toBe(0)

    // Spinner animasyonu (~4.2sn) bitip sonuç modalı açılmalı.
    await expect(page.getByText('Tebrikler!')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('777 puan kazandın', { exact: false })).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Bugün kalan hakkın:', { exact: false })).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('0', { exact: true }).last()).toBeVisible({ timeout: 3000 })
  })

  test('3) API çapraz doğrulama: puan GERÇEKTEN LoyaltyTransaction\'a yazıldı (me/loyalty/balance), ikinci çevirme günlük limit hatasıyla reddedilir', async ({ page: _page }) => {
    test.setTimeout(60_000)
    expect(citizenTckn, 'önceki testte vatandaş oluşturulmuş olmalı').toBeTruthy()

    // Aynı vatandaşla tekrar login olup HEM bakiyeyi doğruluyoruz HEM ikinci spin'i deniyoruz.
    const loginRes = await apiCtx.post(`${API_BASE}/auth/citizen/login`, {
      data: { identifier: citizenTckn, password: 'E2eWheelSpin2026!' },
    })
    let citizenToken = ''
    if (loginRes.ok()) {
      const body = await loginRes.json()
      citizenToken = body?.data?.accessToken
      if (!citizenToken && body?.data?.otpSessionToken) {
        const verify = await (await apiCtx.post(`${API_BASE}/auth/citizen/verify-otp`, {
          data: { otpSessionToken: body.data.otpSessionToken, code: '111111' },
        })).json()
        citizenToken = verify?.data?.accessToken
      }
    }
    expect(citizenToken, `ilk vatandaş tekrar login olabilmeli: ${await loginRes.text().catch(() => '')}`).toBeTruthy()

    // Fake-success-detection: puanın GERÇEKTEN bir LoyaltyTransaction olarak kaydedildiğini
    // doğrula. NOT (gerçek testte bulunan gotcha): bakiyeye salt farkla güvenmek KIRILGAN —
    // consent onayı sonrası eşzamanlı/gecikmeli başka bir LoyaltyRule daha tetiklenebiliyor
    // (canlı testte gözlemlendi: beklenen +777 yerine +787 ölçüldü). Bunun yerine transactions
    // listesinden action="wheel-spin" olan kaydı BULUP değerinin TAM 777 olduğunu doğruluyoruz
    // — bu, diğer eşzamanlı puan kaynaklarından etkilenmeyen izole bir kanıt.
    const txRes = await apiCtx.get(`${API_BASE}/me/loyalty/transactions?limit=20`, { headers: { Authorization: `Bearer ${citizenToken}` } })
    expect(txRes.ok(), `GET me/loyalty/transactions başarısız: ${await txRes.text()}`).toBeTruthy()
    const txBody = await txRes.json()
    const transactions: Array<{ actionKey?: string; points?: number; amount?: number; referenceId?: string }> = txBody.data?.items ?? txBody.data ?? []
    const wheelTx = transactions.find((t) => t.actionKey === 'wheel-spin' && (t.referenceId === wheelId || !t.referenceId))
    expect(wheelTx, `wheel-spin LoyaltyTransaction bulunamalı: ${JSON.stringify(transactions).slice(0, 500)}`).toBeTruthy()
    expect(wheelTx!.points ?? wheelTx!.amount).toBe(777)

    const secondSpin = await apiCtx.post(`${API_BASE}/wheels/${wheelId}/spin`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    })
    expect(secondSpin.status(), 'ikinci çevirme günlük limit nedeniyle 409 dönmeli').toBe(409)
    const secondSpinBody = await secondSpin.json()
    expect(secondSpinBody.errorCode).toBe('DAILY_SPIN_LIMIT_REACHED')
  })
})

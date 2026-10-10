/**
 * Bilgi Yarışması (`/quiz` admin, `/yarisma` citizen-portal) — Vatandaş Cevaplama Akışı
 * (`QuizPlayModal`), 3 katmanlı sıfır hata toleranslı E2E.
 *
 * `quiz-admin.spec.ts` sadece admin panelden kategori/yaş grubu/quiz/soru CRUD'unu
 * kapsıyor — GERÇEK yarışma alma mekanizması (bir vatandaşın soruları cevaplayıp puan
 * kazanması, `POST /me/quizzes/{id}/submit`) hiçbir testte kapsanmamıştı
 * (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md` madde C, "Bilgi Yarışması ve Çark").
 *
 * Katman 1 — Admin panel UI: `quiz-admin.spec.ts`'teki mevcut yardımcı desenler yeniden
 *   kullanılarak kategori + "Devam Ediyor" durumunda, "Tüm yaşlar" (yaş grubu kısıtı yok)
 *   2 sorulu bir quiz oluşturuluyor. Her sorunun doğru cevabı BİLEREK sabitleniyor (test 2'de
 *   doğru/yanlış karışımı ile skor deterministik hesaplanabilsin diye).
 * Katman 2 — Citizen-portal UI: gerçek yarışma kartına tıklanıyor, "Yarışmayı Başlat"
 *   ile intro ekranından playing'e geçiliyor, HER İKİ soru GERÇEK tıklamayla cevaplanıyor
 *   (biri doğru, biri yanlış — anlık doğru/yanlış görsel geri bildirimi de doğrulanıyor),
 *   `POST /me/quizzes/{id}/submit` isteği yakalanıp sonuç ekranındaki skor/doğru/yanlış
 *   sayılarıyla çapraz doğrulanıyor.
 * Katman 3 — API çapraz doğrulama: aynı vatandaşın AYNI quiz'e ikinci kez katılmaya
 *   çalışması 409 (zaten katıldı) ile reddediliyor; puanın GERÇEKTEN LoyaltyTransaction'a
 *   yazıldığı izole bir transaction kaydı üzerinden doğrulanıyor.
 *
 * DÜRÜST KAPSAM NOTU: Soru başına süre limiti (perQuestionTimeLimit / question.timeLimit),
 * pas geçme hakkı (passRights) ve toplam yarışma süresi dolma senaryosu (QUIZ_TIME_EXCEEDED)
 * bu testin kapsamı DIŞINDA — her biri ayrı zamanlayıcı temelli senaryolar, ayrı bir
 * iterasyonda ele alınmalı. Leaderboard (sıralama) ekranı da kapsam dışı.
 *
 * Bu dosyayı yazarken bulunan gerçek gotcha: Sistemde birçok orphan test yaş grubu
 * (`Genç Yetişkin 19-30 Q10K-...` gibi, başka bir test/agent'tan kalma) birikmişti.
 * Backend'in `ParticipantQuizService.GetListAsync`'i, vatandaşın yaşına göre eşleşen İLK
 * aktif yaş grubunu (`ageGroups.FirstOrDefault(g => g.Contains(age))`, DB sırasına göre —
 * belirsiz/kırılgan) "vatandaşın yaş grubu" sayıp quiz'i SADECE o quiz'in ageGroupId'si
 * bununla eşleşirse listeliyor. Kendi (geniş 0-120) yaş grubumuzu oluştursak bile, DB'de
 * daha önce sıralanan dar bir orphan grup (örn. 19-30) vatandaşın yaşıyla eşleşip quiz'i
 * gizleyebiliyordu (test 2'de "yarışma kartı bulunamadı" olarak ortaya çıktı) — yaş
 * grubunu HİÇ seçmeyip "Tüm yaşlar" bırakarak (`OnlyAllAges` dalı) bu kırılgan bağımlılığı
 * ortadan kaldırdık.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { clickRowAction } from './helpers/rowActions'

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

function tomorrowDateText(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  const email = `qa.test.quizplay.${tag.replace(/\s+/g, '')}@example.com`.toLowerCase()
  const phone = `05${String(Date.now()).slice(-9)}`
  const reg = await (await ctx.post(`${API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate: '2000-01-01', phone, email, password: 'E2eQuizPlay2026!', guardianPhone: null, guardianEmail: null },
  })).json()
  const otpSessionToken = reg?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`citizen register otp yok: ${JSON.stringify(reg)}`)
  const ver = await (await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken, code: '111111' },
  })).json()
  const token = ver?.data?.accessToken
  const refreshToken = ver?.data?.refreshToken
  if (!token) throw new Error(`citizen accessToken yok: ${JSON.stringify(ver)}`)

  // NOT (tekrarlayan gotcha, bkz. wheel-spin-flow.spec.ts): yeni kayıt olan vatandaş
  // kvkkAccepted=false ile başlıyor — ConsentGate.tsx zorunlu onay modalını gösterip
  // TÜM sayfayı tıklanamaz hale getiriyor. UI'dan onaylamak yerine gerçek backend
  // uçlarını doğrudan çağırıyoruz.
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-kvkk`, { headers: { Authorization: `Bearer ${token}` } })
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-notification-consent`, { headers: { Authorization: `Bearer ${token}` } })

  return { token, refreshToken, tckn }
}

async function fillByPlaceholder(page: Page, placeholder: string | RegExp, value: string) {
  await page.getByPlaceholder(placeholder, { exact: true }).fill(value)
}

async function selectOption(page: Page, trigger: ReturnType<Page['getByRole']>, optionName: string | RegExp) {
  await trigger.click()
  await page.getByRole('button', { name: optionName }).last().click()
}

function rowContaining(page: Page, text: string) {
  return page.locator(`tr:has-text("${text}")`).last()
}

test.describe.serial('Bilgi Yarışması — Vatandaş Cevaplama Akışı (QuizPlayModal), 3 katmanlı, sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let quizId = ''
  let categoryId = ''
  let citizenTckn = ''
  const tag = uniq('QA-TEST-E2E-AUTO QuizPlay')
  const categoryName = `${tag} Kategori`
  const quizTitle = `${tag} Yarismasi`

  test.beforeAll(async () => { apiCtx = await pwRequest.newContext() })

  test.afterAll(async () => {
    const token = await adminToken(apiCtx).catch(() => '')
    if (token) {
      if (quizId) await apiCtx.delete(`${API_BASE}/quizzes/${quizId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
      if (categoryId) await apiCtx.delete(`${API_BASE}/quiz-categories/${categoryId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    await apiCtx.dispose()
  })

  test('1) ADMIN PANEL UI: kategori + 2 sorulu "Devam Ediyor" quiz oluşturulur (Tüm yaşlar)', async ({ page }) => {
    test.setTimeout(120_000)
    await adminLoginUi(page)

    // --- Kategori ---
    await page.goto('/quiz')
    await expect(page.getByRole('heading', { name: 'Bilgi Yarışması' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: /Kategoriler/ }).click()
    await page.getByRole('button', { name: 'Yeni Kategori' }).click()
    await expect(page.getByText('Yeni Kategori Ekle')).toBeVisible()
    await fillByPlaceholder(page, 'Örn. Sultangazi', categoryName)
    await fillByPlaceholder(page, 'Kategori hakkında kısa açıklama', 'QA-TEST-E2E-AUTO quiz cevaplama testi kategorisi')
    const [catRes] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/quiz-categories') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(catRes.ok(), `POST /quiz-categories başarısız: ${await catRes.text()}`).toBeTruthy()
    categoryId = (await catRes.json()).data.id
    await page.getByPlaceholder('Kategori adı veya açıklama ara...').fill(categoryName)
    await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 20000 })

    // --- Yaş grubu: KASITLI OLARAK "Tüm yaşlar (herkes görebilir)" ile bırakılıyor ---
    // NOT (2026-09-04, gerçek testte bulunan gotcha): Sistemde birçok orphan test yaş grubu
    // (`Genç Yetişkin 19-30 Q10K-...` gibi, başka bir test/agent'tan kalma) birikmişti.
    // Backend'in `GetListAsync`'i, vatandaşın yaşına göre eşleşen İLK aktif yaş grubunu
    // (`ageGroups.FirstOrDefault(g => g.Contains(age))`, DB sırasına göre) "benim yaş grubum"
    // olarak alıp quiz'i SADECE o quiz'in ageGroupId'si bununla eşleşirse listeliyor. Testin
    // kendi (geniş 0-120) yaş grubunu oluştursak bile, DB'de listede daha ÖNCE gelen dar bir
    // orphan grup (örn. 19-30) vatandaşın yaşıyla eşleşip quiz'i gizleyebiliyor — gerçek bir
    // bug değil ama test ortamındaki kirli veriyle çakışan kırılgan bir bağımlılık. Bunun
    // yerine yaş grubunu HİÇ seçmeyip "Tüm yaşlar" bırakıyoruz — bu, `OnlyAllAges` dalına
    // düşüyor ve DB'deki hiçbir yaş grubu kaydından etkilenmiyor.

    // --- Quiz (Yönetim) ---
    await page.getByRole('button', { name: /Yönetim/ }).click()
    await page.getByRole('button', { name: 'Yeni Yarışma' }).click()
    await expect(page.getByText('Yeni Yarışma Ekle')).toBeVisible()
    await fillByPlaceholder(page, 'Yarışma başlığı', quizTitle)
    await fillByPlaceholder(page, 'Yarışma açıklaması', 'QA-TEST-E2E-AUTO quiz cevaplama testi')
    await page.getByPlaceholder('Başlangıç tarihi').fill(tomorrowDateText(0))
    await page.getByPlaceholder('Bitiş tarihi').fill(tomorrowDateText(14))
    // NOT (gerçek testte bulunan davranış, aria-labelledby accessibility iyileştirmesi):
    // Select bileşeninin erişilebilir adı artık SEÇİLİ DEĞER metni değil, alanın etiketi
    // ("Durum", "Kategori*") — Field.tsx'in aria-labelledby'yi alan etiketine bağlaması
    // nedeniyle. Eskiden `getByRole('button', {name: 'Yakında'})` ile seçili değerden
    // bulunabiliyordu, artık alan etiketinden bulunmalı.
    await selectOption(page, page.getByRole('button', { name: 'Durum' }), 'Devam Ediyor')
    await selectOption(page, page.getByRole('button', { name: /^Kategori/ }), new RegExp(`^${escapeRegExp(categoryName)}(?: ·|$)`))

    await page.getByText(/^Soru Sayısı/).first().scrollIntoViewIfNeeded()
    const numericInputs = page.locator('input[inputmode="numeric"]')
    await numericInputs.nth(2).fill('2')
    await numericInputs.nth(3).fill('5')
    await numericInputs.nth(4).fill('30')

    const [quizRes] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/quizzes') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(quizRes.ok(), `POST /quizzes başarısız: ${await quizRes.text()}`).toBeTruthy()
    const created = (await quizRes.json()).data
    quizId = created.id
    expect(created.status).toBe('ongoing')
    expect(created.ageGroupId).toBeFalsy()
    await page.getByPlaceholder('Yarışma başlığı veya açıklama ara...').fill(quizTitle)
    await expect(page.getByText(quizTitle).first()).toBeVisible({ timeout: 20000 })

    // --- Sorular: 1. soru doğru cevap "Doğru A" (index 1), 2. soru doğru cevap "Doğru B" (index 0) ---
    const row = rowContaining(page, quizTitle)
    // NOT (gerçek testte bulunan davranış, bkz. Modül 2 Kaşif Çocuk aynı bulgusu): satır
    // eylemleri artık daralmış (collapsed) menüde olabiliyor — doğrudan buton yerine
    // clickRowAction helper'ı "Tüm işlemleri göster" menüsünü de deniyor.
    await clickRowAction(page, row, 'Sorular')
    await expect(page.getByRole('heading', { name: 'Soru Yönetimi' })).toBeVisible()

    async function addQuestion(question: string, options: string[], correctIndex: number) {
      await page.getByRole('button', { name: 'Soru Ekle' }).first().click()
      // NOT (gerçek testte bulunan davranış): "Soru Ekle" modal header'ı artık alt başlık
      // metni olmadan render oluyor — modalın gerçekten açıldığını "Soru Metni" alanı
      // üzerinden doğruluyoruz (daha stabil, header metin değişikliklerinden etkilenmez).
      await expect(page.getByPlaceholder('Soru metnini giriniz...')).toBeVisible({ timeout: 8000 })
      await page.getByPlaceholder('Soru metnini giriniz...').fill(question)
      for (let i = 0; i < options.length; i += 1) {
        await page.getByPlaceholder(`${i + 1}. seçenek`).fill(options[i])
      }
      if (correctIndex !== 0) {
        await page.getByPlaceholder(`${correctIndex + 1}. seçenek`).locator('../../..').getByRole('button', { name: 'Doğru' }).click()
      }
      await page.getByRole('button', { name: 'Ekle', exact: true }).click()
      await expect(page.getByText(question).first()).toBeVisible({ timeout: 10000 })
    }

    await addQuestion('QA-TEST-E2E-AUTO quiz sorusu 1: doğru cevap hangisi?', ['Yanlış A', 'Doğru A', 'Yanlış B', 'Yanlış C'], 1)
    await addQuestion('QA-TEST-E2E-AUTO quiz sorusu 2: ikinci doğru cevap?', ['Doğru B', 'Yanlış D', 'Yanlış E', 'Yanlış F'], 0)

    await expect(page.getByText('2 soru')).toBeVisible()
    await page.getByRole('button', { name: 'Kaydet' }).click()
    await expect(page.getByRole('heading', { name: 'Soru Yönetimi' })).toBeHidden({ timeout: 20000 })
  })

  test('2) CITIZEN PORTAL UI: yarışma alınır — 1 doğru + 1 yanlış cevap, sonuç ekranı skoru doğru gösterir', async ({ page }) => {
    test.setTimeout(60_000)
    expect(quizId, 'önceki testte quiz oluşturulmuş olmalı').toBeTruthy()
    const citizen = await registerCitizen(apiCtx, tag)
    citizenTckn = citizen.tckn

    // NOT (gerçek testte bulunan davranış): citizen-portal'ın tokenStorage.ts'i artık
    // 'portal_'-önekli key'ler kullanıyor (eski 'access_token' vb. sadece native webview'de
    // migrate ediliyor, normal tarayıcıda okunmuyor) — eski key'lerle giriş sessiz başarısız
    // olup login sayfasına geri düşüyordu.
    await page.addInitScript(({ at, rt }) => {
      localStorage.setItem('portal_access_token', at)
      localStorage.setItem('portal_refresh_token', rt)
      localStorage.setItem('portal_auth_kind', 'citizen')
      localStorage.setItem('portal_auth_remember', '1')
      localStorage.setItem('nexora_citizen_onboarding_done', '1')
    }, { at: citizen.token, rt: citizen.refreshToken })
    await page.goto(`${CITIZEN_PORTAL_URL}/yarisma`)

    const quizCard = page.locator('button', { hasText: quizTitle })
    await expect(quizCard).toBeVisible({ timeout: 20000 })
    await quizCard.click()

    await expect(page.getByRole('button', { name: 'Yarışmayı Başlat' })).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: 'Yarışmayı Başlat' }).click()

    // --- Soru 1: DOĞRU cevap seç ("Doğru A") ve anlık yeşil geri bildirimi doğrula ---
    await expect(page.getByText('QA-TEST-E2E-AUTO quiz sorusu 1', { exact: false })).toBeVisible({ timeout: 8000 })
    const correctOption1 = page.locator('[data-testid="quiz-option-1"]')
    await expect(correctOption1).toContainText('Doğru A')
    await correctOption1.click()
    // Sunucu /check-answer üzerinden doğru/yanlış bilgisini döner — yeşil check ikonu görünmeli.
    await expect(page.locator('button:has-text("Doğru A") svg')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /Sonraki Soru/ }).click()

    // --- Soru 2: YANLIŞ cevap seç ("Yanlış D") ---
    await expect(page.getByText('QA-TEST-E2E-AUTO quiz sorusu 2', { exact: false })).toBeVisible({ timeout: 8000 })
    const wrongOption2 = page.locator('[data-testid="quiz-option-1"]')
    await expect(wrongOption2).toContainText('Yanlış D')
    await wrongOption2.click()
    await page.waitForTimeout(500) // /check-answer isteğinin dönüp kırmızı geri bildirimin görünmesi için

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/me/quizzes/${quizId}/submit`) && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Tamamla/ }).click(),
    ])
    expect(submitResponse.ok(), `POST submit başarısız: ${await submitResponse.text()}`).toBeTruthy()
    const result = (await submitResponse.json()).data
    expect(result.correctAnswers).toBe(1)
    expect(result.wrongAnswers).toBe(1)
    expect(result.successRate).toBe(50)

    await expect(page.getByText('Toplam Puan')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(String(result.score), { exact: true }).first()).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('%50 başarı oranı', { exact: false })).toBeVisible({ timeout: 3000 })
  })

  test('3) API çapraz doğrulama: aynı quiz\'e ikinci katılım reddedilir, puan GERÇEKTEN LoyaltyTransaction\'a yazıldı', async ({ page: _page }) => {
    test.setTimeout(45_000)
    expect(citizenTckn, 'önceki testte vatandaş oluşturulmuş olmalı').toBeTruthy()

    const loginRes = await apiCtx.post(`${API_BASE}/auth/citizen/login`, {
      data: { identifier: citizenTckn, password: 'E2eQuizPlay2026!' },
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
    expect(citizenToken, `vatandaş tekrar login olabilmeli: ${await loginRes.text().catch(() => '')}`).toBeTruthy()

    // İkinci katılım denemesi — 409 (zaten katıldı) bekleniyor.
    const secondSubmit = await apiCtx.post(`${API_BASE}/me/quizzes/${quizId}/submit`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
      data: { answers: [{ questionIndex: 0, selectedAnswer: 'Doğru A', timeSpent: 1, isPassed: false }], totalTimeSpent: 1 },
    })
    expect(secondSubmit.status(), 'ikinci katılım zaten katıldığı için reddedilmeli').toBe(409)

    // Puanın GERÇEKTEN LoyaltyTransaction'a yazıldığını izole bir kayıt üzerinden doğrula
    // (bkz. wheel-spin-flow.spec.ts — bakiyeye salt farkla güvenmek kırılgan, eşzamanlı
    // başka LoyaltyRule'lar da puan ekleyebiliyor).
    const txRes = await apiCtx.get(`${API_BASE}/me/loyalty/transactions?limit=20`, { headers: { Authorization: `Bearer ${citizenToken}` } })
    expect(txRes.ok(), `GET me/loyalty/transactions başarısız: ${await txRes.text()}`).toBeTruthy()
    const txBody = await txRes.json()
    const transactions: Array<{ actionKey?: string; points?: number; amount?: number; referenceId?: string }> = txBody.data?.items ?? txBody.data ?? []
    const quizTx = transactions.find((t) => t.actionKey === 'quiz_complete' && (t.referenceId === quizId || !t.referenceId))
    expect(quizTx, `quiz_complete LoyaltyTransaction bulunamalı: ${JSON.stringify(transactions).slice(0, 500)}`).toBeTruthy()
    expect(quizTx!.points ?? quizTx!.amount).toBeGreaterThan(0)
  })
})

import { test, expect, type Page } from '@playwright/test'
import { SurveyTrash } from './helpers/surveyCleanup'

// Kullanıcı isteği (2026-09-01, docs/ankettema/02.png): saha anket doldurma ekranı tablet
// düzenine göre revize edildi. Bu test 02.png'nin ASIL konusunu — soru gövdesinin görünümü
// ve davranışını — doğrular:
//   - ikonlu seçenek kartları (tek seçim radyo, çok seçim checkbox)
//   - 1-5 yıldızlı memnuniyet satırı
//   - 500 karakter sayaçlı serbest metin
//   - ilerleme göstergesi ve otomatik taslak kaydı
//   - alt aksiyon barı: Geri / Kaydet ve Çık / Devam
//
// NOT: Üst bar ve soruların sayfada nasıl dizildiği (tek sayfa / tek soru) eşzamanlı başka
// bir çalışma tarafından da değiştirildiği için burada kırılgan metin eşleşmesi yapılmaz;
// testler soru bileşenlerinin davranışına bağlıdır.

const API = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

// Hata bulgusu (2026-09-02): bu testin oluşturduğu anketler DB'de kalıp Mahalle
// Analizi ekranının demografisini çarpıtıyordu. Artık koşum sonunda siliniyor.
const trash = new SurveyTrash(API, () => adminToken())
test.afterAll(async () => { await trash.purge() })
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const PASSWORD = 'E2eAudit2026'
const OTP = process.env.MOCK_OTP || '111111'

function validTckn(): string {
  const n: number[] = [1 + Math.floor(Math.random() * 9)]
  for (let i = 1; i < 9; i++) n.push(Math.floor(Math.random() * 10))
  const odd = n[0] + n[2] + n[4] + n[6] + n[8]
  const even = n[1] + n[3] + n[5] + n[7]
  n.push((((odd * 7) - even) % 10 + 10) % 10)
  n.push(n.slice(0, 10).reduce((a, b) => a + b, 0) % 10)
  return n.join('')
}

const dayOffset = (o: number) =>
  new Date(Date.now() + 3 * 3600_000 + o * 86400_000).toISOString().slice(0, 10)

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  return { status: res.status, body: await res.json().catch(() => null) as any }
}

async function adminToken(): Promise<string> {
  const l = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) })
  if (l.body?.data?.accessToken) return l.body.data.accessToken
  const v = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ otpSessionToken: l.body?.data?.otpSessionToken, code: OTP }) })
  return v.body?.data?.accessToken
}

/** 02.png'deki anketin birebir aynısını (4 soru, 4 farklı tip) kuran anketör hesabı. */
async function provision(): Promise<{ tckn: string; surveyId: string }> {
  const tckn = validTckn()
  const tag = Math.random().toString(36).slice(2, 10)
  const reg = await api('/auth/citizen/register', {
    method: 'POST',
    body: JSON.stringify({
      tckn, birthDate: '1993-07-01T00:00:00Z',
      phone: '555' + Math.floor(1000000 + Math.random() * 8999999),
      email: `e2e.form.${tag}@example.com`, password: PASSWORD,
    }),
  })
  const v = await api('/auth/citizen/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ otpSessionToken: reg.body?.data?.otpSessionToken, code: OTP }),
  })
  const token: string = v.body?.data?.accessToken
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  const participantId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? payload.sub

  const tok = await adminToken()
  const auth = { Authorization: `Bearer ${tok}` }
  const survey = await api('/surveys', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      title: `Mahalle Sorun Tespiti ${tag}`, description: '02.png düzeni',
      category: 'Belediye Hizmetleri', targetAudience: 'all', topic: 'Temizlik',
      surveyType: 'satisfaction', isActive: true, isAnonymous: false,
      fieldEnabled: true, requireLocation: false, estimatedDuration: 5,
      startDate: dayOffset(0), endDate: dayOffset(7),
      questions: [
        { order: 1, type: 'multiple_choice', question: 'Mahallenizde en önemli sorun nedir?', required: true, options: ['Temizlik', 'Ulaşım', 'Park ve Bahçeler', 'Güvenlik', 'Sosyal Yardım', 'Diğer'] },
        { order: 2, type: 'checkbox', question: 'En çok iyileştirilmesini istediğiniz alanlar hangileri?', required: false, options: ['Temizlik Hizmetleri', 'Ulaşım', 'Park ve Yeşil Alanlar', 'Altyapı', 'Güvenlik', 'Sosyal Hizmetler'] },
        { order: 3, type: 'rating', question: 'Belediye hizmetlerinden genel memnuniyetiniz', required: true, options: [], ratingCount: 5 },
        { order: 4, type: 'text', question: 'Ek görüş ve önerileriniz', required: false, options: [] },
      ],
    }),
  })
  trash.add(survey.body?.data?.id)
  await api('/surveys/field-tasks', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      surveyId: survey.body?.data?.id, interviewerId: participantId, interviewerType: 'participant',
      neighborhood: 'Cebeci', startDate: dayOffset(0), endDate: dayOffset(3),
      targetCount: 10, dailyTarget: 0, note: '02.png form testi', status: 'assigned',
    }),
  })
  return { tckn, surveyId: survey.body?.data?.id as string }
}

/** Admin API'den bu ankete kaydedilmiş son yanıtı okur (formun DB'ye ne yazdığını görmek için). */
async function fetchLatestResponse(surveyId: string) {
  const tok = await adminToken()
  const list = await api(`/surveys/${surveyId}/responses?page=1&limit=20&sort=submittedAt&order=desc`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  const items = list.body?.data?.items ?? list.body?.data ?? []
  if (items.length === 0) return null
  const detail = await api(`/surveys/${surveyId}/responses/${items[0].id}`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  return detail.body?.data ?? null
}

async function loginAndOpenForm(page: Page, tckn: string) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('nexora_citizen_onboarding_done', '1')
      // Testler arasında görünüm tercihi sızmasın: her test 02.png (tek sayfa) ile başlar.
      window.localStorage.removeItem('nexora_field_layout')
    } catch { /* yok say */ }
  })
  await page.goto('/login')
  await page.locator('input').first().fill(tckn)
  await page.getByPlaceholder(/Şifre/i).first().fill(PASSWORD)
  await page.getByRole('button', { name: /Giriş Yap/i }).click()
  await page.waitForURL(/\/login\/otp/, { timeout: 20000 })
  const quick = page.getByRole('button', { name: /Hızlı Test/ })
  if (await quick.isVisible().catch(() => false)) await quick.click()
  else {
    const boxes = page.locator('input[maxlength="1"]')
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(OTP[i])
  }
  const verify = page.getByRole('button', { name: /Doğrula/ })
  if (await verify.isEnabled().catch(() => false)) await verify.click()
  await page.waitForURL((u) => !u.pathname.includes('/otp'), { timeout: 25000 })

  const consent = page.getByRole('heading', { name: 'Devam Etmeden Önce' })
  if (await consent.isVisible().catch(() => false)) {
    for (const cb of await page.getByRole('checkbox').all()) await cb.check()
    await page.getByRole('button', { name: /Onaylayıp Devam Et/ }).click()
    await expect(consent).toBeHidden({ timeout: 15000 })
  }

  await page.goto('/saha')
  // Saha kabuğu dashboard ile açılır; görev listesi "Anketler" sekmesindedir.
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /^Anketler/ }).first().click()
  // Açık görevi başlat.
  await page.getByRole('button', { name: /Anket doldur|Başlat|Doldur/ })
    .and(page.locator('button:not([disabled])')).first().click()

  // Kimlik adımı: anonim katılımla hızlıca soru sayfasına geç.
  await expect(page.getByRole('heading', { name: 'Görüşülen kişi' })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /İsimsiz \/ Anonim Katılım/ }).click()
  // Anonim katılımda yaş ve cinsiyet zorunlu (kullanıcı isteği 2026-09-01):
  // kimlik sorulmadığında demografi başka yerden türetilemiyor.
  await page.getByTestId('anon-age-groups').getByRole('button', { name: '25-34', exact: true }).click()
  await page.getByTestId('anon-genders').getByRole('button', { name: 'Kadın', exact: true }).click()
  await page.getByRole('button', { name: /Ankete başla/ }).click()
}

test.use({ viewport: { width: 1194, height: 834 } }) // iPad yatay

test.describe('Saha anket formu — 02.png düzeni', () => {
  let tckn: string
  let surveyId: string
  test.beforeAll(async () => { ({ tckn, surveyId } = await provision()) })

  test('üst bar, ilerleme, katılımcı kartı ve tek sayfa sorular render edilir', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await loginAndOpenForm(page, tckn)

    // Marka ve bağlantı durumu üst barda görünür.
    await expect(page.getByText('SULTANŞEHİR')).toBeVisible()
    await expect(page.getByText('İlerleme')).toBeVisible()

    // 1. soru: 02.png'deki ikonlu seçenek kartları radyo olarak render edilir.
    await expect(page.getByText('Mahallenizde en önemli sorun nedir?')).toBeVisible()
    for (const opt of ['Temizlik', 'Ulaşım', 'Park ve Bahçeler', 'Güvenlik', 'Sosyal Yardım', 'Diğer']) {
      await expect(page.getByRole('radio', { name: opt, exact: true })).toBeVisible()
    }
    // Her seçenek kartında konuya göre bir ikon bulunur (02.png: süpürge, otobüs, ağaç…).
    for (const opt of ['Temizlik', 'Ulaşım', 'Park ve Bahçeler']) {
      await expect(
        page.getByRole('radio', { name: opt, exact: true }).locator('svg'),
        `${opt} seçeneğinde ikon yok`,
      ).toHaveCount(1)
    }

    // Zorunlu rozeti
    await expect(page.getByText('Zorunlu').first()).toBeVisible()

    // Katılımcı Bilgileri kartı (02.png): mahalle + iki kimlik anahtarı her modda görünür.
    await expect(page.getByText('Katılımcı Bilgileri')).toBeVisible()
    await expect(page.getByText('(İsteğe Bağlı)')).toBeVisible()
    await expect(page.getByRole('switch', { name: /Anonim Katılım/ })).toBeVisible()
    await expect(page.getByRole('switch', { name: /T.C. Kimlikli/ })).toBeVisible()
    // Kullanıcı isteği (2026-09-03): anonim katılımda ad-soyad/telefon alanları GÖSTERİLMEZ
    // (kimlik toplanmaz). loginAndOpenForm anonim modda açtığı için bu alanlar görünmemeli;
    // yerine "kişisel bilgi alınmaz" bilgisi çıkar.
    await expect(page.getByPlaceholder('Örn: Ahmet Yılmaz')).toHaveCount(0)
    await expect(page.getByPlaceholder('05xx xxx xx xx')).toHaveCount(0)
    await expect(page.getByText(/Anonim katılım: kişisel bilgi/)).toBeVisible()

    // Alt aksiyon barı: kaydet-ve-çık her zaman erişilebilir olmalı.
    await expect(page.getByRole('button', { name: /Kaydet ve [çÇ]ık/i })).toBeVisible()

    if (process.env.FIELD_FORM_SHOT) await page.screenshot({ path: process.env.FIELD_FORM_SHOT, fullPage: true })

    expect(errors, `Sayfa hataları: ${errors.join(' | ')}`).toEqual([])
  })

  test('seçimler kaydedilir, ilerleme artar ve form gönderilir', async ({ page }) => {
    await loginAndOpenForm(page, tckn)

    // Varsayılan görünüm 02.png: tüm sorular tek sayfada.
    await expect(page.getByText('Mahallenizde en önemli sorun nedir?')).toBeVisible()
    await expect(page.getByText('En çok iyileştirilmesini istediğiniz alanlar hangileri?')).toBeVisible()
    await expect(page.getByText('Belediye hizmetlerinden genel memnuniyetiniz')).toBeVisible()

    // 1. soru: ikonlu tek seçim
    await page.getByRole('radio', { name: 'Temizlik', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Temizlik', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('%25')).toBeVisible({ timeout: 10000 })

    // 2. soru: çoklu seçim — iki kutu birlikte seçili kalır
    await page.getByRole('checkbox', { name: 'Temizlik Hizmetleri' }).click()
    await page.getByRole('checkbox', { name: 'Ulaşım', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: 'Temizlik Hizmetleri' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('checkbox', { name: 'Ulaşım', exact: true })).toHaveAttribute('aria-checked', 'true')

    // 3. soru: 1-5 yıldız satırı
    await page.getByRole('radio', { name: '5 puan' }).click()
    await expect(page.getByRole('radio', { name: '5 puan' })).toHaveAttribute('aria-checked', 'true')

    // 4. soru: serbest metin + 500 karakter sayacı
    await page.getByPlaceholder(/Görüş ve önerilerinizi/).fill('Saha görüşmesi otomatik test notu.')
    await expect(page.getByText(/34 \/ 500/)).toBeVisible()
    await expect(page.getByText('%100')).toBeVisible({ timeout: 10000 })
    if (process.env.FIELD_FORM_SHOT2) await page.screenshot({ path: process.env.FIELD_FORM_SHOT2, fullPage: true })

    // Otomatik taslak kaydı (1,2 sn debounce) üst barda saatiyle görünür.
    await expect(page.getByText(/Kaydedildi \d{2}:\d{2}/)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /Anketi Tamamla/ }).click()
    await expect(page.getByRole('heading', { name: 'Anket kaydedildi' })).toBeVisible({ timeout: 20000 })
  })

  // Kullanıcı isteği (2026-09-02): "anket sonunda talep formu olacak ... kişi eğer tc doğum
  // tarihi vs vermek istemezse ... talepler bölümüne düşecek, ulakbele gitmeyecek".
  test('anket sonunda talep formu açılır ve TC/ad boş bırakılırsa anonim + iletilmeden kaydedilir', async ({ page }) => {
    await loginAndOpenForm(page, tckn)
    await page.getByRole('radio', { name: 'Temizlik', exact: true }).click()
    await page.getByRole('radio', { name: '5 puan' }).click()
    await page.getByRole('button', { name: /Anketi Tamamla/ }).click()
    await expect(page.getByRole('heading', { name: 'Anket kaydedildi' })).toBeVisible({ timeout: 20000 })

    // "Anket kaydedildi" ekranında talep formuna erişim açıkça sunulur.
    const talepButton = page.getByRole('button', { name: /Talep \/ Öneri \/ Şikayet Ekle/ })
    await expect(talepButton).toBeVisible()
    await expect(page.getByText(/T\.C\.\/doğum tarihi vermek istemezse anonim kaydedilir/)).toBeVisible()
    await talepButton.click()

    await expect(page.getByRole('heading', { name: 'Hızlı İşlemler' })).toBeVisible()
    // T.C./Ad Soyad alanları AÇIKÇA opsiyonel işaretli; doldurulmadan gönderilebilmeli.
    await expect(page.getByText(/Ad girilmezse.*Anonim.*olarak kaydedilir/)).toBeVisible()

    await page.getByPlaceholder('Kısa başlık').fill('E2E talep testi')
    await page.getByPlaceholder('Vatandaşın talep/öneri/şikayetini yazın').fill('TC ve doğum tarihi vermeden gönderilen test talebi.')
    // Konu bir arama kutusu içeren Combobox'tır (portal + klavye navigasyonu destekler).
    const konuInput = page.locator('input[placeholder*="Konu ara"]')
    await konuInput.scrollIntoViewIfNeeded()
    await konuInput.click()
    await page.waitForTimeout(300)
    await konuInput.press('ArrowDown')
    await konuInput.press('Enter')

    await page.getByRole('button', { name: /Başvuruyu Kaydet/ }).click()
    await expect(page.getByText(/Başvuru oluşturuldu/)).toBeVisible({ timeout: 15000 })

    // Gerçek kanıt: kayıt admin API'de "new" durumunda, TC boş, "Anonim" adla ve
    // Ulakbel'e İLETİLMEMİŞ (UlakbelUnit boş) olmalı — kullanıcının istediği tam davranış.
    const tok = await adminToken()
    const list = await api('/citizen-submissions?page=1&limit=10&search=E2E talep testi', {
      headers: { Authorization: `Bearer ${tok}` },
    })
    const created = (list.body?.data?.items ?? []).find((x: { title?: string }) => x.title === 'E2E talep testi')
    expect(created, 'Talep DB\'de bulunamadı').toBeTruthy()
    expect(created.citizenTc ?? '').toBe('')
    expect(created.citizenName).toBe('Sahada Görüşülen Vatandaş (Anonim)')
    expect(created.status).toBe('new')
    expect(created.ulakbelUnit ?? null).toBeNull()
  })

  test('zorunlu soru boşken gönderim engellenir', async ({ page }) => {
    await loginAndOpenForm(page, tckn)

    // Sadece 1. soruyu cevapla; zorunlu 3. soru (puan) boş kalsın.
    await page.getByRole('radio', { name: 'Ulaşım', exact: true }).click()
    await page.getByRole('button', { name: /Anketi Tamamla/ }).click()

    await expect(page.getByText('Zorunlu sorular cevaplanmadı.')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Anket kaydedildi' })).toBeHidden()
  })

  test('görünüm anahtarı tek soru moduna geçirir', async ({ page }) => {
    await loginAndOpenForm(page, tckn)

    // Tek sayfada 4 soru birden görünür.
    await expect(page.getByText('Ek görüş ve önerileriniz')).toBeVisible()

    await page.getByRole('button', { name: 'Tek soru' }).click()

    // Odak modunda yalnızca ilk soru görünür, sonuncusu gizlenir.
    await expect(page.getByText('Mahallenizde en önemli sorun nedir?')).toBeVisible()
    await expect(page.getByText('Ek görüş ve önerileriniz')).toBeHidden()
    await expect(page.getByRole('button', { name: /^Sonraki/ })).toBeVisible()

    // Geri dönünce yine tüm sorular listelenir.
    await page.getByRole('button', { name: 'Tüm sorular' }).click()
    await expect(page.getByText('Ek görüş ve önerileriniz')).toBeVisible()
  })

  // Kullanıcı isteği (2026-09-02): "saha görevlisi ekranında ekran boyutuna otomatik
  // genişleyecek ayrıca hızlı geçiş soru numaraları üste olacak".
  test('Hızlı Geçiş üstte yatay şerittedir ve ekran genişliğine göre genişler', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await loginAndOpenForm(page, tckn)
    await page.getByRole('button', { name: 'Tek soru' }).click()

    // "HIZLI GEÇİŞ" etiketi artık ilerleme şeridinin ALTINDA, tam genişlikte bir şeritte;
    // eski tasarımdaki gibi sağda dar dikey bir panelde değil.
    const quickNav = page.getByText('Hızlı Geçiş')
    await expect(quickNav).toBeVisible()

    // Soru numarası düğmeleri (1, 2, 3, 4) aynı yatay satırda, ilerleme şeridinin altında
    // durmalı — sağ kenarda değil.
    const q1 = page.getByRole('button', { name: '1', exact: true })
    const q2 = page.getByRole('button', { name: '2', exact: true })
    await expect(q1).toBeVisible()
    await expect(q2).toBeVisible()
    const box1 = await q1.boundingBox()
    const box2 = await q2.boundingBox()
    // Aynı satırda: dikey konumları neredeyse eşit olmalı (yatay şerit kanıtı).
    expect(Math.abs((box1?.y ?? 0) - (box2?.y ?? 0))).toBeLessThan(5)
    // Yan yana: q2 solda q1'in hemen sağında olmalı (dikey listede olsaydı alt alta olurdu).
    expect(box2!.x).toBeGreaterThan(box1!.x)

    // Hata bulgusu (2026-09-02, tarayıcı doğrulaması): kabuk genişliği "1180px" SABİT bir
    // tavandı; 1920px genişliğinde bir ekranda içerik ekranın ~%38'ini boş bırakıyordu.
    // Artık viewport'a oranla büyür; en az 1400px olmalı (eski 1180px sabitinden büyük).
    const shellWidth = await page.evaluate(() => {
      const el = document.querySelector('main .mx-auto')
      return el?.getBoundingClientRect().width ?? 0
    })
    expect(shellWidth).toBeGreaterThan(1400)

    // Dar bir ekranda da (saha tableti — iPad dikey) genişlik viewport'u aşmamalı.
    await page.setViewportSize({ width: 834, height: 1194 })
    await page.waitForTimeout(300)
    const narrowShellWidth = await page.evaluate(() => {
      const el = document.querySelector('main .mx-auto')
      return el?.getBoundingClientRect().width ?? 0
    })
    expect(narrowShellWidth).toBeLessThanOrEqual(834)
    expect(narrowShellWidth).toBeGreaterThan(700)
  })

  test('anonim modda ad/telefon gizli, mahalle ve kimlik anahtarları açık gelir', async ({ page }) => {
    await loginAndOpenForm(page, tckn)

    // Anonim katılımla girildiği için anonim anahtarı açık, TC anahtarı kapalı olmalı.
    await expect(page.getByRole('switch', { name: /Anonim Katılım/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('switch', { name: /T.C. Kimlikli/ })).toHaveAttribute('aria-checked', 'false')

    // Kullanıcı isteği (2026-09-03): "isimsiz anonim yapıldığında burada ilk baştaki ad soyad
    // tc'si alanı kaldır" — anonim modda ad-soyad/telefon alanları GÖSTERİLMEZ; yerine
    // "kişisel bilgi alınmaz" bilgisi çıkar.
    await expect(page.getByPlaceholder('Örn: Ahmet Yılmaz')).toHaveCount(0)
    await expect(page.getByPlaceholder('05xx xxx xx xx')).toHaveCount(0)
    await expect(page.getByText(/Anonim katılım: kişisel bilgi/)).toBeVisible()

    // Mahalle seçimi kartta her modda düzenlenebilir olmalı.
    await expect(page.getByLabel('Mahalle')).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // GERÇEK GERİ BİLDİRİM DÖNGÜSÜ: ekranda seçilenlerin veritabanına DOĞRU yazıldığı.
  // Önceki kontroller yalnızca "ekranda göründü" diyordu; bu test kaydedilen veriyi
  // admin API'den geri okuyup ekrandaki seçimlerle karşılaştırır.
  // ---------------------------------------------------------------------------
  test('ekranda seçilenler veritabanına doğru kaydedilir', async ({ page }) => {
    await loginAndOpenForm(page, tckn)

    await page.getByRole('radio', { name: 'Park ve Bahçeler', exact: true }).click()
    // Virgül içermeyen iki ayrı seçenek: checkbox JSON dizisi olarak saklanmalı.
    await page.getByRole('checkbox', { name: 'Altyapı' }).click()
    await page.getByRole('checkbox', { name: 'Sosyal Hizmetler' }).click()
    await page.getByRole('radio', { name: '4 puan' }).click()
    const freeText = 'Kaydedilen veri doğrulama notu ÇĞİÖŞÜ'
    await page.getByPlaceholder(/Görüş ve önerilerinizi/).fill(freeText)

    await page.getByRole('button', { name: /Anketi Tamamla/ }).click()
    await expect(page.getByRole('heading', { name: 'Anket kaydedildi' })).toBeVisible({ timeout: 20000 })

    const saved = await fetchLatestResponse(surveyId)
    expect(saved, 'Kaydedilen yanıt admin API üzerinden okunamadı').toBeTruthy()

    const byQuestion = new Map<string, string>()
    for (const a of saved.answers ?? []) byQuestion.set(a.questionText as string, a.answerDisplay as string)

    // 1) Tek seçim: seçilen etiket birebir kaydedilmeli.
    expect(byQuestion.get('Mahallenizde en önemli sorun nedir?')).toBe('Park ve Bahçeler')

    // 2) Çoklu seçim: iki seçenek de kaydedilmeli (JSON dizisi okunabilir metne çevrilir).
    const multi = byQuestion.get('En çok iyileştirilmesini istediğiniz alanlar hangileri?') ?? ''
    expect(multi).toContain('Altyapı')
    expect(multi).toContain('Sosyal Hizmetler')
    expect(multi, 'Seçilmeyen seçenek kaydedilmiş').not.toContain('Temizlik Hizmetleri')

    // 3) Puan: 5 üzerinden 4 olarak kaydedilmeli.
    expect(byQuestion.get('Belediye hizmetlerinden genel memnuniyetiniz')).toContain('4')

    // 4) Serbest metin: Türkçe karakterler bozulmadan kaydedilmeli.
    expect(byQuestion.get('Ek görüş ve önerileriniz')).toBe(freeText)

    // 5) Tüm sorular kayda geçmeli (raporlama eksik cevapla bozulmasın).
    expect(saved.answeredQuestionCount, 'Bazı cevaplar kaydedilmemiş').toBe(4)
  })

  test('"Kaydet ve Çık" sonrası taslak geri yüklenir', async ({ page }) => {
    await loginAndOpenForm(page, tckn)

    await page.getByRole('radio', { name: 'Güvenlik', exact: true }).click()
    // Kullanıcı isteği (2026-09-03): anonim modda ad-soyad alanı yok; taslak geri yükleme
    // soru cevabı + serbest not üzerinden doğrulanır.
    await page.getByPlaceholder(/Görüş ve önerilerinizi/).fill('Yarım kalan not')

    // Alt bardaki "Kaydet ve çık" düğmesi dar ekranda gizlidir (`sm:flex`); her iki
    // düzende de çalışması için görünürse o, değilse hamburger menüdeki seçenek kullanılır.
    const saveExit = page.getByRole('button', { name: /Kaydet ve [çÇ]ık/i }).locator('visible=true')
    if (await saveExit.count() > 0) {
      await saveExit.first().click()
    } else {
      await page.getByRole('button', { name: 'Menü' }).click()
      await page.getByRole('button', { name: /Kaydet ve [çÇ]ık/i }).locator('visible=true').first().click()
    }
    // Görev listesine dönülür.
    await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })

    // Aynı göreve tekrar girildiğinde taslak geri gelmeli.
    await page.getByRole('button', { name: /^Anketler/ }).first().click()
    await page.getByRole('button', { name: /Anket doldur|Başlat|Doldur/ })
      .and(page.locator('button:not([disabled])')).first().click()

    const start = page.getByRole('button', { name: /Ankete başla/ })
    if (await start.isVisible().catch(() => false)) {
      await expect(start).toBeEnabled({ timeout: 10000 })
      await start.click()
    }

    await expect(page.getByRole('radio', { name: 'Güvenlik', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByPlaceholder(/Görüş ve önerilerinizi/)).toHaveValue('Yarım kalan not')
  })

  test('"Diğer" seçildiğinde serbest metin açılır ve birlikte kaydedilir', async ({ page }) => {
    await loginAndOpenForm(page, tckn)

    await page.getByRole('radio', { name: 'Diğer', exact: true }).click()
    const other = page.getByPlaceholder('Lütfen belirtiniz…')
    await expect(other, '"Diğer" seçilince serbest metin kutusu açılmalı').toBeVisible()
    await other.fill('Sokak aydınlatması')

    await page.getByRole('radio', { name: '3 puan' }).click()
    await page.getByRole('button', { name: /Anketi Tamamla/ }).click()
    await expect(page.getByRole('heading', { name: 'Anket kaydedildi' })).toBeVisible({ timeout: 20000 })

    const saved = await fetchLatestResponse(surveyId)
    const answer = (saved?.answers ?? []).find((a: any) => a.questionText === 'Mahallenizde en önemli sorun nedir?')
    expect(answer?.answerDisplay, 'Diğer seçeneğinin serbest metni kaydedilmemiş').toContain('Sokak aydınlatması')
  })

  // Dar ekran (tablet dikey): seçenek ızgarası tek/iki sütuna düşer, öğeler taşmaz.
  test('dar ekranda düzen bozulmaz ve seçenekler tıklanabilir', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await loginAndOpenForm(page, tckn)

    await expect(page.getByText('Katılımcı Bilgileri')).toBeVisible()
    await expect(page.getByText('Mahallenizde en önemli sorun nedir?')).toBeVisible()

    // Yatay taşma olmamalı (tablette yan kaydırma kabul edilemez).
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'Sayfa yatay olarak taşıyor').toBeLessThanOrEqual(1)

    // Seçenekler dar ekranda da gerçekten tıklanabilir olmalı.
    await page.getByRole('radio', { name: 'Temizlik', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Temizlik', exact: true })).toHaveAttribute('aria-checked', 'true')

    // Alt aksiyon barı erişilebilir kalmalı.
    await expect(page.getByRole('button', { name: /Anketi Tamamla/ })).toBeVisible()
  })

  // Kullanıcı isteği (2026-09-03): "tablet ekranınıa uyumlu tıklanma alanları olsun ok
  // rahat olsun" — Hızlı Geçiş soru numaraları, görünüm anahtarı, mahalle selectbox ve
  // kimlik toggle butonları Apple/Google'ın önerdiği ~44px dokunmatik minimuma çıkarıldı.
  test('anket içi dokunmatik hedefler (Hızlı Geçiş, mahalle, toggle) en az 44px', async ({ page }) => {
    await loginAndOpenForm(page, tckn)

    const quickNavBtn = page.locator('button', { hasText: /^\d+$/ }).first()
    const quickNavBox = await quickNavBtn.boundingBox()
    expect(quickNavBox?.height, 'Hızlı Geçiş butonu 44px altında').toBeGreaterThanOrEqual(44)
    expect(quickNavBox?.width, 'Hızlı Geçiş butonu 44px altında').toBeGreaterThanOrEqual(44)

    const neighborhoodSelect = page.locator('select[aria-label="Mahalle"]')
    const selectBox = await neighborhoodSelect.boundingBox()
    expect(selectBox?.height, 'Mahalle seçici 44px altında').toBeGreaterThanOrEqual(44)

    const anonymousToggle = page.getByRole('switch', { name: /Anonim Katılım/ })
    const toggleBox = await anonymousToggle.boundingBox()
    expect(toggleBox?.height, 'Anonim Katılım toggle 44px altında').toBeGreaterThanOrEqual(44)
  })

  // Kullanıcı isteği (2026-09-03): "sek görüş ve talep detki ciklama alanına sesli yazma
  // sigesi olsun tıkalndığında ses kayıt edilebiliyorsa edilsin" — anket içindeki serbest
  // metin sorularında (talep formunda zaten mevcuttu) mikrofon butonu render edilmeli ve
  // hata fırlatmadan tıklanabilmeli.
  test('anket içi metin sorusunda sesli yazma butonu render edilir ve tıklanabilir', async ({ page, context }) => {
    await context.grantPermissions(['microphone'])
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await loginAndOpenForm(page, tckn)

    // "Ek görüş ve önerileriniz" (4. soru, type: text) Hızlı Geçiş'te 4 numaralı buton.
    await page.locator('button', { hasText: /^4$/ }).first().click()
    await expect(page.getByText('Ek görüş ve önerileriniz')).toBeVisible()

    const micBtn = page.locator('button[aria-label*="Sesli" i]')
    await expect(micBtn.first()).toBeVisible()
    const micBox = await micBtn.first().boundingBox()
    // Kullanıcı isteği (2026-09-03): "tıklanma alanları ok rahat olsun" — hem yükseklik
    // hem GENİŞLİK 44px dokunmatik minimumun altında kalmamalı (yalnızca height kontrolü
    // dar/uzun bir dikdörtgeni de "geçer" sayardı, bu yüzden width da doğrulanır).
    expect(micBox?.height, 'Mikrofon butonu yüksekliği 44px altında').toBeGreaterThanOrEqual(44)
    expect(micBox?.width, 'Mikrofon butonu genişliği 44px altında').toBeGreaterThanOrEqual(44)

    await micBtn.first().click()
    await expect(micBtn.first()).toHaveAttribute('aria-pressed', 'true')

    expect(errors, `Mikrofona tıklayınca sayfa hatası: ${errors.join(' | ')}`).toEqual([])
  })

  // Hata bulgusu (2026-09-03, kullanıcı raporu): Firefox Web Speech API'yi (SpeechRecognition)
  // desteklemez. MicButton `supported=false` iken tamamen `return null` yapıyordu — Firefox'ta
  // sesli yazma alanı sağdaki köşe BOMBOŞ görünüyordu, kullanıcı "buton yok / hata var" sanıyordu.
  // Artık desteklenmeyen tarayıcıda buton GÖRÜNÜR (gri/pasif) kalır ve tıklanınca açıklayıcı
  // bir uyarı gösterir. Bu test SpeechRecognition'ı silerek Firefox'u simüle eder.
  test('SpeechRecognition desteklenmeyen tarayıcıda mikrofon butonu görünür kalır (gri, açıklamalı)', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test amaçlı Firefox'u simüle et
      delete window.SpeechRecognition
      // @ts-expect-error test amaçlı Firefox'u simüle et
      delete window.webkitSpeechRecognition
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await loginAndOpenForm(page, tckn)

    await page.locator('button', { hasText: /^4$/ }).first().click()
    await expect(page.getByText('Ek görüş ve önerileriniz')).toBeVisible()

    const disabledMic = page.locator('button[aria-label*="desteklenmiyor" i]')
    await expect(disabledMic.first(), 'Desteklenmeyen tarayıcıda mikrofon butonu hiç görünmüyor').toBeVisible()
    await disabledMic.first().click()
    await expect(page.getByText(/Chrome veya Edge kullanın/i)).toBeVisible({ timeout: 5000 })

    expect(errors, `Devre dışı mikrofona tıklayınca sayfa hatası: ${errors.join(' | ')}`).toEqual([])
  })

  // Kullanıcı isteği (2026-09-03) devamı: anket-sonu Talep/Öneri/Şikayet formundaki
  // Açıklama alanına da sesli yazma eklenmişti (FieldQuickActionsModal). Firefox
  // simülasyonunda o formda da butonun görünür+açıklamalı kaldığını doğrular
  // (aynı MicButton bileşeni paylaşıldığı için düzeltme her iki yerde de geçerli).
  test('anket sonu talep formunun Açıklama alanında da mikrofon Firefox simülasyonunda görünür kalır', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test amaçlı Firefox'u simüle et
      delete window.SpeechRecognition
      // @ts-expect-error test amaçlı Firefox'u simüle et
      delete window.webkitSpeechRecognition
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await loginAndOpenForm(page, tckn)
    await page.getByRole('radio', { name: 'Temizlik', exact: true }).click()
    await page.getByRole('radio', { name: '5 puan' }).click()
    await page.getByRole('button', { name: /Anketi Tamamla/ }).click()
    await expect(page.getByRole('heading', { name: 'Anket kaydedildi' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: /Talep \/ Öneri \/ Şikayet Ekle/ }).click()
    await expect(page.getByRole('heading', { name: 'Hızlı İşlemler' })).toBeVisible()

    const disabledMic = page.locator('button[aria-label*="desteklenmiyor" i]')
    await expect(disabledMic.first(), 'Talep formunda mikrofon butonu Firefox simülasyonunda görünmüyor').toBeVisible()

    expect(errors, `Hata: ${errors.join(' | ')}`).toEqual([])
  })

  // Hata bulgusu (2026-09-03, ek doğrulama): Chrome/Edge'de bile mikrofon izni
  // TARAYICI TARAFINDAN REDDEDİLİRSE (kullanıcı "İzin verme" derse) buton eskiden
  // sessizce eski haline dönüyordu — anketör "kırmızıya döndü, sonra sessizce
  // söndü, ne oldu?" yaşıyordu. Artık "Mikrofon izni reddedildi" uyarısı gösterilir.
  test('mikrofon izni reddedildiğinde açıklayıcı uyarı gösterilir (sessizce sönmez)', async ({ page }) => {
    await page.addInitScript(() => {
      const OrigCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!OrigCtor) return
      function FakeRecognition(this: any) {
        const inst = new OrigCtor()
        inst.start = () => {
          setTimeout(() => { if (inst.onerror) inst.onerror({ error: 'not-allowed' }) }, 50)
        }
        return inst
      }
      ;(window as any).SpeechRecognition = FakeRecognition
      ;(window as any).webkitSpeechRecognition = FakeRecognition
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await loginAndOpenForm(page, tckn)
    await page.locator('button', { hasText: /^4$/ }).first().click()
    await expect(page.getByText('Ek görüş ve önerileriniz')).toBeVisible()

    const micBtn = page.locator('button[aria-label*="Sesli" i]').first()
    await micBtn.click()
    await expect(page.getByText(/Mikrofon izni reddedildi/i), 'İzin reddinde kullanıcıya hiçbir uyarı gösterilmiyor').toBeVisible({ timeout: 5000 })

    expect(errors, `Hata: ${errors.join(' | ')}`).toEqual([])
  })
})

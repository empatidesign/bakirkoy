import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { waitIdle } from './helpers/videoProof'

// Saha görevlisi ekranı tablette kullanılır (iPad dikey 820x1180, yatay 1180x820).
// Dev veritabanında test kullanıcısına atanmış saha görevi olmayabildiği için
// görev ve anket verisi route ile sağlanır; ölçülen şey gerçek UI'nin tablet
// yerleşimi: dokunma hedefi boyutu, yatay taşma ve metin kırpılması.
const TABLETS = [
  { name: 'iPad dikey', width: 820, height: 1180 },
  { name: 'iPad yatay', width: 1180, height: 820 },
]

const TASK_ID = '99999999-9999-9999-9999-999999999999'

const task = {
  id: TASK_ID,
  surveyId: '88888888-8888-8888-8888-888888888888',
  surveyTitle: 'Mahalle Memnuniyet Anketi',
  surveyCategory: 'Belediye Hizmetleri',
  neighborhood: 'Cebeci',
  category: 'Belediye Hizmetleri',
  questionCount: 10,
  estimatedDuration: 6,
  targetCount: 50,
  completedCount: 12,
  todayCount: 3,
  dailyTarget: 10,
  progressPercent: 24,
  isWindowOpen: true,
  startDate: null,
  endDate: null,
  requireLocation: false,
  isAnonymous: false,
  status: 'active',
}

// Kapalı (tarih dışı) görev: satırda uyarı ve pasif düğme render edilir;
// bu durumun da tablete sığdığı ölçülsün diye listeye eklendi.
const closedTask = {
  ...task,
  id: '77777777-7777-7777-7777-777777777777',
  surveyTitle: 'Kapalı Dönem Anketi',
  isWindowOpen: false,
}

// Saha anketlerinde kullanılan tüm soru tipleri; her biri farklı widget render
// eder ve dokunma hedefi boyutu tipe göre değişir, bu yüzden hepsi tek tek gezilir.
const q = (id: string, type: string, question: string, extra: Record<string, unknown> = {}) => ({
  id, order: 1, type, question, description: null, required: false,
  options: [], scaleMin: null, scaleMax: null, minLabel: null, maxLabel: null, ratingCount: null,
  ...extra,
})

const questions = [
  q('q1', 'multiple_choice', 'Mahallenizdeki temizlik hizmetinden memnun musunuz?', { options: ['Çok memnunum', 'Memnunum', 'Kararsızım', 'Memnun değilim'] }),
  q('q2', 'rating', 'Belediye hizmetlerini 5 üzerinden puanlayın', { ratingCount: 5 }),
  q('q3', 'emoji_rating', 'Mahallenizi genel olarak nasıl buluyorsunuz?'),
  q('q4', 'satisfaction', 'Ulaşım hizmetinden memnuniyetiniz'),
  q('q5', 'agreement', 'Park ve yeşil alanlar yeterli'),
  q('q6', 'like_dislike', 'Yeni pazar yerini beğendiniz mi?'),
  q('q7', 'yes_no', 'Belediye çağrı merkezini aradınız mı?'),
  q('q8', 'scale', 'Belediyeyi tavsiye eder misiniz?', { scaleMin: 0, scaleMax: 10, minLabel: 'Hiç', maxLabel: 'Kesinlikle' }),
  q('q9', 'checkbox', 'Hangi hizmetleri kullanıyorsunuz?', { options: ['Kütüphane', 'Spor salonu', 'Kurslar', 'Sosyal yardım'] }),
  q('q10', 'text', 'Eklemek istediğiniz görüşünüz var mı?'),
]

async function stubFieldApi(page: import('@playwright/test').Page) {
  const ok = (data: unknown) => ({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, statusCode: 200, data }),
  })
  await page.route('**/api/v1/me/surveys/field/tasks', (r) => r.fulfill(ok([task, closedTask])))
  await page.route(`**/api/v1/me/surveys/field/tasks/${TASK_ID}`, (r) =>
    r.fulfill(ok({ task, survey: { id: task.surveyId, title: task.surveyTitle, description: '', isAnonymous: false, questions }, questions })))
  await page.route(`**/api/v1/me/surveys/field/tasks/${TASK_ID}/responses*`, (r) => r.fulfill(ok([])))
  await page.route('**/api/v1/me/surveys/field-assignment', (r) => r.fulfill(ok({ hasActiveAssignment: true })))
}

// Dokunma hedefi: iOS HIG ve Material 44/48px önerir; saha görevlisi ayakta,
// tek elle, eldivenle kullanabildiği için 44px altı öğeler kabul edilmez.
const MIN_TOUCH = 44

async function smallTargets(page: import('@playwright/test').Page) {
  return page.evaluate((min) => {
    const bad: string[] = []
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.height < min) bad.push(`<${el.tagName.toLowerCase()}> "${(el.textContent || (el as HTMLInputElement).placeholder || '').trim().slice(0, 30)}" ${Math.round(r.height)}px`)
    }
    return bad
  }, MIN_TOUCH)
}

async function horizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

// Tablette kırpılan bir etiket, anketörün hangi görevi seçtiğini göremeden
// dokunması demek; bu yüzden metin taşması da ölçülür.
async function clippedTexts(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const bad: string[] = []
    for (const el of document.querySelectorAll('button, td, th, h1, h2, h3, p')) {
      if (el.children.length > 0) continue
      if (el.scrollWidth > el.clientWidth + 1) bad.push((el.textContent || '').trim().slice(0, 34))
    }
    return bad
  })
}

test.describe('Saha anket ekranı tablet uyumu', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  // Ölçümler ~10 sn sürüyor ama her test canlı API üzerinden tam giriş
  // (şifre + OTP) yapıyor; paket toplu koştuğunda 30 sn'lik varsayılan limit
  // sınıra dayanıp sahte "flaky" üretiyordu.
  test.setTimeout(75_000)

  for (const t of TABLETS) {
    test(`${t.name}: görev listesi ve anket akışı tablete uygun`, async ({ page }) => {
      await page.setViewportSize({ width: t.width, height: t.height })
      await stubFieldApi(page)
      await login(page)
      await page.goto('/saha')
      await waitIdle(page)

      // Görev listesi "Anketler" sekmesinde; açılış sekmesi dashboard.
      await page.getByRole('button', { name: /^Anketler/ }).first().click()
      await expect(page.getByText('Mahalle Memnuniyet Anketi').first()).toBeVisible({ timeout: 10_000 })

      expect(await horizontalOverflow(page), 'görev listesi yatay taşmamalı').toBeLessThanOrEqual(0)
      expect(await smallTargets(page), 'görev listesinde 44px altı dokunma hedefi olmamalı').toEqual([])
      expect(await clippedTexts(page), 'görev listesinde metin kırpılmamalı').toEqual([])

      // Anket akışına gir: kimlik adımı.
      await page.getByRole('button', { name: /Anketi Başlat/ }).first().click()
      await expect(page.getByRole('heading', { name: 'Görüşülen kişi' })).toBeVisible()
      expect(await horizontalOverflow(page), 'kimlik adımı yatay taşmamalı').toBeLessThanOrEqual(0)
      expect(await smallTargets(page), 'kimlik adımında 44px altı dokunma hedefi olmamalı').toEqual([])

      // Anonim katılımla soru adımına geç.
      await page.getByRole('button', { name: /İsimsiz \/ Anonim Katılım/ }).click()
      // Anonim katılımda yaş ve cinsiyet zorunlu (kullanıcı isteği 2026-09-01).
      await page.getByTestId('anon-age-groups').getByRole('button', { name: '25-34', exact: true }).click()
      await page.getByTestId('anon-genders').getByRole('button', { name: 'Kadın', exact: true }).click()
      await page.getByRole('button', { name: /Ankete başla/ }).click()

      // Saha tasarımı tüm soruları tek sayfada listeliyor: her soru tipi farklı
      // widget render ettiği için hepsinin aynı anda ekranda olduğu doğrulanır,
      // ardından dokunma hedefi ve taşma tüm sayfa üzerinde ölçülür.
      for (const q of questions) {
        await expect(page.getByRole('heading', { name: q.question }), `${q.type}: soru render edilmeli`).toBeVisible()
      }
      await page.waitForTimeout(300) // giriş animasyonları bitsin
      expect(await horizontalOverflow(page), 'soru sayfası yatay taşmamalı').toBeLessThanOrEqual(0)
      expect(await smallTargets(page), 'soru sayfasında 44px altı dokunma hedefi olmamalı').toEqual([])

      // Sayfa sonuna kaydırıldığında da taşma olmamalı (uzun listede kenar durumu).
      await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 99_999))
      await page.waitForTimeout(200)
      expect(await horizontalOverflow(page), 'kaydırma sonrası da taşmamalı').toBeLessThanOrEqual(0)
    })
  }
})

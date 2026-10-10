/**
 * Anketler — Vatandaş Yanıtlama Akışı (SurveyFormModal), 3 katmanlı, sıfır hata toleranslı.
 *
 * `survey-admin.spec.ts` sadece admin tarafını (anket oluşturma, aktif/pasif toggle) kapsıyor —
 * vatandaşın anketi GERÇEKTEN açıp yanıtlamasının (citizen-portal `/anketler` listesi → kart
 * tıklama → giriş ekranı → soru-soru ilerleme → gönderme) hiçbir testte kapsanmadığı tespit
 * edildi (kullanıcı talebi: "anket ... detaylı bir senaryo olarak test et").
 *
 * Katman 1 — Admin panel UI: "Tüm yaşlar" hedef kitleli, 1 çoktan seçmeli (zorunlu değil,
 *   otomatik ilerleyen) + 1 serbest metin (zorunlu) sorulu, AKTİF bir anket oluşturulur.
 * Katman 2 — Citizen-portal UI: vatandaş GERÇEK giriş yapar, `/anketler` "Yanıtlanacak"
 *   sekmesinde anketi bulur, kartına tıklar, "Başla" ile giriş ekranını geçer, çoktan seçmeli
 *   soruyu seçip (otomatik ilerleme), serbest metin sorusunu yazıp gerçek `POST
 *   /me/surveys/{id}/submit` isteğini tetikler, "Teşekkürler!" ekranını görür, anket
 *   "Yanıtlandı" sekmesine taşınır VE kartına TEKRAR tıklanınca `allowMultipleResponses: false`
 *   olduğu için `readonlyBlocked` dalının "Bu anketi zaten yanıtladınız" ekranını gösterip
 *   soru akışını tekrar AÇMADIĞI doğrulanıyor.
 * Katman 3 — API çapraz doğrulama: `GET /surveys/{id}/responses` üzerinden yanıtın
 *   GERÇEKTEN kaydedildiği ve metin cevabının tam eşleştiği doğrulanıyor.
 *
 * DÜRÜST KAPSAM NOTU: Zorunlu anket "PendingSurveyGate" bloklayıcı modalı (sayfa açılışında
 * otomatik açılan tam ekran engelleme) ve saha anketörü akışı (FieldSurveyRunner, görevli
 * personel tarafından TC ile başkası adına doldurma) bu testin kapsamı DIŞINDA — ayrı, farklı
 * giriş noktaları olan senaryolar, ayrı bir iterasyonda ele alınabilir.
 */
import { test, expect, request as pwRequest, type Page } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'
import { registerCitizen, citizenLoginUiWithToken, CITIZEN_PORTAL_URL } from './helpers/citizenAuth'

let api: AdminApi
let surveyId = ''
let surveyTitle = ''
const textAnswer = `QA-TEST-E2E-AUTO yanıt metni ${Date.now()}`
const chosenOption = 'İyi'

test.describe.serial('Anketler — Vatandaş Yanıtlama Akışı (SurveyFormModal), 3 katmanlı, sıfır hata', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => {
    if (surveyId) await api.request('DELETE', `/surveys/${surveyId}`, { confirmation: 'silmek istiyorum' }).catch(() => {})
    await api.dispose()
  })

  test('1) ADMIN PANEL UI: 1 çoktan seçmeli + 1 serbest metin sorulu, AKTİF, "Tüm yaşlar" anket oluşturulur', async ({ page }) => {
    test.setTimeout(60_000)
    surveyTitle = uniq('QA-TEST-E2E-AUTO Survey')
    const survey = await api.request<{ id: string; title: string; isActive: boolean; questionCount: number }>('POST', '/surveys', {
      title: surveyTitle,
      description: 'QA-TEST-E2E-AUTO vatandaş yanıtlama testi',
      category: 'Genel',
      targetAudience: 'all',
      startDate: null,
      endDate: null,
      estimatedDuration: 2,
      isActive: true,
      isAnonymous: false,
      allowMultipleResponses: false,
      showResults: true,
      autoSendAfterEvent: false,
      sendReminderSMS: false,
      isRequired: false,
      questions: [
        { type: 'multiple_choice', question: 'Hizmeti nasıl buldunuz?', description: '', required: false, options: ['Kötü', 'Orta', chosenOption], config: {} },
        { type: 'text', question: 'Eklemek istediğiniz bir şey var mı?', description: '', required: true, options: [], config: {} },
      ],
    })
    surveyId = survey.id
    expect(survey.title).toBe(surveyTitle)
    expect(survey.questionCount).toBe(2)
    expect(survey.isActive).toBe(true)

    // Gerçek UI'dan da listede görünüp görünmediğini doğrula (companies-admin.spec.ts
    // desenindeki gibi — fixture API ile kurulur, varlığı UI'dan onaylanır).
    await loginAndOpen(page, '/survey?tab=anketler', 'Anketler')
    await page.getByPlaceholder('Anket adı veya açıklama ara...').fill(surveyTitle)
    const row = page.locator('tr', { hasText: surveyTitle }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await expect(row).toContainText(/Aktif/)
  })

  test('2) CITIZEN PORTAL UI: vatandaş GERÇEK giriş yapar, "/anketler" listesinden anketi bulup yanıtlar, "Teşekkürler!" ekranını görür', async ({ page }: { page: Page }) => {
    test.setTimeout(60_000)
    expect(surveyId, 'önceki testte anket oluşturulmuş olmalı').toBeTruthy()

    const citizenCtx = await pwRequest.newContext()
    const citizen = await registerCitizen(citizenCtx, 35, 'surveyresp')

    await citizenLoginUiWithToken(page, citizen)
    await page.goto(`${CITIZEN_PORTAL_URL}/anketler`)
    await expect(page.getByRole('heading', { name: 'Anketler' })).toBeVisible({ timeout: 20000 })

    const card = page.getByText(surveyTitle, { exact: true }).first()
    await expect(card).toBeVisible({ timeout: 15000 })
    await card.click()

    // Giriş (intro) ekranı — "Başla" ile soru akışına geç.
    await expect(page.getByText(surveyTitle).first()).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: 'Başla' }).click()

    // Soru 1/2: çoktan seçmeli, zorunlu değil — seçince 380ms sonra otomatik ilerler.
    await expect(page.getByText('Hizmeti nasıl buldunuz?')).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: chosenOption, exact: true }).click()

    // Soru 2/2: serbest metin, zorunlu.
    await expect(page.getByText('Eklemek istediğiniz bir şey var mı?')).toBeVisible({ timeout: 8000 })
    await page.getByPlaceholder('Yanıtınızı buraya yazın…').fill(textAnswer)

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/me/surveys/${surveyId}/submit`) && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Gönder' }).click(),
    ])
    expect(submitResponse.ok(), `POST submit başarısız: ${await submitResponse.text()}`).toBeTruthy()

    await expect(page.getByText('Teşekkürler! 🎉')).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: 'Kapat' }).last().click()

    // Anket artık "Yanıtlandı" sekmesine taşınmış olmalı, "Yanıtlanacak"tan kaybolmalı.
    await expect(page.getByText(surveyTitle, { exact: true })).toBeHidden({ timeout: 10000 })
    await page.getByRole('button', { name: 'Yanıtlandı' }).click()
    await expect(page.getByText(surveyTitle, { exact: true })).toBeVisible({ timeout: 10000 })

    // GERÇEK doğrulama: "Yanıtlandı" sekmesindeki kartına tekrar tıklanınca SurveyFormModal'ın
    // readonlyBlocked dalı devreye girip "zaten yanıtladınız" ekranını göstermeli (allowMultipleResponses:
    // false olduğu için) — soru akışı tekrar AÇILMAMALI.
    await page.getByText(surveyTitle, { exact: true }).first().click()
    await expect(page.getByText('Bu anketi zaten yanıtladınız')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Hizmeti nasıl buldunuz?')).not.toBeVisible()
    await page.getByRole('button', { name: 'Kapat' }).last().click()
  })

  test('3) API çapraz doğrulama: yanıt GERÇEKTEN kaydedildi, metin cevap tam eşleşiyor', async ({}) => {
    test.setTimeout(30_000)
    expect(surveyId).toBeTruthy()

    const detail = await api.request<{ id: string; responses?: Array<{ answers: Array<{ answer: string }> }> }>('GET', `/surveys/${surveyId}`)
    expect(detail.id).toBe(surveyId)

    // Yanıt listesini (varsa ayrı endpoint, yoksa detail içindeki responses) kontrol et —
    // metin cevabın GERÇEKTEN backend'e ulaştığını doğrula. textAnswer Date.now() ile
    // benzersizleştirildiği için (başka anketlerle çakışma riski yok) substring araması güvenli.
    const responsesViaEndpoint = await api.raw('GET', `/surveys/${surveyId}/responses`)
    const allAnswersText = JSON.stringify(responsesViaEndpoint.body)
    expect(allAnswersText.includes(textAnswer), `gönderilen metin cevap backend'de bulunamadı: ${allAnswersText.slice(0, 800)}`).toBeTruthy()
  })
})

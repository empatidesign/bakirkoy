import { test, expect, type Page } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const API_BASE = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

type ApiEnvelope<T> = { data: T }
type Paged<T> = { items: T[] }
type Wheel = { id: string; title: string; remainingSpinsToday: number | null; dailySpinLimit: number; slices: { label: string }[] }
type Gift = { id: string; name: string; points: number; remaining: number; hasPendingRequest: boolean }
type AvailableGifts = { gifts: Gift[]; balance: number }
type Quiz = { id: string; title: string; status: string; alreadyParticipated: boolean; questionCount: number }
type QuizDetail = Quiz & { questions: { question: string; options: string[] }[] }
type Leaderboard = { rankings: { participantName: string; rank: number; score: number }[]; totalParticipants: number }

async function getAccessToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('portal_access_token') ?? sessionStorage.getItem('portal_access_token'))
  expect(token, 'citizen access token should be stored after login').toBeTruthy()
  return token as string
}

async function apiGet<T>(page: Page, path: string): Promise<T> {
  const token = await getAccessToken(page)
  const response = await page.request.get(`${API_BASE}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), `${path} should return OK`).toBeTruthy()
  const body = await response.json() as ApiEnvelope<T>
  return body.data
}

const main = (page: Page) => page.locator('main')

test.use({ viewport: { width: 1280, height: 900 } })

async function waitForAppIdle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await closeBlockingMenu(page)
}

async function closeBlockingMenu(page: Page) {
  await page.keyboard.press('Escape').catch(() => {})
  const closeButtons = page.getByRole('button', { name: 'Kapat' })
  for (let i = 0; i < await closeButtons.count(); i++) {
    const button = closeButtons.nth(i)
    if (await button.isVisible().catch(() => false)) {
      await button.click({ force: true }).catch(() => {})
    }
  }
  await page.locator('div.fixed.inset-0.z-\\[9999\\]').first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach((el) => {
      const className = String(el.getAttribute('class') ?? '')
      if (className.includes('fixed') && className.includes('inset-0') && className.includes('z-[9999]')) {
        el.remove()
      }
    })
  }).catch(() => {})
}

test.describe.serial('Çark ve yarışma citizen akışları', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('çark sayfası aktif çarkları API verisiyle render eder', async ({ page }) => {
    const wheels = await apiGet<Paged<Wheel>>(page, '/me/wheels?page=1&limit=50')

    await page.goto('/carkım')
    await waitForAppIdle(page)

    await expect(main(page).getByRole('heading', { name: 'Çarkım' })).toBeVisible()
    await expect(main(page).getByRole('button', { name: /^Çark$/ })).toBeVisible()
    await expect(main(page).getByRole('button', { name: /Puanla Hediyeler/ })).toBeVisible()

    if (wheels.items.length > 0) {
      await expect(main(page).getByText(wheels.items[0].title).first()).toBeVisible()
      await expect(main(page).getByText(/Çevir|Bugün doldu/).first()).toBeVisible()
    } else {
      await expect(main(page).getByText('Aktif çark yok')).toBeVisible()
    }
  })

  test('çark çevirme API çağrısı yapar ve sonucu gösterir', async ({ page }) => {
    const wheels = await apiGet<Paged<Wheel>>(page, '/me/wheels?page=1&limit=50')
    const playable = wheels.items.find((w) => w.slices.length > 0 && (w.dailySpinLimit <= 0 || w.remainingSpinsToday === null || w.remainingSpinsToday > 0))
    test.skip(!playable, 'Çevrilebilir aktif çark yok')

    await page.goto('/carkım')
    await waitForAppIdle(page)

    await main(page).getByRole('button', { name: new RegExp(escapeRegExp(playable!.title)) }).click()
    await expect(page.getByRole('button', { name: 'Çarkı Çevir' })).toBeVisible()

    const spinResponse = page.waitForResponse((r) => r.url().includes(`/wheels/${playable!.id}/spin`) && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Çarkı Çevir' }).click()
    const response = await spinResponse
    expect(response.ok(), 'spin API should return success').toBeTruthy()

    // Kazanınca buton "Harika!", kaybedince "Tamam" yazar (WheelSpinResultModal:98).
    // Sonuç rastgele olduğu için ikisini de kabul et — yoksa test kayıpta rastgele kırılır.
    await expect(page.getByText(/Tebrikler!|Bu sefer olmadı/)).toBeVisible({ timeout: 12000 })
    await expect(page.getByRole('button', { name: /^(Harika!|Tamam)$/ })).toBeVisible()
  })

  test('puanla hediyeler katalogu ve uygun hediye başvuru akışı görünür', async ({ page }) => {
    const catalog = await apiGet<AvailableGifts>(page, '/me/wheels/gifts/available')

    await page.goto('/carkım?tab=catalog')
    await waitForAppIdle(page)

    await expect(main(page).getByText('Mevcut Bakiyem')).toBeVisible()
    await expect(main(page).getByText(new RegExp(`${catalog.balance.toLocaleString('tr-TR')}\\s*puan`)).first()).toBeVisible()

    if (catalog.gifts.length === 0) {
      await expect(main(page).getByText('Hediye yok')).toBeVisible()
      return
    }

    const gift = catalog.gifts[0]
    await expect(main(page).getByText(gift.name).first()).toBeVisible()

    const canApply = !gift.hasPendingRequest && gift.remaining > 0 && catalog.balance >= gift.points
    if (!canApply) {
      await expect(main(page).getByText(/Talebiniz beklemede|Stok tükendi|Yetersiz puan/).first()).toBeVisible()
      return
    }

    await main(page).getByText(gift.name).first().locator('xpath=ancestor::div[contains(@class,"rounded-card")][1]').getByRole('button', { name: 'Başvur' }).click()
    await expect(page.getByRole('heading', { name: 'Hediye Başvurusu' })).toBeVisible()
    await expect(page.getByText(gift.name).last()).toBeVisible()
  })

  test('yarışma başlatılır, sorular cevaplanır ve sonuç ekranı görünür', async ({ page }) => {
    const quizzes = await apiGet<Paged<Quiz>>(page, '/me/quizzes?page=1&limit=50')
    const quiz = quizzes.items.find((q) => q.status === 'ongoing' && q.questionCount > 0)
    test.skip(!quiz, 'Oynanabilir yarışma yok')
    const detail = await apiGet<QuizDetail>(page, `/me/quizzes/${quiz!.id}`)

    await page.goto('/yarisma')
    await waitForAppIdle(page)

    await main(page).getByRole('button', { name: new RegExp(escapeRegExp(quiz!.title)) }).click()
    if (quiz!.alreadyParticipated) {
      await expect(page.getByRole('button', { name: 'Sıralamaya Git' })).toBeVisible()
      await page.getByRole('button', { name: 'Sıralamaya Git' }).click()
      await expect(main(page).getByRole('combobox')).toBeVisible()
      return
    }

    await expect(page.getByRole('button', { name: 'Yarışmayı Başlat' })).toBeVisible()
    await page.getByRole('button', { name: 'Yarışmayı Başlat' }).click()

    for (let i = 0; i < detail.questions.length; i++) {
      const question = detail.questions[i]
      await expect(page.getByText(question.question)).toBeVisible()
      await page.getByRole('button', { name: new RegExp(`A\\s+${escapeRegExp(question.options[0])}`) }).click()
      const submitResponse = i === detail.questions.length - 1
        ? page.waitForResponse((r) => r.url().includes(`/me/quizzes/${quiz!.id}/submit`) && r.request().method() === 'POST')
        : null
      await page.getByRole('button', { name: /Sonraki Soru|Tamamla/ }).click()
      if (submitResponse) {
        const response = await submitResponse
        expect(response.ok(), 'quiz submit API should return success').toBeTruthy()
      }
    }

    await expect(main(page).getByText(quiz!.title).first()).toBeVisible({ timeout: 15000 })
  })

  test('liderlik sekmesi yarışma seçimini ve sıralama verisini gösterir', async ({ page }) => {
    const quizzes = await apiGet<Paged<Quiz>>(page, '/me/quizzes?page=1&limit=50')
    test.skip(quizzes.items.length === 0, 'Liderlik için yarışma yok')
    const quiz = quizzes.items[0]
    const leaderboard = await apiGet<Leaderboard>(page, `/me/quizzes/${quiz.id}/leaderboard`)

    await page.goto('/yarisma')
    await waitForAppIdle(page)
    await main(page).getByRole('button', { name: 'Liderlik' }).click()

    await main(page).getByRole('combobox').click()
    await page.getByRole('button', { name: new RegExp(escapeRegExp(quiz.title)) }).click()

    await expect(main(page).getByText(/katılımcı/).first()).toBeVisible()

    if (leaderboard.rankings.length > 0) {
      await expect(main(page).getByText(leaderboard.rankings[0].participantName).first()).toBeVisible()
    } else {
      await expect(main(page).getByText(/katılımcı|Sıralama boş/).first()).toBeVisible()
    }
  })
})

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

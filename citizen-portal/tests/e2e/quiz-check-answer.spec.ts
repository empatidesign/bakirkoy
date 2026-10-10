import { test, expect, type Page } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const API_BASE = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

type ApiEnvelope<T> = { data: T }
type Paged<T> = { items: T[] }
type Quiz = { id: string; title: string; status: string; alreadyParticipated: boolean }
type QuizDetail = Quiz & { questions: { question: string; options: string[]; timeLimit: number }[] }

async function getAccessToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('portal_access_token') ?? sessionStorage.getItem('portal_access_token'))
  expect(token, 'citizen access token should be stored after login').toBeTruthy()
  return token as string
}

test.describe.configure({ mode: 'serial' })

test('yarışma cevap kontrol ucu yalnız doğru/yanlış döner, cevap anahtarı sızmaz', async ({ page }) => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgileri yok')
  await login(page)
  const token = await getAccessToken(page)
  const headers = { Authorization: `Bearer ${token}` }

  const listRes = await page.request.get(`${API_BASE}/api/v1/me/quizzes?limit=50`, { headers })
  expect(listRes.ok()).toBeTruthy()
  const list = (await listRes.json() as ApiEnvelope<Paged<Quiz>>).data.items
  const target = list.find((q) => q.status === 'ongoing' && !q.alreadyParticipated)
  test.skip(!target, 'Katılıma açık yarışma yok')

  const detailRes = await page.request.get(`${API_BASE}/api/v1/me/quizzes/${target!.id}`, { headers })
  expect(detailRes.ok()).toBeTruthy()
  const detail = (await detailRes.json() as ApiEnvelope<QuizDetail>).data

  // Anti-cheat: soru yükünde doğru cevabı ele veren hiçbir alan olmamalı.
  const raw = JSON.stringify(detail.questions)
  expect(raw).not.toMatch(/correctAnswer|isCorrect|answerKey/i)

  const q0 = detail.questions[0]
  expect(q0.options.length).toBeGreaterThan(1)

  const verdicts: boolean[] = []
  for (const opt of q0.options) {
    const res = await page.request.post(`${API_BASE}/api/v1/me/quizzes/${target!.id}/check-answer`, {
      headers,
      data: { questionIndex: 0, selectedAnswer: opt },
    })
    expect(res.ok(), 'check-answer 200 dönmeli').toBeTruthy()
    const body = (await res.json() as ApiEnvelope<{ questionIndex: number; isCorrect: boolean }>).data
    expect(Object.keys(body).sort()).toEqual(['isCorrect', 'questionIndex'])
    expect(body.questionIndex).toBe(0)
    verdicts.push(body.isCorrect)
  }

  // Tam olarak bir şık doğru olmalı.
  expect(verdicts.filter(Boolean).length).toBe(1)

  // Geçersiz soru indeksi reddedilmeli.
  const bad = await page.request.post(`${API_BASE}/api/v1/me/quizzes/${target!.id}/check-answer`, {
    headers,
    data: { questionIndex: 9999, selectedAnswer: 'x' },
  })
  expect(bad.status()).toBe(409)
})

test('şık seçilince anlık yeşil/kırmızı geri bildirim görünür', async ({ page }) => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgileri yok')
  await login(page)
  const token = await getAccessToken(page)
  const headers = { Authorization: `Bearer ${token}` }

  const listRes = await page.request.get(`${API_BASE}/api/v1/me/quizzes?limit=50`, { headers })
  const list = (await listRes.json() as ApiEnvelope<Paged<Quiz>>).data.items
  const target = list.find((q) => q.status === 'ongoing' && !q.alreadyParticipated)
  test.skip(!target, 'Katılıma açık yarışma yok')

  await page.goto('/yarisma')
  await page.waitForLoadState('networkidle').catch(() => {})

  const card = page.getByText(target!.title).first()
  await card.waitFor({ timeout: 15000 })
  await card.click()

  const startBtn = page.getByRole('button', { name: 'Yarışmayı Başlat' })
  await startBtn.waitFor({ timeout: 15000 })
  await startBtn.click()

  const option = page.getByTestId('quiz-option-0')
  await option.waitFor({ timeout: 10000 })

  const checkResponse = page.waitForResponse((r) => r.url().includes('/check-answer'), { timeout: 15000 })
  await option.click()
  const res = await checkResponse
  expect(res.status()).toBe(200)

  // Seçilen şık yeşile (doğru) veya kırmızıya (yanlış) boyanmalı.
  // CSS geçişi (transition-all) sürerken ara renk okunabildiği için poll ediliyor.
  await expect.poll(
    () => option.evaluate((el) => getComputedStyle(el).backgroundColor),
    { timeout: 5000 },
  ).toMatch(/^rgba?\((22, 163, 74|220, 38, 38)[,)]/)

  // Şık içindeki rozet beyaz daireye dönüp tik/çarpı ikonu göstermeli.
  const badge = option.locator('div').first()
  await expect.poll(
    () => badge.evaluate((el) => getComputedStyle(el).backgroundColor),
    { timeout: 5000 },
  ).toMatch(/^rgba?\(255, 255, 255[,)]/)
  await expect(badge.locator('svg')).toBeVisible()
})

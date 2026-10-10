import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { apiGet, citizenToken, screenshot, waitIdle, type Paged } from './helpers/videoProof'

test.describe('VIDEO Kanıt — Bilgi Yarışması detaylı akış', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  let token = ''
  test.beforeAll(async ({ request }) => { token = await citizenToken(request) })
  test('yarışma: liste, detay, soru yanıtlama veya katılmışsa liderlik negatif durumu', async ({ page, request }) => {
    const quizzes = await apiGet<Paged<any>>(request, token, '/me/quizzes?page=1&limit=50')
    expect(quizzes.items.length, 'yarışma verisi bulunmalı').toBeGreaterThan(0)
    const quiz = quizzes.items.find((q) => q.status === 'ongoing' && !q.alreadyParticipated)
      ?? quizzes.items.find((q) => q.status === 'ongoing')
      ?? quizzes.items[0]
    await login(page); await page.goto('/yarisma'); await waitIdle(page)
    await expect(page.getByRole('button').filter({ hasText: /Devam Ediyor|Katıldınız|Yarışması|Bilgi/ }).first()).toBeVisible({ timeout: 15000 })
    await screenshot(page, 'quiz-list')
    await page.getByRole('button', { name: new RegExp(quiz.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click()
    await screenshot(page, 'quiz-detail')
    const start = page.getByRole('button', { name: 'Yarışmayı Başlat' })
    if (await start.isVisible().catch(() => false)) {
      await start.click()
      const nextOrDone = page.getByRole('button', { name: /Sonraki Soru|Tamamla/ })
      for (let i = 0; i < 10 && await nextOrDone.isVisible().catch(() => false); i++) {
        await page.getByTestId('quiz-option-0').click({ timeout: 10000 })
        await expect(nextOrDone).toBeEnabled({ timeout: 5000 })
        await nextOrDone.click()
      }
      await page.waitForLoadState('networkidle').catch(() => {})
      await screenshot(page, 'quiz-result-or-progress')
    } else {
      await expect(page.getByRole('button', { name: /Sıralamaya Git|Tekrar katılamaz|Katıldınız/ }).first()).toBeVisible()
      await screenshot(page, 'quiz-already-participated-negative')
    }
  })
})

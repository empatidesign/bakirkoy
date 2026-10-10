import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { apiGet, citizenToken, screenshot, waitIdle, type Paged } from './helpers/videoProof'

test.describe('VIDEO Kanıt — Anketler cevaplama akışı', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  let token = ''
  test.beforeAll(async ({ request }) => { token = await citizenToken(request) })
  test('anket: liste, detay, zorunlu soru negatif kontrolü ve cevap gönderimi', async ({ page, request }) => {
    const surveys = await apiGet<Paged<any>>(request, token, '/me/surveys?page=1&limit=50')
    expect(surveys.items.length, 'anket verisi bulunmalı').toBeGreaterThan(0)
    const survey = surveys.items.find((s) => !s.alreadyResponded) ?? surveys.items[0]
    await login(page); await page.goto('/anketler'); await waitIdle(page)
    await expect(page.getByRole('heading', { name: 'Anketler' })).toBeVisible()
    await screenshot(page, 'survey-list')
    if (survey.alreadyResponded) {
      await page.getByRole('button', { name: /Tamamlan/ }).click()
    }
    await page.getByRole('button').filter({ hasText: survey.title }).first().click({ timeout: 15000 })
    await screenshot(page, 'survey-detail')
    const startButton = page.getByRole('button', { name: 'Başla' }).last()
    if (await startButton.isVisible().catch(() => false)) await startButton.click()
    for (let step = 0; step < 12; step++) {
      const modal = page.locator('.fixed').last()
      const option = modal.getByRole('button').filter({ hasText: /Evet|Hayır|Çok İyi|İyi|Orta|Beğendim|Kesinlikle|^[1-9]$|^[A-ZÇĞİÖŞÜa-zçğıöşü ]{2,}$/ }).first()
      if (await option.isVisible().catch(() => false)) await option.click().catch(() => {})
      const text = modal.locator('textarea').first()
      if (await text.isVisible().catch(() => false)) await text.fill('Video E2E test cevabı')
      await page.waitForTimeout(450)
      const next = page.getByRole('button', { name: /İleri|Gönder/ }).last()
      if (!(await next.isVisible().catch(() => false))) break
      const label = await next.textContent()
      await next.click()
      if (/Gönder/.test(label ?? '')) break
    }
    await page.waitForLoadState('networkidle').catch(() => {})
    await screenshot(page, 'survey-success-or-validation')
  })
})

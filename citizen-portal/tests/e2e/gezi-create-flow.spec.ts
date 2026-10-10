import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

test.describe('Gezi başvuru (create) akışı — vatandaş', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')

  test('Geziler listelenir, detay açılır, uygunluk/şart ve başvuru CTA görünür', async ({ page }) => {
    await login(page)

    await page.goto('/geziler')
    await expect(page.getByRole('heading', { name: 'Geziler' })).toBeVisible()

    const cards = page.locator('button.w-full.text-left.bg-white')
    await expect(cards.first()).toBeVisible({ timeout: 15000 })
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThan(0)

    const [detailResp] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/v1\/me\/travels\/[0-9a-fA-F-]{36}(\?|$)/.test(r.url()) && r.request().method() === 'GET',
        { timeout: 15000 }
      ),
      cards.first().click(),
    ])
    expect(detailResp.status()).toBe(200)

    await expect(
      page
        .getByText('Rezervasyonu Tamamla')
        .or(page.getByText('Yedek Listeye Başvur'))
        .or(page.getByText(/tarihinde açılacak/))
        .or(page.getByText(/sona erdi/))
        .first()
    ).toBeVisible({ timeout: 10000 })
  })
})

import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Gezi yönetimi (admin) — başvuru/onay konsolu', () => {
  test('Gezi sayfası açılır, başvurular sekmesi listeyi yükler', async ({ page }) => {
    await login(page)

    const [appsResp] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/v1\/travel-applications(\?|$)/.test(r.url()) && r.request().method() === 'GET',
        { timeout: 20000 }
      ),
      page.goto('/travels?tab=applications'),
    ])
    expect(appsResp.status()).toBe(200)

    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Gezi Sistemi').first()).toBeVisible({ timeout: 15000 })
  })
})

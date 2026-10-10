import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

const CRASH = [
  'something went wrong', 'bir şeyler ters gitti', 'beklenmeyen bir hata',
  'application error', 'cannot read propert', 'is not a function',
]

test.describe.serial('Tesis (FacilityTemplate) — admin ekran doğrulama', () => {
  test('Spor Salonu modülü hatasız render (tesis motoru + ayar kabuğu)', async ({ page }) => {
    await login(page)
    await page.goto('/sports')
    await page.waitForLoadState('networkidle')

    const body = (await page.locator('body').innerText()).toLowerCase()
    for (const m of CRASH) expect(body, `crash: ${m}`).not.toContain(m)

    await expect(page.locator('body')).toContainText(/spor|tesis|ayarlar|yönet|genel bakış|başvuru|grup/i)
  })
})

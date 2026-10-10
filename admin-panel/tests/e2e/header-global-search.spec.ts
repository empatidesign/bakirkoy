import { test, expect } from '@playwright/test'
import { apiToken } from './helpers/facilityFixture'
import { login } from './helpers/auth'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

test('üst arama: boşken son aramalar, TC ile kişi bulur, tıklayınca detaya gider', async ({ page }) => {
  const token = await apiToken()
  const auth = { Authorization: `Bearer ${token}` }
  const seed = await page.request.get(`${API_BASE}/search`, { headers: auth, params: { q: '12' } })
  const tckn: string = (await seed.json()).data.applications.find((a: { tckn: string }) => /^\d{11}$/.test(a.tckn)).tckn
  const byTc = await page.request.get(`${API_BASE}/search`, { headers: auth, params: { q: tckn } })
  const participant: { id: string } = (await byTc.json()).data.participants[0]

  await login(page)
  await page.evaluate(() => localStorage.removeItem('header-search-recent'))
  const box = page.getByPlaceholder('Tesis, program, grup, ad soyad ara...')

  await box.click()
  await expect(page.getByText('Aramak için yazın')).toBeVisible()
  await expect(page.getByText('Sayfa', { exact: true })).toHaveCount(0)

  await box.fill(tckn)
  const hit = page.locator('button').filter({ hasText: 'Katılımcı ·' }).first()
  await expect(hit).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Aranıyor...')).toHaveCount(0)
  await hit.click()

  await expect(page).toHaveURL(new RegExp(`/participants\\?pid=${participant.id}`))
  await expect(page.getByText('Hızlı İşlemler')).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: 'Kapat' }).first().click()
  await box.click()
  await expect(page.locator('button').filter({ hasText: 'Katılımcı ·' }).first()).toBeVisible()
  await expect(page.getByText('Aranıyor...')).toHaveCount(0, { timeout: 3000 })
})

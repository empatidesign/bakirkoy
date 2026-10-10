import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { apiGet, citizenToken, screenshot, waitIdle, type Paged } from './helpers/videoProof'

test.describe('VIDEO Kanıt — Kampanyalar self kullanım akışı', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  let token = ''
  test.beforeAll(async ({ request }) => { token = await citizenToken(request) })
  test('kampanya: liste, filtre/detay, kullan veya uygun değil negatif durumu', async ({ page, request }) => {
    const campaigns = await apiGet<Paged<any>>(request, token, '/me/campaigns?page=1&limit=50')
    expect(campaigns.items.length, 'kampanya verisi bulunmalı').toBeGreaterThan(0)
    const campaign = campaigns.items[0]
    const campaignName = campaign.title ?? campaign.name
    expect(campaignName, 'kampanya adı API yanıtında bulunmalı').toBeTruthy()
    await login(page); await page.goto('/kampanyalar'); await waitIdle(page)
    await expect(page.getByRole('heading', { name: 'Kampanyalar' })).toBeVisible()
    await screenshot(page, 'campaign-list')
    await page.getByText(campaignName).first().click({ timeout: 15000 })
    await expect(page.getByText(campaignName).first()).toBeVisible()
    await screenshot(page, 'campaign-detail')
    const redeem = page.getByRole('button', { name: /Kullan|QR|Faydalan|Kupon|Al/i }).last()
    if (await redeem.isVisible().catch(() => false) && await redeem.isEnabled().catch(() => false)) {
      await redeem.click()
      await expect(page.getByText(/QR|kod|kullanım|başarı/i).first()).toBeVisible({ timeout: 15000 })
      await screenshot(page, 'campaign-redeem-success')
    } else {
      await expect(page.getByText(/süresi|tükendi|kullanıldı|uygun değil|pasif/i).first()).toBeVisible()
      await screenshot(page, 'campaign-unavailable-negative')
    }
  })
})

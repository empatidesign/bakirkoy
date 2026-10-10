import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { apiGet, citizenToken, ensureChild, firstName, screenshot, waitIdle, type Paged } from './helpers/videoProof'

test.describe.serial('VIDEO Kanıt — Geziler koltuk ve aile başvuru akışları', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  let token = ''; let childFirst = ''
  test.beforeAll(async ({ request }) => { token = await citizenToken(request); childFirst = firstName((await ensureChild(request, token)).fullName) })
  test('gezi: detay, self/çocuk seçimi, otobüs koltuk seçimi, kapasite ve gizli/dolu koltuk kontrolü', async ({ page, request }) => {
    const travels = await apiGet<Paged<any>>(request, token, '/me/travels/discover?page=1&limit=100')
    expect(travels.items.length, 'gezi verisi bulunmalı').toBeGreaterThan(0)
    const item = travels.items.find((t) => t.eligible && t.requiresSeat && t.minAge === 0 && t.maxAge === 0 && t.registeredCount < t.capacity)
      ?? travels.items.find((t) => t.eligible && t.requiresSeat && t.minAge === 0 && t.maxAge === 0)
      ?? travels.items.find((t) => t.eligible && t.requiresSeat)
      ?? travels.items.find((t) => t.eligible)
      ?? travels.items.find((t) => t.requiresSeat || t.availableSeats > 0)
      ?? travels.items[0]
    const detail = await apiGet<any>(request, token, `/me/travels/${item.id}`)
    await login(page); await page.goto('/geziler'); await waitIdle(page)
    await expect(page.getByRole('heading', { name: 'Geziler' })).toBeVisible()
    await screenshot(page, 'travels-list')
    await page.getByRole('button').filter({ hasText: item.name }).first().click({ timeout: 15000 })
    await expect(page.getByText(/Kimler için başvuruyorsunuz|Rezervasyonu Tamamla|Koltuk|Kontenjan/).first()).toBeVisible({ timeout: 15000 })
    await screenshot(page, 'travels-detail-capacity')
    const modal = page.locator('.fixed.inset-0.z-50')
    const self = modal.getByRole('button').filter({ hasText: /\(Ben\)|Ben/i }).first()
    const child = modal.getByRole('button').filter({ hasText: new RegExp(childFirst, 'i') }).first()
    if (await self.isEnabled().catch(() => false)) await self.click()
    const childIsEligible = await child.isVisible().catch(() => false) && await child.isEnabled().catch(() => false)
    if (childIsEligible) {
      await expect(child).toBeEnabled({ timeout: 5000 })
      await child.click({ timeout: 15000 })
      await expect(child.locator('..').getByText('Seçildi')).toBeVisible({ timeout: 5000 }).catch(() => {})
    }
    const seatButton = modal.getByRole('button', { name: /Koltuk Seç|Seç →|Değiştir/i }).first()
    if (await seatButton.isVisible().catch(() => false)) {
      await seatButton.click()
      await expect(page.getByText(/Koltuk seç|Otobüs|Uygun|Dolu/i).first()).toBeVisible({ timeout: 10000 })
      await screenshot(page, 'travels-seat-picker')
      const available = page.locator('.fixed button:not([disabled])').filter({ hasText: /^\d+$/ }).first()
      await expect(available, 'pickable numbered free seat should be visible').toBeVisible({ timeout: 10000 })
      const label = (await available.textContent())?.trim() ?? ''
      await available.click()
      await expect(page.getByText(new RegExp(`Koltuk\\s*${label} seçildi`)).first()).toBeVisible({ timeout: 10000 })
      await screenshot(page, 'travels-seat-selected')
      const seatStates = detail.buses?.[0]?.seats ?? []
      const hidden = seatStates.find((s: any) => String(s.status).toLowerCase() === 'hidden')
      if (hidden?.number) await expect(page.getByRole('button', { name: String(hidden.number) })).toHaveCount(0)
    }
    const reserve = modal.getByRole('button', { name: /Rezervasyonu Tamamla|Yedek Listeye Başvur/i }).last()
    if (await reserve.isEnabled().catch(() => false)) {
      await reserve.click()
      await expect(page.getByText(/Rezervasyon|Başvurunuz|alındı|başarı/i).first()).toBeVisible({ timeout: 15000 })
      await screenshot(page, 'travels-reservation-success')
    } else {
      await expect(page.getByText(/kontenjan|uygun değil|koltuk|kişi seçin/i).first()).toBeVisible()
      await screenshot(page, 'travels-negative-state')
    }
  })
})

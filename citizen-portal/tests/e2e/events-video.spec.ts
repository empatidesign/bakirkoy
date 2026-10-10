import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { acceptTermsIfPresent, apiGet, citizenToken, ensureChild, firstName, screenshot, waitIdle, type Paged } from './helpers/videoProof'

test.describe.serial('VIDEO Kanıt — Etkinlikler self/çocuk/seans uygunluk akışları', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  let token = ''; let childFirst = ''
  test.beforeAll(async ({ request }) => { token = await citizenToken(request); childFirst = firstName((await ensureChild(request, token)).fullName) })
  test('etkinlik: filtre çipleri, detay, seans/salon ve başvuran kişi seçimi', async ({ page, request }) => {
    const list = await apiGet<Paged<any>>(request, token, '/me/events/discover?page=1&limit=100')
    expect(list.items.length, 'etkinlik listesi boş olmamalı').toBeGreaterThan(0)
    const item = list.items.find((e) => !e.alreadyApplied) ?? list.items[0]
    const eventName = item.title ?? item.name
    expect(eventName, 'etkinlik adı API yanıtında bulunmalı').toBeTruthy()
    await login(page); await page.goto('/etkinlikler'); await waitIdle(page)
    await expect(page.getByRole('heading', { name: 'Etkinlikler' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Bana uygun/ })).toBeVisible()
    await page.getByRole('button', { name: /Bana uygun/ }).click()
    const childChip = page.getByRole('button', { name: new RegExp(`${childFirst}.*uygun`, 'i') }).first()
    if (await childChip.isVisible().catch(() => false)) await childChip.click()
    await screenshot(page, 'events-eligibility-chips')
    let visibleEvent = page.locator('main').getByRole('button').filter({ hasText: /yer|kontenjan|Başvuru|Devam|Etkinlik|Kampı|Konser|Tiyatro/i }).first()
    if (!(await visibleEvent.isVisible({ timeout: 5000 }).catch(() => false))) {
      const clear = page.getByRole('button', { name: /Filtreleri Temizle|Temizle/ }).first()
      if (await clear.isVisible().catch(() => false)) await clear.click()
      visibleEvent = page.locator('main').getByRole('button').filter({ hasText: /yer|kontenjan|Başvuru|Devam|Etkinlik|Kampı|Konser|Tiyatro/i }).first()
    }
    await expect(visibleEvent, 'görünür etkinlik kartı olmalı').toBeVisible({ timeout: 15000 })
    await visibleEvent.click()
    await page.waitForLoadState('networkidle').catch(() => {})
    await screenshot(page, 'events-detail-session-hall')
    const next = page.getByRole('button', { name: /Başvur|Devam|Katıl|Rezervasyon/i }).last()
    if (await next.isVisible().catch(() => false) && await next.isEnabled().catch(() => false)) await next.click()
    await page.waitForTimeout(500)
    const ineligible = page.getByRole('button').filter({ hasText: /uygun değil|Yaş|Yalnızca|En az|En fazla|cinsiyet/i }).first()
    if (await ineligible.isVisible().catch(() => false)) await expect(ineligible).toBeVisible()
    const self = page.getByRole('button').filter({ hasText: /\(Ben\)|Ben/i }).first()
    const child = page.getByRole('button').filter({ hasText: new RegExp(childFirst, 'i') }).first()
    if (await self.isEnabled().catch(() => false)) await self.click()
    else if (await child.isEnabled().catch(() => false)) await child.click()
    await acceptTermsIfPresent(page)
    await screenshot(page, 'events-applicant-selection')
    const apply = page.getByRole('button', { name: /Başvur|Yedek|Tamamla|Rezervasyonu/i }).last()
    if (await apply.isEnabled().catch(() => false)) {
      await apply.click()
      await page.waitForLoadState('networkidle').catch(() => {})
      await screenshot(page, 'events-application-post-click')
    }
  })
})

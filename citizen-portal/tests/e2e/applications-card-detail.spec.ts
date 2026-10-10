import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

test.describe.serial('Başvurularım — kart tıklaması program detayını açar', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test('Karta tıklayınca detay modalı açılır ve içerik dolu gelir', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await login(page)
    await page.goto('/basvurularim')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    const cards = page.locator('button.rounded-xl:has(p.font-bold)')
    const total = await cards.count()
    expect(total).toBeGreaterThan(0)

    // Detay ucu 200 dönen ilk kartı bul: silinmiş test grupları 404 veriyor.
    let opened = false
    for (let i = 0; i < Math.min(total, 12); i++) {
      const card = cards.nth(i)
      const label = (await card.innerText()).split('\n').filter(Boolean).join(' | ')

      const [res] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/me\/(facilities|events|travels|libraries)/.test(r.url()), { timeout: 8000 }).catch(() => null),
        card.click(),
      ])
      await page.waitForTimeout(900)

      const modal = page.locator('.fixed.inset-0').last()
      await expect(modal).toBeVisible()
      const text = await modal.innerText()

      if (res && res.status() === 200) {
        console.log('DOLU DETAY:', label, '→', text.slice(0, 120).replace(/\n/g, ' / '))
        expect(text.length).toBeGreaterThan(60)
        opened = true
        break
      }

      // Ölü kayıt: boş iskelet değil, açık bir mesaj görünmeli
      console.log('SILINMIS KAYIT:', label, '→', text.slice(0, 120).replace(/\n/g, ' / '))
      expect(text).toMatch(/bulunamadı|yüklenemedi/i)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      const closeBtn = page.locator('.fixed.inset-0').last().locator('button').first()
      if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click()
      await page.waitForTimeout(300)
    }

    expect(opened, 'Detayı dolu gelen en az bir başvuru bulunmalı').toBeTruthy()
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})

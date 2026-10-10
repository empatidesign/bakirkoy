import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'


test.describe('Raporlama & Analiz ekranı — kapsamlı doğrulama', () => {
  test('süper admin ile giriş yapıp raporlama ekranını tam olarak görüntüler', async ({ page }) => {
    test.setTimeout(90000)
    await login(page)

    const sidebarLink = page.getByRole('link', { name: 'Raporlama & Analiz' })
    await expect(sidebarLink).toBeVisible({ timeout: 15000 })
    await sidebarLink.click()

    await page.waitForURL('**/reports')
    await expect(page.getByRole('heading', { name: 'Raporlama & Analiz' })).toBeVisible({ timeout: 15000 })

    await expect(page.getByText('Toplam Katılım/Başvuru')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Tekil Katılımcı')).toBeVisible()

    const presetTrigger = page.locator('main button[aria-haspopup]', { hasText: 'Bu Ay' }).first()
    await expect(presetTrigger).toBeVisible()
    await presetTrigger.click()
    for (const label of ['Bugün', 'Dün', 'Bu Hafta', 'Bu Yıl', 'Özel Tarih Aralığı']) {
      await expect(page.locator('div[data-ds-popover] button', { hasText: label })).toHaveCount(1)
    }
    await page.locator('div[data-ds-popover] button', { hasText: 'Bugün' }).click()
    await page.waitForTimeout(1000)

    await page.locator('main button[aria-haspopup]', { hasText: 'Bugün' }).first().click()
    await page.locator('div[data-ds-popover] button', { hasText: 'Özel Tarih Aralığı' }).click()
    await expect(page.locator('input.pilot-date, input[placeholder="gg.aa.yyyy"]')).toHaveCount(2, { timeout: 10000 })

    await page.getByRole('button', { name: 'Modül Kırılımı' }).click()
    await expect(page.getByText('Modül Bazlı Kırılım')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'En Aktif Katılımcılar' }).click()
    await expect(page.getByText('En Aktif Katılımcılar').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Demografi' }).click()
    await expect(page.getByText('Cinsiyet Dağılımı')).toBeVisible({ timeout: 15000 })
  })

  test('katılımcı satırına tıklayınca detay modalı açılır', async ({ page }) => {
    test.setTimeout(90000)
    await login(page)
    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: 'Raporlama & Analiz' })).toBeVisible({ timeout: 15000 })

    await page.locator('main button[aria-haspopup]', { hasText: 'Bu Ay' }).first().click()
    await page.locator('div[data-ds-popover] button', { hasText: 'Bu Yıl' }).click()
    await page.waitForTimeout(1000)

    await page.getByRole('button', { name: 'En Aktif Katılımcılar' }).click()
    await expect(page.getByText('En Aktif Katılımcılar').first()).toBeVisible({ timeout: 15000 })

    const firstRow = page.locator('table tbody tr').first()
    const hasRows = await firstRow.count()
    if (hasRows > 0) {
      const nameButton = firstRow.locator('button').first()
      await nameButton.click()
      await expect(page.getByText('toplam katılım').first()).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Katılım Geçmişi').first()).toBeVisible({ timeout: 15000 })

      await expect(page.getByText(/Etkinlik Bazında/).first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/Tüm Kayıtlar/).first()).toBeVisible({ timeout: 10000 })
      await page.getByText(/Tüm Kayıtlar/).first().click()
      await page.waitForTimeout(300)
      await page.getByText(/Etkinlik Bazında/).first().click()
    }
  })
})

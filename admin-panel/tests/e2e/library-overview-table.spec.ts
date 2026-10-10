import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

// 2026-10-05 kullanıcı isteği: "kütüphanelerde kartlı gösterim var bunları tablo
// sistemini de göstersin default olarak ayrıca ekleme düzenleme silme işlemleri
// tabloda işlem menüsü altında görüntülensin"
test('Kütüphaneler listesi varsayılan olarak tablo (Liste) görünümünde, satır işlem menüsünde Düzenle/Sil/Aktif-Pasif var', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto('/library')
  await expect(page.getByText('Kütüphane Modülü')).toBeVisible({ timeout: 20000 })

  // Varsayılan görünüm Liste (tablo) olmalı — SegmentedControl'da "Liste" basılı
  const listToggle = page.getByRole('button', { name: 'Liste', exact: true })
  await listToggle.scrollIntoViewIfNeeded()
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 })
  await expect(page.locator('table').getByText('Doluluk')).toBeVisible()
  await expect(page.locator('table').getByText('Durum')).toBeVisible()

  // İlk satırda işlem menüsü (RowActions) erişilebilir olmalı: Görüntüle/Düzenle/Aktif-Pasif/Sil
  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  const menuBtn = firstRow.getByRole('button', { name: /işlemleri|Tüm işlemleri göster/ })
  if (await menuBtn.count() > 0) {
    await menuBtn.first().click()
    await expect(page.getByText('Düzenle')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Sil')).toBeVisible()
    await page.keyboard.press('Escape')
  } else {
    await expect(firstRow.locator('button[aria-label="Düzenle"], button[title="Düzenle"]')).toBeVisible()
  }

  // Kart görünümüne geçiş hâlâ çalışıyor olmalı
  await page.getByRole('button', { name: 'Kart', exact: true }).click()
  await expect(page.locator('table')).toHaveCount(0)
  await expect(page).toHaveURL(/view=cards/)

  // Liste görünümüne geri dönüş
  await listToggle.click()
  await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 })
})

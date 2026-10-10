import { test, expect } from '@playwright/test'
import { loginAndOpen } from './helpers/adminApi'

// Kullanıcı isteği (2026-09-01, docs/ankettema/06.png): mahalle analizi ekranında ısı
// haritası renklendirmesi, memnuniyet lejantı, sıralama düğmeleri, olumlu/olumsuz dağılım
// ve "en problemli mahalle / en sık sorunlar" bulguları görünmeli.

test.describe('Mahalle analizi raporu', () => {
  test('ısı haritası, lejant, sıralama ve bulgu kartları render edilir', async ({ page }) => {
    test.setTimeout(90000)
    await loginAndOpen(page, '/survey?tab=mahalle-analizi', 'Mahalle Analizi')

    // Üst özet kartları
    await expect(page.getByText('Genel Memnuniyet')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('En Problemli Mahalle').first()).toBeVisible()

    // Isı haritası bölümü ve 06.png'deki lejant kademeleri
    await expect(page.getByText('Mahalle Isı Haritası')).toBeVisible()
    await expect(page.getByText('Memnuniyet Oranı (%)')).toBeVisible()
    for (const label of ['80-100', '60-80', '40-60', '20-40', '0-20']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible()
    }

    // Sıralama düğmeleri çalışır (tıklayınca yön değişir, ekran çökmez)
    const sortBtn = page.getByRole('button', { name: /Memnuniyet/ }).first()
    await expect(sortBtn).toBeVisible()
    await sortBtn.click()
    await expect(page.getByText('Mahalle Isı Haritası')).toBeVisible()

    // Ölçüm bulgusu (2026-09-01): verisi olmayan mahalleler %0 ile "en problemli" görünüyordu.
    // Artık gri "Veri yok" lejantı bulunmalı ve en problemli mahalle gerçek veriden seçilmeli.
    await expect(page.getByText('Veri yok', { exact: false }).first()).toBeVisible()

    // Genel analiz bölümleri
    await expect(page.getByText('Olumlu / Olumsuz Dağılım')).toBeVisible()
    await expect(page.getByText('En Sık Bildirilen Sorunlar')).toBeVisible()
    await expect(page.getByText('En Memnun Mahalle')).toBeVisible()
    await expect(page.getByText('En Çok Açık Kayıt')).toBeVisible()

    // Tablolar
    await expect(page.getByText('Mahalle Bazında Durum')).toBeVisible()
    await expect(page.getByText('Konu Bazında Durum')).toBeVisible()
  })
})

test('görsel doğrulama için tam sayfa ekran görüntüsü alır', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1500, height: 1000 })
  await loginAndOpen(page, '/survey?tab=mahalle-analizi', 'Mahalle Analizi')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/mahalle-analizi.png', fullPage: true })
})

import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

// Kullanıcı isteği (2026-10-05): "/Users/mac/Downloads/sultanga_genclik_20261005_032409.sql
// kütüphanelerde hangi kullanıcılar şimdiye kadar kaç defa kullanmış incele ve bunu sisteme
// istatistiklere ekle". Eski MySQL Millet Kıraathanesi sisteminden (2019-2026, 491.772 oturum
// kaydı) içe aktarılan TCKN bazlı özet istatistik artık LibraryLegacyUsageStats tablosunda ve
// /libraries/analytics uç noktasında legacyTopUsers alanında. Bu test, Raporlar sekmesinde
// "Tüm Zamanlar Kullanım Geçmişi" bölümünün GERÇEKTEN göründüğünü ve gerçek, API'den doğrulanmış
// isim/sayılarla doldurulduğunu kanıtlar.

test('Kütüphane Raporlar sekmesi: "Tüm Zamanlar Kullanım Geçmişi" bölümü eski sistem verisini gösterir', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto('/library')
  await expect(page.getByText('Kütüphane Modülü')).toBeVisible({ timeout: 20000 })

  await page.getByRole('button', { name: /Raporlar/ }).click()
  await expect(page.getByText("Tüm Zamanlar Kullanım Geçmişi")).toBeVisible({ timeout: 15000 })

  // En çok kullanan kişinin adı ve ziyaret sayısı gerçekten görünmeli (API'den doğrulanmış: AYNUR YILMAZ, 1635 ziyaret).
  await expect(page.getByText('AYNUR YILMAZ')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/1\.635 ziyaret|1635 ziyaret/)).toBeVisible()

  await page.getByText("Tüm Zamanlar Kullanım Geçmişi").scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/library-legacy-usage-stats.png' })

  // Kullanıcı isteği (devam): "cinsiyetine yaş aralıklarına mahallelerden gelen kullanıcılara
  // kadar tümünü içeride analizlerini yapacak raporlama olsun" — bu bölüm GERÇEKTEN görünmeli
  // ve API'den doğrulanmış gerçek sayılarla dolmalı (toplam 17.568, %55.1 kadın, İsmetpaşa en çok).
  await expect(page.getByText('Kullanıcı Cinsiyet Dağılımı (Tüm Zamanlar)').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/17\.568 eşleşen kullanıcı/).first()).toBeVisible()
  await expect(page.getByText('Yaş Grupları × Cinsiyet (Tüm Zamanlar)').first()).toBeVisible()
  await expect(page.getByText('Mahalle Bazlı Kullanıcı Dağılımı (Tüm Zamanlar)').first()).toBeVisible()
  await expect(page.getByText('İsmetpaşa').first()).toBeVisible()

  await page.getByText('Kullanıcı Cinsiyet Dağılımı (Tüm Zamanlar)').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/library-legacy-demographics-gender-age.png' })

  await page.getByText('Mahalle Bazlı Kullanıcı Dağılımı (Tüm Zamanlar)').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/library-legacy-demographics-neighborhood.png' })
})

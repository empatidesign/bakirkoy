import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

// 2026-10-05: /library sayfası gezi sistemi deseniyle (üst Tabs) birleştirildi —
// /library-mesai ayrı route'u kaldırıldı, içeriği "Mesai Yönetimi" üst-sekmesi oldu.
test('Kütüphane sayfası gezi sistemindeki gibi üst sekme menülü: Kütüphaneler / Mesai Yönetimi / Aylık Rapor / Raporlar', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto('/library')
  await expect(page.getByText('Kütüphane Modülü')).toBeVisible({ timeout: 20000 })

  // Üst sekmeler görünür olmalı (gezi sistemindeki Tabs deseni)
  await expect(page.getByRole('button', { name: /Kütüphaneler/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Mesai Yönetimi/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Aylık Detay Rapor/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Raporlar/ })).toBeVisible()

  // Mesai Yönetimi sekmesine geç — eski /library-mesai sayfasının içeriği burada görünmeli
  await page.getByRole('button', { name: /Mesai Yönetimi/ }).click()
  await expect(page.getByText('Şu An Mesaide')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Aktif Personel')).toBeVisible()
  await expect(page).toHaveURL(/topTab=mesai(?!-)/)

  // Aylık Detay Rapor sekmesi
  await page.getByRole('button', { name: /Aylık Detay Rapor/ }).click()
  await expect(page).toHaveURL(/topTab=mesai-aylik/)

  // Raporlar sekmesi
  await page.getByRole('button', { name: /Raporlar/ }).click()
  await expect(page).toHaveURL(/topTab=mesai-raporlar/)

  // Eski /library-mesai route'u artık mevcut değil — dashboard'a yönlendirmemeli,
  // zira route App.tsx'ten tamamen kaldırıldı (404 davranışı yerine React Router eşleşmeyince
  // boş kalır ama uygulama çökmemeli). Kütüphaneler sekmesine geri dönüş kontrolü asıl kanıt.
  await page.getByRole('button', { name: /Kütüphaneler/ }).click()
  await expect(page).toHaveURL(/topTab=libraries/)
  await expect(page.getByText('Toplam Kapasite')).toBeVisible({ timeout: 10000 })
})

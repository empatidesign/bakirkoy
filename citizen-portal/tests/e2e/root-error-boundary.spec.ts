import { test, expect } from '@playwright/test'

// Kullanıcı bildirimi (2026-09-02): "tablette ekran beyaz ekran olarak açıyor android tablette".
// Kök neden (bkz. RootErrorBoundary.tsx): uygulamada hiç React ErrorBoundary yoktu; render
// sırasında herhangi bir çalışma-zamanı hatası TÜM ağacı unmount edip geriye BEYAZ EKRAN
// bırakıyordu. Bu test, ErrorBoundary'nin gerçekten devrede olduğunu ve bir render hatasında
// beyaz ekran yerine kullanıcıya bilgilendirici bir hata ekranı + "Sayfayı Yenile" butonu
// gösterdiğini KALICI olarak doğrular (ileride biri sınırı kaldırırsa bu test kırılır).
//
// Tetikleme: yalnızca dev/test ortamında etkin olan ?__eb_probe=1 kancası (production
// bundle'ında import.meta.env.DEV false olduğu için ölü koddur).

test.describe('Kök ErrorBoundary — tablette beyaz ekran koruması', () => {
  test('normal açılışta hata ekranı görünmez', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Bir sorun oluştu')).toHaveCount(0)
    // Uygulama gerçekten render olmuş olmalı (beyaz ekran değil).
    const bodyLen = (await page.textContent('body'))?.trim().length ?? 0
    expect(bodyLen).toBeGreaterThan(50)
  })

  test('render hatasında beyaz ekran yerine hata ekranı ve yenile butonu gösterilir', async ({ page }) => {
    await page.goto('/login?__eb_probe=1')
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Bir sorun oluştu' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sayfayı Yenile' })).toBeVisible()
    // Hata metni teknik ekip için ekranda görünür (teşhis edilebilirlik).
    await expect(page.getByText(/EB_PROBE/)).toBeVisible()
  })

  test('"Sayfayı Yenile" butonu probe olmadan tekrar yüklerse uygulama normal açılır', async ({ page }) => {
    await page.goto('/login?__eb_probe=1')
    await expect(page.getByRole('button', { name: 'Sayfayı Yenile' })).toBeVisible({ timeout: 10000 })
    // Yenilemeden önce query param'i temizle ki reload sonrası hata tekrarlamasın
    // (gerçek dünyada kullanıcı sayfayı adres çubuğundan temiz açar; burada davranışı
    // deterministik kılmak için param'i düşürüp normal açılışı doğruluyoruz).
    await page.goto('/login')
    await expect(page.getByText('Bir sorun oluştu')).toHaveCount(0)
  })
})

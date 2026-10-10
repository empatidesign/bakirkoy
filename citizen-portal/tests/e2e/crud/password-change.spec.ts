/**
 * Password change — POM + Factory + Fake-Success-Detection örneği (QA gap #9 — 2026-09-04).
 *
 * Bu dosya master prompt'un 3 ilkesini tek akışta gösterir:
 *   - madde 63: Page Object Model kullanımı (tests/pages/ProfilePage.ts)
 *   - madde 6: Test Data Factory kullanımı (tests/factories/testDataFactory.ts)
 *   - madde 81/82: "Başarıyla değiştirildi" toast'ı görmek yeterli DEĞİL — yeni
 *     şifreyle gerçekten login olabildiğimizi doğruluyoruz (fake success detection).
 *
 * Yıkıcı bir işlem olduğu için (gerçek kullanıcının şifresini kalıcı değiştirir)
 * `productionSafety.ts`'den `test`/`expect` import ediyor — bu test production
 * baseURL'ine karşı otomatik bloklanır.
 */
import { test, expect } from '../helpers/productionSafety'
import { login, hasCredentials, TEST_TCKN, TEST_OTP } from '../helpers/auth'
import { ProfilePage } from '../../pages/ProfilePage'
import { createTestPasswordChange } from '../../factories/testDataFactory'

test.describe('Profil — şifre değiştirme (gerçek CRUD doğrulaması)', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi — atlandı')
  // Bu describe içindeki testler paylaşılan hesabın şifresini geçici olarak
  // değiştirip geri alıyor (stateful). Playwright'ın varsayılan retry'ı (2)
  // burada TEHLİKELİ: bir retry, önceki denemenin ortada bıraktığı değişmiş
  // şifreyle başlar ve yanlış pozitif/negatif üretebilir. Retry kapatıldı.
  test.describe.configure({ retries: 0 })

  test('şifre değiştirilir, eski şifreyle giriş reddedilir, yeni şifreyle giriş kabul edilir', async ({
    page,
  }) => {
    // Çok adımlı akış (login → değiştir → logout → 2x login denemesi → geri al):
    // varsayılan 30s test timeout'u yetersiz, gerçekçi bir üst sınıra çekildi.
    test.setTimeout(90_000)
    const originalPassword = process.env.E2E_PASSWORD!.trim()
    const { newPassword } = createTestPasswordChange(originalPassword)

    // --- ADIM 1: Giriş yap, şifre değiştirme modalını doldur ---
    await login(page)
    const profile = new ProfilePage(page)
    await profile.gotoPasswordSection()
    await expect(profile.passwordModal).toBeVisible()

    await profile.submitPasswordChange({
      currentPassword: originalPassword,
      newPassword,
    })

    // --- ADIM 2: Toast'ı gör AMA orada durma (madde 81 — Fake Success Detection) ---
    await expect(page.getByText('Şifreniz değiştirildi.')).toBeVisible({ timeout: 8000 })
    await expect(profile.passwordModal).toBeHidden({ timeout: 5000 })

    // --- ADIM 3: Gerçek doğrulama — çıkış yap, YENİ şifreyle tekrar giriş dene ---
    // Toast'a güvenmiyoruz: backend'in gerçekten hash'i güncelleyip güncellemediğini
    // sadece yeni şifreyle bir sonraki login'in başarılı olmasıyla kanıtlarız.
    // localStorage'ı TAMAMEN temizlemiyoruz — auth.ts'deki login() helper'ının
    // kendi addInitScript'i "onboarding_done" flag'ini zaten set ediyor; burada
    // sıfırdan hoşgeldin ekranı çıkmasını önlemek için sadece auth token'ı silmek
    // yeterli ve doğru olan.
    await page.context().clearCookies()
    await page.evaluate(() => {
      // Gerçek key isimleri: src/services/tokenStorage.ts (ACCESS_TOKEN_KEY/REFRESH_TOKEN_KEY).
      // Token "remember me" işaretli değilse sessionStorage'da tutuluyor (varsayılan
      // durum) — sadece localStorage temizlemek yetersiz kalıp eski oturumun
      // kalmasına, dolayısıyla /login'e hiç düşmemesine yol açıyordu (gerçek bug,
      // ilk denemede yakalandı). İkisi de temizlenmeli.
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      sessionStorage.removeItem('access_token')
      sessionStorage.removeItem('refresh_token')
    })
    await page.addInitScript(() => localStorage.setItem('nexora_citizen_onboarding_done', '1'))
    await page.goto('/login')

    const tcknInput = page.getByPlaceholder(/05XX \/ T\.C\. Kimlik|Telefon veya T\.C\. kimlik numaranız/i)
    await tcknInput.fill(TEST_TCKN)
    await page.getByPlaceholder(/••••••••|Şifreniz/i).fill(originalPassword)
    const kvkkBox = page.locator('#login-kvkk')
    if (await kvkkBox.isVisible().catch(() => false)) await kvkkBox.check()
    const notifBox = page.locator('#login-notif')
    if (await notifBox.isVisible().catch(() => false)) await notifBox.check()
    await page.getByRole('button', { name: /Giriş Yap/i }).click()

    // ESKİ şifre artık geçersiz olmalı — dashboard'a değil, hata mesajına gitmeli.
    await expect(page.getByText(/hatalı|geçersiz/i).first()).toBeVisible({ timeout: 8000 })
    await expect(page).toHaveURL(/\/login/)

    // --- ADIM 4: YENİ şifreyle giriş gerçekten çalışmalı ---
    await page.getByPlaceholder(/••••••••|Şifreniz/i).fill(newPassword)
    await page.getByRole('button', { name: /Giriş Yap/i }).click()

    // Yeni cihaz/context olduğu için backend tekrar OTP isteyebilir (login()
    // helper'ındaki ile aynı davranış) — bunu da işleyip sonunda dashboard'a
    // varmalıyız.
    await page.waitForURL((url) => !url.pathname.startsWith('/login') || url.pathname === '/login/otp', {
      timeout: 15000,
    })
    if (/\/login\/otp/.test(page.url())) {
      const otpInputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
      const count = await otpInputs.count()
      if (count >= 6) {
        for (let i = 0; i < 6; i++) await otpInputs.nth(i).fill(TEST_OTP[i])
      } else {
        await page.locator('input').first().fill(TEST_OTP)
      }
      await page.getByRole('button', { name: 'Doğrula' }).click()
    }
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })

    // --- CLEANUP: şifreyi eski haline geri döndür (test kendi izini silmeli) ---
    // Bir sonraki test koşusunun E2E_PASSWORD ile giriş yapabilmesi için zorunlu —
    // bu olmadan bu spec çalıştıktan sonra tüm diğer login-gerektiren testler kırılır.
    const profileAfter = new ProfilePage(page)
    await profileAfter.gotoPasswordSection()
    await expect(profileAfter.passwordModal).toBeVisible()
    await profileAfter.submitPasswordChange({
      currentPassword: newPassword,
      newPassword: originalPassword,
    })
    await expect(page.getByText('Şifreniz değiştirildi.')).toBeVisible({ timeout: 8000 })
  })

  test('yanlış mevcut şifreyle değiştirme reddedilir (backend gerçekten doğruluyor mu)', async ({
    page,
  }) => {
    await login(page)
    const profile = new ProfilePage(page)
    await profile.gotoPasswordSection()
    await expect(profile.passwordModal).toBeVisible()

    await profile.submitPasswordChange({
      currentPassword: 'KesinlikleYanlisSifre999!',
      newPassword: 'YeniGuclu2026Sifre!',
    })

    // Başarı toast'ı GÖRÜNMEMELİ — backend ChangePasswordAsync yanlış mevcut şifreyi
    // reddediyor (ConflictException "Mevcut şifreniz hatalı."). Modal açık kalmalı.
    await expect(page.getByText('Şifreniz değiştirildi.')).toBeHidden()
    await expect(profile.passwordModal).toBeVisible()
  })
})

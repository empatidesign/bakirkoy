import type { Page } from '@playwright/test'

/**
 * Page Object Model — Profil sayfası (QA gap #9 — 2026-09-04).
 *
 * Neden bu ekran örnek seçildi: bugünkü oturumda `citizen-portal`'ın şifre
 * değiştirme akışı canlı bir hata olarak ele alındı (bkz. Vault/production kesintisi
 * araştırması). Aynı ekranın Page Object Model + Test Data Factory ile nasıl
 * test edilmesi gerektiğini göstermek için ideal, gerçek bir örnek.
 *
 * Selector stratejisi (repo genelindeki disipline uygun, madde 75-76): önce
 * `getByLabel`/`getByRole`, `data-testid`'e gerek yok çünkü ProfilePage.tsx zaten
 * `<Field label="...">` ile semantic label sağlıyor.
 */
export class ProfilePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/profil')
  }

  async gotoPasswordSection(): Promise<void> {
    // ProfilePage.tsx: ?bolum=sifre query param'ı doğrudan şifre modalını açıyor
    // (FieldSideMenu.tsx'teki "Şifre İşlemleri" linkiyle aynı yol).
    await this.page.goto('/profil?bolum=sifre')
  }

  get passwordModal() {
    // NOT: design-system/Modal/Modal.tsx `role="dialog"`/`aria-modal` kullanmıyor
    // (düz <div>, madde 68'deki accessibility boşluğuyla aynı kök sorun — ayrıca
    // raporlandı). Modal panelini başlık `<h3>`'ünün en yakın panel atasından bulur.
    return this.page.locator('div.rounded-panel', {
      has: this.page.getByRole('heading', { name: 'Şifre Değiştir', level: 3 }),
    })
  }

  get currentPasswordInput() {
    return this.passwordModal.getByPlaceholder('Mevcut şifreniz')
  }

  get newPasswordInput() {
    // exact: true zorunlu — 'Yeni şifre' placeholder'ı 'Yeni şifre tekrar'ın da
    // alt string'i olduğu için exact olmadan strict-mode violation'a düşer.
    return this.passwordModal.getByPlaceholder('Yeni şifre', { exact: true })
  }

  get confirmPasswordInput() {
    return this.passwordModal.getByPlaceholder('Yeni şifre tekrar')
  }

  get saveButton() {
    return this.passwordModal.getByRole('button', { name: 'Kaydet' })
  }

  get cancelButton() {
    return this.passwordModal.getByRole('button', { name: 'Vazgeç' })
  }

  /**
   * Şifre değiştirme modalını tamamen doldurup Kaydet'e basar. Sonucu (başarı
   * toast'ı veya hata) çağıran test kendi assert eder — bu metod yalnızca eylemi
   * gerçekleştirir, doğrulama yapmaz (Page Object prensiplerine uygun).
   */
  async submitPasswordChange(params: {
    currentPassword: string
    newPassword: string
  }): Promise<void> {
    await this.currentPasswordInput.fill(params.currentPassword)
    await this.newPasswordInput.fill(params.newPassword)
    await this.confirmPasswordInput.fill(params.newPassword)
    await this.saveButton.click()
  }

  get editContactButton() {
    return this.page.getByRole('button', { name: /İletişim Bilgileri/i })
  }
}

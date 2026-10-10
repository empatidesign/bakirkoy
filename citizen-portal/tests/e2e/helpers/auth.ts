import { Page, expect } from '@playwright/test'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required test setting: ${name}`)
  return value
}

export const TEST_TCKN = process.env.E2E_TCKN?.trim() ?? ''
export const TEST_PASSWORD = process.env.E2E_PASSWORD?.trim() ?? ''
export const TEST_OTP = process.env.E2E_OTP_CODE?.trim() ?? ''
const NAV_TIMEOUT = Number(process.env.E2E_NAV_TIMEOUT) || 40000

export const hasCredentials = () => TEST_TCKN.length === 11 && TEST_PASSWORD.length > 0

// Flakiness bulgusu (2026-09-01): paket birden çok spec ile birlikte koşarken
// giriş adımı 15 sn'lik sabit sınıra takılıp sahte hata üretiyordu (API'nin
// kendisi ~0.15 sn yanıt veriyor, sıkışma paralel giriş yükünden). Sınır
// yükseltildi ve E2E_NAV_TIMEOUT ile ortama göre ayarlanabilir yapıldı.

export async function login(page: Page) {
  const tckn = required('E2E_TCKN')
  const password = required('E2E_PASSWORD')
  const otp = required('E2E_OTP_CODE')
  await page.addInitScript(() => localStorage.setItem('nexora_citizen_onboarding_done', '1'))
  await page.goto('/login')
  const tcknInput = page.getByPlaceholder(/05XX \/ T\.C\. Kimlik|Telefon veya T\.C\. kimlik numaranız/i)
  await tcknInput.waitFor()
  await tcknInput.fill(tckn)

  const passwordInput = page.getByPlaceholder(/••••••••|Şifreniz/i)
  await passwordInput.fill(password)

  // Kullanıcı isteği (2026-08-02): KVKK/Bildirim izni onayı artık girişten önce, iki ayrı
  // checkbox ile zorunlu alınıyor. Bunlar işaretlenmeden "Giriş Yap" devre dışı kalır.
  const kvkkBox = page.locator('#login-kvkk')
  if (await kvkkBox.isVisible().catch(() => false)) await kvkkBox.check()
  const notifBox = page.locator('#login-notif')
  if (await notifBox.isVisible().catch(() => false)) await notifBox.check()

  await page.getByRole('button', { name: 'Giriş Yap' }).click()

  await page.waitForURL('**/login/otp', { timeout: NAV_TIMEOUT })

  const otpInputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
  const count = await otpInputs.count()
  if (count >= 6) {
    for (let i = 0; i < 6; i++) await otpInputs.nth(i).fill(otp[i])
  } else {
    await page.locator('input').first().fill(otp)
  }

  await page.getByRole('button', { name: 'Doğrula & Giriş Yap' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: NAV_TIMEOUT })
  await expect(page).not.toHaveURL(/\/login/)
  await acceptConsentIfPresent(page)
  await dismissOnboarding(page)
}

export async function acceptConsentIfPresent(page: Page) {
  for (let round = 0; round < 4; round++) {
    const closers = [
      page.getByRole('button', { name: 'Harika, Başlayalım!' }),
      page.getByRole('button', { name: /Karşılama mesajını kapat/ }),
    ]
    let closedSomething = false
    for (const c of closers) {
      const visible = await c.isVisible().catch(() => false)
      if (visible) {
        await c.click().catch(() => undefined)
        closedSomething = true
        await page.waitForTimeout(400)
        break
      }
    }

    const confirm = page.getByRole('button', { name: 'Onaylayıp Devam Et' })
    const consentVisible = await confirm.isVisible().catch(() => false)
    if (consentVisible) {
      const boxes = page.locator('div.fixed input[type="checkbox"]')
      const count = await boxes.count()
      for (let i = 0; i < count; i++) {
        if (!(await boxes.nth(i).isChecked().catch(() => true))) {
          await boxes.nth(i).check({ force: true }).catch(() => undefined)
        }
      }
      await confirm.click({ force: true }).catch(() => undefined)
      await confirm.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined)
      closedSomething = true
    }

    if (!closedSomething) return
  }
}

export async function dismissOnboarding(page: Page) {
  const skip = page.getByRole('button', { name: 'Atla' })
  const appeared = await skip.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)
  if (!appeared) return
  for (let i = 0; i < 3; i++) {
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {})
      // Hata bulgusu (2026-09-02): sabit 300ms bekleme, "Atla" tıklaması ile overlay'in
      // (createPortal, z-[9999]) DOM'dan kalkması arasında bir yarış durumuna yol
      // açıyordu. mousedown/mouseup arasında React re-render tetiklenirse, mouseup
      // artık overlay'in ALTINDAKİ elemente gidebilir — sayfada o konumda tıklanabilir
      // bir öğe varsa (ör. bir kart butonu) yanlışlıkla tıklanmış olur. Sabit bekleme
      // yerine overlay'in gerçekten kaybolduğu doğrulanır.
      await skip.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
    } else break
  }
}

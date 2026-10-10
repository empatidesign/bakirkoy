/**
 * Citizen-portal (vatandaş) gerçek kayıt/giriş yardımcıları — canlı demo akışları için.
 *
 * Kanıtlanmış desen: `quiz-citizen-play-flow.spec.ts`, `wheel-spin-flow.spec.ts` ve
 * `participants-crud.spec.ts`'teki `fakeTckn()` algoritması (gerçek T.C. Kimlik No
 * checksum formülü — mod10/mod11) ile üretilen numaralar NVI MOCK servisinin
 * (`NviMockService.cs`) kabul ettiği GERÇEK bir "Mehmet Yılmaz" sahte kimliğiyle
 * eşleşiyor.
 *
 * GERÇEK BULGU (2026-10-03, canlı ortamda doğrulandı): Docker'daki API grubu
 * (localhost:34000, nexora-lb → api-nexora-api-{1,2,3}, ASPNETCORE_ENVIRONMENT=
 * Production) NVI'yi MOCK MODUNDA ÇALIŞTIRMIYOR — `/auth/citizen/register`
 * orada her zaman NVI_NOT_FOUND (404) döner. Ayrı bir yerel süreç
 * (localhost:5207, `dotnet run` ile `bin/Debug`'tan, aynı Postgres'e — Docker'daki
 * nexora-postgres konteynerine 34100 portundan — bağlı) NVI mock'u AÇIK çalıştırıyor
 * ve aynı DB'ye yazıyor. Çözüm: KAYIT 5207'ye yapılır (NVI mock orada), sonra aynı
 * TCKN/şifreyle 34000'e GERÇEK login+OTP ile girilip 34000-imzalı bir token alınır
 * (34000 kendi imzaladığı JWT'leri bekliyor — 5207'nin token'ı 34000'de 401 verir,
 * canlı doğrulandı). citizen-portal UI zaten 34000'e karşı çalıştığı için token'ın
 * 34000-imzalı olması şart.
 */
import { Page, APIRequestContext, expect } from '@playwright/test'

export const API_BASE = process.env.E2E_API_URL || 'http://localhost:34000/api/v1'
export const NVI_MOCK_API_BASE = process.env.E2E_NVI_MOCK_API_URL || 'http://localhost:5207/api/v1'
export const CITIZEN_PORTAL_URL = process.env.E2E_CITIZEN_PORTAL_URL || 'http://localhost:3100'
export const CITIZEN_OTP = process.env.E2E_OTP_CODE || '111111'

export function fakeTckn(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10raw = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10 = ((d10raw % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10) % 10
  return [...digits, d10, d11].join('')
}

export interface NewCitizen {
  tckn: string
  password: string
  email: string
  phone: string
  token: string
  refreshToken: string
  birthDateIso: string
  ageYears: number
}

/**
 * Belirtilen yaşta GERÇEK yeni bir vatandaş kaydı açar: register NVI-mock'u olan
 * 5207'ye yapılır, ardından aynı kimlikle 34000'e GERÇEK login+OTP ile girilip
 * UI'nin kabul edeceği 34000-imzalı bir token alınır (bkz. dosya başı NOT).
 * Döndürülen token'lar hem API doğrulamaları hem de UI'ya session enjeksiyonu için
 * kullanılabilir (bkz. citizenLoginUiWithToken).
 */
export async function registerCitizen(ctx: APIRequestContext, ageYears: number, tag: string): Promise<NewCitizen> {
  const tckn = fakeTckn()
  const birthYear = new Date().getFullYear() - ageYears
  const birthDateIso = `${birthYear}-06-15`
  const email = `qa.canli.${tag}.${Date.now()}@example.com`.toLowerCase().replace(/[^a-z0-9.@]/g, '')
  const phone = `05${String(Date.now()).slice(-9)}`
  const password = 'E2eCanliDemo2026!'
  // 18 yaş altı kayıtlarda backend veli telefonu zorunlu kılıyor (CitizenRegisterRequest
  // GUARDIAN_REQUIRED, bkz. ParticipantAuthService.RegisterAsync) — canlı doğrulandı.
  const isMinor = ageYears < 18
  const guardianPhone = isMinor ? `05${String(Date.now() + 1).slice(-9)}` : null

  const reg = await (await ctx.post(`${NVI_MOCK_API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate: birthDateIso, phone, email, password, guardianPhone, guardianEmail: null },
  })).json()
  const regOtpToken = reg?.data?.otpSessionToken
  if (!regOtpToken) throw new Error(`citizen register (NVI mock :5207) OTP alınamadı: ${JSON.stringify(reg)}`)
  const regVer = await (await ctx.post(`${NVI_MOCK_API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken: regOtpToken, code: CITIZEN_OTP },
  })).json()
  if (!regVer?.data?.accessToken) throw new Error(`citizen register doğrulama (:5207) başarısız: ${JSON.stringify(regVer)}`)

  // Asıl kullanılacak oturum: aynı TCKN/şifre ile GERÇEK 34000 login+OTP — UI bu
  // API'ye karşı çalıştığı için token'ın 34000 tarafından imzalanmış olması gerekir.
  const login = await (await ctx.post(`${API_BASE}/auth/citizen/login`, {
    data: { identifier: tckn, password },
  })).json()
  const otpSessionToken = login?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`citizen login (:34000) OTP alınamadı: ${JSON.stringify(login)}`)

  const ver = await (await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken, code: CITIZEN_OTP },
  })).json()
  const token = ver?.data?.accessToken
  const refreshToken = ver?.data?.refreshToken
  if (!token) throw new Error(`citizen accessToken (:34000) alınamadı: ${JSON.stringify(ver)}`)

  await ctx.post(`${API_BASE}/auth/citizen/me/accept-kvkk`, { headers: { Authorization: `Bearer ${token}` } })
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-notification-consent`, { headers: { Authorization: `Bearer ${token}` } })

  return { tckn, password, email, phone, token, refreshToken, birthDateIso, ageYears }
}

/**
 * Citizen-portal UI'ya token enjekte ederek gerçek bir oturum açar — her defasında
 * login formunu + OTP ekranını yeniden sürmek yerine (admin-panel'deki fastLoginUi
 * ile aynı desen).
 */
export async function citizenLoginUiWithToken(page: Page, citizen: NewCitizen): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('nexora_citizen_onboarding_done', '1'))
  await page.goto(`${CITIZEN_PORTAL_URL}/login`)
  await page.evaluate(({ at, rt }) => {
    localStorage.setItem('portal_access_token', at)
    localStorage.setItem('portal_refresh_token', rt)
  }, { at: citizen.token, rt: citizen.refreshToken })
  await page.goto(`${CITIZEN_PORTAL_URL}/`)
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
}

/**
 * GERÇEK tarayıcı UI login formu (TC + şifre + OTP) — "gerçekten giriş yapılıyor mu"
 * sorusunu kanıtlamak için en az bir kez bu yolla da giriş yapılmalı.
 */
export async function citizenLoginUiForm(page: Page, citizen: NewCitizen): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('nexora_citizen_onboarding_done', '1'))
  await page.goto(`${CITIZEN_PORTAL_URL}/login`)
  await page.getByPlaceholder(/05XX \/ T\.C\. Kimlik|Telefon veya T\.C\. kimlik numaranız/i).fill(citizen.tckn)
  await page.getByPlaceholder(/••••••••|Şifreniz/i).fill(citizen.password)
  const kvkkBox = page.locator('#login-kvkk')
  if (await kvkkBox.isVisible().catch(() => false)) await kvkkBox.check()
  const notifBox = page.locator('#login-notif')
  if (await notifBox.isVisible().catch(() => false)) await notifBox.check()
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  if (await page.waitForURL('**/login/otp', { timeout: 5000 }).then(() => true).catch(() => false)) {
    const otpInputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
    const count = await otpInputs.count()
    if (count >= 6) for (let i = 0; i < 6; i++) await otpInputs.nth(i).fill(CITIZEN_OTP[i])
    else await page.locator('input').first().fill(CITIZEN_OTP)
    await page.getByRole('button', { name: 'Doğrula' }).click()
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
}

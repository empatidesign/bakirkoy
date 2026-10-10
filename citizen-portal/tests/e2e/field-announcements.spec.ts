import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { waitIdle } from './helpers/videoProof'

// Kullanıcı isteği (2026-09-01): anketörlere toplu mesaj/SMS, zorunlu onaylı
// popup ("okudum demeden kapatamaz"), sağ üst bildirim alanı ve sol hamburger
// menü (profil, şifre işlemleri, görevler).
//
// Bu test gerçek sistemi kullanır: admin API'siyle gerçek duyuru gönderilir,
// anketör ekranında popup'ın kapatılamadığı ve onaydan sonra kapandığı ölçülür.
const API = process.env.E2E_API_BASE || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!
const MIN_TOUCH = 44

type Req = import('@playwright/test').APIRequestContext

async function tokenFrom(request: Req, loginPath: string, verifyPath: string, data: object, code: string) {
  const res = await request.post(`${API}${loginPath}`, { data })
  const body = await res.json()
  if (body.data?.accessToken) return body.data.accessToken as string
  const verify = await request.post(`${API}${verifyPath}`, { data: { otpSessionToken: body.data.otpSessionToken, code } })
  return (await verify.json()).data.accessToken as string
}

const adminToken = (r: Req) =>
  tokenFrom(r, '/auth/login', '/auth/verify-otp', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ADMIN_OTP)

const citizenToken = (r: Req) =>
  tokenFrom(r, '/auth/citizen/login', '/auth/citizen/verify-otp',
    { identifier: process.env.E2E_TCKN!, password: process.env.E2E_PASSWORD! },
    process.env.E2E_OTP_CODE!)

async function participantId(request: Req) {
  const res = await request.post(`${API}/auth/citizen/login`, {
    data: { identifier: process.env.E2E_TCKN!, password: process.env.E2E_PASSWORD! },
  })
  const body = await res.json()
  if (body.data?.user?.id) return body.data.user.id as string
  const verify = await request.post(`${API}/auth/citizen/verify-otp`, {
    data: { otpSessionToken: body.data.otpSessionToken, code: process.env.E2E_OTP_CODE! },
  })
  return (await verify.json()).data.user.id as string
}

/** Testten kalan onay bekleyen duyuruları temizler; aksi hâlde sonraki koşum kirlenir. */
async function clearPending(request: Req, token: string) {
  const res = await request.get(`${API}/me/notifications/pending-acknowledgements`, {
    headers: { authorization: `Bearer ${token}` },
  })
  for (const n of (await res.json()).data ?? []) {
    await request.post(`${API}/me/notifications/${n.id}/acknowledge`, { headers: { authorization: `Bearer ${token}` } })
  }
}

test.describe('Anketör duyuru ve bildirim akışı', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  test.setTimeout(90_000)

  test('zorunlu duyuru onaylanmadan kapanmaz, onaylanınca kapanır', async ({ page, request }) => {
    const cToken = await citizenToken(request)
    await clearPending(request, cToken)

    const pid = await participantId(request)
    const aToken = await adminToken(request)
    const title = `E2E Saha Talimatı ${Date.now()}`

    // 1) Admin gerçek API üzerinden zorunlu onaylı duyuru gönderir.
    const send = await request.post(`${API}/surveys/interviewers/messages`, {
      headers: { authorization: `Bearer ${aToken}` },
      data: { title, body: 'Yarın 09:00 Cebeci toplanma.', interviewerIds: [pid], notify: true, sms: false, requiresAck: true },
    })
    expect(send.ok(), 'duyuru gönderimi 200 dönmeli').toBeTruthy()
    expect((await send.json()).data.recipients, 'bir anketöre ulaşmalı').toBe(1)

    // 2) Anketör ekranını açınca popup görünmeli.
    await page.setViewportSize({ width: 820, height: 1180 })
    await login(page)
    await page.goto('/saha')
    await waitIdle(page)

    const popup = page.getByTestId('mandatory-announcement')
    await expect(popup, 'zorunlu duyuru popup açılmalı').toBeVisible({ timeout: 15_000 })
    await expect(popup.getByText(title)).toBeVisible()

    // 3) Kapatılamamalı: ESC ve dışarı tıklama işe yaramamalı.
    await page.keyboard.press('Escape')
    await expect(popup, 'ESC ile kapanmamalı').toBeVisible()
    await page.mouse.click(10, 10)
    await expect(popup, 'dışarı tıklayınca kapanmamalı').toBeVisible()

    // Kapatma düğmesi (çarpı) hiç bulunmamalı.
    await expect(popup.getByRole('button', { name: /kapat/i }), 'çarpı düğmesi olmamalı').toHaveCount(0)

    // 4) Onay düğmesi tablette dokunmaya uygun olmalı.
    const confirm = page.getByTestId('mandatory-announcement-confirm')
    const box = await confirm.boundingBox()
    expect(Math.round(box!.height), 'onay düğmesi 44px+ olmalı').toBeGreaterThanOrEqual(MIN_TOUCH)

    // 5) Onaylayınca kapanmalı ve bir daha açılmamalı.
    await confirm.click()
    await expect(popup, 'onaydan sonra kapanmalı').toBeHidden({ timeout: 10_000 })

    await page.reload()
    await waitIdle(page)
    await expect(popup, 'yeniden yüklemede tekrar açılmamalı').toBeHidden()

    // 6) Sunucu tarafında da onaylanmış olmalı.
    const pending = await request.get(`${API}/me/notifications/pending-acknowledgements`, {
      headers: { authorization: `Bearer ${cToken}` },
    })
    expect((await pending.json()).data, 'sunucuda bekleyen onay kalmamalı').toEqual([])
  })

  test('bildirim zili duyuruyu gösterir, hamburger menüde profil ve şifre var', async ({ page, request }) => {
    const cToken = await citizenToken(request)
    await clearPending(request, cToken)

    const pid = await participantId(request)
    const aToken = await adminToken(request)
    const title = `E2E Bildirim ${Date.now()}`

    // Onay istemeyen normal duyuru: zil listesinde görünmeli, popup açılmamalı.
    await request.post(`${API}/surveys/interviewers/messages`, {
      headers: { authorization: `Bearer ${aToken}` },
      data: { title, body: 'Bilgilendirme mesajı.', interviewerIds: [pid], notify: true, sms: false, requiresAck: false },
    })

    await page.setViewportSize({ width: 820, height: 1180 })
    await login(page)
    await page.goto('/saha')
    await waitIdle(page)

    await expect(page.getByTestId('mandatory-announcement'), 'onay istemeyen duyuru popup açmamalı').toHaveCount(0)

    // Sağ üst bildirim alanı: rozet ve liste.
    const bell = page.getByTestId('field-notification-bell')
    await expect(bell, 'sağ üstte bildirim zili olmalı').toBeVisible()
    await expect(page.getByTestId('field-notification-badge'), 'okunmamış rozeti görünmeli').toBeVisible()
    await bell.click()
    // Panel açıldıktan sonra liste ağdan çekiliyor; canlı API yavaşladığında
    // varsayılan 7 sn sınıra dayanıyordu.
    const panel = page.getByTestId('field-notification-panel')
    await expect(panel, 'bildirim paneli açılmalı').toBeVisible({ timeout: 10_000 })
    await expect(panel.getByText(title), 'duyuru listede görünmeli').toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await page.mouse.click(400, 700)

    // Sol hamburger menü: görevler, profil, şifre işlemleri.
    await page.getByTestId('field-menu-button').click()
    const menu = page.getByTestId('field-side-menu')
    await expect(menu).toBeVisible()
    await expect(page.getByTestId('field-menu-tasks')).toBeVisible()
    await expect(page.getByTestId('field-menu-profile')).toBeVisible()
    await expect(page.getByTestId('field-menu-password')).toBeVisible()

    // Menü öğeleri de tablette dokunmaya uygun olmalı.
    for (const key of ['tasks', 'notifications', 'profile', 'password', 'sessions']) {
      const box = await page.getByTestId(`field-menu-${key}`).boundingBox()
      expect(Math.round(box!.height), `${key} menü öğesi 44px+ olmalı`).toBeGreaterThanOrEqual(MIN_TOUCH)
    }

    // Şifre işlemleri yalnızca profile götürmemeli, şifre değiştirme adımını da açmalı:
    // aksi hâlde anketör menüden geldiğinde bölümü kendisi aramak zorunda kalır.
    await page.getByTestId('field-menu-password').click()
    await expect(page).toHaveURL(/\/profil/)
    await expect(page.getByRole('heading', { name: 'Şifre Değiştir' }), 'şifre değiştirme adımı açılmalı').toBeVisible({ timeout: 10_000 })
  })
})

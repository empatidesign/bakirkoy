import { test, expect } from '@playwright/test'
import { login, hasCredentials } from '../helpers/auth'

const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Ana Sayfa' },
  { path: '/etkinlikler', name: 'Etkinlikler' },
  { path: '/planlarim', name: 'Planlarım' },
  { path: '/hizmetler', name: 'Hizmetler' },
  { path: '/geziler', name: 'Geziler' },
  { path: '/kutuphane', name: 'Kütüphane' },
  { path: '/ailem', name: 'Ailem' },
  { path: '/bildirimler', name: 'Bildirimler' },
  { path: '/bildirimler/tercihler', name: 'Bildirim Tercihleri' },
  { path: '/profil', name: 'Profil' },
  { path: '/profil/oturumlar', name: 'Aktif Oturumlar' },
  { path: '/kampanyalar', name: 'Kampanyalar' },
  { path: '/carkım', name: 'Çarkım' },
  { path: '/qr', name: 'QR Hub' },
  { path: '/formlarim', name: 'Formlarım' },
  { path: '/yarisma', name: 'Yarışma' },
  { path: '/acil-alanlar', name: 'Acil Alanlar' },
  { path: '/anketler', name: 'Anketler' },
  { path: '/seda', name: 'SEDA' },
  { path: '/gecmisim', name: 'Geçmişim' },
  { path: '/basvurularim', name: 'Başvurularım' },
  { path: '/sadakat', name: 'Sadakat' },
]

const CRASH_MARKERS = [
  'something went wrong',
  'bir şeyler ters gitti',
  'beklenmeyen bir hata',
  'application error',
  'cannot read propert',
  'is not a function',
  'undefined is not',
]

test.describe.serial('Korumalı sayfalar — login sonrası smoke', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi — login-sonrası testler atlandı')

  test('tek login, tüm korumalı sayfalar hatasız açılıyor', async ({ page }) => {
    await login(page)

    const failures: string[] = []

    for (const route of ROUTES) {
      const errors: string[] = []
      const onError = (e: Error) => errors.push(`${e.name}: ${e.message}`)
      page.on('pageerror', onError)

      const resp = await page.goto(route.path)
      await page.waitForLoadState('networkidle').catch(() => {})

      if (resp && resp.status() >= 500) failures.push(`${route.name} (${route.path}): HTTP ${resp.status()}`)
      if (/\/login/.test(page.url())) failures.push(`${route.name} (${route.path}): login'e atıldı (oturum düştü)`)

      const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
      for (const m of CRASH_MARKERS) {
        if (body.includes(m)) failures.push(`${route.name} (${route.path}): çökme metni "${m}"`)
      }
      if (errors.length) failures.push(`${route.name} (${route.path}): JS ${errors.join(' | ')}`)

      page.off('pageerror', onError)
    }

    expect(failures, `\nSORUNLU SAYFALAR:\n${failures.join('\n')}\n`).toHaveLength(0)
  })
})

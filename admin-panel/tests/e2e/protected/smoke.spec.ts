import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/auth'

const ROUTES: { path: string; name: string }[] = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/admin', name: 'Yöneticiler' },
  { path: '/participants', name: 'Katılımcılar' },
  { path: '/service-facilities', name: 'Hizmet Tesisleri' },
  { path: '/halls', name: 'Salonlar' },
  { path: '/events', name: 'Etkinlikler' },
  { path: '/travels', name: 'Geziler' },
  { path: '/library', name: 'Kütüphane' },
  { path: '/sports', name: 'Spor' },
  { path: '/kasif', name: 'Kaşif' },
  { path: '/pool', name: 'Havuz' },
  { path: '/youth-camp', name: 'Gençlik Kampı' },
  { path: '/scout-camp', name: 'İzcilik Kampı' },
  { path: '/science-center', name: 'Bilim Merkezi' },
  { path: '/seda', name: 'SEDA' },
  { path: '/accessible-life', name: 'Engelsiz Yaşam' },
  { path: '/muhtarlik', name: 'Muhtarlık' },
  { path: '/emergency-areas', name: 'Acil Alanlar' },
  { path: '/quiz', name: 'Quiz' },
  { path: '/wheel', name: 'Çark' },
  { path: '/survey', name: 'Anket' },
  { path: '/companies', name: 'Firmalar' },
  { path: '/settings', name: 'Ayarlar' },
  { path: '/loyalty', name: 'Sadakat' },
]

const CRASH_MARKERS = [
  'something went wrong',
  'bir şeyler ters gitti',
  'beklenmeyen bir hata',
  'cannot read propert',
  'is not a function',
  'undefined is not',
]

test.describe.serial('Admin korumalı sayfalar — smoke', () => {
  test('tek login, 24 sayfa hatasız açılıyor', async ({ page }) => {
    await login(page)

    const failures: string[] = []

    for (const route of ROUTES) {
      const errors: string[] = []
      const onError = (e: Error) => errors.push(`${e.name}: ${e.message}`)
      page.on('pageerror', onError)

      const resp = await page.goto(route.path)
      await page.waitForLoadState('load').catch(() => {})
      await page.waitForTimeout(400)

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

export type { Page }

import { test, expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_OTP } from './helpers/auth'
import { apiToken } from './helpers/facilityFixture'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

async function loginTolerant(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.locator('#email').waitFor()
  await page.locator('#email').fill(ADMIN_EMAIL)
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await page.waitForURL((u) => /\/login\/otp/.test(u.pathname) || !u.pathname.startsWith('/login'), { timeout: 20000 })
  if (/\/login\/otp/.test(page.url())) {
    const otp = page.locator('input[inputmode="numeric"]')
    await otp.first().waitFor()
    const n = await otp.count()
    for (let i = 0; i < Math.min(6, n); i++) await otp.nth(i).fill(ADMIN_OTP[i])
    await page.getByRole('button', { name: /Doğrula/ }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 })
  }
}

async function post(path: string, body: unknown, _retried = false): Promise<any> {
  const token = await apiToken()
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (r.status === 401 && !_retried) { await apiToken(true); return post(path, body, true) }
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${JSON.stringify(json)}`)
  return json.data ?? json
}

async function get(path: string, _retried = false): Promise<any> {
  const token = await apiToken()
  const r = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (r.status === 401 && !_retried) { await apiToken(true); return get(path, true) }
  const json = await r.json().catch(() => ({}))
  return json.data ?? json
}

async function createSportsFacility(name: string) {
  const me = await get('/auth/me')
  const managerId = me?.me?.id ?? me?.id ?? null
  const uniq = Math.random().toString(36).slice(2, 8)
  const serviceFacility = await post('/service-facilities', {
    name: `E2E Hizmet ${name} ${uniq}`, type: 'sports', locationType: 'Indoor',
    city: 'İstanbul', district: 'Sultangazi', address: 'E2E No:1', latitude: 41.1039, longitude: 28.8674, managerId,
    weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
    parkingCapacity: 0, parkingType: 'Free', capacity: 200,
  })
  return post('/sports/facilities', {
    name, kind: 'indoor',
    serviceFacilityId: serviceFacility.id, managerId, capacity: 100, isActive: true, grantAccess: false,
  })
}

test.describe('Aranabilir Select — tesis seçimi', () => {
  test('Spor Salonu Ayarları tesis dropdown’ında arama kutusu listeyi filtreler', async ({ page }) => {
    test.setTimeout(90000)

    const suffix = `${Date.now()}`
    await createSportsFacility(`E2E Badminton Salonu ${suffix}`)
    await createSportsFacility(`E2E Voleybol Salonu ${suffix}`)

    await loginTolerant(page)

    await page.goto('/sports')
    await page.getByRole('button', { name: 'Ayarlar' }).click()
    await page.getByRole('button', { name: 'Spor Salonu Ayarları' }).click()

    await page.getByText('Spor Salonu Kapsamı').waitFor({ timeout: 15000 })
    const scope = page.locator('div').filter({ hasText: /^Spor Salonu Seçin/ }).last()
    await scope.getByRole('button').first().click()

    const popover = page.locator('[data-ds-popover]')
    const search = popover.locator('input[placeholder]')
    await expect(search, 'dropdown açılınca en üstte arama kutusu görünmeli').toBeVisible({ timeout: 10000 })

    const optionsBefore = await popover.locator('button').count()
    await search.fill('badminton')
    await expect.poll(async () => popover.locator('button').count()).toBeLessThan(optionsBefore)
    await expect(popover.getByText(/badminton/i).first()).toBeVisible()

    await search.fill('zzzzxyyq')
    await expect(popover.getByText('Sonuç bulunamadı')).toBeVisible()
  })
})

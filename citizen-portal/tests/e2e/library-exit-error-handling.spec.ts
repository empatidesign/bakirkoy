import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { login, hasCredentials, TEST_TCKN, TEST_PASSWORD, TEST_OTP } from './helpers/auth'


const API = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

let ctx: APIRequestContext
let adminToken = ''
let citizenToken = ''

async function adminLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (l.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/verify-otp`, { data: { otpSessionToken: l.data.otpSessionToken, code: ADMIN_OTP } })).json()
  return v.data.accessToken
}

async function citizenLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/citizen/login`, { data: { identifier: TEST_TCKN, password: TEST_PASSWORD } })).json()
  if (l.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/citizen/verify-otp`, { data: { otpSessionToken: l.data.otpSessionToken, code: TEST_OTP } })).json()
  return v.data.accessToken
}

test.describe('Kütüphane QR çıkış — hata gösterimi (kod incelemesi düzeltmesi)', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    adminToken = await adminLogin()
    citizenToken = await citizenLogin()

    const existing = await ctx.get(`${API}/api/v1/me/libraries/session`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    })
    const existingSession = existing.ok() ? (await existing.json())?.data : null
    if (existingSession?.id) {
      await ctx.post(`${API}/api/v1/library-sessions/${existingSession.id}/exit`, {
        headers: { Authorization: `Bearer ${adminToken}` }, data: {},
      })
    }
  })

  test.afterAll(async () => {
    await ctx.dispose()
  })

  test('pending-exit isteği başarısız olursa vatandaşa hata gösterilir ve modal kapanır (sessizce yutulmaz)', async ({ page }) => {
    const sfRes = await ctx.post(`${API}/api/v1/service-facilities`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: `UI Exit-Err Tesis ${Date.now()}`, type: 'sports_facility', locationType: 'Indoor',
        outdoorCategory: null, areaSizeM2: 500, description: 'ui exit-err test', about: '',
        city: 'İstanbul', district: 'Sultangazi', address: 'Test Adres', latitude: 41.106, longitude: 28.867,
        managerId: null, manager: 'Test Yönetici', managerPhone: '05551112233',
        managerEmail: `sfmgr-exiterr-${Date.now()}@test.local`, emergencyPhone: '05559998877',
      },
    })
    const sf = await sfRes.json()
    const serviceFacilityId = sf.data.id

    const libRes = await ctx.post(`${API}/api/v1/libraries`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        name: `UI Exit-Err Kıraathane ${Date.now()}`, description: 'ui exit-err test', serviceFacilityId,
        managerId: null, manager: 'Test Yönetici', managerRoleKey: 'library_manager', managerRoleName: 'Kütüphane Sorumlusu',
        managerPhone: '05551112233', managerEmail: `libmgr-exiterr-${Date.now()}@test.local`, emergencyPhone: '05559998877',
        seatingMode: 'sirali', isMultiFloor: false,
        floors: [{ id: 'f1', name: 'Zemin Kat', capacity: 40, active: true, krokiUrl: null, sections: [] }],
        amenities: ['wifi'], queueEnabled: false, reservationEnabled: false,
        entryControlMode: 'manual', exitControlMode: 'qr', autoCheckOutAfterMinutes: 0,
        useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 2, longBreakDurationMinutes: 30,
        maxStudyHoursPerDay: 4, requireBreakAfterHours: 2, ipRestrictionEnabled: false, allowedIps: [],
        isActive: true, accessType: 'manual', deviceControlEnabled: false, areaType: 'mixed',
      },
    })
    const lib = await libRes.json()
    const libraryId = lib.data.id

    const walkInRes = await ctx.post(`${API}/api/v1/me/libraries/${libraryId}/walk-in`, {
      headers: { Authorization: `Bearer ${citizenToken}` }, data: {},
    })
    expect(walkInRes.ok(), 'walk-in başarılı olmalı').toBeTruthy()

    const checkinRes = await ctx.post(`${API}/api/v1/me/libraries/${libraryId}/check-in`, {
      headers: { Authorization: `Bearer ${citizenToken}` }, data: {},
    })
    expect(checkinRes.ok(), 'check-in başarılı olmalı').toBeTruthy()

    await login(page)

    await page.route('**/api/v1/me/libraries/pending-exit', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false, statusCode: 409, errorCode: 'NO_ACTIVE_SESSION',
          message: 'Aktif bir kıraathane oturumunuz bulunmuyor.', data: null,
        }),
      })
    })

    await page.goto('/kutuphane')
    await page.waitForLoadState('networkidle').catch(() => {})

    const sessionBanner = page.getByRole('button', { name: /Aktif oturumunuz var/i })
    await expect(sessionBanner).toBeVisible({ timeout: 15000 })
    await sessionBanner.click()

    const exitButton = page.getByRole('button', { name: /Oturumu Sonlandır/i })
    await expect(exitButton).toBeVisible({ timeout: 10000 })
    await exitButton.click()

    await expect(page.getByText('Aktif bir kıraathane oturumunuz bulunmuyor.').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Çıkış pencereniz')).not.toBeVisible()

    const sessionRes = await ctx.get(`${API}/api/v1/me/libraries/session`, { headers: { Authorization: `Bearer ${citizenToken}` } })
    const session = sessionRes.ok() ? (await sessionRes.json())?.data : null
    if (session?.id) {
      await ctx.post(`${API}/api/v1/library-sessions/${session.id}/exit`, { headers: { Authorization: `Bearer ${adminToken}` }, data: {} })
    }
  })
})

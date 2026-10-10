import { test, expect } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'

let api: AdminApi

test.describe('Service facilities admin CRUD coverage', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => { await api.dispose() })

  test('konum, kapasite ve çalışma saatleriyle tesis oluşturur', async ({ page }) => {
    test.setTimeout(90000)
    const name = uniq('E2E Hizmet Tesisi')
    const facility = await api.request<{ id: string; name: string; capacity: number; weekdayOpen: string; weekdayClose: string }>('POST', '/service-facilities', {
      name,
      type: 'Spor Tesisi',
      locationType: 'Outdoor',
      outdoorCategory: 'Park',
      areaSizeM2: 1500,
      description: 'Playwright tesis açıklaması',
      about: 'E2E tesis hakkında',
      city: 'İstanbul', district: 'Sultangazi', address: 'E2E tesis adresi', latitude: 41.123, longitude: 28.456,
      manager: 'E2E Tesis Sorumlusu', managerPhone: '05551112233', managerEmail: `e2e.service.${Date.now()}@example.com`, emergencyPhone: '02120000000',
      weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
      facilities: ['Duş', 'Wi-Fi'], accessibilityFeatures: ['Rampa'], parkingCapacity: 25, parkingType: 'Free', capacity: 250,
      offeredServices: [{ id: `svc-${Date.now()}`, name: 'E2E Hizmet', module: 'sports', capacity: 50, capacityUnit: 'kişi', schedule: 'Hafta içi', isPaid: false, description: 'E2E', active: true }],
      images: [],
    })
    expect(facility).toMatchObject({ name, capacity: 250, weekdayOpen: '08:00', weekdayClose: '22:00' })

    await loginAndOpen(page, '/service-facilities', 'Hizmet Tesisleri')
    await page.getByPlaceholder('Tesis adı, ilçe, adres veya yönetici ara...').fill(name)
    const row = page.locator('tr', { hasText: name }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await expect(row).toContainText(/Sultangazi|250|Aktif/)
  })
})

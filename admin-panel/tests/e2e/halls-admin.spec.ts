import { test, expect } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'

let api: AdminApi

async function createFacility(name = uniq('E2E Salon Tesis')) {
  return api.request<{ id: string; name: string }>('POST', '/service-facilities', {
    name,
    type: 'Kültür Merkezi',
    locationType: 'Indoor',
    city: 'İstanbul',
    district: 'Sultangazi',
    address: 'E2E salon tesis adresi',
    latitude: 41.1,
    longitude: 28.8,
    manager: 'E2E Yönetici',
    managerPhone: '05550000000',
    managerEmail: `e2e.facility.${Date.now()}@example.com`,
    weekdayOpen: '09:00', weekdayClose: '18:00', weekendOpen: '10:00', weekendClose: '16:00',
    facilities: ['Wi-Fi'], accessibilityFeatures: ['Rampa'], parkingCapacity: 10, parkingType: 'Free', capacity: 120,
    offeredServices: [], images: [],
  })
}

test.describe('Halls admin CRUD coverage', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => { await api.dispose() })

  test('salon oluşturur ve düzenlemeyi doğrular', async ({ page }) => {
    test.setTimeout(90000)
    const facility = await createFacility()
    const name = uniq('E2E Salon')
    const updatedName = `${name} Güncel`
    const hall = await api.request<{ id: string; name: string; capacity: number }>('POST', '/halls', {
      facilityId: facility.id,
      name,
      type: 'conference',
      buildingFloor: 1,
      seatingMode: 'standing',
      capacity: 75,
      featureIds: [],
      description: 'Playwright salon',
      about: 'E2E salon hakkında',
    })
    expect(hall.capacity).toBe(75)

    try {
      const updated = await api.request<{ name: string; capacity: number }>('PUT', `/halls/${hall.id}`, {
        facilityId: facility.id,
        name: updatedName,
        type: 'conference',
        buildingFloor: 2,
        seatingMode: 'standing',
        capacity: 90,
        featureIds: [],
        description: 'Playwright salon güncel',
        about: 'E2E salon güncel',
      })
      expect(updated).toMatchObject({ name: updatedName, capacity: 90 })

      await loginAndOpen(page, '/halls', 'Salonlar')
      await page.getByPlaceholder('Salon adı, tür veya tesis ara...').fill(updatedName)
      await expect(page.locator('tr', { hasText: updatedName }).first()).toContainText('90', { timeout: 20000 })
    } finally {
      // NOT (2026-09-05, gerçek testte bulunan bug): Bu test hem /halls hem
      // /service-facilities'e API üzerinden kayıt oluşturuyordu ama HİÇBİRİNİ
      // silmiyordu — her koşuda orphan veri birikiyordu (2 koşuda 2 facility +
      // 2 hall orphan bulundu ve manuel temizlendi). Cleanup eklendi.
      await api.request('DELETE', `/halls/${hall.id}`).catch(() => {})
      await api.request('DELETE', `/service-facilities/${facility.id}`).catch(() => {})
    }
  })
})

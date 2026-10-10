import { test, expect } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'

let api: AdminApi

test.describe('Emergency areas admin CRUD coverage', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => { await api.dispose() })

  test('acil alan oluşturur ve düzenlemeyi doğrular', async ({ page }) => {
    test.setTimeout(90000)
    const name = uniq('E2E Acil Alan')
    const updatedName = `${name} Güncel`
    const created = await api.request<{ id: string; name: string; capacity: number }>('POST', '/emergency-areas', {
      name,
      neighborhood: 'Uğur Mumcu',
      address: 'E2E acil alan adresi',
      latitude: 41.12,
      longitude: 28.89,
      capacity: 500,
      areaSizeM2: 2500,
      equipment: { toilet: true, water: true, electricity: true, generator: false, heating: false, tentArea: true },
      manager: 'E2E Alan Sorumlusu',
      managerPhone: '05553334455',
      managerEmail: `e2e.emergency.${Date.now()}@example.com`,
      emergencyPhone: '02125550000',
      description: 'Playwright acil alan',
    })
    expect(created.capacity).toBe(500)

    const updated = await api.request<{ name: string; capacity: number }>('PUT', `/emergency-areas/${created.id}`, {
      name: updatedName,
      neighborhood: 'Uğur Mumcu',
      address: 'E2E acil alan güncel adres',
      latitude: 41.12,
      longitude: 28.89,
      capacity: 650,
      areaSizeM2: 3000,
      equipment: { toilet: true, water: true, electricity: true, generator: true, heating: false, tentArea: true },
      manager: 'E2E Alan Sorumlusu',
      managerPhone: '05553334455',
      managerEmail: `e2e.emergency.updated.${Date.now()}@example.com`,
      emergencyPhone: '02125550000',
      description: 'Playwright acil alan güncel',
    })
    expect(updated).toMatchObject({ name: updatedName, capacity: 650 })

    await loginAndOpen(page, '/emergency-areas', 'Acil Toplanma Alanları')
    await page.getByPlaceholder('Alan adı, mahalle veya adres ara...').fill(updatedName)
    await expect(page.locator('tr', { hasText: updatedName }).first()).toContainText(/650|Uğur Mumcu/, { timeout: 20000 })
  })
})

import { test, expect } from '@playwright/test'
import { AdminApi, futureIso, loginAndOpen, uniq } from './helpers/adminApi'

let api: AdminApi

test.describe('SEDA admin CRUD coverage', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => { await api.dispose() })

  test('dönem aktif eder, tanım ve okul kaydını listede doğrular', async ({ page }) => {
    test.setTimeout(90000)
    const periodName = uniq('E2E SEDA Dönem')
    const schoolName = uniq('E2E SEDA Okul')
    const definitionName = uniq('E2E SEDA Eğitim Türü')

    const period = await api.request<{ id: string; isActive: boolean }>('POST', '/seda/periods', {
      name: periodName,
      startDate: futureIso(1),
      endDate: futureIso(60),
      maxApplications: 40,
      description: 'Playwright dönem fixture',
    })
    const activePeriod = await api.request<{ id: string; isActive: boolean }>('PATCH', `/seda/periods/${period.id}/activate`)
    expect(activePeriod.isActive).toBeTruthy()

    const definition = await api.request<{ id: string; name: string; type: string }>('POST', '/seda/definitions', { type: 'education-type', name: definitionName })
    expect(definition).toMatchObject({ name: definitionName, type: 'education-type' })

    const school = await api.request<{ id: string; name: string }>('POST', '/seda/schools', { name: schoolName })
    expect(school.name).toBe(schoolName)

    await loginAndOpen(page, '/seda?tab=donemler', 'Dönemler')
    await page.getByPlaceholder('Dönem adı ara...').fill(periodName)
    await expect(page.locator('tr', { hasText: periodName }).first()).toContainText(/Aktif/, { timeout: 20000 })

    const definitions = await api.request<{ items: { name: string }[] }>('GET', `/seda/definitions?page=1&limit=20&type=education-type&search=${encodeURIComponent(definitionName)}`)
    expect(definitions.items.some((d) => d.name === definitionName)).toBeTruthy()

    const schools = await api.request<{ items: { name: string }[] }>('GET', `/seda/schools?page=1&limit=20&search=${encodeURIComponent(schoolName)}`)
    expect(schools.items.some((s) => s.name === schoolName)).toBeTruthy()
  })
})

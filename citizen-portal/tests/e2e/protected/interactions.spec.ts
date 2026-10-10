import { assertCitizenStateFile, expect, isolatedAuthEnabled, test } from '../helpers/isolatedAuth'
import { login, hasCredentials } from '../helpers/auth'

test.describe.serial('Citizen — derin etkileşim', () => {
  test.skip(!isolatedAuthEnabled && !hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeEach(async ({ page }) => {
    if (!isolatedAuthEnabled) await login(page)
  })

  test('Ana sayfa: içerik yükleniyor, çökme yok', async ({ page, isolatedAuthSession }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    if (isolatedAuthEnabled) {
      expect(isolatedAuthSession?.workerIndex).toBe(testInfo.workerIndex)
      await assertCitizenStateFile(isolatedAuthSession!.path, testInfo.workerIndex)
    }
    await page.goto('/')
    if (isolatedAuthEnabled) expect(await page.evaluate(() => localStorage.getItem('e2e_worker_index'))).toBe(String(testInfo.workerIndex))
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/)
    const body = await page.locator('body').innerText()
    expect(body.length, 'Ana sayfa boş').toBeGreaterThan(20)
    expect(errors, errors.join('\n')).toHaveLength(0)
    if (process.env.E2E_FORCE_REPRESENTATIVE_FAILURE === '1') expect('forced failure').toBe('success')
  })

  test('Etkinlikler: Keşfet ↔ Başvurularım sekme geçişi çökmüyor', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/etkinlikler')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Etkinlikler' })).toBeVisible()
    await page.getByText('Başvurularım', { exact: true }).first().click().catch(() => {})
    await page.waitForTimeout(800)
    await page.getByText('Keşfet', { exact: true }).first().click().catch(() => {})
    await page.waitForTimeout(800)

    expect(errors, errors.join('\n')).toHaveLength(0)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('Profil: kullanıcı bilgileri ve TC görünüyor', async ({ page }) => {
    await page.goto('/profil')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('T.C. Kimlik No')).toBeVisible({ timeout: 10000 })
  })

  test('Geziler: içerik yükleniyor, çökme yok', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/geziler')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/)
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})

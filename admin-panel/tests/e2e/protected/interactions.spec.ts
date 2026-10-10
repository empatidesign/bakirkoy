import { assertAdminStateFile, expect, isolatedAuthEnabled, test } from '../helpers/isolatedAuth'
import { login } from '../helpers/auth'

test.describe.serial('Admin — derin etkileşim', () => {
  test.beforeEach(async ({ page }) => {
    if (!isolatedAuthEnabled) await login(page)
  })

  test('Katılımcılar: başlık, tablo ve veri/boş-durum görünür', async ({ page, isolatedAuthSession }, testInfo) => {
    if (isolatedAuthEnabled) {
      expect(isolatedAuthSession?.workerIndex).toBe(testInfo.workerIndex)
      await assertAdminStateFile(isolatedAuthSession!.path, testInfo.workerIndex)
    }
    await page.goto('/participants')
    if (isolatedAuthEnabled) expect(await page.evaluate(() => localStorage.getItem('e2e_worker_index'))).toBe(String(testInfo.workerIndex))
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading').first()).toBeVisible()

    const table = page.getByRole('table').first()
    const emptyState = page.getByText(/kayıt yok|bulunamadı|henüz/i).first()
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: 12000 })
    if (process.env.E2E_FORCE_REPRESENTATIVE_FAILURE === '1') expect('forced failure').toBe('success')
  })

  test('Katılımcılar: arama kutusuna yazınca sayfa çökmüyor', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/participants')
    await page.waitForLoadState('networkidle')

    const search = page.getByPlaceholder(/ara/i).first()
    if (await search.count()) {
      await search.fill('test')
      await page.waitForTimeout(1200)
    }
    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('Etkinlikler: sayfa içeriği (tablo veya boş durum) yükleniyor', async ({ page }) => {
    await page.goto('/events')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading').first()).toBeVisible()
    const table = page.getByRole('table').first()
    const empty = page.getByText(/kayıt yok|bulunamadı|henüz|etkinlik yok/i).first()
    await expect(table.or(empty).first()).toBeVisible({ timeout: 12000 })
  })

  test('Firmalar: liste yükleniyor, ilk satıra tıklayınca çökme yok', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/companies')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading').first()).toBeVisible()

    const rows = page.getByRole('row')
    const count = await rows.count()
    if (count > 1) {
      await rows.nth(1).click().catch(() => {})
      await page.waitForTimeout(800)
    }
    expect(errors, errors.join('\n')).toHaveLength(0)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('Ayarlar: sekmeler/içerik render ediliyor', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading').first()).toBeVisible()
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})

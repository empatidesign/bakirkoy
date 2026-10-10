import { test, expect, Page } from '@playwright/test'
import { login } from './helpers/auth'
import { setupModGatingFixture, ModGatingFixture, FACILITY_MODULES, FacilityModule } from './helpers/sportsSetup'

const OFF_BUTTON_TITLE = 'Bu grupta yoklama kapalı (devamsızlık takibi yok)'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const MODULE_LABELS: Record<FacilityModule, string> = {
  sports: 'Spor', pool: 'Havuz', 'youth-camp': 'Gençlik Kampı',
  'scout-camp': 'İzcilik Kampı', 'science-center': 'Bilim Merkezi', kasif: 'Kaşif',
}

async function openSessionDay(page: Page, fx: ModGatingFixture) {
  const [y, m, d] = fx.sessionDate.split('-').map(Number)
  const targetLabel = `${MONTHS[m - 1]} ${y}`
  const dayNum = String(d)

  await page.goto(`/${fx.module}?f=${fx.facilityId}&tab=sessions`)
  await expect(page.getByText('Seans Takvimi')).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  const monthLabel = (label: string) =>
    page.getByText(new RegExp(`^${label}$`)).first()

  for (let i = 0; i < 6; i++) {
    if (await monthLabel(targetLabel).isVisible().catch(() => false)) break
    await page.getByRole('button', { name: 'Sonraki ay' }).click()
    await page.waitForTimeout(300)
  }
  await expect(monthLabel(targetLabel)).toBeVisible()
  const dayTitleRe = new RegExp(`${d}\\s+${MONTHS[m - 1]}\\s+${y}`)
  await expect(async () => {
    const cell = page.getByRole('button', { name: dayNum, exact: true })
    const title = await cell.getAttribute('title')
    expect(title ?? '', 'gün hücresinde seans ipucu bekleniyor').toMatch(/seans/i)
    await cell.click()
    await expect(page.getByText(dayTitleRe).first()).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 25000 })
}

test.describe('Tesis yoklama mod-gating — AttendanceMode=off (self-contained, tüm facility modülleri)', () => {
  for (const module of FACILITY_MODULES) {
    test.describe(`[${MODULE_LABELS[module]}]`, () => {
      let fx: ModGatingFixture

      test.beforeAll(async () => {
        test.setTimeout(60000)
        fx = await setupModGatingFixture(module)
      })

      test('off grup: buton disable + "Yoklama Kapalı" rozeti; full grup Yoklama Al çalışır', async ({ page }) => {
        await login(page)
        await openSessionDay(page, fx)

        const offButton = page.getByRole('button', { name: OFF_BUTTON_TITLE })
        await expect(offButton).toBeVisible()
        await expect(offButton).toBeDisabled()

        await expect(page.getByText('Yoklama Kapalı').first()).toBeVisible()

        const fullButtons = page.getByRole('button', { name: 'Yoklama Al' })
        expect(await fullButtons.count()).toBeGreaterThanOrEqual(1)
        await expect(fullButtons.first()).toBeEnabled()
      })

      test('off grup butonu tıklanamaz → yoklama modalı açılmaz', async ({ page }) => {
        await login(page)
        await openSessionDay(page, fx)

        const offButton = page.getByRole('button', { name: OFF_BUTTON_TITLE })
        await offButton.click({ force: true }).catch(() => undefined)

        await expect(page.getByRole('heading', { name: 'Yoklama Al' })).toHaveCount(0)
      })

      test('full grup Yoklama Al → modal açılır (gating yalnız off için)', async ({ page }) => {
        await login(page)
        await openSessionDay(page, fx)

        await page.getByRole('button', { name: 'Yoklama Al' }).first().click()
        await expect(page.getByRole('heading', { name: 'Yoklama Al' })).toBeVisible({ timeout: 10000 })
      })
    })
  }
})

import { test, expect, Page } from '@playwright/test'
import { login } from './helpers/auth'
import { setupAbsenceFixture, AbsenceFixture, FACILITY_MODULES, FacilityModule } from './helpers/sportsSetup'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const MODULE_LABELS: Record<FacilityModule, string> = {
  sports: 'Spor', pool: 'Havuz', 'youth-camp': 'Gençlik Kampı',
  'scout-camp': 'İzcilik Kampı', 'science-center': 'Bilim Merkezi', kasif: 'Kaşif',
}

async function openTakenSession(page: Page, fx: AbsenceFixture) {
  const [y, m, d] = fx.sessionDate.split('-').map(Number)
  const targetLabel = `${MONTHS[m - 1]} ${y}`
  const dayNum = String(d)

  await page.goto(`/${fx.module}?f=${fx.facilityId}&tab=sessions`)
  await expect(page.getByText('Seans Takvimi')).toBeVisible({ timeout: 20000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  const monthLabel = (label: string) => page.getByText(new RegExp(`^${label}$`)).first()
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

test.describe('Tesis yoklama — devamsızlık/kalan hak + düzeltme yetkisi (self-contained, tüm facility modülleri)', () => {
  for (const module of FACILITY_MODULES) {
    test(`[${MODULE_LABELS[module]}] alınmış seans roster: kalan hak rozeti + "Devamsızlık Düzelt" → düzeltme modu`, async ({ page }) => {
      test.setTimeout(90000)
      const fx = await setupAbsenceFixture(module)

      await login(page)
      await openTakenSession(page, fx)

      await page.getByRole('button', { name: 'Yoklamayı Görüntüle' }).first().click()

      await expect(page.getByText(/yoklaması alınmıştır/)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/Kalan hak:/).first()).toBeVisible()

      const editBtn = page.getByRole('button', { name: 'Devamsızlık Düzelt' })
      await expect(editBtn).toBeVisible()

      await editBtn.click()
      await expect(page.getByText(/düzeltme modundasınız/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Düzeltmeyi Kaydet' })).toBeVisible()
      await expect(page.getByText('Tümü Geldi')).toBeVisible()
    })
  }
})

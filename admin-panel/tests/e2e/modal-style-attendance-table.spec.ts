import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

// 2026-10-04: modal başlıkları tema tonunda (ds-hero) + yoklama checkbox'lı tablo (seç/tümünü seç/toplu durum).
test.use({ viewport: { width: 1600, height: 1000 } })
const SHOTS = process.env.SHOTS_DIR ?? 'test-results'

test('Seans Kapatma modalı yeni tasarım + yoklama tablosu checkbox/toplu işlem', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto('/sports')
  await page.getByText('QATEST sports Tesis KST561715').first().click()
  await page.getByRole('tab', { name: /Seanslar/ }).or(page.getByRole('button', { name: /^Seanslar/ })).first().click()

  // --- Modal stili ---
  await page.getByRole('button', { name: /Seans Kapatma/ }).click()
  const header = page.locator('.pilot-form-dialog .pilot-form-header').first()
  await expect(header).toBeVisible()
  expect(await header.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('radial-gradient')
  expect(await header.locator('h3').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)')
  await page.screenshot({ path: `${SHOTS}/modal-seans-kapatma.png` })
  await page.getByRole('button', { name: 'Kapat' }).first().click()

  // --- Yoklama tablosu ---
  await page.getByRole('button', { name: 'Bugün' }).first().click()
  await page.getByRole('button', { name: String(new Date().getDate()), exact: true }).first().click()
  const attendanceBtn = page.getByRole('button', { name: /^(Yoklama Al|Yoklamayı Görüntüle)$/ }).first()
  await expect(attendanceBtn).toBeVisible({ timeout: 20000 })
  await attendanceBtn.click()
  const dialog = page.locator('.pilot-form-dialog').last()
  const table = dialog.locator('table')
  await expect(table).toBeVisible({ timeout: 20000 })

  // Salt-okunursa düzeltme moduna geç (izin varsa)
  const fix = dialog.getByRole('button', { name: /Devamsızlık Düzelt/ })
  if (await fix.isVisible()) await fix.click()

  const selectAll = dialog.getByRole('checkbox', { name: 'Tümünü seç' })
  await expect(selectAll).toBeVisible()
  const rows = await table.locator('tbody tr').count()
  await selectAll.click()
  await expect(dialog.getByText(`${rows} seçili`)).toBeVisible()
  await dialog.getByRole('button', { name: 'Gelmedi işaretle' }).click()
  await expect(dialog.getByText(`Gelmedi: ${rows}`)).toBeVisible()

  // Tek satır seçimi + toplu "Geldi"
  await table.locator('tbody tr').first().getByRole('checkbox').click()
  await expect(dialog.getByText('1 seçili')).toBeVisible()
  await dialog.getByRole('button', { name: 'Geldi işaretle' }).click()
  await expect(dialog.getByText('Geldi: 1')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/yoklama-tablo.png` })
  // Kaydetmeden çık (veri değişmesin)
})

import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test('kütüphane yönetimi: tek satır araç çubuğu, durum seçimi ve sayfa boyutu', async ({ page }) => {
  await login(page)
  await page.goto('/library')
  await page.getByRole('button', { name: 'Yönet', exact: true }).click()
  await expect(page.getByText('Kütüphane Yönetimi')).toBeVisible({ timeout: 20000 })

  const addBtn = page.getByRole('button', { name: /Yeni Kütüphane Ekle/ })
  const search = page.getByPlaceholder('Kütüphane ara (isim, ilçe, adres)...')
  const status = page.getByRole('button', { name: 'Durum filtresi' })
  await expect(status).toBeVisible()

  const [a, s, f] = await Promise.all([addBtn.boundingBox(), search.boundingBox(), status.boundingBox()])
  const mid = (b: NonNullable<typeof a>) => b.y + b.height / 2
  expect(Math.abs(mid(a!) - mid(s!))).toBeLessThan(6)
  expect(Math.abs(mid(s!) - mid(f!))).toBeLessThan(6)

  await expect(status).toContainText('Tümü')
  await status.click()
  await page.locator('[data-ds-popover]').getByRole('button', { name: /^Aktif/ }).click()
  await expect(status).toContainText('Aktif')

  const pageSize = page.getByRole('button', { name: 'Sayfa başına kayıt sayısı' })
  await expect(pageSize).toBeVisible()
  await pageSize.click()
  await page.locator('[data-ds-popover]').getByRole('button', { name: '25', exact: true }).click()
  await expect(pageSize).toContainText('25')
})

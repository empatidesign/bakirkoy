import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.use({ viewport: { width: 1600, height: 1000 } })

test('Seanslar sekmesinde "Seans Ekle" butonu yok', async ({ page }) => {
  await login(page)
  await page.goto('/sports')
  await page.getByRole('button', { name: /işlemleri$/ }).first().click()
  await page.getByRole('menuitem', { name: 'Detay Sayfasını Aç' }).click()
  await page.getByRole('tab', { name: /Seanslar/ }).or(page.getByRole('button', { name: /^Seanslar/ })).first().click()
  await expect(page.getByRole('button', { name: /Seans Kapatma/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Seans Ekle$/ })).toHaveCount(0)
  await page.screenshot({ path: `${process.env.SHOTS_DIR ?? 'test-results'}/seanslar-no-add.png` })
})

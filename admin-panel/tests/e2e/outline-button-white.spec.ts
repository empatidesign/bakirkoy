import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.use({ viewport: { width: 1600, height: 1000 } })

test('outline butonların zemini beyaz', async ({ page }) => {
  await login(page)
  await page.goto('/sports')
  await page.getByText('QATEST sports Tesis KST561715').first().click()
  await page.getByRole('tab', { name: /Gruplar/ }).or(page.getByRole('button', { name: /^Gruplar/ })).first().click()
  const btn = page.getByRole('button', { name: /Görünümü/ }).first()
  await expect(btn).toBeVisible()
  expect(await btn.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
  await page.screenshot({ path: `${process.env.SHOTS_DIR ?? 'test-results'}/outline-btn.png`, clip: { x: 600, y: 150, width: 1000, height: 400 } })
})

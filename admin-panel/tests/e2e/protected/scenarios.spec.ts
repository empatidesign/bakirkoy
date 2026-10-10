import { test, expect } from '@playwright/test'
import { login } from '../helpers/auth'

test.describe.serial('Admin — kullanıcı senaryoları', () => {
  test('bilinmeyen route /dashboard\'a yönlendiriyor', async ({ page }) => {
    await login(page)
    await page.goto('/boyle-bir-sayfa-yok-12345')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('sekme değişimi URL\'ye yansıyor ve geri tuşu önceki sekmeye döner', async ({ page }) => {
    await login(page)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'Roller' }).or(page.getByText('Roller', { exact: true })).first().click()
    await expect(page).toHaveURL(/[?&]tab=roles/, { timeout: 8000 })

    await page.getByRole('tab', { name: 'Departmanlar' }).or(page.getByText('Departmanlar', { exact: true })).first().click()
    await expect(page).toHaveURL(/[?&]tab=departments/, { timeout: 8000 })

    await page.goBack()
    await expect(page).toHaveURL(/[?&]tab=roles/, { timeout: 8000 })
  })

  test('sayfa yenilenince oturum korunuyor (reload sonrası login\'e atmıyor)', async ({ page }) => {
    await login(page)
    await page.goto('/participants')
    await page.waitForLoadState('networkidle')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('Çıkış Yap → login sayfasına döner ve korumalı sayfa erişilemez', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByText('Çıkış Yap').click()
    await page.waitForURL(/\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/participants')
    await page.waitForLoadState('networkidle')
    await expect(page, 'Çıkıştan sonra korumalı sayfa açıldı').toHaveURL(/\/login/)
  })
})

import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe.configure({ mode: 'serial' })

test('Hizmet tesisi seçici Liste ve + butonları oturumu kapatmaz', async ({ page }) => {
  await login(page)
  await page.goto('/halls')
  await page.getByRole('button', { name: 'Yeni Salon' }).first().click()

  await page.getByRole('button', { name: 'Yeni hizmet tesisi ekle' }).click()
  await expect(page.getByText('Yeni Hizmet Tesisi Ekle')).toBeVisible()
  await expect(page).not.toHaveURL(/\/login/)
  await page.getByRole('button', { name: 'İptal' }).last().click()
  await expect(page.getByText('Yeni Hizmet Tesisi Ekle')).toBeHidden()

  await page.getByRole('button', { name: 'Hizmet tesisleri listesi' }).click()
  await expect(page).toHaveURL(/\/service-facilities/)
  await expect(page).not.toHaveURL(/\/login/)
})

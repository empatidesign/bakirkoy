import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Kütüphane formu — GPS konum kısıtlaması validasyonu (kök neden düzeltmesi)', () => {
  test('yeni kıraathane oluştururken konum kısıtlaması açılıp koordinatlar boş bırakılınca Ekle butonu devre dışı kalır', async ({ page }) => {
    await login(page)
    await page.goto('/library')
    await page.waitForLoadState('networkidle').catch(() => {})

    await page.getByRole('button', { name: 'Yönet', exact: true }).click()
    await page.getByRole('button', { name: 'Yeni Kütüphane Ekle' }).click()

    await expect(page.getByText('Güvenlik · Konum (GPS) Kısıtlaması')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Örn. Cemil Meriç Millet Kütüphanesi').fill(`E2E Geofence Form Test ${Date.now()}`)
    const facilitySelect = page.getByText('Hizmet tesisi seçin...')
    await facilitySelect.click({ timeout: 5000 }).catch(() => {})
    const firstOption = page.locator('[role="option"], li[role="button"]').first()
    await firstOption.click({ timeout: 5000 }).catch(() => {})

    const addButton = page.getByRole('button', { name: 'Ekle', exact: true })

    const geofenceRow = page.locator('div', { hasText: 'Konum kısıtlaması aktif' }).filter({ has: page.getByRole('switch') }).last()
    const switchButton = geofenceRow.getByRole('switch')
    await switchButton.click()
    await expect(page.getByText('Enlem (Latitude)')).toBeVisible({ timeout: 5000 })

    await expect(addButton).toBeDisabled({ timeout: 5000 })

    await page.getByPlaceholder('41.1039').fill('41.1039')
    await page.getByPlaceholder('28.8674').fill('28.8674')

    await switchButton.click()
    await expect(page.getByText('Enlem (Latitude)')).not.toBeVisible({ timeout: 5000 })
  })
})

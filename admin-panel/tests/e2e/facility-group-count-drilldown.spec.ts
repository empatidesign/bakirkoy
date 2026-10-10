import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { setupModGatingFixture } from './helpers/sportsSetup'

test.describe('Grup listesi — kontenjan/yedek/bekleyen tıklanınca liste açılır', () => {
  test('Kontenjan rozetine tıklanınca kayıt/yedek/bekleyen modalı veya alt gruplar açılır', async ({ page }) => {
    test.setTimeout(90000)
    const { facilityId } = await setupModGatingFixture('sports')
    await login(page)
    await page.goto(`/sports?f=${facilityId}&tab=groups`)

    const capacityBtn = page.locator('td button[title="Kayıtlı listesini gör"], td button[title="Alt grupları gör"]').first()
    await expect(capacityBtn).toBeVisible({ timeout: 20000 })
    const title = await capacityBtn.getAttribute('title')
    await capacityBtn.click()

    if (title === 'Kayıtlı listesini gör') {
      await expect(page.getByText('Kayıtlar ve Yedekler').first()).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: 'Kapat' }).last().click()
    } else {
      await expect(page.locator('td button[title="Kayıtlı listesini gör"]').first()).toBeVisible({ timeout: 15000 })
      await page.locator('td button[title="Kayıtlı listesini gör"]').first().click()
      await expect(page.getByText('Kayıtlar ve Yedekler').first()).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: 'Kapat' }).last().click()
    }

    const waitlistBtn = page.locator('td button[title="Yedek listesini gör"]').first()
    if (await waitlistBtn.count()) {
      await waitlistBtn.click()
      await expect(page.getByText('Kayıtlar ve Yedekler').first()).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: 'Kapat' }).last().click()
    }

    const pendingBtn = page.locator('td button[title="Bekleyen başvuruları gör"]').first()
    if (await pendingBtn.count()) {
      await pendingBtn.click()
      await expect(page.getByText('Kayıtlar ve Yedekler').first()).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: 'Kapat' }).last().click()
    }
  })
})

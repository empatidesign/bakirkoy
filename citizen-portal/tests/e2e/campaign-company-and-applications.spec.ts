import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const trackErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe.serial('Firma kampanyaları + Kaydettiklerim + Başvuru durum filtresi', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test('Kampanya detayında firma satırına tıklayınca firma sayfası açılır', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/kampanyalar')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const firstCard = page.locator('[role="button"]').filter({ hasText: /₺|%/ }).first()
    if (!(await firstCard.count())) test.skip(true, 'Kampanya kartı yok')
    await firstCard.click()
    await page.waitForTimeout(600)

    const modal = page.locator('.fixed.inset-0.z-50')
    await expect(modal).toBeVisible({ timeout: 10000 })
    const firmaRow = modal.getByRole('button').filter({ hasText: 'Firma' }).first()
    if (!(await firmaRow.count())) test.skip(true, 'Firma satırı yok')

    const companyReqP = page.waitForRequest(
      (r) => /\/me\/campaigns\/directory\/[0-9a-f-]+/.test(r.url()),
      { timeout: 8000 },
    ).catch(() => null)
    const listReqP = page.waitForRequest(
      (r) => r.url().includes('/me/campaigns') && r.url().includes('companyId='),
      { timeout: 8000 },
    ).catch(() => null)

    await firmaRow.click()

    const [companyReq, listReq] = await Promise.all([companyReqP, listReqP])

    expect(page.url(), 'firma rotasına gidilmeli').toContain('/kampanyalar/firma/')
    expect(companyReq, 'firma bilgi ucu çağrılmalı').toBeTruthy()
    expect(listReq, 'kampanya listesi companyId ile çağrılmalı').toBeTruthy()

    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('Profilde Kaydettiklerim → /kaydettiklerim onlySaved ile açılır', async ({ page }) => {
    await login(page)
    await page.goto('/profil')
    await page.waitForLoadState('networkidle')

    const savedLink = page.getByText('Kaydettiklerim').first()
    await expect(savedLink).toBeVisible()

    const savedReqP = page.waitForRequest(
      (r) => r.url().includes('/me/campaigns') && r.url().includes('onlySaved=true'),
      { timeout: 8000 },
    ).catch(() => null)

    await savedLink.click()
    const savedReq = await savedReqP
    expect(page.url()).toContain('/kaydettiklerim')
    expect(savedReq, 'kaydettiklerim onlySaved=true ile listelemeli').toBeTruthy()
  })

  test('Başvurularım durum filtresi (Onaylananlar/Bekleyenler) çalışır', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/basvurularim')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(700)

    await expect(page.getByRole('button', { name: /Onaylananlar/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Bekleyenler/ })).toBeVisible()

    await page.getByRole('button', { name: /Onaylananlar/ }).click()
    await page.waitForTimeout(400)

    await page.getByRole('button', { name: /Bekleyenler/ }).click()
    await page.waitForTimeout(400)

    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})

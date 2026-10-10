import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.use({ viewport: { width: 1920, height: 1080 } })

test.describe('Spor salonları ana ekranı — yeni tasarım', () => {
  test('istatistik, filtre, tablo sütunları, görünüm ve dışa aktarma çalışır', async ({ page }) => {
    test.setTimeout(90000)
    await login(page)
    const listRes = page.waitForResponse((r) => r.url().includes('/sports/facilities?') && r.request().method() === 'GET')
    await page.goto('/sports')
    const body = await (await listRes).json()
    const first = body.data.items[0]
    expect(first).toHaveProperty('branches')
    expect(first).toHaveProperty('genders')
    expect(first).toHaveProperty('todaySessionCount')
    expect(first).toHaveProperty('sessionDays')
    expect(first).toHaveProperty('updatedAt')

    for (const label of ['Toplam Kontenjan', 'Bugünkü Seans', 'Bekleyenler']) {
      await expect(page.locator('.pilot-stat-label', { hasText: label })).toBeVisible({ timeout: 20000 })
    }
    await expect(page.getByRole('button', { name: 'Yeni Salon Ekle' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Listeyi yenile' })).toBeVisible()

    await expect(page.locator('th', { hasText: 'Seans Bilgisi' }).first()).toBeVisible()
    await expect(page.locator('th', { hasText: 'Branşlar' })).toHaveCount(0)
    for (const label of ['Salon Türü', 'Branş', 'Seans Günü', 'Doluluk Oranı']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    const triggers = page.locator('.pilot-filters button[aria-haspopup]')
    await expect(triggers.first()).toHaveText(/Tüm salonlar/)
    await expect(triggers.nth(1)).toHaveText(/Tüm branşlar/)
    const withBranch = body.data.items.find((f: { branches: string[] }) => f.branches.length > 0)
    if (withBranch) {
      const name = withBranch.branches[0]
      await triggers.nth(1).click()
      await page.locator('[data-ds-popover] input').fill(name)
      await page.locator('[data-ds-popover] button', { hasText: new RegExp(`^${name}$`) }).click()
      await expect(triggers.nth(1)).toHaveText(name)
      await expect(page.locator('tbody tr').first()).toBeVisible()
      await page.getByRole('button', { name: 'Filtreleri sıfırla' }).click()
      await expect(triggers.nth(1)).toHaveText(/Tüm branşlar/)
    }

    await expect(page.locator('th svg[data-sort-icon]').first()).toBeVisible()
    await page.locator('th', { hasText: 'Kapasite' }).click()
    await expect(page.locator('th', { hasText: 'Kapasite' }).locator('svg[data-sort-icon="active"]')).toBeVisible()
    const caps = (await page.locator('tbody tr td:nth-child(6)').allInnerTexts()).map((t) => Number(t.replace(/\D/g, '')))
    expect(caps).toEqual([...caps].sort((a, b) => a - b))

    const rowChecks = page.locator('tbody [role="checkbox"]')
    const headCheck = page.locator('thead [role="checkbox"]')
    const [headBox, rowBox] = [await headCheck.boundingBox(), await rowChecks.first().boundingBox()]
    expect(Math.round(headBox!.width)).toBe(Math.round(rowBox!.width))
    expect(await rowChecks.first().evaluate((el) => getComputedStyle(el).borderRadius)).toBe('4px')
    await rowChecks.nth(0).click()
    await rowChecks.nth(1).click()
    const bulk = page.getByRole('toolbar', { name: 'Toplu işlemler' })
    await expect(bulk).toContainText('2 seçili')
    for (const name of ['Aktif Yap', 'Pasif Yap']) await expect(bulk.getByRole('button', { name })).toBeVisible()
    const bulkBox = await bulk.boundingBox()
    const smsBox = await page.getByRole('button', { name: /SMS & Bildirim/ }).boundingBox()
    if (smsBox) expect(bulkBox!.x + bulkBox!.width).toBeLessThanOrEqual(smsBox.x)
    await bulk.getByRole('button', { name: 'Seçimi temizle' }).click()
    await expect(bulk).toHaveCount(0)

    await page.getByRole('button', { name: 'Kart görünümü' }).click()
    await expect(page.locator('.pilot-card-grid article').first()).toBeVisible()
    await page.getByRole('button', { name: 'Tablo', exact: true }).click()
    await expect(page.locator('tbody tr').first()).toBeVisible()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Dışa Aktar' }).click()
    expect((await download).suggestedFilename()).toBe('sports-tesisler.csv')

    await page.getByRole('button', { name: 'Yeni Salon Ekle' }).click()
    await expect(page.getByText('Temel Bilgiler').first()).toBeVisible()
    const dialog = page.locator('.pilot-form-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Yeni Spor Salonu Ekle', { exact: true })).toHaveCount(1)
    await expect(dialog.getByText('Yeni kayıt', { exact: true })).toHaveCount(0)
    const input = dialog.locator('.pilot-form-body input:not([type="checkbox"])').first()
    expect(Math.round((await input.boundingBox())!.height)).toBe(44)
    expect(await input.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(248, 250, 252)')
    const section = dialog.locator('[data-form-section]').first()
    expect(await section.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderRadius])).toEqual(['rgb(255, 255, 255)', '8px'])
    await page.keyboard.press('Escape')
    await page.goto('/sports')

    await expect(page.getByRole('button', { name: 'Eğitmenler' })).toHaveCount(0)
    for (const name of ['Yönet', 'Ayarlar', 'Yeni Salon Ekle', "QR'ları Toplu Yazdır", 'Arşiv']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Arşiv', exact: true }).hover()
    await expect(page.getByRole('tooltip', { name: 'Arşiv' })).toBeVisible()

    await page.getByRole('button', { name: `${first.name} işlemleri` }).click()
    const menu = page.getByRole('menu')
    for (const item of ['Tesis & Salon Düzenle', 'Cihaz & Ekipman Yönetimi', 'Tesis Ayarları & Politikalar', 'Detay Sayfasını Aç', 'Katılımcı Listesi', 'Kaydı Sil']) {
      await expect(menu.getByRole('menuitem', { name: new RegExp(item) })).toBeVisible()
    }
    await menu.getByRole('menuitem', { name: /Katılımcı Listesi/ }).click()
    await expect(page).toHaveURL(new RegExp(`f=${first.id}.*tab=applications|tab=applications.*f=${first.id}`))
    await page.goto('/sports')

    await page.locator('.pilot-facility-select input').click()
    const pop = page.locator('[data-ds-popover]', { hasText: 'Tesise Gir' })
    await expect(pop).toBeVisible()
    await expect(pop.getByText('doluluk').first()).toBeVisible()
    await expect(pop.getByText('Tesise Gir').first()).toBeVisible()
    await pop.getByRole('button', { name: /Karma/ }).first().click()
    await expect(pop.getByRole('button', { name: /Karma/ }).first()).toHaveAttribute('aria-pressed', 'true')
    await pop.getByRole('button', { name: /^Tümü \(\d+\)$/ }).click()
    await page.locator('[data-ds-popover] input').fill(first.name)
    await page.locator('[data-ds-popover] button', { hasText: first.name }).first().click()
    await expect(page).toHaveURL(new RegExp(`f=${first.id}`))

    const branchRes = page.waitForResponse((r) => r.url().includes('/sports/branches?') && r.request().method() === 'GET')
    await page.locator('.pilot-detail-tabs button', { hasText: /^Branşlar/ }).click()
    const branchBody = await (await branchRes).json()
    if (branchBody.data.items.length > 0) {
      expect(branchBody.data.items[0]).toHaveProperty('sessionCount')
      expect(branchBody.data.items[0]).toHaveProperty('applicationCount')
    }
    for (const header of ['Grup Sayısı', 'Seans Sayısı', 'Başvuru Sayısı']) {
      await expect(page.locator('th', { hasText: header }).first()).toBeVisible()
    }
  })

  test('kabuk: başlık, kart düzeni ve menü araması', async ({ page }) => {
    test.setTimeout(60000)
    await login(page)
    await page.goto('/sports')
    const header = page.locator('.pilot-app-shell > header').first()
    expect(Math.round((await header.boundingBox())!.height)).toBe(64)
    const sidebar = page.locator('.pilot-shell-body aside.sidebar-ui-pilot')
    expect(Math.round((await sidebar.boundingBox())!.width)).toBe(245)
    expect(await sidebar.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('8px')
    expect(await page.locator('.pilot-shell-body > main').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    const gaps = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)!.getBoundingClientRect()
      const [side, main, header, stats, filters, table] = ['aside.sidebar-ui-pilot', '.pilot-shell-body > main', '.pilot-overview-header', '.pilot-stat-grid', '.pilot-filters', '.pilot-desktop-table'].map(box)
      return [main.x - side.right, stats.y - header.bottom, filters.y - stats.bottom, table.y - filters.bottom].map(Math.round)
    })
    expect(gaps).toEqual([8, 8, 8, 8])

    const search = page.getByPlaceholder('Tesis, program, grup, ad soyad ara...')
    await expect(search).toBeVisible()
    await page.locator('main').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('ControlOrMeta+k')
    await expect(search).toBeFocused()
    await search.fill('Havuz')
    await page.locator('[data-ds-popover]').getByRole('button', { name: 'Havuz Sayfa' }).first().click()
    await expect(page).toHaveURL(/\/pool/)
  })

  test('tesis detayı ana ekranla aynı düzende', async ({ page }) => {
    test.setTimeout(60000)
    await login(page)
    const listRes = page.waitForResponse((r) => r.url().includes('/sports/facilities?') && r.request().method() === 'GET')
    await page.goto('/sports')
    const first = (await (await listRes).json()).data.items[0]
    await page.goto(`/sports?f=${first.id}&tab=applications`)
    await expect(page.locator('.pilot-detail-tabs')).toBeVisible({ timeout: 20000 })
    expect(Math.round((await page.locator('.pilot-overview-header .pilot-header-row').boundingBox())!.height)).toBeLessThanOrEqual(1)
    await expect(page.getByText('Başvuru Ara', { exact: true })).toBeVisible()
    await expect(page.locator('.pilot-filters').getByRole('button', { name: 'Filtreleri sıfırla' })).toBeVisible()
    await expect(page.locator('.pilot-stat-card').first()).toBeVisible()
    const gaps = await page.evaluate(() => {
      const box = (s: string) => document.querySelector(s)!.getBoundingClientRect()
      const [header, tabs, stats, filters] = ['.pilot-overview-header', '.pilot-detail-tabs', '.pilot-detail-content .pilot-stat-grid', '.pilot-detail-content .pilot-filters'].map(box)
      return [tabs.y - header.bottom, filters.y - stats.bottom].map(Math.round)
    })
    expect(gaps).toEqual([8, 8])
    const iconColors = await page.locator('.pilot-detail-tabs button[data-tab] svg').evaluateAll((els) => els.map((e) => getComputedStyle(e).color))
    expect(new Set(iconColors).size).toBe(iconColors.length)

    await page.locator('.pilot-detail-tabs button', { hasText: /^Gruplar/ }).click()
    await expect(page.getByText('Cinsiyet', { exact: true }).first()).toBeVisible({ timeout: 20000 })
    const rows = await page.locator('.pilot-filter-row > *').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().bottom))).size)
    expect(rows).toBeLessThanOrEqual(2)
  })
})

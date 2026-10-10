import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { newContext, getCitizenToken, listGroups, cleanFamilyApplications, getChildren, ensureAdultMixedGroup } from './helpers/sportsApi'

test.describe.serial('Spor — UI smoke', () => {
  test.skip(!hasCredentials(), 'E2E creds yok')
  test.describe.configure({ retries: 0 })

  test.beforeAll(async () => {
    await ensureAdultMixedGroup()
  })

  test('Branded spor listesi açılır; branş + filtre çalışır', async ({ page }) => {
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('SPOR', { exact: true })).toBeVisible()
    await expect(page.getByText(/grup gösteriliyor|Tümünü Gör/).first()).toBeVisible({ timeout: 10000 })

    const discoverCalls: string[] = []
    page.on('request', (r) => { if (r.url().includes('/me/facilities/sports/discover')) discoverCalls.push(r.url()) })
    const branch = page.locator('button', { hasText: /Basketbol|Voleybol|Futsal|Badminton/ }).first()
    if (await branch.count()) {
      await branch.click()
      await page.waitForTimeout(700)
      expect(discoverCalls.some((u) => u.includes('branchName=')), 'branş seçimi backend filtrelemeli').toBeTruthy()
    }

    await expect(page.getByText(/Kayıt Açık|Kontenjan Dolu/).first()).toBeVisible({ timeout: 10000 })
  })

  test('Grup detay ekranı açılır; başvuru bilgileri ve CTA görünür', async ({ page }) => {
    const rc = await newContext()
    const token = await getCitizenToken(rc)
    const children = await getChildren(rc, token)
    await cleanFamilyApplications(token, children.map((c) => c.id))

    const groups = await listGroups(rc, token)
    const g = groups.find((x) =>
      x.registeredCount < x.capacity && x.capacity > 1 &&
      (x.gender === 'male' || x.gender === 'mixed') && x.ageMin <= 36 && x.ageMax >= 36 &&
      !x.name.startsWith('KAPALI-PENCERE') && !x.name.startsWith('YEDEK-TEST'))
    expect(g, 'uygun grup bulunmalı').toBeTruthy()
    await rc.dispose()

    await login(page)
    await page.goto(`/hizmetler?m=sports&g=${g!.id}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(new RegExp(g!.branchName, 'i')).first()).toBeVisible({ timeout: 10000 })
    const cta = page.getByRole('button', { name: /Başvur|Yedek|Başvuru/i }).first()
    await expect(cta, 'başvuru/yedek CTA görünür olmalı').toBeVisible({ timeout: 10000 })

    const terms = page.getByText(/kabul ediyorum/i)
    await terms.scrollIntoViewIfNeeded()
    const applyBtn = page.getByRole('button', { name: /^Başvur|Yedek Listeye Başvur/ }).last()
    await expect(applyBtn, 'kurallar işaretlenmeden başvur pasif olmalı').toBeDisabled()
    await terms.click()
    await expect(applyBtn, 'kurallar işaretlenince başvur aktif olmalı').toBeEnabled()
  })
})

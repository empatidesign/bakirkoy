import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const trackErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe.serial('Spor Salonu — backend-driven filtreleme', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test('Spor sayfası açılıyor, banner sayaç ve branş sekmeleri render oluyor', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('SPOR', { exact: true })).toBeVisible()
    await expect(page.getByText(/grup gösteriliyor|Tümünü Gör/).first()).toBeVisible({ timeout: 10000 })

    await expect(page.getByRole('button', { name: '🏅 Tümü' })).toBeVisible()

    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('Branş sekmesine tıklamak listeyi backend üzerinden filtreler', async ({ page }) => {
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')

    const discoverCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/facilities/sports/discover')) discoverCalls.push(req.url())
    })

    const branchTab = page.locator('button', { hasText: /Badminton|Basketbol|Futsal|Voleybol/ }).first()
    if (await branchTab.count()) {
      await branchTab.click()
      await page.waitForTimeout(800)
      expect(discoverCalls.some((u) => u.includes('branchName=')), 'sekme seçimi discover\'a branchName parametresi göndermeli').toBeTruthy()
    }
  })

  test('Filtre paneli açılıyor; "boş yer" toggle discover isteğini tetikler', async ({ page }) => {
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')

    const availableCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/facilities/sports/discover') && req.url().includes('onlyAvailable=true')) {
        availableCalls.push(req.url())
      }
    })

    await page.getByRole('button').filter({ has: page.locator('.lucide-sliders-horizontal') }).first().click().catch(async () => {
      await page.locator('button:near(input[placeholder*="ara"])').last().click()
    })
    await page.waitForTimeout(300)

    const toggleRow = page.getByText('Sadece boş yer olanlar')
    if (await toggleRow.count()) {
      await toggleRow.locator('xpath=following-sibling::button').first().click()
      await page.waitForTimeout(800)
      expect(availableCalls.length, 'boş-yer toggle onlyAvailable=true ile discover çağırmalı').toBeGreaterThan(0)
    }
  })

  test('"Tümünü Gör" showAll parametresiyle discover çağırır', async ({ page }) => {
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')

    const showAllCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/facilities/sports/discover') && req.url().includes('showAll=true')) {
        showAllCalls.push(req.url())
      }
    })

    const banner = page.getByText(/Tümünü Gör/).first()
    if (await banner.count()) {
      await banner.click()
      await page.waitForTimeout(800)
      expect(showAllCalls.length, 'Tümünü Gör showAll=true göndermeli').toBeGreaterThan(0)
    }
  })

  test('Sayfa açılışında /filters endpoint çağrılır ve seçenekleri döner', async ({ page }) => {
    let filtersBody: any = null
    page.on('response', async (res) => {
      if (res.url().includes('/me/facilities/sports/filters') && res.ok()) {
        try { filtersBody = (await res.json())?.data } catch {  }
      }
    })

    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    expect(filtersBody, '/filters yanıtı gelmeli').toBeTruthy()
    expect(Array.isArray(filtersBody.facilities), 'filters.facilities dizi olmalı').toBeTruthy()
    expect(Array.isArray(filtersBody.branches), 'filters.branches dizi olmalı').toBeTruthy()
    expect(Array.isArray(filtersBody.genders), 'filters.genders dizi olmalı').toBeTruthy()
    expect(Array.isArray(filtersBody.ageGroups), 'filters.ageGroups dizi olmalı').toBeTruthy()

    const branchNames = filtersBody.branches.map((b: any) => b.branchName)
    expect(branchNames, 'çöp branşlar temizlendi — sadece gerçek branşlar dönmeli')
      .not.toContain('ABS Br cgde80')
  })

  const openFilterPanel = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button').filter({ has: page.locator('.lucide-sliders-horizontal') }).first().click()
    await page.waitForTimeout(300)
  }

  test('Tesis çipi seçimi discover\'a facilityId gönderir', async ({ page }) => {
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')

    const facilityCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/facilities/sports/discover') && req.url().includes('facilityId=')) {
        facilityCalls.push(req.url())
      }
    })

    await openFilterPanel(page)
    const facilitySection = page.getByText('Tesis', { exact: true })
    if (await facilitySection.count()) {
      const chip = facilitySection.locator('xpath=following-sibling::div//button').nth(1)
      if (await chip.count()) {
        await chip.click()
        await page.waitForTimeout(800)
        expect(facilityCalls.length, 'tesis çipi facilityId ile discover çağırmalı').toBeGreaterThan(0)
      }
    }
  })

  test('Yaş grubu çipi discover\'a ageMin/ageMax gönderir', async ({ page }) => {
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')

    const ageCalls: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/me/facilities/sports/discover') && req.url().includes('ageMin=')) {
        ageCalls.push(req.url())
      }
    })

    await openFilterPanel(page)
    const ageSection = page.getByText('Yaş grubu', { exact: true })
    if (await ageSection.count()) {
      const chip = ageSection.locator('xpath=following-sibling::div//button').nth(1)
      if (await chip.count()) {
        await chip.click()
        await page.waitForTimeout(800)
        expect(ageCalls.length, 'yaş grubu çipi ageMin ile discover çağırmalı').toBeGreaterThan(0)
      }
    }
  })

  test('Aktif filtre seçilince badge sayısı ve özet çipler görünür', async ({ page }) => {
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')

    const filterBtn = page.getByRole('button').filter({ has: page.locator('.lucide-sliders-horizontal') }).first()
    await filterBtn.click()
    await page.waitForTimeout(300)

    const toggleRow = page.getByText('Sadece boş yer olanlar')
    await toggleRow.locator('xpath=following-sibling::button').first().click()
    await page.waitForTimeout(500)

    await expect(filterBtn.getByText('1')).toBeVisible()

    await filterBtn.click()
    await page.waitForTimeout(300)

    await expect(page.getByText('Boş yer var')).toBeVisible()
    await expect(page.getByText(/Temizle/).first()).toBeVisible()
  })
})

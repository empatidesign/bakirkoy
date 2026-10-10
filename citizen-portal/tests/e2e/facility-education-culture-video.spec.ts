import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { acceptTermsIfPresent, apiGet, assertIneligibleApplicant, citizenToken, cleanProgramName, ensureChild, firstName, screenshot, waitIdle, type Paged } from './helpers/videoProof'

test.describe.serial('VIDEO Kanıt — Eğitim Kültür tesis/program akışları', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  let token = ''; let childFirst = ''
  test.beforeAll(async ({ request }) => { token = await citizenToken(request); childFirst = firstName((await ensureChild(request, token)).fullName) })
  test('Eğitim Kültür: liste, detay, self/çocuk seçimi, uygunluk filtresi ve negatif sebep', async ({ page, request }) => {
    const data = await apiGet<Paged<any>>(request, token, '/me/facilities/science-center/discover?page=1&limit=100&onlySubGroups=true&showAll=true')
    test.skip(data.items.length === 0, 'Eğitim Kültür için dev DB discover verisi yok; VIDEO_TEST_REPORT.md içinde açık veri boşluğu olarak raporlanır')
    const item = data.items.find((g) => !g.alreadyApplied) ?? data.items[0]
    await login(page); await page.goto('/hizmetler?m=science-center'); await waitIdle(page)
    await expect(page.getByRole('heading', { name: /Eğitim Kültür|Hizmetler/ })).toBeVisible()
    const filter = page.getByRole('button', { name: /Sadece yaşıma uygun|Bana uygun/i }).first()
    if (await filter.isVisible().catch(() => false)) await filter.click()
    await screenshot(page, 'education-culture-eligibility-filter')
    await page.getByText(cleanProgramName(item.name)).first().click({ timeout: 15000 })
    await expect(page.getByText('Kimler için başvuruyorsunuz?')).toBeVisible({ timeout: 15000 })
    await screenshot(page, 'education-culture-detail')
    const self = page.getByRole('button').filter({ hasText: /\(Ben\)|Ben/i }).first()
    if (await self.isEnabled().catch(() => false)) {
      await self.click(); await acceptTermsIfPresent(page)
      const cta = page.getByRole('button', { name: /Başvur|Yedek Listeye Başvur|Başvurmak için kişi seçin|Uygun kişi yok/i }).last()
      await expect(cta).toBeVisible()
      if (await cta.isEnabled()) { await cta.click(); await expect(page.getByText(/Başvurunuz alındı|Yedek listesine alındınız/)).toBeVisible({ timeout: 15000 }); await screenshot(page, 'education-culture-self-success') }
    }
    await page.goto('/hizmetler?m=science-center'); await waitIdle(page)
    await page.getByText(cleanProgramName(item.name)).first().click({ timeout: 15000 })
    await expect(page.getByText('Kimler için başvuruyorsunuz?')).toBeVisible({ timeout: 15000 })
    const child = page.getByRole('button').filter({ hasText: new RegExp(childFirst, 'i') }).first()
    if (await child.isVisible().catch(() => false) && await child.isEnabled().catch(() => false)) { await child.click(); await acceptTermsIfPresent(page); await screenshot(page, 'education-culture-child-selected') }
    else { await assertIneligibleApplicant(page); await screenshot(page, 'education-culture-ineligible-reason') }
  })
})

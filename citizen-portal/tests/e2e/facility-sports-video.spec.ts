import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { acceptTermsIfPresent, apiGet, apiPost, cancelAllCancellableApplications, chooseApplicant, citizenToken, cleanProgramName, ensureChild, firstName, screenshot, waitIdle, type Paged, type Applicant } from './helpers/videoProof'

test.describe.serial('VIDEO Kanıt — Spor modülü tam UI başvuru akışları', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  let token = ''; let childName = ''
  test.beforeAll(async ({ request }) => {
    token = await citizenToken(request)
    childName = firstName((await ensureChild(request, token)).fullName)
    await cancelAllCancellableApplications(request, token, 'sports')
  })
  test('spor: self başvuru, çocuk başvurusu, uygunluk filtresi ve negatif kişi sebebi videoya alınır', async ({ page, request }) => {
    const discover = await apiGet<Paged<any>>(request, token, '/me/facilities/sports/discover?page=1&limit=100&onlySubGroups=true&showAll=true')
    test.skip(discover.items.length === 0, 'Spor için dev DB discover verisi yok; sportsApi fixture seed bu ortamda parent grubu doğrulayamadı')
    // `?? discover.items[0]` fallback'i BAŞVURULMUŞ bir grubu seçebiliyordu; o grupta
    // "Başvurunuz alındı" toast'ı hiçbir zaman çıkmaz ve test, ürün hatası yokken
    // kırmızıya düşerdi (süit içinde önceki koşudan kalan gerçek-grup başvurusu yüzünden
    // deterministik olarak tekrarlanıyordu). Başvurulmamış grup yoksa test atlanır.
    // Başvuru penceresi kapalı grup (applicationOpen === false) backend'de 409 ile
    // reddediliyor; aday olarak seçilirse test ürün hatası yokken kırmızıya düşer.
    // KAPALI-PENCERE test grubu listede ilk sıralarda olduğu için bu deterministikti.
    const isOpen = (g: any) => g.applicationOpen !== false
    const candidate = discover.items.find((g) => isOpen(g) && !g.alreadyApplied && g.eligible)
      ?? discover.items.find((g) => isOpen(g) && !g.alreadyApplied)
    test.skip(!candidate, 'Başvuruya açık, başvurulmamış spor grubu yok')
    await login(page); await page.goto('/hizmetler?m=sports'); await waitIdle(page)
    await expect(page.getByRole('heading', { name: /Spor Salonu|Hizmetler/ })).toBeVisible()
    // Uygunluk süzgeci varsayılan AÇIK (onlyEligible=true) ve bir role="switch"
    // (aria-checked) — eski `getByRole('button', {name:/Sadece yaşıma uygun/})`
    // seçicisi HİÇBİR ZAMAN eşleşmiyordu, yani filtre kanıtı sessizce boştu.
    const eligibleSwitch = page.getByRole('switch').first()
    if (await eligibleSwitch.isVisible().catch(() => false))
      await expect(eligibleSwitch).toHaveAttribute('aria-checked', 'true')
    await screenshot(page, 'sports-eligibility-filter')
    await page.getByRole('button').filter({ hasText: cleanProgramName(candidate.name) }).first().click({ timeout: 15000 })
    await expect(page.getByText('Kimler için başvuruyorsunuz?')).toBeVisible({ timeout: 15000 })
    await screenshot(page, 'sports-detail-applicants')
    const detail = await apiGet<any>(request, token, `/me/facilities/sports/groups/${candidate.id}`)
    const self = detail.applicants.find((a: Applicant) => a.isSelf && a.eligible && !a.alreadyApplied)
    const modal = page.locator('.fixed.inset-0.z-50')
    if (self) {
      await chooseApplicant(page, /\(Ben\)|Ben/i, modal); await acceptTermsIfPresent(page)
      await page.getByRole('button', { name: /^Başvur$|Yedek Listeye Başvur/i }).last().click()
      await expect(page.getByText(/Başvurunuz alındı|Yedek listesine alındınız/).first()).toBeVisible({ timeout: 15000 })
      await screenshot(page, 'sports-self-success'); await page.getByRole('button', { name: 'Tamam' }).click()
    }
    const childGroup = discover.items.find((g) => isOpen(g) && g.id !== candidate.id && !g.alreadyApplied) ?? candidate
    await page.goto('/hizmetler?m=sports'); await waitIdle(page)
    // Liste varsayılan olarak "sadece bana uygun" süzülüyor (FacilityProgramsTab
    // onlyEligible=true), bu yüzden çocuk grubu ("... Cocuk") hiç render edilmiyor.
    // Ürünün gerçek akışı: çocuk çipine ("<Ad>'e uygun · N yaş") basılır; visibleGroups
    // o çocuğa uygun grupları da gösterir. Çip olmadan buton bulunamaz (eski kırmızı).
    const childChip = page.getByRole('button', { name: new RegExp(`${childName}.*uygun`, 'i') }).first()
    if (await childChip.isVisible().catch(() => false)) { await childChip.click(); await waitIdle(page) }
    await page.getByRole('button').filter({ hasText: cleanProgramName(childGroup.name) }).first().click({ timeout: 15000 })
    await expect(page.getByText('Kimler için başvuruyorsunuz?')).toBeVisible({ timeout: 15000 })
    const childButton = modal.getByRole('button').filter({ hasText: new RegExp(childName, 'i') }).first()
    if (await childButton.isEnabled().catch(() => false)) {
      const alreadySelected = await childButton.getAttribute('aria-pressed') === 'true'
      if (!alreadySelected) await childButton.click()
      await acceptTermsIfPresent(page)
      await page.getByRole('button', { name: /Başvur|Yedek Listeye Başvur/i }).last().click()
      await expect(page.getByText(/Başvurunuz alındı|Yedek listesine alındınız/).first()).toBeVisible({ timeout: 15000 })
      await screenshot(page, 'sports-child-success')
    } else { await expect(childButton).toContainText(/uygun değil|yaş|cinsiyet/i); await screenshot(page, 'sports-child-ineligible') }
    expect((await apiPost(request, token, '/me/facilities/sports/groups/00000000-0000-0000-0000-000000000000/apply', {})).status).toBeGreaterThanOrEqual(400)
  })
})

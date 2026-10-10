import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { waitIdle } from './helpers/videoProof'

// Kullanıcı isteği (2026-09-01): anketler düz liste yerine kategoriye göre
// (Etkinlik / Kütüphane / Belediye Hizmetleri / müdürlük adı…) gruplu gelmeli.
// Bu test API'den beklenen grup başlıklarını hesaplar ve ekranda başlık +
// sayaç olarak göründüğünü doğrular.
const SOURCE_LABEL: Record<string, string> = {
  Event: 'Etkinlik', Travel: 'Gezi', Library: 'Kütüphane', Facility: 'Tesis',
}

test.describe('Anket listesi kategori grupları', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  // Her test canlı API üzerinden tam giriş (şifre + OTP) yapıyor; paket toplu
  // koştuğunda 30 sn'lik varsayılan limit sınıra dayanıyordu. Ölçümler ~7 sn.
  test.setTimeout(75_000)

  test('bekleyen anketler kategori başlıkları altında gruplanır', async ({ page }) => {
    // Beklenen gruplar, sayfanın GERÇEKTEN aldığı yanıttan hesaplanır. Ayrı bir
    // API çağrısı yapmak yanıltıcıydı: canlı veritabanına bu arada yeni anket
    // eklenince beklenen 6, ekranda 7 çıkıp sahte hata üretiyordu.
    let payload: any = null
    page.on('response', async (res) => {
      if (!/\/api\/v1\/me\/surveys\?/.test(res.url()) || !res.ok()) return
      payload = await res.json().catch(() => null)
    })

    await login(page)
    await page.goto('/anketler')
    await waitIdle(page)
    await expect(page.getByRole('heading', { name: 'Anketler' })).toBeVisible()
    await expect.poll(() => payload !== null, { timeout: 15_000 }).toBe(true)

    const pending = (payload.data?.items ?? []).filter((s: any) => !s.alreadyResponded)
    test.skip(pending.length === 0, 'bekleyen anket yok')

    const expected = new Map<string, number>()
    for (const s of pending) {
      const key = (s.category ?? '').trim() || SOURCE_LABEL[s.sourceType ?? ''] || 'Genel'
      expected.set(key, (expected.get(key) ?? 0) + 1)
    }

    for (const [label, count] of expected) {
      const heading = page.getByRole('heading', { level: 3, name: label, exact: true })
      await expect(heading, `"${label}" grup başlığı görünmeli`).toBeVisible()
      await expect(
        heading.locator('xpath=following-sibling::span[1]'),
        `"${label}" grubunun sayacı ${count} olmalı`,
      ).toHaveText(String(count))
    }

    // Kartlar bir gruba ait olmalı: grup sayılarının toplamı toplam kart sayısına eşit.
    const total = [...expected.values()].reduce((a, b) => a + b, 0)
    expect(total, 'her anket bir gruba düşmeli').toBe(pending.length)
  })

  // Dev veritabanında bekleyen anketlerin tümü tek kategoride olabiliyor; bu durumda
  // yukarıdaki test grup *ayrımını* kanıtlamaz. Bu test API yanıtını çok kategorili
  // hâle getirip ayrı başlıklar, doğru sayaçlar ve "Genel"in en sona düşmesini doğrular.
  test('birden fazla kategori ayrı başlıklara ayrılır, Genel en sonda', async ({ page }) => {
    const mk = (id: string, title: string, category: string, sourceType: string | null = null) => ({
      id, title, description: '', category, status: 'active', isActive: true,
      isAnonymous: false, estimatedDuration: 5, questionCount: 3,
      startDate: null, endDate: null, alreadyResponded: false,
      sourceType, sourceId: null, isRequired: false, sourceContext: null,
    })
    const items = [
      mk('11111111-1111-1111-1111-111111111111', 'Zabıta hizmet anketi', 'Belediye Hizmetleri'),
      mk('22222222-2222-2222-2222-222222222222', 'Temizlik memnuniyeti', 'Belediye Hizmetleri'),
      mk('33333333-3333-3333-3333-333333333333', 'Yaz konseri değerlendirme', 'Etkinlik'),
      mk('44444444-4444-4444-4444-444444444444', 'Serbest anket', ''),
      // kategori boş + sourceType dolu → kaynak etiketi başlık olur
      mk('55555555-5555-5555-5555-555555555555', 'Kütüphane deneyimi', '', 'Library'),
    ]

    await page.route('**/api/v1/me/surveys?*', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items, total: items.length, page: 1, limit: 50, totalPages: 1 } }),
      })
    })

    await login(page)
    await page.goto('/anketler')
    await waitIdle(page)

    const headings = page.getByRole('heading', { level: 3 })
    await expect(headings).toHaveText(['Belediye Hizmetleri', 'Etkinlik', 'Kütüphane', 'Genel'])

    const countOf = (label: string) =>
      page.getByRole('heading', { level: 3, name: label, exact: true }).locator('xpath=following-sibling::span[1]')
    await expect(countOf('Belediye Hizmetleri')).toHaveText('2')
    await expect(countOf('Etkinlik')).toHaveText('1')
    await expect(countOf('Kütüphane')).toHaveText('1')
    await expect(countOf('Genel')).toHaveText('1')

    // Kart doğru grubun içinde mi: "Temizlik memnuniyeti" Belediye Hizmetleri bölümünde olmalı.
    const belediye = page.locator('section').filter({ has: page.getByRole('heading', { level: 3, name: 'Belediye Hizmetleri' }) })
    await expect(belediye.getByText('Temizlik memnuniyeti')).toBeVisible()
    await expect(belediye.getByText('Yaz konseri değerlendirme')).toHaveCount(0)

  })
})

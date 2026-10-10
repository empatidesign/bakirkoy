import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { waitIdle } from './helpers/videoProof'

// Kullanıcı isteği (2026-09-01): "/saha sayfasında isim anonimde yaş ve cinsiyet
// seçilmeli; ortadaki butonlar ve üstteki başlık ve sayfada sağ ve sola göre
// ayarlanmalı."
const TASK = '99999999-9999-9999-9999-999999999999'
const MIN_TOUCH = 44

const task = {
  id: TASK, surveyId: '88888888-8888-8888-8888-888888888888',
  surveyTitle: 'Hizalama ve Kimlik Testi', surveyCategory: 'Belediye Hizmetleri',
  neighborhood: 'Cebeci', category: 'Belediye Hizmetleri', questionCount: 1,
  estimatedDuration: 3, targetCount: 50, completedCount: 1, todayCount: 0,
  dailyTarget: 10, progressPercent: 2, isWindowOpen: true, startDate: null,
  endDate: null, requireLocation: false, isAnonymous: false, status: 'active',
}

const questions = [{
  id: 'q1', order: 1, type: 'multiple_choice', question: 'Temizlikten memnun musunuz?',
  description: null, required: false, options: ['Evet', 'Hayır'],
  scaleMin: null, scaleMax: null, minLabel: null, maxLabel: null, ratingCount: null,
}]

async function openIdentityStep(page: import('@playwright/test').Page) {
  const ok = (d: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, statusCode: 200, data: d }) })
  await page.route('**/api/v1/me/surveys/field/tasks', (r) => r.fulfill(ok([task])))
  await page.route(`**/api/v1/me/surveys/field/tasks/${TASK}`, (r) =>
    r.fulfill(ok({ task, survey: { id: task.surveyId, title: task.surveyTitle, description: '', isAnonymous: false, questions }, questions })))
  await page.route(`**/api/v1/me/surveys/field/tasks/${TASK}/responses*`, (r) => r.fulfill(ok([])))
  await login(page)
  await page.goto('/saha')
  await waitIdle(page)
  await page.getByRole('button', { name: /^Anketler/ }).first().click()
  await page.getByRole('button', { name: /Anketi Başlat/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Görüşülen kişi' })).toBeVisible()
}

test.describe('Saha kimlik adımı: anonim demografi ve hizalama', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  test.setTimeout(75_000)

  test('anonim katılımda yaş ve cinsiyet seçilmeden ankete başlanamaz', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await openIdentityStep(page)

    await page.getByRole('button', { name: /İsimsiz \/ Anonim Katılım/ }).click()

    // Yaş ve cinsiyet seçimleri görünür olmalı.
    const ages = page.getByTestId('anon-age-groups')
    const genders = page.getByTestId('anon-genders')
    await expect(ages, 'anonim modda yaş grubu seçimi görünmeli').toBeVisible()
    await expect(genders, 'anonim modda cinsiyet seçimi görünmeli').toBeVisible()

    const start = page.getByRole('button', { name: /Ankete başla/ })
    await expect(start, 'yaş ve cinsiyet seçilmeden başlanamamalı').toBeDisabled()

    // Yalnızca yaş seçmek yetmemeli.
    await ages.getByRole('button', { name: '25-34', exact: true }).click()
    await expect(start, 'sadece yaş seçiliyken hâlâ kilitli olmalı').toBeDisabled()

    // Cinsiyet de seçilince açılmalı.
    await genders.getByRole('button', { name: 'Kadın', exact: true }).click()
    await expect(start, 'yaş + cinsiyet seçilince başlanabilmeli').toBeEnabled()

    // Seçim düğmeleri tablette dokunmaya uygun olmalı.
    for (const loc of [ages.getByRole('button').first(), genders.getByRole('button').first()]) {
      const box = await loc.boundingBox()
      expect(Math.round(box!.height), 'demografi düğmeleri 44px+ olmalı').toBeGreaterThanOrEqual(MIN_TOUCH)
    }

    await start.click()
    await expect(page.getByRole('heading', { name: questions[0].question }), 'soru adımına geçilmeli').toBeVisible()
  })

  // Kullanıcı isteği (2026-09-01): "ortadaki butonlar ... sağa ve sola göre
  // ayarlanmalı." Soru adımındaki birincil buton sayfanın gerçek ortasında
  // olmalı; ölçümde sol 154px / sağ 176px ile kaymıştı.
  for (const vp of [{ name: 'dikey', w: 820, h: 1180 }, { name: 'yatay', w: 1180, h: 820 }]) {
    test(`${vp.name}: soru adımındaki aksiyon butonları ortalı ve simetrik`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h })
      await openIdentityStep(page)

      await page.getByRole('button', { name: /İsimsiz \/ Anonim Katılım/ }).click()
      await page.getByTestId('anon-age-groups').getByRole('button', { name: '25-34', exact: true }).click()
      await page.getByTestId('anon-genders').getByRole('button', { name: 'Kadın', exact: true }).click()
      await page.getByRole('button', { name: /Ankete başla/ }).click()
      await expect(page.getByRole('heading', { name: questions[0].question })).toBeVisible()

      const layout = await page.evaluate(() => {
        const main = document.querySelector('main')!
        const buttons = [...main.querySelectorAll('button')]
          .filter((b) => /Anketi Tamamla|^Sonraki|Önceki|Kaydet/.test((b.textContent || '').trim()))
        const primary = buttons.find((b) => /Anketi Tamamla|^Sonraki/.test((b.textContent || '').trim()))
        if (!primary) return null
        const bar = primary.parentElement!.getBoundingClientRect()
        const p = primary.getBoundingClientRect()
        return {
          barLeft: Math.round(bar.left),
          barRight: Math.round(window.innerWidth - bar.right),
          primaryLeft: Math.round(p.left),
          primaryRight: Math.round(window.innerWidth - p.right),
        }
      })

      expect(layout, 'aksiyon barı ölçülebilmeli').not.toBeNull()
      // Bar sayfanın kenarlarına eşit uzaklıkta olmalı.
      expect(layout!.barLeft, 'aksiyon barı sağ-sol simetrik olmalı').toBe(layout!.barRight)
      // Ortadaki birincil buton da sayfanın gerçek ortasında olmalı.
      expect(layout!.primaryLeft, 'ortadaki buton sağa/sola eşit uzaklıkta olmalı').toBe(layout!.primaryRight)
    })
  }

  for (const vp of [{ name: 'dikey', w: 820, h: 1180 }, { name: 'yatay', w: 1180, h: 820 }]) {
    test(`${vp.name}: üst başlık, şerit ve içerik sağ-sol hizalı`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h })
      await openIdentityStep(page)

      const edges = await page.evaluate(() => {
        const box = (el: Element | null | undefined) => {
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { left: Math.round(r.left), right: Math.round(window.innerWidth - r.right) }
        }
        const header = document.querySelector('header')
        return {
          header: box(header?.firstElementChild),
          strip: box(header?.nextElementSibling?.firstElementChild),
          content: box(document.querySelector('main')?.firstElementChild),
        }
      })

      expect(edges.header, 'üst bar ölçülebilmeli').not.toBeNull()
      // Üst başlık, başlık şeridi ve içerik kartı aynı kenar boşluğunu kullanmalı.
      expect(edges.strip!.left, 'başlık şeridi üst barla aynı hizada olmalı').toBe(edges.header!.left)
      expect(edges.content!.left, 'içerik üst barla aynı hizada olmalı').toBe(edges.header!.left)
      // Her biri kendi içinde de simetrik olmalı (sağ boşluk = sol boşluk).
      for (const [key, v] of Object.entries(edges)) {
        expect(v!.left, `${key}: sol ve sağ boşluk eşit olmalı`).toBe(v!.right)
      }
    })
  }
})

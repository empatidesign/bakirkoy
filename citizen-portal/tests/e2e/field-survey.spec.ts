import { test, expect, type Page } from '@playwright/test'

// Kullanıcı isteği (2026-09-01): saha görevlisi TC ile giriş yapıp tablo tasarımlı görev
// listesinden ankete başlar ve büyük kartlı soru ekranlarında anketi doldurur.
// Bu test gerçek API'ye (:5207) karşı, gerçek bir saha görevi üzerinden akışı doğrular.

const TCKN = process.env.FIELD_TCKN || '10028544554'
const PASSWORD = process.env.FIELD_PASSWORD || 'Test1234!'
const OTP = process.env.MOCK_OTP || '111111'
// Saha anketi sistemde kayıtlı OLMAYAN vatandaşlarla da yapılabildiği için, test her
// koşumda algoritmik olarak geçerli ve benzersiz bir TCKN üretir. Böylece test tekrar
// tekrar çalıştırıldığında "ALREADY_RESPONDED" nedeniyle kırılmaz (kendi kendine yeter).
function generateValidTckn(): string {
  const n: number[] = [1 + Math.floor(Math.random() * 9)]
  for (let i = 1; i < 9; i++) n.push(Math.floor(Math.random() * 10))
  const odd = n[0] + n[2] + n[4] + n[6] + n[8]
  const even = n[1] + n[3] + n[5] + n[7]
  n.push((((odd * 7) - even) % 10 + 10) % 10)
  n.push(n.slice(0, 10).reduce((a, b) => a + b, 0) % 10)
  return n.join('')
}

const RESPONDENT = process.env.FIELD_RESPONDENT_TCKN || generateValidTckn()

async function loginAsInterviewer(page: Page) {
  // İlk kullanım tanıtım turu (OnboardingWizard) tam ekran overlay açıp tıklamaları
  // engellediği için test profilinde baştan "görüldü" işaretlenir.
  await page.addInitScript(() => {
    try { window.localStorage.setItem('nexora_citizen_onboarding_done', '1') } catch { /* yok say */ }
  })
  await page.goto('/login')
  await page.locator('input').first().fill(TCKN)
  await page.getByPlaceholder(/Şifre/i).first().fill(PASSWORD)
  await page.getByRole('button', { name: /Giriş Yap/i }).click()
  await page.waitForURL(/\/login\/otp/, { timeout: 20000 })
  const quick = page.getByRole('button', { name: /Hızlı Test/ })
  if (await quick.isVisible().catch(() => false)) {
    await quick.click()
  } else {
    const boxes = page.locator('input[maxlength="1"]')
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(OTP[i])
  }
  const verify = page.getByRole('button', { name: /Doğrula/ })
  if (await verify.isEnabled().catch(() => false)) await verify.click()
  await page.waitForURL((u) => !u.pathname.includes('/otp'), { timeout: 25000 })

  // Test hesabı KVKK/bildirim onayı vermemişse ConsentGate modali açılır; akışa devam
  // edebilmek için onaylanır.
  const consent = page.getByRole('heading', { name: 'Devam Etmeden Önce' })
  if (await consent.isVisible().catch(() => false)) {
    for (const cb of await page.getByRole('checkbox').all()) await cb.check()
    await page.getByRole('button', { name: /Onaylayıp Devam Et/ }).click()
    await expect(consent).toBeHidden({ timeout: 15000 })
  }
}

test.describe('Saha anket sistemi', () => {
  test('anketör görev tablosunu görür ve anketi TC ile doldurur', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await loginAsInterviewer(page)

    // Saha görevi atanmış kullanıcı mod seçim ekranına düşer.
    await expect(page).toHaveURL(/\/mod-secimi|\/saha|\//, { timeout: 20000 })
    if (page.url().includes('/mod-secimi')) {
      await page.getByRole('button', { name: /Anket Sistemi/ }).click()
    } else {
      await page.goto('/saha')
    }

    await page.waitForURL(/\/saha/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: 'Saha Anket Sistemi' })).toBeVisible()

    // Tablo tasarımı: başlıklar görünür olmalı.
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('columnheader', { name: 'Anket' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Mahalle' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'İlerleme' })).toBeVisible()

    // Görevi başlat.
    // Kapalı tarih aralığındaki görevlerin butonu pasiftir; açık (etkin) ilk görevi seç.
    await page.getByRole('button', { name: /Anket doldur/ }).and(page.locator('button:not([disabled])')).first().click()

    // Kimlik adımı.
    await expect(page.getByText('Görüşülen kişi')).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('11 haneli T.C. kimlik no').fill(RESPONDENT)
    await page.getByRole('button', { name: 'Sorgula' }).click()
    await expect(page.getByRole('button', { name: /Ankete başla/ })).toBeEnabled({ timeout: 15000 })
    await page.getByRole('button', { name: /Ankete başla/ }).click()

    // Soru ekranı: her soru tek başına büyük kartta.
    await expect(page.getByText(/Soru 1 \//)).toBeVisible({ timeout: 15000 })

    // Tüm soruları cevapla: her adımda kart içindeki ilk seçeneği/serbest metni doldurup ilerle.
    for (let guard = 0; guard < 40; guard++) {
      const textarea = page.locator('main textarea')
      if (await textarea.count() > 0 && await textarea.first().isVisible().catch(() => false)) {
        await textarea.first().fill('Saha görüşmesi otomatik test cevabı')
      } else {
        const inCard = page.locator('div.rounded-panel button')
        if (await inCard.count() > 0) await inCard.first().click()
      }
      await page.waitForTimeout(350)

      const save = page.getByRole('button', { name: 'Kaydet' })
      if (await save.isVisible().catch(() => false)) {
        await save.click()
        break
      }
      const next = page.getByRole('button', { name: 'İleri' })
      if (await next.isEnabled().catch(() => false)) await next.click()
      await page.waitForTimeout(200)
    }

    await expect(page.getByRole('heading', { name: 'Anket kaydedildi' })).toBeVisible({ timeout: 25000 })
    await expect(page.getByRole('button', { name: /Yeni anket doldur/ })).toBeVisible()

    // "Son kayıtlar" paneli: az önce kaydedilen görüşme maskeli TC ile listelenmeli.
    await page.getByRole('button', { name: /Son kayıtlar/ }).click()
    await expect(page.getByText('Bu görevde toplanan son kayıtlar')).toBeVisible({ timeout: 15000 })
    const maskedCell = page.locator('td.font-mono').first()
    await expect(maskedCell).toBeVisible({ timeout: 15000 })
    // Tam TC ekranda görünmemeli (maskeli olmalı).
    await expect(maskedCell).not.toHaveText(RESPONDENT)
    await expect(maskedCell).toContainText(RESPONDENT.slice(0, 3))

    // "Yeni anket doldur": arka arkaya ikinci görüşmeye temiz formla dönülmeli.
    await page.getByRole('button', { name: /Yeni anket doldur/ }).click()
    await expect(page.getByText('Görüşülen kişi')).toBeVisible({ timeout: 15000 })
    await expect(page.getByPlaceholder('11 haneli T.C. kimlik no')).toHaveValue('')

    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})

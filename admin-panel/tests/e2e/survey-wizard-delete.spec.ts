import { test, expect } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'
import { clickRowAction } from './helpers/rowActions'

// Kullanıcı isteği (2026-09-01):
//  - "tek sayfada soruların ne olduğu, cevap şıkları ... anket sihirbazı olması lazım"
//  - "gerektiğinde anket kopyalama olsun"
//  - "silmek icin mutlaka silmek istiyorum onay gibi birşey yazıp silmek lazım"
// Bu test, üç davranışı da gerçek admin panelde uçtan uca doğrular.

let api: AdminApi

test.describe('Anket sihirbazı, kopyalama ve güvenli silme', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => { await api.dispose() })

  test('sihirbaz: yapıştırılan metinden soru tipleriyle anket kurar', async ({ page }) => {
    test.setTimeout(120000)
    const title = uniq('E2E Sihirbaz')

    await loginAndOpen(page, '/survey?tab=anketler', 'Anketler')
    await page.getByRole('button', { name: 'Anket Sihirbazı' }).click()

    await expect(page.getByRole('heading', { name: 'Anket Sihirbazı' })).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('Örn. Belediye Hizmet Memnuniyeti').fill(title)

    // Farklı soru tiplerini kapsayan gerçekçi bir metin yapıştır.
    const pasted = [
      '1. Belediyemizin hizmetlerinden memnun musunuz?',
      'a) Evet',
      'b) Hayır',
      '',
      '[yıldız] Temizlik hizmetlerini puanlayın',
      '',
      'Hangi hizmetlerden yararlandınız?',
      '- Kütüphane',
      '- Spor tesisi',
      '- Kurslar',
      '',
      'Belediyeden beklentilerinizi yazınız.',
    ].join('\n')
    await page.locator('textarea.font-mono').fill(pasted)

    // Algılanan soru sayısı anında görünmeli (canlı ayrıştırma).
    await expect(page.getByText('4 soru algılandı')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Ankete Çevir' }).click()
    await expect(page.getByText('4 soru hazır')).toBeVisible({ timeout: 10000 })

    // Soru tipleri otomatik belirlenmiş olmalı.
    await expect(page.getByText(/Evet \/ Hayır × 1/)).toBeVisible()
    await expect(page.getByText(/Yıldız Değerlendirme × 1/)).toBeVisible()
    await expect(page.getByText(/Çoklu Seçim × 1/)).toBeVisible()
    await expect(page.getByText(/Metin Yanıtı × 1/)).toBeVisible()

    await page.getByRole('button', { name: /Anketi Oluştur \(4 soru\)/ }).click()

    // Kaydedilen anket listede görünmeli ve 4 sorusu olmalı.
    await expect(page.getByRole('button', { name: 'Anket Sihirbazı' })).toBeVisible({ timeout: 20000 })
    const list = await api.request<{ items: { id: string; title: string; questionCount: number }[] }>(
      'GET', `/surveys?page=1&limit=50&search=${encodeURIComponent(title)}`)
    const created = list.items.find((s) => s.title === title)
    expect(created, 'sihirbazla oluşturulan anket API listesinde bulunmalı').toBeTruthy()
    expect(created!.questionCount).toBe(4)

    // Temizlik: test anketini sil (süper yönetici + doğru onay metni).
    await api.request('DELETE', `/surveys/${created!.id}`, { confirmation: 'silmek istiyorum' })
  })

  test('silme: onay metni yazılmadan silme düğmesi açılmaz', async ({ page }) => {
    test.setTimeout(120000)
    const title = uniq('E2E Silme')
    const survey = await api.request<{ id: string }>('POST', '/surveys', {
      title,
      description: 'Silme onayı testi',
      category: 'Genel',
      targetAudience: 'all',
      startDate: null,
      endDate: null,
      estimatedDuration: 3,
      isActive: false,
      isAnonymous: false,
      allowMultipleResponses: false,
      showResults: true,
      autoSendAfterEvent: false,
      sendReminderSMS: false,
      isRequired: false,
      questions: [{ type: 'yes_no', question: 'Test sorusu?', description: '', required: true, options: [], config: {} }],
    })

    await loginAndOpen(page, '/survey?tab=anketler', 'Anketler')
    await page.getByPlaceholder('Anket adı veya açıklama ara...').fill(title)
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible({ timeout: 20000 })

    // NOT (2026-09-05, flaky test bulundu ve düzeltildi): "Tüm işlemleri göster"
    // dropdown'ı sonra hemen "Sil"e tıklamak zaman zaman menüyü kapanmış buluyordu
    // (~%50 flaky). clickRowAction helper'ı (admin-crud.spec.ts fix'inde eklendi)
    // retry+toPass ile bunu güvenilir hale getiriyor.
    try {
      await clickRowAction(page, row, 'Sil')
      await expect(page.getByText('Anketi Kalıcı Olarak Sil')).toBeVisible({ timeout: 15000 })

      // Etki özeti gösterilmeli ve buton onay metni yazılmadan kapalı olmalı.
      await expect(page.getByText('Bu işlem geri alınamaz')).toBeVisible()
      const deleteBtn = page.getByRole('button', { name: 'Kalıcı Olarak Sil' })
      await expect(deleteBtn).toBeDisabled()

      // Yanlış metin de açmamalı.
      const input = page.getByPlaceholder('silmek istiyorum')
      await input.fill('evet sil')
      await expect(deleteBtn).toBeDisabled()

      // Doğru metin butonu açar ve silme gerçekleşir.
      await input.fill('silmek istiyorum')
      await expect(deleteBtn).toBeEnabled()
      await deleteBtn.click()

      await expect(page.getByText('Anketi Kalıcı Olarak Sil')).toBeHidden({ timeout: 20000 })

      const after = await api.request<{ items: { id: string }[] }>(
        'GET', `/surveys?page=1&limit=50&search=${encodeURIComponent(title)}`)
      expect(after.items.find((s) => s.id === survey.id), 'anket silinmiş olmalı').toBeFalsy()
    } finally {
      // Orphan-data koruması: test UI adımlarından biri (ör. flaky dropdown) beklenmedik
      // şekilde başarısız olursa bile, fixture anketi API ile temizlensin.
      await api.request('DELETE', `/surveys/${survey.id}`, { confirmation: 'silmek istiyorum' }).catch(() => {})
    }
  })

  test('kopyalama: mevcut anket sorularıyla birlikte çoğaltılır', async ({ page }) => {
    test.setTimeout(120000)
    const title = uniq('E2E Kopya')
    const survey = await api.request<{ id: string }>('POST', '/surveys', {
      title,
      description: 'Kopyalama testi',
      category: 'Genel',
      targetAudience: 'all',
      startDate: null,
      endDate: null,
      estimatedDuration: 3,
      isActive: false,
      isAnonymous: false,
      allowMultipleResponses: false,
      showResults: true,
      autoSendAfterEvent: false,
      sendReminderSMS: false,
      isRequired: false,
      questions: [
        { type: 'multiple_choice', question: 'Kopya sorusu 1?', description: '', required: true, options: ['A', 'B'], config: {} },
        { type: 'rating', question: 'Kopya sorusu 2?', description: '', required: true, options: [], config: { ratingCount: 5 } },
      ],
    })

    await loginAndOpen(page, '/survey?tab=anketler', 'Anketler')
    await page.getByPlaceholder('Anket adı veya açıklama ara...').fill(title)
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible({ timeout: 20000 })

    try {
      // NOT (2026-09-05): clickRowAction ile aynı flaky-dropdown düzeltmesi (bkz. yukarıdaki test).
      await clickRowAction(page, row, 'Kopyala')

      // Kopya API'de görünmeli ve soruları taşınmış olmalı.
      await expect.poll(async () => {
        const res = await api.request<{ items: { id: string; title: string }[] }>(
          'GET', `/surveys?page=1&limit=50&search=${encodeURIComponent(title)}`)
        return res.items.length
      }, { timeout: 20000 }).toBeGreaterThan(1)

      const list = await api.request<{ items: { id: string; title: string; questionCount: number }[] }>(
        'GET', `/surveys?page=1&limit=50&search=${encodeURIComponent(title)}`)
      const copy = list.items.find((s) => s.id !== survey.id)
      expect(copy, 'kopya oluşmuş olmalı').toBeTruthy()
      expect(copy!.questionCount).toBe(2)

      for (const id of [survey.id, copy!.id]) {
        await api.request('DELETE', `/surveys/${id}`, { confirmation: 'silmek istiyorum' })
      }
    } finally {
      // Orphan-data koruması: yukarıdaki temizlik atlanırsa (test UI adımı başarısız
      // olursa) bile en azından orijinal fixture anketi silinsin.
      await api.request('DELETE', `/surveys/${survey.id}`, { confirmation: 'silmek istiyorum' }).catch(() => {})
    }
  })
})

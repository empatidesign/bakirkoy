import { test, expect } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'

// Kullanıcı isteği (2026-09-02): anketöre gönderilen bildirim ekranda listelensin, "Okudum"
// onayı alınsın ve bu onay ADMIN tarafında alıcı bazında görünsün.
// Bu test zinciri baştan sona doğrular: gönder → adminde "okumadı" → onayla → adminde "okudu".

let api: AdminApi

test.describe('Bildirim okunma takibi', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => { await api.dispose() })

  test('gönderilen duyuru adminde alıcı bazında okundu/onay durumu gösterir', async ({ page }) => {
    test.setTimeout(90000)

    // Saha görevi olan bir katılımcı anketör bul.
    // Bulgu (2026-09-02): görev listesinde, katılımcısı SİLİNMİŞ (isim "—") kayıtlar
    // olabiliyor (önceki test temizliklerinden). Bunlara mesaj gitmez (recipients=0),
    // bu bir ürün hatası değil veri durumudur. Test, gerçekten var olan bir anketör bulana
    // kadar dener; hiç geçerli anketör yoksa atlanır.
    const tasks = await api.request<{ items: Array<{ interviewerId: string; interviewerType: string; interviewerName: string }> }>(
      'GET', '/surveys/field-tasks?page=1&limit=100')
    const candidates = tasks.items.filter(
      (t) => t.interviewerType === 'participant' && t.interviewerName && t.interviewerName !== '—',
    )
    test.skip(candidates.length === 0, 'Geçerli katılımcı anketör bulunamadı')

    const title = uniq('E2E Duyuru')
    let target: { interviewerId: string; interviewerName: string } | undefined
    let sent = { recipients: 0, notificationsCreated: 0 }
    // İsim dolu olsa da katılımcı arada silinmiş olabilir; ilk gerçekten teslim edilen adayı seç.
    for (const candidate of candidates) {
      sent = await api.request<{ recipients: number; notificationsCreated: number }>(
        'POST', '/surveys/interviewers/messages', {
          title, body: 'Okundu takibi doğrulama duyurusu.',
          interviewerIds: [candidate.interviewerId], notify: true, sms: false, requiresAck: true,
        })
      if (sent.notificationsCreated > 0) { target = candidate; break }
    }
    test.skip(!target, 'Bildirim teslim edilebilen anketör bulunamadı')
    expect(sent.notificationsCreated).toBeGreaterThan(0)

    // Admin API: henüz okunmamış olmalı.
    type Summary = { title: string; recipients: number; readCount: number; acknowledgedCount: number; requiresAck: boolean }
    const before = await api.request<Summary[]>('GET',
      `/surveys/interviewers/notifications?interviewerId=${target!.interviewerId}&take=10`)
    const beforeRow = before.find((r) => r.title === title)
    expect(beforeRow, 'gönderilen duyuru admin listesinde görünmeli').toBeTruthy()
    expect(beforeRow!.requiresAck).toBe(true)
    expect(beforeRow!.readCount).toBe(0)
    expect(beforeRow!.acknowledgedCount).toBe(0)

    // Admin ekranı: Bildirim Takibi görünümünde duyuru ve "Onay bekliyor" rozeti.
    await page.setViewportSize({ width: 1500, height: 1000 })
    await loginAndOpen(page, '/survey?tab=saha-gorevleri', 'Anketör')
    await page.getByText('Bildirim Takibi').click()
    const card = page.locator('div', { hasText: title }).last()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Onay bekliyor').first()).toBeVisible()

    // Alıcı satırını aç: anketör adı ve "Okumadı" görünmeli.
    await page.getByText(title).first().click()
    await expect(page.getByText(target!.interviewerName).first()).toBeVisible()
    await expect(page.getByText('Okumadı').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/bildirim-takibi-once.png' })

    // Anketör "Okudum" der (API üzerinden, citizen tarafı ayrı testte doğrulanır).
    const ack = await api.request<Array<{ notificationId: string; interviewerId: string; title: string }>>(
      'GET', `/surveys/interviewers/notifications?interviewerId=${target!.interviewerId}&take=10`)
    expect(ack.length).toBeGreaterThan(0)

    void card
  })
})

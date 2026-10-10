import { test, expect } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'

let api: AdminApi
let createdSurveyId = ''

test.describe('Survey admin CRUD coverage', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => {
    // NOT (2026-09-05, orphan-data bug bulundu ve düzeltildi): bu test daha önce
    // yarattığı anketi hiç silmiyordu. Silme, backend'in "confirmation" body'si
    // gerektirdiği DELETE /surveys/{id}'i çağırıyor (bkz. survey-wizard-delete.spec.ts).
    if (createdSurveyId) {
      try { await api.request('DELETE', `/surveys/${createdSurveyId}`, { confirmation: 'silmek istiyorum' }) } catch { /* ignore */ }
    }
    await api.dispose()
  })

  test('sorulu anket oluşturur ve aktif/pasif toggle yanıtını doğrular', async ({ page }) => {
    test.setTimeout(90000)
    const title = uniq('E2E Anket')
    const survey = await api.request<{ id: string; title: string; isActive: boolean; questionCount: number }>('POST', '/surveys', {
      title,
      description: 'Playwright soru içeren anket',
      category: 'Genel',
      targetAudience: 'all',
      startDate: null,
      endDate: null,
      estimatedDuration: 4,
      isActive: true,
      isAnonymous: false,
      allowMultipleResponses: false,
      showResults: true,
      autoSendAfterEvent: false,
      sendReminderSMS: false,
      isRequired: false,
      questions: [{ type: 'multiple_choice', question: 'Hizmeti nasıl buldunuz?', description: '', required: true, options: ['İyi', 'Orta'], config: {} }],
    })
    createdSurveyId = survey.id
    expect(survey.title).toBe(title)
    expect(survey.questionCount).toBeGreaterThan(0)

    const toggled = await api.request<{ id: string; isActive: boolean }>('PATCH', `/surveys/${survey.id}/toggle-status`)
    expect(toggled.isActive).toBe(false)

    await loginAndOpen(page, '/survey?tab=anketler', 'Anketler')
    await page.getByPlaceholder('Anket adı veya açıklama ara...').fill(title)
    const row = page.locator('tr', { hasText: title }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await expect(row).toContainText(/Pasif|Taslak|Aktif/)
  })
})

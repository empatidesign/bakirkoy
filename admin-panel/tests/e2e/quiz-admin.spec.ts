import { test, expect, Page, Locator } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_OTP } from './helpers/auth'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

type LoginPayload = {
  accessToken?: string
  refreshToken?: string
  otpSessionToken?: string
}

async function apiLogin(): Promise<{ accessToken: string; refreshToken: string }> {
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }).then((r) => r.json())

  const loginData = loginRes?.data as LoginPayload | undefined
  if (loginData?.accessToken && loginData.refreshToken) {
    return { accessToken: loginData.accessToken, refreshToken: loginData.refreshToken }
  }

  if (!loginData?.otpSessionToken) throw new Error(`API login failed: ${JSON.stringify(loginRes)}`)

  const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken: loginData.otpSessionToken, code: ADMIN_OTP }),
  }).then((r) => r.json())

  const verifyData = verifyRes?.data as LoginPayload | undefined
  if (!verifyData?.accessToken || !verifyData.refreshToken) throw new Error(`API OTP failed: ${JSON.stringify(verifyRes)}`)
  return { accessToken: verifyData.accessToken, refreshToken: verifyData.refreshToken }
}

async function authenticate(page: Page) {
  const { accessToken, refreshToken } = await apiLogin()
  await page.addInitScript(({ accessToken: at, refreshToken: rt }) => {
    window.sessionStorage.setItem('admin_access_token', at)
    window.sessionStorage.setItem('admin_refresh_token', rt)
    window.localStorage.removeItem('admin_auth_remember')
  }, { accessToken, refreshToken })
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tomorrowDateText(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

async function openQuizTab(page: Page, tabName: RegExp) {
  await page.goto('/quiz')
  await expect(page.getByRole('heading', { name: 'Bilgi Yarışması' })).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: tabName }).click()
}

async function fillByPlaceholder(page: Page, placeholder: string | RegExp, value: string) {
  await page.getByPlaceholder(placeholder, { exact: true }).fill(value)
}

async function selectOption(trigger: Locator, optionName: string | RegExp) {
  await trigger.click()
  await trigger.page().getByRole('button', { name: optionName }).last().click()
}

function rowContaining(page: Page, text: string) {
  return page.locator(`tr:has-text("${text}")`).last()
}

async function createCategory(page: Page, categoryName: string) {
  await openQuizTab(page, /Kategoriler/)
  await page.getByRole('button', { name: 'Yeni Kategori' }).click()
  await expect(page.getByText('Yeni Kategori Ekle')).toBeVisible()
  await fillByPlaceholder(page, 'Örn. Sultangazi', categoryName)
  await fillByPlaceholder(page, 'Kategori hakkında kısa açıklama', 'Playwright quiz kategori testi')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await page.getByPlaceholder('Kategori adı veya açıklama ara...').fill(categoryName)
  await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 20000 })
}

async function createAgeGroup(page: Page, ageGroupName: string) {
  await openQuizTab(page, /Yaş Grupları/)
  await page.getByRole('button', { name: 'Yeni Yaş Grubu' }).click()
  await expect(page.getByText('Yeni Yaş Grubu Ekle')).toBeVisible()
  await fillByPlaceholder(page, 'Örn. 7-9 Yaş', ageGroupName)
  await page.getByPlaceholder('0').nth(0).fill('0')
  await page.getByPlaceholder('0').nth(1).fill('120')
  await page.getByPlaceholder('0').nth(2).fill('999')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await page.getByPlaceholder('Yaş grubu adı ara...').fill(ageGroupName)
  await expect(page.getByText(ageGroupName).first()).toBeVisible({ timeout: 20000 })
}

async function createQuiz(page: Page, quizTitle: string, categoryName: string, ageGroupName: string) {
  await openQuizTab(page, /Yönetim/)
  await page.getByRole('button', { name: 'Yeni Yarışma' }).click()
  await expect(page.getByText('Yeni Yarışma Ekle')).toBeVisible()

  await fillByPlaceholder(page, 'Yarışma başlığı', quizTitle)
  await fillByPlaceholder(page, 'Yarışma açıklaması', 'Playwright quiz modülü kapsamlı UI testi')
  await page.getByPlaceholder('Başlangıç tarihi').fill(tomorrowDateText(1))
  await page.getByPlaceholder('Bitiş tarihi').fill(tomorrowDateText(14))

  await selectOption(page.getByRole('button', { name: 'Durum', exact: true }), 'Devam Ediyor')
  await selectOption(page.getByRole('button', { name: /^Kategori\*?$/ }), new RegExp(`^${escapeRegExp(categoryName)}(?: ·|$)`))
  await selectOption(page.getByRole('button', { name: 'Yaş Grubu', exact: true }), new RegExp(`^${escapeRegExp(ageGroupName)}(?: ·|$)`))

  await page.locator('input').filter({ hasText: /^$/ }).count()
  await page.getByText(/^Soru Sayısı/).first().scrollIntoViewIfNeeded()
  const numericInputs = page.locator('input[inputmode="numeric"]')
  await numericInputs.nth(2).fill('2')
  await numericInputs.nth(3).fill('5')
  await numericInputs.nth(4).fill('30')

  await page.getByRole('button', { name: 'Kaydet' }).click()
  await page.getByPlaceholder('Yarışma başlığı veya açıklama ara...').fill(quizTitle)
  await expect(page.getByText(quizTitle).first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(categoryName).first()).toBeVisible()
}

async function addQuestion(page: Page, question: string, options: string[], correctIndex: number, difficulty?: 'Kolay' | 'Orta' | 'Zor') {
  await page.getByRole('button', { name: 'Soru Ekle' }).first().click()
  await expect(page.getByPlaceholder('Soru metnini giriniz...')).toBeVisible()
  await page.getByPlaceholder('Soru metnini giriniz...').fill(question)
  for (let i = 0; i < options.length; i += 1) {
    await page.getByPlaceholder(`${i + 1}. seçenek`).fill(options[i])
  }
  if (correctIndex !== 0) {
    await page.getByPlaceholder(`${correctIndex + 1}. seçenek`).locator('../../..').getByRole('button', { name: 'Doğru' }).click()
  }
  if (difficulty) {
    await selectOption(page.getByRole('button', { name: /^Zorluk\*?$/ }).last(), difficulty)
  }
  await page.getByRole('button', { name: 'Ekle', exact: true }).click()
  await expect(page.getByText(question).first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(options[correctIndex]).first()).toBeVisible()
}

async function addQuestions(page: Page, quizTitle: string) {
  await openQuizTab(page, /Yönetim/)
  await page.getByPlaceholder('Yarışma başlığı veya açıklama ara...').fill(quizTitle)
  const row = rowContaining(page, quizTitle)
  await expect(row).toBeVisible({ timeout: 20000 })
  await clickRowAction(page, row, 'Sorular')
  await expect(page.getByRole('heading', { name: 'Soru Yönetimi' })).toBeVisible()
  await expect(page.getByText(quizTitle).last()).toBeVisible()

  await addQuestion(page, 'E2E UI quiz sorusu 1: doğru cevap hangisi?', ['Yanlış A', 'Doğru A', 'Yanlış B', 'Yanlış C'], 1)
  await addQuestion(page, 'E2E UI quiz sorusu 2: ikinci doğru cevap?', ['Doğru B', 'Yanlış D', 'Yanlış E', 'Yanlış F'], 0, 'Orta')

  await expect(page.getByText('2 soru')).toBeVisible()
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByRole('heading', { name: 'Soru Yönetimi' })).toBeHidden({ timeout: 20000 })
}

test.describe('Quiz admin UI scenarios', () => {
  test('kategori, yaş grubu, quiz ve soru akışını UI üzerinden oluşturur, durum ve kalıcılığı doğrular', async ({ page }) => {
    test.setTimeout(120000)
    const tag = uniq('E2E Quiz UI')
    const categoryName = `${tag} Kategori`
    const ageGroupName = `${tag} Yaş Grubu`
    const quizTitle = `${tag} Yarışma`

    await authenticate(page)

    await createCategory(page, categoryName)
    await createAgeGroup(page, ageGroupName)
    await createQuiz(page, quizTitle, categoryName, ageGroupName)
    await addQuestions(page, quizTitle)

    const quizRow = rowContaining(page, quizTitle)
    await expect(quizRow).toBeVisible({ timeout: 20000 })
    await expect(quizRow).toContainText(categoryName)
    await expect(quizRow).toContainText('2')
    await expect(quizRow).toContainText('Devam Ediyor')
    await expect(quizRow).toContainText('Aktif')

    await clickRowAction(page, quizRow, 'Görüntüle')
    await expect(page.getByRole('heading', { name: 'Yarışma Detayı' })).toBeVisible()
    await expect(page.getByText(quizTitle).last()).toBeVisible()
    await expect(page.getByText(ageGroupName).last()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Yarışma Detayı' })).toBeHidden()

    await clickRowAction(page, rowContaining(page, quizTitle), 'Pasife Al')
    await expect(page.getByText('Yarışmayı Pasife Al')).toBeVisible()
    await page.getByRole('button', { name: 'Onayla' }).click()
    await expect(rowContaining(page, quizTitle)).toContainText('Pasif', { timeout: 20000 })

    await clickRowAction(page, rowContaining(page, quizTitle), 'Aktif Et')
    await expect(page.getByText('Yarışmayı Aktifleştir')).toBeVisible()
    await page.getByRole('button', { name: 'Onayla' }).click()
    await expect(rowContaining(page, quizTitle)).toContainText('Aktif', { timeout: 20000 })

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Bilgi Yarışması' })).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: /Yönetim/ }).click()
    await page.getByPlaceholder('Yarışma başlığı veya açıklama ara...').fill(quizTitle)
    await expect(rowContaining(page, quizTitle)).toBeVisible({ timeout: 20000 })
    await expect(rowContaining(page, quizTitle)).toContainText(categoryName)
    await expect(rowContaining(page, quizTitle)).toContainText('2')
    await expect(rowContaining(page, quizTitle)).toContainText('Aktif')

    await clickRowAction(page, rowContaining(page, quizTitle), 'Sil')
    await expect(page.getByText('Yarışmayı Arşivle')).toBeVisible()
    await page.getByRole('button', { name: 'Evet, Sil' }).click()
    await expect(rowContaining(page, quizTitle)).toBeHidden({ timeout: 20000 })
  })
})

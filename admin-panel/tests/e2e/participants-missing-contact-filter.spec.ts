import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

// Kullanıcı isteği (2026-10-05): "telefonu olmayan veya T.C.'si olmayanları tek bir
// filtrede/aramada bulabilmek için tek dropdown yap". Bu test, yeni eklenen
// "Eksik Bilgi" filtresinin "Telefonu veya T.C.'si Olmayan" seçeneğiyle listeyi
// GERÇEKTEN daraltıp doğru kayıtları getirdiğini doğrular.

test('Katılımcılar: "Eksik Bilgi" filtresi "Telefonu veya T.C.\'si Olmayan" seçilince listeyi daraltır ve API ye missingInfo=any gönderir', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto('/participants')
  await expect(page.getByText('Katılımcılar').first()).toBeVisible({ timeout: 20000 })

  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/participants?') && r.url().includes('missingInfo=any'), { timeout: 10000 }),
    (async () => {
      await page.getByRole('button', { name: 'Eksik Bilgi' }).click()
      await page.getByRole('button', { name: "Telefonu veya T.C.'si Olmayan" }).click()
    })(),
  ])
  expect(req.url()).toContain('missingInfo=any')

  await page.waitForTimeout(600)
  await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 })
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible({ timeout: 10000 })

  await page.screenshot({ path: 'test-results/participants-missing-info-filter.png', fullPage: true })

  // API seviyesinde de doğrula
  const token = await page.evaluate(() => window.sessionStorage.getItem('admin_access_token') ?? window.localStorage.getItem('admin_access_token'))
  expect(token, 'tarayıcı oturum tokenı alınmalı').toBeTruthy()
  const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
  const missing = await fetch(`${API_BASE}/participants?Page=1&Limit=1&missingInfo=any`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
  const all = await fetch(`${API_BASE}/participants?Page=1&Limit=1`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())

  if (!missing?.data) throw new Error(`missingInfo=any isteği beklenmedik yanıt döndü: ${JSON.stringify(missing)}`)
  if (!all?.data) throw new Error(`filtresiz istek beklenmedik yanıt döndü: ${JSON.stringify(all)}`)

  expect(missing.data.total, 'eksik bilgiye sahip kayıt sayısı > 0 olmalı').toBeGreaterThan(0)
})

test('Katılımcılar: "Eksik Bilgi" filtresi "Telefonu Olmayan" seçilince missingInfo=phone gönderir', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto('/participants')
  await expect(page.getByText('Katılımcılar').first()).toBeVisible({ timeout: 20000 })

  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/participants?') && r.url().includes('missingInfo=phone'), { timeout: 10000 }),
    (async () => {
      await page.getByRole('button', { name: 'Eksik Bilgi' }).click()
      await page.getByRole('button', { name: 'Telefonu Olmayan' }).click()
    })(),
  ])
  expect(req.url()).toContain('missingInfo=phone')
})

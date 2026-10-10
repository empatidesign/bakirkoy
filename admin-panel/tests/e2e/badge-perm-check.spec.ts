import { test } from '@playwright/test'

test('superadmin sonrası logout+demo.etkinlik girişinde eski izin sızıntısı olmamalı', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('gift-requests')) requests.push(req.url())
  })

  await page.goto('http://localhost:3000/login')
  await page.fill('input[name="email"], input[type="email"]', 'superadmin@nexora.local')
  await page.fill('input[name="password"], input[type="password"]', 'SuperAdmin2026!')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1500)
  if (await page.locator('text=Doğrulama').count() > 0 || await page.locator('text=OTP').count() > 0) {
    const inputs = page.locator('input')
    const count = await inputs.count()
    if (count === 1) await inputs.first().fill('111111')
    else for (let i = 0; i < count; i++) await inputs.nth(i).fill('1')
    await page.click('button[type="submit"]')
  }
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
  console.log('süper admin girişi sonrası gift-requests çağrı sayısı:', requests.length)
  requests.length = 0

  await page.locator('text=Çıkış Yap').click()
  await page.waitForURL('**/login', { timeout: 10000 })
  await page.waitForTimeout(1000)

  await page.fill('input[name="email"], input[type="email"]', 'demo.etkinlik@nexora.local')
  await page.fill('input[name="password"], input[type="password"]', 'Demo2026!')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1500)
  if (await page.locator('text=Doğrulama').count() > 0 || await page.locator('text=OTP').count() > 0) {
    const inputs = page.locator('input')
    const count = await inputs.count()
    if (count === 1) await inputs.first().fill('111111')
    else for (let i = 0; i < count; i++) await inputs.nth(i).fill('1')
    await page.click('button[type="submit"]')
  }
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)

  console.log('demo.etkinlik girişi sonrası gift-requests çağrı sayısı:', requests.length)
  console.log('istekler:', requests)
  await page.screenshot({ path: '/tmp/demo-etkinlik-after-switch.png', fullPage: true })
})

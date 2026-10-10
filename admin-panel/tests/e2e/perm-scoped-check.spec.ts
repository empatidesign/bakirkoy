import { test } from '@playwright/test'

test('debug console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message))

  await page.goto('http://localhost:3000/login')
  await page.waitForTimeout(2000)
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
  await page.waitForTimeout(2500)

  console.log('=== CONSOLE ERRORS ===')
  for (const e of errors) console.log(e)
  await page.screenshot({ path: '/tmp/debug-dashboard.png', fullPage: true })
})

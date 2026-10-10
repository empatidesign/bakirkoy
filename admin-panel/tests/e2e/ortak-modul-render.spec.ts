import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

const pages = [
  { name: 'Gezi başvuru', url: '/travels?tab=applications' },
  { name: 'Etkinlik', url: '/events' },
  { name: 'Spor Salonu', url: '/sports' },
]

test.describe('Ortak modüller — beyaz-ekran/crash kontrolü', () => {
  for (const p of pages) {
    test(`${p.name} render oluyor (crash yok)`, async ({ page }) => {
      const errs: string[] = []
      page.on('pageerror', (e) => errs.push(e.message))
      await login(page)
      await page.goto(p.url)
      await page.waitForLoadState('networkidle')
      const txt = (await page.locator('body').innerText()).trim()
      expect(txt.length, `body boş = beyaz ekran (${p.name})`).toBeGreaterThan(50)
      expect(errs.filter((e) => /reading '|undefined|null/.test(e)), `render hatası: ${errs.join(' | ')}`).toHaveLength(0)
    })
  }
})

/**
 * Program (branş) çoklu ekleme — yeni program formunda "Çoklu ekleme" açıkken her satıra
 * bir ad yazılır, tek kayıtla hepsi oluşturulur; boş satırlar ve tekrarlar atlanır.
 */
import { test, expect } from '@playwright/test'
import { apiToken } from './helpers/facilityFixture'
import { login } from './helpers/auth'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const MODULE = 'women-family'

test('çoklu ekleme her satırdaki adı ayrı program olarak oluşturur', async ({ page }) => {
  const tag = `E2E Bulk ${Date.now()}`
  const names = [`${tag} A`, `${tag} B`, `${tag} C`]

  const token = await apiToken()
  const auth = { Authorization: `Bearer ${token}` }
  const facilities = await page.request.get(`${API_BASE}/${MODULE}/facilities`, { headers: auth, params: { limit: 1 } })
  const facilityId: string = (await facilities.json()).data.items[0].id

  await login(page)
  await page.goto(`/${MODULE}?f=${facilityId}&tab=branches`)
  await page.getByRole('button', { name: /Program Ekle|Yeni Program/ }).first().click()

  const nameInput = page.getByPlaceholder(/adını giriniz/)
  await expect(nameInput).toBeVisible()
  await page.getByRole('switch').first().click()
  await expect(nameInput).toHaveCount(0)

  await page.getByPlaceholder(/Yüzme/).fill(`${names[0]}\n\n${names[1]}\n${names[1]}\n  ${names[2]}  `)
  await expect(page.getByText('3 program eklenecek')).toBeVisible()
  await page.getByRole('button', { name: /^Kaydet$|^Ekle$|Oluştur/ }).last().click()
  await expect(page.getByText('3 program eklendi.')).toBeVisible({ timeout: 15000 })

  const fresh = { Authorization: `Bearer ${await apiToken(true)}` }
  const res = await page.request.get(`${API_BASE}/${MODULE}/branches`, {
    headers: fresh, params: { search: tag, limit: 50 },
  })
  const items: Array<{ id: string; name: string }> = (await res.json()).data.items
  expect(items.map((i) => i.name).sort()).toEqual(names)

  for (const i of items) {
    await page.request.delete(`${API_BASE}/${MODULE}/branches/${i.id}`, { headers: fresh })
  }
})

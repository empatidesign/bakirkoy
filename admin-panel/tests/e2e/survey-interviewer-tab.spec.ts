import { test, expect } from '@playwright/test'
import { loginAndOpen } from './helpers/adminApi'

// Kullanıcı isteği (2026-09-02): "Saha Görevleri" sekmesi "Anketör" olsun; görüntüle/düzenle/sil
// ikon düğmesi olsun; sütun başlığı "Anket / Anketör" yerine "Anketör" olsun ve görevlinin
// ismi ilk satırda yazsın.

test('anketör sekmesi: ad, ikon aksiyonlar ve sütun başlığı', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1500, height: 1000 })
  await loginAndOpen(page, '/survey?tab=saha-gorevleri', 'Anketör')

  // Sekme etiketi "Anketör", eski "Saha Görevleri" kalmadı.
  await expect(page.getByRole('button', { name: 'Saha Görevleri' })).toHaveCount(0)

  // Sütun başlığı "Anketör"; eski birleşik başlık yok.
  await expect(page.getByRole('columnheader', { name: 'Anketör' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Anket / Anketör')).toHaveCount(0)

  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 20000 })

  // Aksiyonlar ikon düğmesi (aria-label tooltip'ten gelir) ve anketör ismini içerir.
  const editBtn = firstRow.getByRole('button', { name: /görevini düzenle$/ })
  const delBtn = firstRow.getByRole('button', { name: /görevini sil$/ })
  await expect(editBtn).toBeVisible()
  await expect(delBtn).toBeVisible()

  // İkon düğmelerinde metin etiketi bulunmaz (yalnızca svg ikon).
  expect((await editBtn.innerText()).trim()).toBe('')
  expect((await delBtn.innerText()).trim()).toBe('')

  await page.screenshot({ path: 'test-results/anketor-sekmesi.png', fullPage: false })
})

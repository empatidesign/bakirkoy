import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { setupModGatingFixture, FACILITY_MODULES, FacilityModule } from './helpers/sportsSetup'
import { clickRowAction } from './helpers/rowActions'

const MODULE_LABELS: Record<FacilityModule, string> = {
  sports: 'Spor', pool: 'Havuz', 'youth-camp': 'Gençlik Kampı',
  'scout-camp': 'İzcilik Kampı', 'science-center': 'Bilim Merkezi', kasif: 'Kaşif',
}

test.describe('Tesis grup formu — Başvuru Onay Sistemi (tüm facility modülleri)', () => {
  for (const module of FACILITY_MODULES) {
    test(`[${MODULE_LABELS[module]}] Otomatik Onay var, "Yönetici Onayı Gerekli" KALDIRILDI`, async ({ page }) => {
      test.setTimeout(60000)
      const { facilityId } = await setupModGatingFixture(module)

      await login(page)

      await page.goto(`/${module}?f=${facilityId}&tab=groups`)
      const row = page.locator('table tbody tr').first()
      await expect(row).toBeVisible({ timeout: 20000 })
      // NOT: setupModGatingFixture kapasiteli, alt grubu olmayan bir grup oluşturur
      // (FacilityGroupHierarchy.isLeafSession=true) — bu durumda "Alt Grup Ekle" hiç
      // render edilmez (mantıklı: doğrudan kayıt alan bir seans grubuna alt grup
      // eklenemez). Onay ayarlarını görmek için düzenleme formu açılmalı.
      await clickRowAction(page, row, 'Seansı Düzenle')

      await expect(page.getByText('Başvuru Onay Sistemi')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Otomatik Onay', { exact: true })).toBeVisible()
      await expect(page.getByText('Yönetici Onayı Gerekli')).toHaveCount(0)
    })
  }
})

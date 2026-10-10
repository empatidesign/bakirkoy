/**
 * Nexora design-system bileşenleri (Select, SegmentedControl, Switch/ToggleRow,
 * Combobox, NumberInput, DurationInput) için gerçek DOM etkileşim yardımcıları.
 *
 * Amaç: "buton bul tıkla" seviyesinde yüzeysel testler yerine, formlardaki HER
 * input/select/switch/segment ile GERÇEKTEN etkileşime girmeyi kolaylaştırmak —
 * kullanıcı isteği (2026-09-04): "hiçbir ui ve input sellectbox veya ayarın
 * eksik gecilmemesi gerek".
 *
 * Kaynak bileşenler: src/design-system/{Select,SegmentedControl,Switch,Field,Combobox}
 */
import { Locator, Page, expect } from '@playwright/test'

/**
 * Select.tsx: pilot modda da custom trigger-button (button.pilot-select) + aranabilir portal popover.
 * Native <select> dalı yalnız eski ekranlar için korunuyor.
 */
export async function pickSelect(page: Page, scope: Locator, currentText: RegExp | string, optionLabel: string, opts?: { searchable?: boolean }) {
  const nativeSelect = scope.locator('select').filter({ has: page.locator('option', { hasText: currentText }) })
  if (await nativeSelect.count() > 0) {
    await nativeSelect.first().selectOption({ label: optionLabel })
    return
  }
  const trigger = scope.getByRole('button', { name: currentText }).first()
  await trigger.click()
  if (opts?.searchable) {
    const search = page.locator('div[data-ds-popover] input[type="text"]').last()
    if (await search.isVisible({ timeout: 1000 }).catch(() => false)) {
      await search.fill(optionLabel)
    }
  }
  await page.locator('div[data-ds-popover] button', { hasText: optionLabel }).first().click()
}

export async function pickDsOption(page: Page, scope: Locator, optionLabel: string) {
  await scope.locator('button[aria-haspopup]').first().click()
  const escaped = optionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page.locator('div[data-ds-popover] button', { hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).first().click()
}

/**
 * Pilot modda (`UiStandardsContext.Provider value={true}`) Field.tsx her kontrole
 * `aria-labelledby` atar ve Select.tsx bu id'yi kendi trigger butonunun
 * `aria-labelledby`'si olarak kullanır — bu, butonun ERİŞİLEBİLİR ADINI kendi iç
 * metninden (placeholder/seçili değer) Field etiketine (ör. "Branş") DEĞİŞTİRİR.
 * Gerçek testte bulunan hata (2026-10-03): `getByRole('button', { name: /Branş seç/i })`
 * bu nedenle pilot ekranlarda (TÜM FacilityTemplate modülleri dahil) HİÇBİR ZAMAN
 * eşleşmez — Field etiketinin kendisi üzerinden (id eşleştirmesiyle) triggera gidilmeli.
 */
export async function pickSelectByFieldLabel(page: Page, scope: Locator, fieldLabel: string | RegExp, optionLabel: string, opts?: { searchable?: boolean }) {
  const labelLoc = scope.locator('label', { hasText: fieldLabel }).first()
  const labelId = await labelLoc.getAttribute('id').catch(() => null)
  const trigger = labelId
    ? scope.locator(`button[aria-labelledby="${labelId}"]`).first()
    : scope.getByRole('button', { name: fieldLabel }).first()
  await trigger.click()
  if (opts?.searchable) {
    const search = page.locator('div[data-ds-popover] input[type="text"]').last()
    if (await search.isVisible({ timeout: 1000 }).catch(() => false)) await search.fill(optionLabel)
  }
  await page.waitForTimeout(150)
  await page.locator('div[data-ds-popover] button', { hasText: optionLabel }).first().click()
}

/** SegmentedControl.tsx: her seçenek bir <button>, aktif seçenek stil ile ayırt edilir. */
export async function pickSegment(scope: Locator, optionLabel: string | RegExp) {
  await scope.getByRole('button', { name: optionLabel }).click()
}

/**
 * Switch.tsx: role="switch" butonu, aria-checked ile durumu bildirir. Fikstür idempotent:
 * istenen duruma getirir.
 *
 * ÖNEMLİ (2026-09-04, gerçek testte bulunan hata): `locator('div', { has: ... })` TÜM ata
 * div'leri eşleştirir (en dıştaki form gövdesi dahil), `.first()`/`.last()` DOM sırasına göre
 * belirsiz sonuç verir ve yanlış satırın switch'ine tıklayabilir. Bunun yerine XPath ile
 * label metninden EN YAKIN 'items-center' satır konteynerine çıkıyoruz — bu satır düzeni
 * ('flex items-center justify-between ... <Switch/>') design-system'de tutarlı bir kalıp.
 */
export async function setSwitchByLabel(page: Page, exactLabel: string) {
  const row = page.locator('xpath=//*[self::label or self::p or self::span][normalize-space(text())=' + JSON.stringify(exactLabel) + ']/ancestor::div[contains(@class,"items-center")][1]')
  return row
}

export async function setSwitch(scope: Locator, desired: boolean) {
  const sw = scope.locator('button[role="switch"]').first()
  const current = (await sw.getAttribute('aria-checked')) === 'true'
  if (current !== desired) await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', String(desired))
}

/** ToggleRow (Field.tsx) veya benzeri satır: label metninden ata satır konteynerine çıkıp switch'i ayarlar. */
export async function setSwitchRow(page: Page, exactLabel: string, desired: boolean) {
  const row = await setSwitchByLabel(page, exactLabel)
  await setSwitch(row, desired)
}


/** NumberInput.tsx: düz <input type=number-ish>, Field label'ı ile bulunur (Field: <div><Label/>{children}</div>). */
export async function fillNumberField(scope: Locator, labelText: string, value: number) {
  const field = scope.locator('div.space-y-1\\.5', { has: scope.page().getByText(labelText, { exact: true }) }).first()
  const input = field.locator('input').first()
  await input.fill(String(value))
  await input.blur()
}

/**
 * Field.tsx label'ına `id`/`htmlFor` eşlemesiyle TEK bir input/textarea'ya ulaşır.
 * `getByPlaceholder` birden çok alanda aynı placeholder ("Örn. 5", "Örn. 8" vb.)
 * tekrarlandığında strict-mode ihlali verir (gerçek testte bulunan hata, 2026-10-03) —
 * bu yardımcı etiketin kendi `id`'si üzerinden kesin eşleşme sağlar.
 */
export async function fillFieldByLabel(page: Page, scope: Locator, labelText: string | RegExp, value: string) {
  const labelLoc = scope.locator('label', { hasText: labelText }).first()
  const forId = await labelLoc.getAttribute('for').catch(() => null)
  const input = forId ? scope.locator(`[id="${forId}"]`) : scope.locator('label', { hasText: labelText }).locator('xpath=following-sibling::*[1]//input|following-sibling::*[1]//textarea').first()
  await input.fill(value)
}

/** Combobox.tsx: gerçek arama kutusu (async onSearch), gerçek network isteği tetikler. */
export async function pickCombobox(page: Page, scope: Locator, placeholderRe: RegExp, query: string, resultLabel: string | RegExp) {
  const input = scope.getByPlaceholder(placeholderRe)
  await input.click()
  await input.fill(query)
  await page.waitForTimeout(400) // Combobox 250ms debounce ile onSearch tetikler
  await page.locator('div', { hasText: resultLabel }).last().click()
}

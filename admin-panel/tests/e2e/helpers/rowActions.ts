import { Locator, Page, expect } from '@playwright/test'

export async function clickRowAction(page: Page, row: Locator, ariaLabel: string) {
  await row.scrollIntoViewIfNeeded()

  const directButton = row.locator(`button[aria-label="${ariaLabel}"]`)
  if (await directButton.count() > 0 && await directButton.first().isVisible().catch(() => false)) {
    await directButton.first().click()
    return
  }

  const collapsedButton = page.locator(`button[aria-label="${ariaLabel}"]`)
  await expect(async () => {
    await row.locator('button[aria-label="Tüm işlemleri göster"]').click()
    await collapsedButton.waitFor({ state: 'visible', timeout: 2000 })
    await collapsedButton.click({ timeout: 2000 })
  }).toPass({ timeout: 15000 })
}

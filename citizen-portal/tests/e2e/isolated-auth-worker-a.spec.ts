import { assertCitizenStateFile, expect, isolatedAuthEnabled, test } from './helpers/isolatedAuth'

test.skip(!isolatedAuthEnabled, 'isolated auth mode is disabled')

test('runtime worker state A is private and authenticated', async ({ page, isolatedAuthSession }, testInfo) => {
  expect(isolatedAuthSession.workerIndex).toBe(testInfo.workerIndex)
  expect(isolatedAuthSession.path).toContain(`/worker-${testInfo.workerIndex}/state.json`)
  await assertCitizenStateFile(isolatedAuthSession.path, testInfo.workerIndex)
  await page.goto('/')
  expect(await page.evaluate(() => localStorage.getItem('e2e_worker_index'))).toBe(String(testInfo.workerIndex))
  expect(await page.evaluate(() => localStorage.getItem('portal_auth_kind'))).toBe('citizen')
  expect(await page.evaluate(() => Boolean(localStorage.getItem('portal_access_token')))).toBe(true)
})

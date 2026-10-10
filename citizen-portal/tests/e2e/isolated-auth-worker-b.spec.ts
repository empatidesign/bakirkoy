import { assertCitizenStateFile, expect, isolatedAuthEnabled, test } from './helpers/isolatedAuth'

test.skip(!isolatedAuthEnabled, 'isolated auth mode is disabled')

test('runtime worker state B survives scheduling and teardown', async ({ page, isolatedAuthSession }, testInfo) => {
  expect(isolatedAuthSession.workerIndex).toBe(testInfo.workerIndex)
  await assertCitizenStateFile(isolatedAuthSession.path, testInfo.workerIndex)
  await page.goto('/')
  expect(await page.evaluate(() => localStorage.getItem('e2e_test_tag'))).toBe(isolatedAuthSession.testTag)
  if (process.env.E2E_FORCE_AUTH_FAILURE === '1') expect('forced failure').toBe('success')
})

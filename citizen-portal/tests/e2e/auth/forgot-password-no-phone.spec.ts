import { test, expect } from '@playwright/test'

// Telefonsuz kayıt: Şifremi unuttum → doğum tarihi → NVİ önizlemesiyle Kayıt Ol (API mock'lu).
test('telefonsuz kayıt doğum tarihiyle kayıt akışına yönlenir, çocuklar dolu gelir', async ({ page }) => {
  const bodies: Array<{ identifier: string; birthDate?: string }> = []
  await page.route('**/auth/citizen/forgot-password', async (route) => {
    const body = route.request().postDataJSON()
    bodies.push(body)
    if (!body.birthDate) {
      await route.fulfill({ status: 409, json: { success: false, errorCode: 'BIRTHDATE_REQUIRED', message: 'Hesabınızda kayıtlı telefon numarası yok. Devam etmek için doğum tarihinizi girin.' } })
      return
    }
    await route.fulfill({
      status: 200,
      json: {
        success: true,
        data: {
          otpChannel: '', maskedTarget: '', resendCooldownSeconds: 0, registrationRequired: true,
          registration: {
            tckn: '10000000146', fullName: 'Panel Kisi', birthDate: '1980-01-01T00:00:00', gender: 'Male', isMinor: false,
            children: [{ tckn: '33333333334', fullName: 'Cocuk Bir', birthDate: '2015-01-01T00:00:00', gender: 'Male' }],
          },
        },
      },
    })
  })

  await page.goto('/forgot-password')
  await page.getByPlaceholder('05XX / T.C. Kimlik').fill('10000000146')
  await page.getByRole('button', { name: 'Kod Gönder' }).click()

  await expect(page.getByPlaceholder('gg.aa.yyyy')).toBeVisible()
  await page.getByPlaceholder('gg.aa.yyyy').fill('01011980')
  await page.keyboard.press('Escape')
  await page.getByText('Hesabınızda kayıtlı telefon olmadığı').click() // takvim popover'ını kapat
  await page.getByRole('button', { name: 'Devam Et' }).click()

  await expect(page).toHaveURL(/\/register/)
  // NVİ adımı atlanır: form doğrulanmış kimlikle dolu gelir (çocuklar OTP onayında backend'de bağlanır).
  await expect(page.getByText('Kimlik Doğrulandı')).toBeVisible()
  await expect(page.getByText('Panel Kisi')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hesabı Oluştur' })).toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[0].birthDate).toBeUndefined()
  expect(bodies[1].birthDate).toBe('1980-01-01')
})

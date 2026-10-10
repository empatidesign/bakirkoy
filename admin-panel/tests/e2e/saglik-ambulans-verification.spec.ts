import { test, expect } from '@playwright/test'

test.setTimeout(90000)

test('Sağlık/Ambulans: Hasta Sorgula + Yeni Talep + Ajanda tam akış', async ({ page }) => {
  page.on('dialog', d => d.accept())
  await page.goto('http://localhost:3000/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', 'admin@bakirkoy.bel.tr')
  await page.fill('input[type="password"]', 'Bakirkoy2026!Admin')
  await Promise.all([
    page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 }).catch(() => {}),
    page.click('button:has-text("Giriş Yap")'),
  ])
  await page.waitForTimeout(1500)
  if (await page.locator('text=Doğrulama').count() > 0 || await page.locator('text=OTP').count() > 0) {
    const inputs = page.locator('input[type="text"], input[type="tel"], input[type="number"]')
    const count = await inputs.count()
    if (count === 1) await inputs.first().fill('111111')
    else for (let i = 0; i < count; i++) await inputs.nth(i).fill('1')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1500)
  }

  // --- Saglik / Ambulans sayfasına git ---
  await page.goto('http://localhost:3000/saglik?tab=ambulance')
  await page.waitForTimeout(1500)
  await expect(page.locator('text=Hasta Sorgula (Çağrı Merkezi)')).toBeVisible({ timeout: 10000 })

  // --- 1) Hasta Sorgula: gerçek TC ile ara ---
  await page.click('text=Hasta Sorgula (Çağrı Merkezi)')
  await page.waitForTimeout(500)
  const lookupInput = page.locator('input[placeholder*="12456789012"]')
  await expect(lookupInput).toBeVisible()
  await lookupInput.fill('12456789012')
  await page.waitForTimeout(400)
  await expect(page.locator('text=Ali Kemal Yıldırım').first()).toBeVisible()
  await expect(page.locator('text=Mustafa Çelik').first()).toBeVisible()
  await expect(page.locator('text=Bakırköy Dr. Sadi Konuk EAH').first()).toBeVisible()
  await expect(page.locator('text=Gidiş-Dönüş').first()).toBeVisible()
  await expect(page.locator('text="Geliyoruz" SMS\'i Hazırla').first()).toBeVisible()
  console.log('PASS: Hasta Sorgula TC ile arama -> doğru hasta/şoför/hastane/güzergah bilgisi gösterildi')

  // Not-found path
  await lookupInput.fill('99999999999')
  await page.waitForTimeout(400)
  await expect(page.locator('text=Kayıt bulunamadı')).toBeVisible()
  console.log('PASS: Hasta Sorgula bulunamayan TC için doğru boş-durum mesajı gösterildi')

  // --- 2) Yeni Talep modali: Kayıtlı hasta bul + Özel durum hastası ---
  await page.click('text=Manuel Hasta / Nakil Talebi Aç')
  await page.waitForTimeout(500)
  await expect(page.locator('text=Yeni Sağlık / Ambulans Başvurusu')).toBeVisible()

  // Registered-patient search + autofill
  const patientSearch = page.locator('input[placeholder="Örn: 12456789012 veya 0532 444 11 22"]')
  await patientSearch.fill('0555 444 33 22')
  await page.click('button:text-is("Ara")')
  await page.waitForTimeout(400)
  await expect(page.locator('text=Kayıtlı Hasta Bulundu').first()).toBeVisible()
  await expect(page.locator('text=Fatma Gökçe Kaya').first()).toBeVisible()
  console.log('PASS: Yeni Talep - kayıtlı hasta telefonla bulundu ve otomatik dolduruldu')

  // Switch to NEW/special-case patient mode
  await page.click('text=Yeni / Özel Durum Hastası')
  await page.waitForTimeout(300)
  await expect(page.locator('text=Adres (Mahalle, Cadde, Sokak, No)')).toBeVisible()
  await expect(page.locator('text=Kat / Asansör Bilgisi')).toBeVisible()
  await expect(page.locator('text=Yakını / Refakatçi Bilgisi')).toBeVisible()
  await expect(page.locator('text=Özel Durum / Genel Bilgi Notu')).toBeVisible()

  // Fill and submit full new-patient ambulance request
  await page.fill('input[placeholder="Ad Soyad"]', 'E2E Test Hastasi QA')
  await page.fill('input[placeholder="11 haneli TCKN"]', '11122233344')
  await page.fill('input[placeholder="05XX XXX XX XX"]', '05551112233')
  await page.fill('input[placeholder="Tam açık adres"]', 'Test Mah. E2E Sok. No:1')

  await page.click('button[type="submit"]:text("Kaydı Sisteme Ekle")')
  await page.waitForTimeout(800)
  console.log('PASS: Yeni Talep - özel durum hastası formu tam dolduruldu ve gönderildi')

  // Verify it actually landed in the real operations data by searching for it in Hasta Sorgula
  // (the modal closed back onto the lookup tab; its search box still has the old "99999999999").
  await lookupInput.fill('11122233344')
  await page.waitForTimeout(400)
  await expect(page.locator('text=E2E Test Hastasi QA').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=Test Mah. E2E Sok').first()).toBeVisible()
  console.log('PASS: Yeni kayıt gerçek operasyon verisine yazıldı ve Hasta Sorgula üzerinden anında bulunabiliyor (uçtan uca kabul kriteri)')

  // --- 3) Ajanda: tarih seçici + günün hastaları + atama bekleyenler ---
  await page.click('text=Operasyon Ajandası & Gantt')
  await page.waitForTimeout(500)
  await expect(page.locator('text=Günün Hastaları')).toBeVisible()
  await expect(page.locator('text=Atama Bekleyenler')).toBeVisible()
  // op-4 (Hüseyin Demirci) is unassigned in mock data -> must show in bekleyenler
  await expect(page.locator('text=Hüseyin Demirci').first()).toBeVisible()
  console.log('PASS: Ajanda - atanmamış hasta (Hüseyin Demirci) Atama Bekleyenler panelinde görünüyor')

  // Navigate to tomorrow and verify a different patient set (Canberk Tan) appears
  await page.click('button[aria-label="Sonraki gün"]')
  await page.waitForTimeout(800)
  await expect(page.locator('text=Canberk Tan').first()).toBeVisible()
  console.log('PASS: Ajanda - gün ileri alındığında farklı günün hastası (Canberk Tan) listeleniyor, gerçek gün filtrelemesi çalışıyor')

  // --- 4) Şoför Mobil Terminali: güzergah/kat/gidiş-dönüş bilgisi + SMS hazırlığı şoförün
  // kendi telefon ekranında da görünmeli (kullanıcı isteği) ---
  await page.click('text=Şoför Mobil Terminali')
  await page.waitForTimeout(500)
  // Yeni eklenen test hastası listeye en başa eklendiği için varsayılan seçim artık o olabilir;
  // bilinen kat/asansör notu olan görevi (Ali Kemal Yıldırım, AMB-2026-000125) açıkça seçiyoruz.
  // Görev Seç alanı özel bir combobox (gerçek <select> değil) — açıp seçeneğe tıklıyoruz.
  await page.getByLabel('Görev Seç').click()
  await page.waitForTimeout(200)
  await page.locator('text=/AMB-2026-000125/').first().click()
  await page.waitForTimeout(400)
  await expect(page.locator('text=Güzergahı Aç').first()).toBeVisible()
  await expect(page.locator('text="Geliyoruz" SMS').first()).toBeVisible()
  await expect(page.locator('text=/Gidiş-Dönüş/').first()).toBeVisible()
  await expect(page.locator('text=Asansör').first()).toBeVisible()
  console.log('PASS: Şoför Mobil Terminali - kat/asansör notu ve gidiş-dönüş bilgisi şoförün ekranında görünüyor')

  await page.click('text="Geliyoruz" SMS')
  await page.waitForTimeout(400)
  await expect(page.locator('text=SMS Gönder').first()).toBeVisible()
  await expect(page.locator('text=Yaklaştık (20 dk)').first()).toBeVisible()
  console.log('PASS: Şoför Mobil Terminali - "Geliyoruz" SMS hazırlık modalı açılıyor')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // --- 5) DataTable pagination sanity on Istanbul Hospitals (51 kayıt) ---
  await page.click('text=İstanbul Hastaneleri & Rotalar')
  await page.waitForTimeout(500)
  await expect(page.locator('text=/sayfa başına/i').first()).toBeVisible()
  console.log('PASS: Hastaneler tablosu DataTable sayfalama bileşenini gösteriyor (51 kayıt > 1 sayfa)')

  // --- 6) Diğer DataTable dönüşümleri: Başvuru & Evrak İnceleme, Filo/Ekip, Denetim İzi ---
  await page.click('text=Başvuru & Evrak İnceleme')
  await page.waitForTimeout(400)
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.locator('text=/sayfa başına/i').first()).toBeVisible()
  console.log('PASS: Başvuru & Evrak İnceleme tablosu DataTable (satır no + sayfalama) gösteriyor')

  await page.click('text=Filo, Ekip & Bakım')
  await page.waitForTimeout(400)
  await page.click('text=Ekipler ve Vardiyalar')
  await page.waitForTimeout(400)
  await expect(page.locator('tbody tr').first()).toBeVisible()
  console.log('PASS: Ekipler ve Vardiyalar DataTable gösteriyor')

  await page.click('text=Denetim İzi')
  await page.waitForTimeout(400)
  await expect(page.locator('thead').first()).toBeVisible()
  await expect(page.locator('tbody tr').first()).toBeVisible()
  console.log('PASS: Denetim İzi DataTable gösteriyor')

  // --- 7) Tıp Merkezi & Poliklinik ve Evde Sağlık sekmeleri de DataTable'a geçti ---
  await page.goto('http://localhost:3000/saglik?tab=polyclinic')
  await page.waitForTimeout(800)
  await expect(page.locator('thead [role="checkbox"]').first()).toBeVisible()
  await expect(page.locator('text=/sayfa başına/i').first()).toBeVisible()
  console.log('PASS: Tıp Merkezi & Poliklinik tablosu DataTable (checkbox + sayfalama) gösteriyor')

  await page.goto('http://localhost:3000/saglik?tab=homeHealth')
  await page.waitForTimeout(800)
  await expect(page.locator('thead [role="checkbox"]').first()).toBeVisible()
  await expect(page.locator('text=/sayfa başına/i').first()).toBeVisible()
  console.log('PASS: Evde Sağlık & Yaşlı Bakım tablosu DataTable (checkbox + sayfalama) gösteriyor')
})

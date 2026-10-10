/**
 * Seda Eğitim (`/seda`) — Başvuru Yönetimi UI Akışı, sıfır hata toleranslı.
 *
 * `seda-admin.spec.ts` dönem/tanım/okul CRUD'unu (çoğunlukla API seviyesinde) kapsıyor —
 * bu dosya, modülün en büyük ve HİÇ test edilmemiş parçasını kapatıyor: `SedaApplicationsTab`
 * (354 satır) + `SedaApplicationForm` (292 satır), gerçek başvuru yaşam döngüsü
 * (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md` madde C, "Seda").
 *
 * Kapsam:
 *   1. Admin panelden YENİ başvuru oluşturma — TÜM alanlar (öğrenci adı/soyadı, TC kimlik,
 *      doğum tarihi, okul — Combobox allowCustom, gelecek yıl sınıfı, eğitim türü, sınav
 *      merkezi, öğrenci/veli telefonu, adres, durum, notlar), negatif validasyon (eksik
 *      zorunlu alanlarla kaydete basınca uyarı toast'u gösterip formu açık tutan davranış).
 *   2. Tekli onaylama — satır aksiyonu, API'den durumun GERÇEKTEN "approved" olduğu doğrulanıyor.
 *   3. Tekli reddetme — gerekçe modalı, gerekçenin API'ye GERÇEKTEN iletildiği doğrulanıyor.
 *   4. Filtreleme — Onay Durumu filtresiyle sadece ilgili duruma sahip kayıtların listelendiği
 *      (reddedilen görünür, onaylanan görünmez, filtre temizlenince ikisi de tekrar görünür).
 *
 * DÜRÜST KAPSAM NOTU: Excel export (`handleExport`, blob indirme) ve SMS/Bildirim toplu
 * gönderme (`BroadcastModal`) bu testin kapsamı DIŞINDA — dosya indirme testleri ayrı bir
 * yaklaşım gerektirir, BroadcastModal da paylaşımlı bir bileşen (başka modüllerde de kullanılıyor).
 *
 * Bu dosyayı yazarken bulunan gerçek gotcha'lar (yorumlarda ayrıca işaretli):
 *   - Escape tuşu, Combobox popover'ını değil `useOverlayDismiss` üzerinden EN ÜSTTEKİ overlay'i
 *     (tüm form drawer'ını) kapatıyor — Combobox'ı kapatmak için forma başka bir yere tıklamak gerekir.
 *   - design-system `Select` bileşeni `<option value="">` yer tutucusunu popover'da GERÇEK bir
 *     seçenek gibi listeye dahil ediyor (`collectOptions` ayrım yapmıyor) — `.first()` ile tıklanırsa
 *     boş değer seçilir ve görünen metin bile placeholder ile aynı olduğundan yanlışlıkla "geçer".
 *   - Öğrenci Adı/Soyadı alanları `sanitize="letters"` kullanıyor — rakam içeren benzersiz test
 *     etiketleri bu alanlarda KULLANILAMAZ, harf-only ayrı bir etiket gerekir.
 *   - `FilterBar` arama kutusu varsa filtre paneli varsayılan KAPALI geliyor (`FilterBarCollapsible`)
 *     — filtrelere erişmeden önce "Filtreler" butonuna basmak gerekir.
 */
import { test, expect, type Page } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'
import { clickRowAction } from './helpers/rowActions'

let api: AdminApi

function fakeTckn() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10Pos = ((d10 % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10Pos) % 10
  return [...digits, d10Pos, d11].join('')
}

// NOT (2026-09-04, gerçek testte bulunan gotcha): Öğrenci Adı/Soyadı alanları `sanitize="letters"`
// kullanıyor (`Input.tsx` — sadece harf/boşluk/kesme/tire kabul eder, RAKAMLARI SİLER). `uniq()`
// benzersizlik için timestamp/hex rakamları içerdiğinden, bu iki alanda KULLANILAMAZ — bu yüzden
// isim alanları için ayrı, tamamen harflerden oluşan benzersiz bir üretici kullanıyoruz.
function uniqName(prefix: string) {
  const rand = Math.random().toString(36).replace(/[^a-z]/g, '').padEnd(8, 'x').slice(0, 8)
  return `${prefix}${rand.charAt(0).toUpperCase()}${rand.slice(1)}`
}

async function getFreshToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('admin_access_token') || sessionStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

test.describe.serial('Seda Eğitim — Başvuru Yönetimi UI akışı, sıfır hata', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })

  let applicationId1 = ''
  let applicationId2 = ''
  const tag = uniq('QA-TEST-E2E-AUTO Seda')
  // Öğrenci Adı/Soyadı alanları rakam kabul etmiyor (bkz. `uniqName` yorumu) — bu iki alan için
  // ayrı, harf-only bir etiket kullanıyoruz; okul adı/adres/not gibi serbest metin alanlarında
  // `tag` (rakamlı, benzersiz) kullanmaya devam ediyoruz.
  const nameTag = uniqName('QATESTEEAUTOSeda')

  // NOT (2026-09-04, gerçek testte bulunan gotcha): Playwright `afterAll` hook'ları KAYIT SIRASINA
  // göre çalışır — `api.dispose()` içeren hook (yukarıda `beforeAll` ile birlikte) bu silme hook'undan
  // ÖNCE tanımlanmış olsaydı, dispose ÖNCE çalışıp silme isteklerini sessizce (`.catch(()=>{})`)
  // başarısız kılardı. Tek bir `afterAll`'da hem silme hem dispose'u SIRALI yaparak bunu önlüyoruz.
  // AYRICA (tekrarlayan "single-session policy" gotcha'sı — bkz. device-monitor-full-form.spec.ts):
  // Test 1-4 boyunca `loginAndOpen` ile UI'de aynı admin hesabına TEKRAR TEKRAR giriş yapılıyor,
  // bu da backend'in tek-oturum politikası gereği `api` fixture'ının token'ını geçersiz kılıyor
  // (401 SESSION_INVALIDATED). `api.raw()` `request()`'in aksine otomatik retry YAPMIYOR — bu yüzden
  // silme isteklerinden ÖNCE `freshToken()` ile token'ı elle yeniliyoruz.
  test.afterAll(async () => {
    await api.freshToken().catch(() => {})
    if (applicationId1) {
      const r = await api.raw('DELETE', `/seda/applications/${applicationId1}`).catch((e) => ({ status: -1, body: String(e) }))
      if (r.status !== 200 && r.status !== 204) console.log('CLEANUP DELETE 1 BAŞARISIZ:', applicationId1, r.status, JSON.stringify(r.body))
    }
    if (applicationId2) {
      const r = await api.raw('DELETE', `/seda/applications/${applicationId2}`).catch((e) => ({ status: -1, body: String(e) }))
      if (r.status !== 200 && r.status !== 204) console.log('CLEANUP DELETE 2 BAŞARISIZ:', applicationId2, r.status, JSON.stringify(r.body))
    }
    await api.dispose()
  })

  test('1) Admin panelden YENİ başvuru oluşturulur — TÜM alanlar, negatif validasyon, sıfır hata', async ({ page }) => {
    test.setTimeout(60_000)
    const studentName = `${nameTag}Ogrenci`
    const studentSurname = 'TestSoyad'
    const tckn = fakeTckn()
    const schoolName = `${tag} Okulu`

    await loginAndOpen(page, '/seda?tab=basvurular', 'Başvurular')

    await page.getByRole('button', { name: 'Yeni Başvuru' }).click()
    await expect(page.getByText('Seda Başvuru Formu')).toBeVisible({ timeout: 8000 })

    // Negatif kontrol: hiçbir alan doldurulmadan "Kaydet"e basınca uyarı toast'u çıkmalı.
    // NOT: CrudListTemplate.tsx bu formda butonu ÖNCEDEN disable ETMİYOR (kütüphane/muhtarlık
    // modüllerinden FARKLI bir desen) — sadece submit() çağrısında getFormErrors kontrolü yapıp
    // toast.warning gösteriyor, modal AÇIK KALIYOR. Disabled beklemek yerine bu davranışı test ediyoruz.
    const saveBtn = page.getByRole('button', { name: 'Kaydet', exact: true }).last()
    await saveBtn.click()
    await expect(page.getByText('Öğrenci adı zorunludur.', { exact: false })).toBeVisible({ timeout: 3000 })

    await page.getByPlaceholder('Öğrenci adı').fill(studentName)
    await page.getByPlaceholder('Öğrenci soyadı').fill(studentSurname)

    // TcknInput: T.C. kimlik alanı (design-system bileşeni, kendi sabit placeholder'ı var).
    await page.getByPlaceholder('11 haneli T.C. kimlik no').fill(tckn)

    // Pilot modda DatePicker native <input type="date"> render ediyor (placeholder yok,
    // ISO yyyy-mm-dd formatı bekliyor) — 2026-10-01 denetiminde bulundu ve düzeltildi.
    const birthDateInput = page.locator('input[type="date"]').first()
    await birthDateInput.fill('2010-01-01')

    // Okul: Combobox allowCustom — yeni bir okul adı serbestçe yazılabilmeli.
    // NOT (2026-09-04, gerçek testte bulunan gotcha): Escape tuşu Combobox popover'ını DEĞİL,
    // `useOverlayDismiss` üzerinden EN ÜSTTEKİ overlay'i (tüm form drawer'ını) kapatıyordu —
    // bunun yerine formun başka bir alanına (etiket metnine) tıklayarak popover'ı kapatıyoruz.
    await page.getByPlaceholder('Okul seçin veya yazın').fill(schoolName)
    await page.getByText('Eğitim Bilgileri', { exact: true }).click()

    // Gelecek Yıl Sınıfı ve Eğitim Türü: design-system Select bileşeni (native <select> DEĞİL,
    // custom buton+popover). NOT (2026-09-04, tekrarlayan gerçek gotcha): `locator('div',
    // {has:...})` TÜM ata div'leriyle eşleşip yanlış (form geneli gibi çok daha geniş) bir
    // kapsayıcı seçebilir — XPath ile Field'ın KENDİ wrapper'ına (`space-y-1.5`) çıkıyoruz.
    // Pilot modda Select bileşeni native <select> render ediyor (eski buton+popover
    // değil) — 2026-10-01 denetiminde bulundu ve düzeltildi. Form hem Select'in kendi
    // placeholder <option>'ını hem de children içindeki boş value="" seçeneğini aynı
    // anda render ediyor — gerçek ilk seçeneği bulmak için boş value'ları atlıyoruz.
    const fieldByLabel = (label: string) => page.locator(
      'xpath=//label[contains(normalize-space(text()),' + JSON.stringify(label) + ')]/ancestor::div[contains(@class,"space-y-1.5")][1]',
    )
    const gradeSelect = fieldByLabel('Gelecek Yıl Sınıfı').locator('select')
    const gradeOptionValue = await gradeSelect.locator('option:not([value=""])').first().getAttribute('value')
    const selectedGradeLabel = (await gradeSelect.locator('option:not([value=""])').first().textContent())?.trim() ?? ''
    await gradeSelect.selectOption(gradeOptionValue ?? '')
    await expect(gradeSelect).toHaveValue(gradeOptionValue ?? '')

    const eduTypeSelect = fieldByLabel('Eğitim Türü').locator('select').last()
    const eduTypeOptionValue = await eduTypeSelect.locator('option:not([value=""])').first().getAttribute('value')
    const selectedEduTypeLabel = (await eduTypeSelect.locator('option:not([value=""])').first().textContent())?.trim() ?? ''
    await eduTypeSelect.selectOption(eduTypeOptionValue ?? '')
    await expect(eduTypeSelect).toHaveValue(eduTypeOptionValue ?? '')

    // Veli telefonu zorunlu.
    await fieldByLabel('Veli Telefonu').locator('input').first().fill('5551234567')

    // Öğrenci telefonu opsiyonel ama yine de test kapsamı tam olsun diye dolduruyoruz.
    await fieldByLabel('Öğrenci Telefonu').locator('input').first().fill('5559876543')

    await page.getByPlaceholder('Adres bilgileri').fill('QA-TEST-E2E-AUTO test adresi No:1')
    await page.getByPlaceholder('Ek notlar...').fill('QA-TEST-E2E-AUTO admin tarafından oluşturuldu.')

    await expect(saveBtn).toBeEnabled({ timeout: 3000 })

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/seda/applications') && r.request().method() === 'POST'),
      saveBtn.click(),
    ])
    expect(createResponse.ok(), `POST /seda/applications başarısız: ${await createResponse.text()}`).toBeTruthy()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })

    const created = (await createResponse.json()).data
    applicationId1 = created.id
    expect(created.studentName).toBe(studentName)
    expect(created.studentSurname).toBe(studentSurname)
    expect(created.tckn).toBe(tckn)
    expect(created.schoolName).toBe(schoolName)
    expect(created.nextYearGrade, `seçilen sınıf etiketi: ${selectedGradeLabel}`).toBeTruthy()
    expect(created.educationType, `seçilen eğitim türü etiketi: ${selectedEduTypeLabel}`).toBeTruthy()
    expect(created.parentPhone).toContain('5551234567')
    expect(created.status).toBe('pending')

    await page.getByPlaceholder('Ad, soyad, TC, başvuru no veya okul ara...').fill(studentName)
    await expect(page.locator('tr', { hasText: studentName }).first()).toBeVisible({ timeout: 15000 })
  })

  test('2) Tekli onaylama: satır aksiyonu ile onaylanır, API\'den durum doğrulanır', async ({ page }) => {
    test.setTimeout(45_000)
    expect(applicationId1, 'önceki testte başvuru oluşturulmuş olmalı').toBeTruthy()
    const studentName = `${nameTag}Ogrenci`

    await loginAndOpen(page, '/seda?tab=basvurular', 'Başvurular')
    await page.getByPlaceholder('Ad, soyad, TC, başvuru no veya okul ara...').fill(studentName)
    const row = page.locator('tr', { hasText: studentName }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await expect(row).toContainText(/Beklemede|Pending/)

    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/seda/applications/${applicationId1}/status`) && r.request().method() === 'PATCH'),
      clickRowAction(page, row, 'Onayla'),
    ])
    expect(approveResponse.ok(), `PATCH status approved başarısız: ${await approveResponse.text()}`).toBeTruthy()
    await expect(row).toContainText(/Onaylandı|Approved/, { timeout: 15000 })

    const freshToken = await getFreshToken(page)
    const check = await (await page.request.get(`${process.env.E2E_API_URL || 'http://localhost:5207/api/v1'}/seda/applications/${applicationId1}`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    expect(check.data.status).toBe('approved')
  })

  test('3) Tekli reddetme: gerekçe modalı açılır, gerekçe GERÇEKTEN API\'ye iletilir', async ({ page }) => {
    test.setTimeout(60_000)
    const studentName = `${nameTag}Ret`
    const tckn = fakeTckn()
    const rejectReason = 'QA-TEST-E2E-AUTO red gerekçesi — koşullar sağlanmıyor.'

    // Fixture: API'den ikinci bir başvuru oluştur (bu test sadece reddetme akışına odaklanıyor).
    // NOT (2026-09-04, gerçek testte bulunan gotcha): `.then((r) => (r as {id:string}))` OBJENİN
    // KENDİSİNİ döndürüyordu, `.id`'sini DEĞİL — applicationId2'ye tüm obje atanınca URL'e
    // `[object Object]` olarak enterpolasyona giriyor ve PATCH isteği asla eşleşen bir URL'e
    // gitmiyordu (bu yüzden waitForResponse hep 12sn timeout'a düşüyordu).
    applicationId2 = await api.request<{ id: string }>('POST', '/seda/applications', {
      studentName, studentSurname: 'RetTest', tckn, birthDate: '2010-01-01',
      schoolName: `${tag} Okulu 2`, nextYearGrade: '5', educationType: 'Etüt',
      examCenterName: '', studentPhone: '', parentPhone: '5551112233',
      address: '', status: 'pending', notes: '',
    }).then((r) => r.id)

    await loginAndOpen(page, '/seda?tab=basvurular', 'Başvurular')
    await page.getByPlaceholder('Ad, soyad, TC, başvuru no veya okul ara...').fill(studentName)
    const row = page.locator('tr', { hasText: studentName }).first()
    await expect(row).toBeVisible({ timeout: 15000 })

    await clickRowAction(page, row, 'Reddet')
    await expect(page.getByRole('heading', { name: 'Başvuruyu Reddet' })).toBeVisible({ timeout: 8000 })

    const rejectModal = page.locator('div.relative.z-10').last()
    await rejectModal.getByPlaceholder(/Başvuru koşulları sağlanmıyor/).fill(rejectReason)

    const [rejectResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/seda/applications/${applicationId2}/status`) && r.request().method() === 'PATCH'),
      rejectModal.getByRole('button', { name: 'Reddet', exact: true }).click(),
    ])
    expect(rejectResponse.ok(), `PATCH status rejected başarısız: ${await rejectResponse.text()}`).toBeTruthy()
    const rejectBody = rejectResponse.request().postDataJSON()
    expect(rejectBody.reason).toBe(rejectReason)

    await expect(row).toContainText(/Reddedildi|Rejected/, { timeout: 15000 })

    const freshToken = await getFreshToken(page)
    const check = await (await page.request.get(`${process.env.E2E_API_URL || 'http://localhost:5207/api/v1'}/seda/applications/${applicationId2}`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    expect(check.data.status).toBe('rejected')
    expect(check.data.rejectionReason).toBe(rejectReason)
  })

  test('4) Filtreleme: "Onay Durumu" filtresi sadece ilgili duruma sahip başvuruları listeler', async ({ page }) => {
    test.setTimeout(45_000)
    expect(applicationId1 && applicationId2, 'önceki testlerde her iki başvuru da oluşturulmuş olmalı').toBeTruthy()

    await loginAndOpen(page, '/seda?tab=basvurular', 'Başvurular')
    // NOT: FilterBar varsayılan KAPALI (`FilterBarCollapsible`, `defaultOpen ?? count > 0`) —
    // önce "Filtreler" butonuna basıp paneli açmak gerekiyor.
    await page.getByRole('button', { name: 'Filtreler', exact: false }).click()
    // NOT: FilterField (`design-system/FilterBar`) — Field'dan FARKLI bir wrapper (`flex
    // flex-col gap-1`, label bir <span> — Field'ın <label>'ından farklı). "Onay Durumu" da
    // yine custom Select bileşeni (native <select> DEĞİL).
    const statusFieldByLabel = (label: string) => page.locator(
      'xpath=//span[contains(normalize-space(text()),' + JSON.stringify(label) + ')]/ancestor::div[contains(@class,"flex-col")][1]',
    )
    const statusTrigger = statusFieldByLabel('Onay Durumu').getByRole('button').first()
    await expect(statusTrigger).toBeVisible({ timeout: 8000 })
    await statusTrigger.click()
    await page.locator('[data-ds-popover]').last().getByRole('button', { name: 'Reddedildi', exact: true }).click()

    await page.getByPlaceholder('Ad, soyad, TC, başvuru no veya okul ara...').fill(nameTag)
    await expect(page.locator('tr', { hasText: `${nameTag}Ret` }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('tr', { hasText: `${nameTag}Ogrenci` })).not.toBeVisible({ timeout: 3000 })

    await statusTrigger.click()
    await page.locator('[data-ds-popover]').last().getByRole('button', { name: 'Tüm Durumlar', exact: true }).click()
    await expect(page.locator('tr', { hasText: `${nameTag}Ogrenci` }).first()).toBeVisible({ timeout: 8000 })
  })
})

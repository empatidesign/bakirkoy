import { test, expect, Page, Locator } from '@playwright/test'
import { login } from './helpers/auth'

const RATIO_TOLERANCE = 0.03
const PX_TOLERANCE = 3

async function makeJpegBuffer(page: Page, w: number, h: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(([cw, ch]) => {
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, cw, ch)
    gradient.addColorStop(0, '#1d4ed8')
    gradient.addColorStop(1, '#f59e0b')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, cw, ch)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 64px sans-serif'
    ctx.fillText(`${cw}x${ch}`, 40, 100)
    return canvas.toDataURL('image/jpeg', 0.9)
  }, [w, h] as const)
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

function uploaderSection(page: Page, labelPrefix: string): Locator {
  return page.locator(`div.space-y-2:has(> p.type-label:has-text("${labelPrefix}"))`).first()
}

async function openNewEventForm(page: Page) {
  await login(page)
  await page.goto('/events?tab=events')
  await expect(page.getByText('Etkinlikler').first()).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'Yeni Etkinlik' }).click()
  await expect(page.getByText('Yoklama ve Erişim Kurulumu')).toBeVisible()
  await page.getByText('Yoklama yok').click()
  await page.getByRole('button', { name: /Devam Et/ }).click()
  await expect(page.getByText('Yeni Etkinlik Ekle')).toBeVisible({ timeout: 15000 })
}

async function boxes(section: Locator) {
  const viewport = await section.locator('div.relative.overflow-hidden').first().boundingBox()
  const img = await section.locator('img').first().boundingBox()
  expect(viewport).not.toBeNull()
  expect(img).not.toBeNull()
  return { viewport: viewport!, img: img! }
}

test.describe('Etkinlik görsel kırpma alanı', () => {
  test('16:9 alanına oranı eşleşmeyen 1920x1000 görsel cover-fit oturur, zoom in/out çalışır, kırp-kaydet yükler', async ({ page }) => {
    await openNewEventForm(page)

    const section = uploaderSection(page, '16:9 —')
    await section.scrollIntoViewIfNeeded()
    // NOT (2026-09-06, gerçek davranış değişikliği bulundu): EventImageUploader artık
    // yüklenen görselin oranı hedef oranla (16:9) tam eşleşirse (fark < 0.01) crop
    // modalını hiç açmadan otomatik kırpıp yüklüyor (autoCropAndUpload) — gereksiz bir
    // manuel adımı atlayan kasıtlı bir UX iyileştirmesi. Tam 1920x1080 (16/9=1.7778)
    // artık crop UI'sini (slider, zoom, pan) hiç göstermiyor. Bu test crop UI'sinin
    // KENDİSİNİ doğruluyor, bu yüzden belirgin farklı bir oranla (1920x1000, oran=1.92,
    // hedeften daha GENİŞ, fark ~0.14 eşiğin çok üstünde) crop modalını gerçekten
    // tetikliyoruz. Görsel hedeften daha geniş olduğu için cover-fit'te YÜKSEKLİK
    // viewport'a eşitlenir, GENİŞLİK taşar (orijinaldeki "ikisi de eşit" varsayımı
    // sadece oran tam eşleşmesinde geçerliydi).
    const buffer = await makeJpegBuffer(page, 1920, 1000)
    await section.locator('input[type=file]').setInputFiles({ name: 'kapak-1920x1000.jpg', mimeType: 'image/jpeg', buffer })

    const slider = section.locator('input[type=range]')
    await expect(slider).toBeVisible()

    await expect.poll(async () => (await boxes(section)).img.width, { timeout: 5000 }).toBeGreaterThan(10)

    const initial = await boxes(section)
    const vpRatio = initial.viewport.width / initial.viewport.height
    expect(Math.abs(vpRatio - 16 / 9)).toBeLessThan(RATIO_TOLERANCE)
    expect(Math.abs(initial.img.height - initial.viewport.height)).toBeLessThanOrEqual(PX_TOLERANCE)
    expect(initial.img.width).toBeGreaterThan(initial.viewport.width - PX_TOLERANCE)

    await slider.fill('2')
    await expect.poll(async () => (await boxes(section)).img.width).toBeGreaterThan(initial.viewport.width * 1.9)

    await slider.fill('1')
    // NOT: zoom=1'e dönünce görsel viewport genişliğine değil, kendi başlangıç
    // (cover-fit) genişliğine döner — bu artık viewport'tan farklı olabilir
    // (görsel hedeften daha geniş olduğu için taşan kısım var, bkz. yukarıdaki not).
    await expect.poll(async () => Math.abs((await boxes(section)).img.width - initial.img.width)).toBeLessThanOrEqual(PX_TOLERANCE)

    const vpCenter = {
      x: initial.viewport.x + initial.viewport.width / 2,
      y: initial.viewport.y + initial.viewport.height / 2,
    }
    await page.mouse.move(vpCenter.x, vpCenter.y)
    await page.mouse.wheel(0, -500)
    await expect.poll(async () => (await boxes(section)).img.width).toBeGreaterThan(initial.viewport.width * 1.5)
    await page.mouse.wheel(0, 500)
    await expect.poll(async () => Math.abs((await boxes(section)).img.width - initial.img.width)).toBeLessThanOrEqual(PX_TOLERANCE)

    await section.getByRole('button', { name: 'Kırp ve Kaydet' }).click()
    await expect(section.getByText('Yüklü')).toBeVisible({ timeout: 20000 })
  })

  test('9:16 alanı oranını korur, yatay görselde kaydırma sınırları kilitler', async ({ page }) => {
    await openNewEventForm(page)

    const section = uploaderSection(page, '9:16 —')
    await section.scrollIntoViewIfNeeded()
    const buffer = await makeJpegBuffer(page, 1920, 1080)
    await section.locator('input[type=file]').setInputFiles({ name: 'yatay-1920x1080.jpg', mimeType: 'image/jpeg', buffer })

    await expect(section.locator('input[type=range]')).toBeVisible()
    await expect.poll(async () => (await boxes(section)).img.width, { timeout: 5000 }).toBeGreaterThan(10)

    const initial = await boxes(section)
    const vpRatio = initial.viewport.width / initial.viewport.height
    expect(Math.abs(vpRatio - 9 / 16)).toBeLessThan(RATIO_TOLERANCE)
    expect(Math.abs(initial.img.height - initial.viewport.height)).toBeLessThanOrEqual(PX_TOLERANCE)
    expect(initial.img.width).toBeGreaterThan(initial.viewport.width)

    const vpCenter = {
      x: initial.viewport.x + initial.viewport.width / 2,
      y: initial.viewport.y + initial.viewport.height / 2,
    }
    await page.mouse.move(vpCenter.x, vpCenter.y)
    await page.mouse.down()
    await page.mouse.move(vpCenter.x + 3000, vpCenter.y, { steps: 5 })
    await page.mouse.up()

    const dragged = await boxes(section)
    expect(Math.abs(dragged.img.x - dragged.viewport.x)).toBeLessThanOrEqual(PX_TOLERANCE)
    expect(dragged.img.x + dragged.img.width).toBeGreaterThanOrEqual(dragged.viewport.x + dragged.viewport.width - PX_TOLERANCE)

    await section.getByRole('button', { name: 'Vazgeç' }).click()
    await expect(section.getByText('Dosya seç veya sürükle')).toBeVisible()
  })

  test('16:9 alanına oranı TAM eşleşen 1920x1080 görsel crop modalı hiç açılmadan otomatik yüklenir', async ({ page }) => {
    // Bu, event-image-crop.spec.ts'in ilk yazıldığı andan sonra eklenen gerçek bir
    // davranış (autoCropAndUpload) — oran tam eşleşirse (fark < 0.01) manuel crop adımı
    // atlanıyor. Diğer testler artık bunu kasıtlı olarak devre dışı bırakan (oranı
    // hafifçe farklı) görseller kullanıyor; bu test asıl "tam eşleşme" yolunun
    // kendisini doğruluyor.
    await openNewEventForm(page)
    const section = uploaderSection(page, '16:9 —')
    await section.scrollIntoViewIfNeeded()
    const buffer = await makeJpegBuffer(page, 1920, 1080)
    await section.locator('input[type=file]').setInputFiles({ name: 'kapak-tam-16-9.jpg', mimeType: 'image/jpeg', buffer })

    // Crop UI'sı (slider) hiç görünmemeli — doğrudan yüklenmeli.
    await expect(section.locator('input[type=range]')).not.toBeVisible({ timeout: 2000 })
    await expect(section.getByText('Yüklü')).toBeVisible({ timeout: 20000 })
  })
})

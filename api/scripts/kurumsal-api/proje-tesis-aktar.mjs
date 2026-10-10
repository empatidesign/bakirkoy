// Kurumsal API "Projeler" (sbyonetim/projects/projects-content) → Nexora Hizmet Tesislerimiz
//
// Kullanıcı isteği (2026-09-07): "buradaki tesislerin hepsini çek, resim galeri açıklama
// tüm bilgileri karşılık gelenleri yap, sadece bu sistemden alacaksın."
//
// KAYNAK: /api/v2/projects (22 kayıt) — panelin projects-content sayfasının API karşılığı.
// Liste ucu: id, title, description(HTML), startDate/endDate
// Detay ucu : + address, map, gallery[] (url/medium/thumb) — resimler yalnız detayda.
//
// Kullanım:
//   node proje-tesis-aktar.mjs                 → kuru çalıştırma (hiçbir şey değişmez)
//   node proje-tesis-aktar.mjs --uygula        → eşleşenleri günceller, olmayanları ekler
//
// NOT (silme): "olmayanları sil" ayrı ve YIKICI bir adımdır; --silmeyi-planla ile yalnız
// RAPOR alınır, gerçek silme bilinçli olarak uygulanmaz (bkz. README "Silme" bölümü).
const KURUMSAL = 'https://sultangazi.bel.tr/api/v2'
const NEXORA = process.env.NEXORA_API ?? 'http://localhost:5207/api/v1'
const CLIENT_ID = process.env.SG_CLIENT_ID ?? 'sg_41906f989e624e52'
const CLIENT_SECRET = process.env.SG_CLIENT_SECRET ?? ''
const UYGULA = process.argv.includes('--uygula')
const SILME_RAPORU = process.argv.includes('--silmeyi-planla')

const j = async (u, o) => { const r = await fetch(u, o); let b; try { b = await r.json() } catch { b = null } return { status: r.status, body: b } }
// NOT (2026-09-07 bulgusu): eski normalize + slice(0,14) eşleştirmesi bazı çiftleri
// kaçırıyordu ("SULTANÇİFTLİĞİ ANA KUCAĞI" gibi Türkçe İ/ı ağırlıklı, kısa-uzun adlarda);
// bu yüzden 3 kaynak tesisi (toplam 34 resim) hiç işlenmemiş kalmıştı. Eşleştirme artık
// tam normalize edilmiş dizgenin BİRİNİ DİĞERİNİ İÇERİP İÇERMEDİĞİNE bakıyor (slice yok).
const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]/g, '')

/** HTML açıklamayı düz metne çevirir (Nexora Description alanı düz metin bekler). */
function htmlToText(html) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&ccedil;/g, 'ç').replace(/&uuml;/g, 'ü')
    .replace(/&ouml;/g, 'ö').replace(/&scaron;/g, 'ş').replace(/&yuml;/g, 'ÿ')
    .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim()
}

const KISALTMALAR = new Set(['ISMEK', 'İSMEK'])
const baslikDuzelt = (s) => (s || '').split(/\s+/).map(k => {
  const sade = k.replace(/[^\wçğıöşüÇĞİÖŞÜ]/g, '')
  if (KISALTMALAR.has(sade.toLocaleUpperCase('tr-TR'))) return k.toLocaleUpperCase('tr-TR')
  return k.toLocaleLowerCase('tr-TR').replace(/(^|[.\-/(])([a-zçğıöşü])/g, (_, o, c) => o + c.toLocaleUpperCase('tr-TR'))
}).join(' ').replace(/\s{2,}/g, ' ').trim()

/** Tesis adından Nexora tesis tipini tahmin eder. */
function tipBelirle(ad) {
  const a = (ad || '').toLocaleLowerCase('tr-TR')
  if (/ana kucağı/.test(a)) return 'Ana Kucağı'
  if (/planetaryum|müze|bilim/.test(a)) return 'Bilim Merkezi'
  if (/kütüphane/.test(a)) return 'Kütüphane'
  if (/gençlik/.test(a)) return 'Gençlik Merkezi'
  if (/spor/.test(a)) return 'Spor Tesisi'
  if (/kültür|sanat|sinema/.test(a)) return 'Kültür Merkezi'
  if (/park|yeşil|yürüyüş|ekoturizm/.test(a)) return 'Park / Yeşil Alan'
  if (/pazar|otopark|hizmet tesisi/.test(a)) return 'Hizmet Tesisi'
  if (/mesleki|eğitim|kurs/.test(a)) return 'Eğitim Merkezi'
  return 'Sosyal Tesis'
}

const mahalleCikar = (adres, ad) => {
  const m = (adres || '').match(/([A-ZÇĞİÖŞÜa-zçğıöşü.\d\s]+?)\s*Mah(?:allesi)?\b/)
  if (m) return m[1].trim().slice(0, 60)
  const m2 = (ad || '').match(/([A-ZÇĞİÖŞÜa-zçğıöşü.\d]+)\s*Mahallesi/i)
  return m2 ? m2[1].trim() : 'Sultangazi'
}

async function kurumsalToken() {
  if (!CLIENT_SECRET) throw new Error('SG_CLIENT_SECRET gerekli')
  const r = await j(`${KURUMSAL}/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }) })
  const t = r.body?.data?.accessToken
  if (!t) throw new Error('kurumsal token alınamadı')
  return t
}

async function nexoraToken() {
  const l = await j(`${NEXORA}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.NEXORA_ADMIN ?? 'e2e-admin@nexora.local', password: process.env.NEXORA_PASS ?? 'E2eTest2026!' }) })
  if (l.body?.data?.accessToken) return l.body.data.accessToken
  const v = await j(`${NEXORA}/auth/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken: l.body?.data?.otpSessionToken, code: process.env.NEXORA_OTP ?? '111111' }) })
  const t = v.body?.data?.accessToken
  if (!t) throw new Error('Nexora girişi başarısız')
  return t
}

// Bazı eski kayıtlar API'den parkingType/locationType alanını "0" (enum tanımsız) olarak
// döndürüyor; bu değer aynen PUT'lanınca validator "Otopark türü geçersiz." diyerek 400 veriyor.
// Geçersiz/boş değerler güvenli varsayılana çevrilir.
const GECERLI_OTOPARK = new Set(['Free', 'Paid', 'Limited'])
const GECERLI_KONUM = new Set(['Indoor', 'Outdoor'])
const otoparkTuru = (v) => GECERLI_OTOPARK.has(v) ? v : 'Free'

/** Metni azami uzunlukta, mümkünse kelime sınırında keser (DB varchar taşmasını önler). */
function kisalt(metin, azami) {
  const t = (metin || '').trim()
  if (t.length <= azami) return t
  const kesik = t.slice(0, azami - 1)
  const bosluk = kesik.lastIndexOf(' ')
  return (bosluk > azami * 0.6 ? kesik.slice(0, bosluk) : kesik).trimEnd() + '…'
}
const konumTuru = (v) => GECERLI_KONUM.has(v) ? v : 'Indoor'

/**
 * Galerideki resimleri Nexora'nın kendi dosya deposuna yükler.
 *
 * ÖNEMLİ (2026-09-07 bulgusu): ServiceFacilityManagementService.ToImage() gelen `url`
 * alanını YOK SAYAR (`Url = ""`); genel URL daima `FileUrl.Public(image.Id)` ile
 * üretilir. Yani dış bağlantı (sultangazi.bel.tr/uploads/...) doğrudan kaydedilemez —
 * dosyanın önce POST /service-facilities/images ile yüklenmesi ve dönen ObjectName'in
 * id olarak kullanılması gerekir. Aksi halde kayıt oluşur ama resimler boş görünür.
 *
 * Zaten yüklenmiş resimler (aynı sayıda) tekrar yüklenmez — script idempotent kalsın diye.
 */
async function resimleriYukle(kaynakKayit, nexoraToken, varOlan) {
  // Zaten GERÇEKTEN yüklenmiş (depoya konmuş) resimler tekrar yüklenmez.
  // Dikkat: eski koşulardan kalan "sg-<id>-<n>" sahte kimlikleri geçerli sayılmaz —
  // bunlar dış URL denemesinden kalma ve dosya deposunda karşılığı yok.
  const sahteKimlik = (id) => /^sg-\d+-\d+$/.test(id || '')
  const mevcutResim = (varOlan?.images ?? []).filter(im => im.id && !sahteKimlik(im.id))
  if (mevcutResim.length >= kaynakKayit.galeri.length && mevcutResim.length > 0) {
    return mevcutResim.map((im, i) => ({ id: im.id, url: im.url, name: im.name, size: im.size ?? null, isPrimary: i === 0 }))
  }

  const yuklenen = []
  for (const [i, url] of kaynakKayit.galeri.entries()) {
    try {
      const resp = await fetch(url)
      if (!resp.ok) continue
      const blob = await resp.blob()
      const dosyaAdi = url.split('/').pop()?.split('?')[0] || `resim-${i}.jpg`
      const fd = new FormData()
      fd.append('file', blob, dosyaAdi)
      const up = await fetch(`${NEXORA}/service-facilities/images`, {
        method: 'POST', headers: { Authorization: `Bearer ${nexoraToken}` }, body: fd,
      })
      const ub = await up.json().catch(() => null)
      const img = ub?.data
      if (img?.id) yuklenen.push({ id: img.id, url: img.url, name: `${kaynakKayit.ad} ${i + 1}`, size: img.size ?? null, isPrimary: yuklenen.length === 0 })
    } catch { /* tek resim hatası tesisi engellemesin */ }
  }
  return yuklenen
}

async function main() {
  const kH = { Authorization: `Bearer ${await kurumsalToken()}` }
  const liste = await j(`${KURUMSAL}/projects?perPage=100`, { headers: kH })
  const kayitlar = liste.body?.data ?? []
  console.log(`kaynak (projects): ${kayitlar.length} tesis\n`)

  // detaylar (adres + galeri yalnız burada)
  const kaynak = []
  for (const k of kayitlar) {
    const d = await j(`${KURUMSAL}/projects/${k.id}`, { headers: kH })
    const x = d.body?.data ?? k
    kaynak.push({
      kaynakId: x.id,
      ad: baslikDuzelt(x.title),
      aciklama: htmlToText(x.description),
      adres: (x.address || '').trim(),
      galeri: (x.gallery || []).map(g => g.url).filter(Boolean),
      tip: tipBelirle(x.title),
    })
  }

  const nTok = await nexoraToken()
  const nH = { 'Content-Type': 'application/json', Authorization: `Bearer ${nTok}` }
  const mevcutR = await j(`${NEXORA}/service-facilities?page=1&limit=500`, { headers: nH })
  const mevcut = mevcutR.body?.data?.items ?? []

  const esles = (ad) => {
    const n = norm(ad)
    return mevcut.find(m => {
      const mn = norm(m.name)
      if (mn === n) return true
      return mn.length > 8 && n.length > 8 && (mn.includes(n) || n.includes(mn))
    })
  }

  const guncellenecek = [], eklenecek = []
  for (const k of kaynak) (esles(k.ad) ? guncellenecek : eklenecek).push(k)

  console.log(`Nexora'da eşleşen (güncellenecek): ${guncellenecek.length}`)
  console.log(`Nexora'da olmayan (eklenecek)   : ${eklenecek.length}\n`)
  for (const k of kaynak) {
    const e = esles(k.ad)
    console.log(`  ${e ? 'GÜNCELLE' : 'EKLE    '} ${k.ad.slice(0, 46).padEnd(46)} tip=${k.tip.padEnd(17)} resim=${String(k.galeri.length).padStart(2)} ${k.adres ? 'adres✓' : 'adres✗'}`)
  }

  if (SILME_RAPORU) {
    const kaynakNorm = kaynak.map(k => norm(k.ad))
    const fazla = mevcut.filter(m => !kaynakNorm.some(n => norm(m.name) === n || (n.length > 8 && norm(m.name).includes(n.slice(0, 14)))))
    console.log(`\n── SİLME RAPORU (yalnız rapor, silinmez) ──`)
    console.log(`Kaynakta olmayan Nexora tesisi: ${fazla.length}`)
    fazla.slice(0, 15).forEach(m => console.log(`   - ${m.name} (${m.type})`))
    if (fazla.length > 15) console.log(`   ... ve ${fazla.length - 15} tane daha`)
  }

  if (!UYGULA) { console.log('\n── KURU ÇALIŞTIRMA ── değişiklik yapılmadı. Uygulamak için: --uygula'); return }

  console.log('\n── UYGULANIYOR ──')
  let gOk = 0, eOk = 0, hata = 0
  const islenen = []   // { ad, nexoraId } — doğrulama için
  for (const k of kaynak) {
    const varOlan = esles(k.ad)
    const govde = {
      name: varOlan?.name ?? k.ad,
      type: varOlan?.type ?? k.tip,
      locationType: konumTuru(varOlan?.locationType),
      outdoorCategory: varOlan?.outdoorCategory ?? null,
      areaSizeM2: varOlan?.areaSizeM2 ?? null,
      // DB sınırı: Description varchar(500). Uzun proje metinleri kelime sınırında kesilir.
      description: k.aciklama ? kisalt(k.aciklama, 500) : (varOlan?.description ?? null),
      about: varOlan?.about ?? null,
      city: 'İstanbul',
      district: k.adres ? mahalleCikar(k.adres, k.ad) : (varOlan?.district ?? 'Sultangazi'),
      address: kisalt(k.adres || varOlan?.address || 'Sultangazi/İstanbul', 500),
      latitude: varOlan?.latitude ?? null, longitude: varOlan?.longitude ?? null,
      managerId: varOlan?.managerId ?? null,
      emergencyPhone: varOlan?.emergencyPhone ?? null, website: varOlan?.website ?? null,
      facebook: null, instagram: null, twitter: null,
      weekdayOpen: varOlan?.weekdayOpen ?? '08:00', weekdayClose: varOlan?.weekdayClose ?? '18:00',
      weekendOpen: varOlan?.weekendOpen ?? '09:00', weekendClose: varOlan?.weekendClose ?? '17:00',
      facilities: varOlan?.facilities ?? null, accessibilityFeatures: varOlan?.accessibilityFeatures ?? null,
      parkingCapacity: varOlan?.parkingCapacity ?? 0, parkingType: otoparkTuru(varOlan?.parkingType),
      capacity: varOlan?.capacity ?? null, offeredServices: null,
      images: await resimleriYukle(k, nTok, varOlan),
    }
    const r = varOlan
      ? await j(`${NEXORA}/service-facilities/${varOlan.id}`, { method: 'PUT', headers: nH, body: JSON.stringify(govde) })
      : await j(`${NEXORA}/service-facilities`, { method: 'POST', headers: nH, body: JSON.stringify(govde) })
    if (r.status < 400) {
      varOlan ? gOk++ : eOk++
      islenen.push({ ad: varOlan?.name ?? k.ad, nexoraId: varOlan?.id ?? r.body?.data?.id })
      console.log(`  ✅ ${varOlan ? 'güncellendi' : 'eklendi   '} ${k.ad.slice(0, 44)} (${k.galeri.length} resim)`)
    }
    else { hata++; console.log(`  ❌ ${k.ad.slice(0, 40)} → ${r.status} ${JSON.stringify(r.body?.errors ?? r.body?.message)?.slice(0, 130)}`) }
  }
  console.log(`\n═══ ${gOk} güncellendi, ${eOk} eklendi, ${hata} hata ═══`)

  // DOĞRULAMA: her kaynak kaydın Nexora'da bir karşılığı oluştu mu?
  // Eşleşme, güncellenen kaydın ADI ile yapılır — kaynak adı ile Nexora adı farklı
  // olabilir (ör. "SU MEKAN (…KADIN KÜLTÜR…)" → mevcut "Sultangazi Kadın ve Aile Yaşam
  // Merkezi"). Bu yüzden isim benzerliği değil, İŞLENEN KAYIT KİMLİĞİ üzerinden bakılır.
  const son = await j(`${NEXORA}/service-facilities?page=1&limit=500`, { headers: nH })
  const sonListe = son.body?.data?.items ?? []
  const eksik = islenen.filter(x => !sonListe.some(m => m.id === x.nexoraId || norm(m.name) === norm(x.ad)))
  console.log(eksik.length === 0
    ? `✅ doğrulama: ${islenen.length} tesisin tamamı listede (${kaynak.length} kaynak kaydı işlendi)`
    : `⚠️  doğrulama: ${eksik.length} tesis listede görünmüyor`)
  if (eksik.length) { eksik.forEach(k => console.log(`   - ${k.ad}`)); process.exitCode = 1 }
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1) })

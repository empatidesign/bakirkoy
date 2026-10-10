#!/usr/bin/env node
// Bakırköy Belediyesi — gerçek kültür merkezi / gençlik merkezi / spor tesisi / sağlık
// merkezi / kütüphane verilerini www.bakirkoy.bel.tr üzerinden araştırıp admin panel
// "Hizmet Tesislerimiz" (service-facilities) modülüne ekleyen tek seferlik script.
// Kullanıcı isteği (2026-10-07): "bakirkoy ilçesinde belediye tesislerini ara... hepsini
// bul hizmet tesislerimiz alanına ekle".

const API = 'http://localhost:34000/api/v1'

async function login() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@nexora.local', password: 'Bakirkoy2026!' }),
  })
  const loginJson = await loginRes.json()
  if (!loginJson.success) throw new Error('login failed: ' + JSON.stringify(loginJson))
  const { otpSessionToken } = loginJson.data
  const otpRes = await fetch(`${API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken, code: '111111' }),
  })
  const otpJson = await otpRes.json()
  if (!otpJson.success) throw new Error('otp failed: ' + JSON.stringify(otpJson))
  return otpJson.data.accessToken
}

const DEFAULT_SCHEDULE = { weekdayOpen: '09:00', weekdayClose: '18:00', weekendOpen: '10:00', weekendClose: '17:00' }

// Kaynak: www.bakirkoy.bel.tr/merkezler/{kultur-merkezleri,spor-tesisleri,saglik-merkezleri,genclik-merkezi}
// + resmi detay sayfaları (adres, açıklama) + kütüphaneler için T.C. Kültür ve Turizm
// Bakanlığı kütüphane müdürlüğü sayfaları. Koordinatlar OpenStreetMap/Nominatim ile
// coğrafi kodlanmıştır (yaklaşık bina/mahalle merkezi).
const FACILITIES = [
  {
    name: 'Yunus Emre Kültür Merkezi',
    type: 'Kültür Merkezi',
    description: "Ataköy 9. Kısım'da 1880'lerde Baruthane olarak kullanılan tarihi yapıda, Müşfik Kenter ve Turhan Tuzcu sahneleri ile iki tiyatro salonu ve Çetin Emeç sergi salonu bulunur.",
    address: 'Ataköy 7-8-9-10. Kısım Mah., Yüzücü Talat Yüzmen Sokağı No:5A',
    emergencyPhone: '0212 414 96 47',
    latitude: 40.9886069, longitude: 28.8483084,
    offeredServices: [{ name: 'Tiyatro Salonu', module: 'service' }, { name: 'Sergi Salonu', module: 'service' }],
  },
  {
    name: 'Tarık Akan Kültür Merkezi',
    type: 'Kültür Merkezi',
    description: '2014 yılından bu yana panel, konferans, konser ve çeşitli sanatsal faaliyetlerle 236 koltuklu sahnesiyle hizmet veren kültür merkezi.',
    address: 'Osmaniye Mah. İsmail Erez Bulvarı No:8',
    emergencyPhone: '0212 414 97 00',
    latitude: 40.9809380, longitude: 28.8541785,
    offeredServices: [{ name: 'Tiyatro Salonu (236 Koltuk)', module: 'service' }],
  },
  {
    name: 'İspirtohane Kültür Merkezi',
    type: 'Kültür Merkezi',
    description: "19. yüzyılda Baruthane-i Amire olarak kullanılan tarihi yapı, İTÜ tarafından restore edilerek Ekim 2000'de Bakırköy Musiki Konservatuvarı olarak hizmete açılmıştır.",
    address: 'Ataköy 7-8-9-10. Kısım Mah., Uğur Mumcu Bulvarı',
    emergencyPhone: '0212 414 97 00',
    latitude: 40.9848452, longitude: 28.8447539,
    offeredServices: [{ name: 'Konservatuvar / Müzik Eğitimi', module: 'service' }],
  },
  {
    name: 'Cumhuriyet Evi',
    type: 'Kültür Merkezi',
    description: 'Fişekhane Caddesi üzerinde, 500 m² açık alan bahçesi olan, haftanın 6 günü açık ve ücretli çay servisi bulunan faaliyet merkezi.',
    address: 'Fişekhane Caddesi No:1',
    emergencyPhone: '0212 414 97 00',
    latitude: 40.9785989, longitude: 28.8680944,
    offeredServices: [{ name: 'Sosyal Etkinlik Alanı', module: 'service' }],
  },
  {
    name: 'Emekliler Evi',
    type: 'Kültür Merkezi',
    description: 'Bakırköy Belediyesi bünyesinde emeklilere yönelik sosyal ve kültürel etkinliklerin düzenlendiği merkez.',
    address: 'Osmaniye Mah. İsmail Erez Bulvarı No:8',
    emergencyPhone: '0212 414 97 00',
    latitude: 40.9966207, longitude: 28.8753616,
    offeredServices: [{ name: 'Emekli Sosyal Etkinlik', module: 'service' }],
  },
  {
    name: 'Yeşilköy Sanat Evi ve Kent Müzesi',
    type: 'Kültür Merkezi',
    description: 'Liman Caddesi İskele Sokak üzerinde, etnografya müzesi içeren, haftanın 7 günü açık ve çay ikramı bulunan tesis.',
    address: 'Yeşilköy Mah., Yeşilköy İskele Caddesi No:34',
    emergencyPhone: '0212 414 97 00',
    latitude: 40.9559647, longitude: 28.8211783,
    offeredServices: [{ name: 'Kent Müzesi', module: 'service' }, { name: 'Sanat Atölyesi', module: 'service' }],
  },
  {
    name: 'Leyla Gencer Opera ve Sanat Merkezi',
    type: 'Kültür Merkezi',
    description: "9 Haziran 2012'de temeli atılan ve Kasım 2013'te tamamlanan, 769 koltuklu sahnesiyle sanatsal faaliyetlere ev sahipliği yapan opera ve sanat merkezi.",
    address: 'Osmaniye Mah., İncirli Yolu Sokak No:20/1',
    emergencyPhone: '0212 414 96 47',
    latitude: 40.9920204, longitude: 28.8813608,
    offeredServices: [{ name: 'Opera Salonu (769 Koltuk)', module: 'service' }],
  },
  {
    name: 'Bakırköy Belediyesi Atatürk Spor ve Yaşam Köyü',
    type: 'Spor Tesisi',
    description: '3 kapalı + 3 açık tenis kortu, 2 futbol sahası, 1 halı saha, 1 kapalı spor salonu ile 1 kapalı yüzme havuzu ve rehabilitasyon merkezinden oluşan spor ve eğitim kompleksi.',
    address: 'Osmaniye Mah. Çolak İbrahim Sokak No:10',
    emergencyPhone: '0212 414 96 00',
    latitude: 40.9940717, longitude: 28.8854603,
    offeredServices: [
      { name: 'Tenis Kortu', module: 'sports' },
      { name: 'Yüzme Havuzu', module: 'sports' },
      { name: 'Kapalı Spor Salonu', module: 'sports' },
      { name: 'Futbol Sahası', module: 'sports' },
    ],
  },
  {
    name: 'Bakırköy Belediyesi Tıp Merkezi',
    type: 'Sağlık Merkezi',
    description: 'Sağlık İşleri Müdürlüğü bünyesinde hafta içi 08.30-16.00 arası; Aile Hekimliği, Kadın Hastalıkları ve Doğum, Göğüs Hastalıkları, Fizik Tedavi ve Rehabilitasyon poliklinikleri ile Diyetisyen ve Psikolojik Danışmanlık hizmeti ücretsiz sunulur.',
    address: 'Sakızağacı Mah. Kennedy Caddesi No:99-101',
    emergencyPhone: '0212 414 97 77',
    weekdayOpen: '08:30', weekdayClose: '16:00', weekendOpen: '', weekendClose: '',
    latitude: 40.9787746, longitude: 28.8806269,
    offeredServices: [
      { name: 'Aile Hekimliği', module: 'service' },
      { name: 'Kadın Hastalıkları ve Doğum', module: 'service' },
      { name: 'Göğüs Hastalıkları', module: 'service' },
      { name: 'Fizik Tedavi ve Rehabilitasyon', module: 'service' },
    ],
  },
  {
    name: 'İsmail Hakkı Tonguç Gençlik Merkezi',
    type: 'Gençlik Merkezi',
    description: 'Bakırköy Belediyesi Gençlik ve Spor Hizmetleri Müdürlüğü bünyesinde gençlere yönelik eğitim ve sosyal etkinlik merkezi.',
    address: 'Osmaniye Mah. İsmail Erez Bulvarı No:8',
    emergencyPhone: '0212 414 97 00',
    latitude: 40.9966207, longitude: 28.8753616,
    offeredServices: [{ name: 'Gençlik Etkinlikleri', module: 'service' }],
  },
  {
    name: 'Bakırköy Rıfat Ilgaz İlçe Halk Kütüphanesi',
    type: 'Kütüphane',
    description: 'T.C. Kültür ve Turizm Bakanlığı bünyesinde, Bakırköy ilçesine hizmet veren ilçe halk kütüphanesi.',
    address: 'Kartaltepe Mah. Yavuklular Sokak No:2',
    emergencyPhone: '0212 542 40 81',
    latitude: 40.9852114, longitude: 28.8759551,
    offeredServices: [{ name: 'Kütüphane', module: 'library' }],
  },
  {
    name: 'Bakırköy Doğan Hızlan Halk Kütüphanesi',
    type: 'Kütüphane',
    description: 'T.C. Kültür ve Turizm Bakanlığı bünyesinde, Cevizlik Mahallesi İstanbul Caddesi üzerinde hizmet veren halk kütüphanesi.',
    address: 'Cevizlik Mah. İstanbul Caddesi No:38',
    emergencyPhone: '0212 414 97 00',
    latitude: 40.9785615, longitude: 28.8768060,
    offeredServices: [{ name: 'Kütüphane', module: 'library' }],
  },
]

function toServiceOffering(s, idx) {
  return { id: `bakirkoy-seed-${idx}`, catalogId: null, name: s.name, module: s.module, description: null, active: true }
}

async function createFacility(token, f, idx) {
  const body = {
    name: f.name,
    type: f.type,
    locationType: 'Indoor',
    outdoorCategory: undefined,
    areaSizeM2: undefined,
    description: f.description,
    about: undefined,
    city: 'İstanbul',
    district: 'Bakırköy',
    address: f.address,
    latitude: f.latitude,
    longitude: f.longitude,
    managerId: undefined,
    emergencyPhone: f.emergencyPhone,
    website: undefined,
    facebook: undefined,
    instagram: undefined,
    twitter: undefined,
    weekdayOpen: f.weekdayOpen ?? DEFAULT_SCHEDULE.weekdayOpen,
    weekdayClose: f.weekdayClose ?? DEFAULT_SCHEDULE.weekdayClose,
    weekendOpen: f.weekendOpen ?? DEFAULT_SCHEDULE.weekendOpen,
    weekendClose: f.weekendClose ?? DEFAULT_SCHEDULE.weekendClose,
    facilities: [],
    accessibilityFeatures: [],
    parkingCapacity: 0,
    parkingType: undefined,
    capacity: undefined,
    offeredServices: (f.offeredServices || []).map((s, i) => toServiceOffering(s, `${idx}-${i}`)),
    images: [],
    grantAccess: false,
  }
  const res = await fetch(`${API}/service-facilities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return { name: f.name, ok: res.ok && json.success, status: res.status, json }
}

async function main() {
  const token = await login()
  console.log('Giriş başarılı, token alındı.')
  for (const [idx, f] of FACILITIES.entries()) {
    const result = await createFacility(token, f, idx)
    if (result.ok) {
      console.log(`✓ ${result.name} -> ${result.json.data.id}`)
    } else {
      console.error(`✗ ${result.name} (status ${result.status}):`, JSON.stringify(result.json))
    }
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})

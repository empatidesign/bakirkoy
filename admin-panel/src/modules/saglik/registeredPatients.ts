// Mock "kayıtlı hasta" dizini — gerçek ortamda MERNİS/HBYS entegrasyonundan gelir.
// Çağrı merkezi veya masa personeli, daha önce sisteme kayıtlı bir hastayı T.C. kimlik no
// veya telefon numarasıyla bulup formu otomatik doldurabilir. Bulunamazsa "Yeni / Özel Durum
// Hastası" akışına düşülür ve adres + genel bilgiler elle girilir.
export interface RegisteredPatient {
  tckn: string
  fullName: string
  phone: string
  birthDate: string
  age: number
  gender: 'KADIN' | 'ERKEK'
  district: string
  neighborhood: string
  address: string
  floorNotes: string
  chronicNotes?: string
}

export const REGISTERED_PATIENTS: RegisteredPatient[] = [
  {
    tckn: '12456789012',
    fullName: 'Ali Kemal Yıldırım',
    phone: '0532 444 11 22',
    birthDate: '1952-04-12',
    age: 74,
    gender: 'ERKEK',
    district: 'Bakırköy',
    neighborhood: 'Zuhuratbaba Mah.',
    address: 'İncirli Cad. No:48 D:6',
    floorNotes: '3. Kat (Asansör Var, Sedye Uyumlu)',
    chronicNotes: 'Kronik Kalp Yetmezliği (NYHA IV), KOAH Alevlenme'
  },
  {
    tckn: '34567890123',
    fullName: 'Fatma Gökçe Kaya',
    phone: '0555 444 33 22',
    birthDate: '1961-09-03',
    age: 65,
    gender: 'KADIN',
    district: 'Bakırköy',
    neighborhood: 'Kartaltepe Mah.',
    address: 'Liman Cad. No:12 D:3',
    floorNotes: '1. Kat (Asansör Yok, Geniş Merdiven)',
    chronicNotes: 'Sağ Femur Boyun Kırığı Sonrası Protez'
  },
  {
    tckn: '78901234567',
    fullName: 'Hüseyin Demirci',
    phone: '0535 222 33 44',
    birthDate: '1948-11-25',
    age: 78,
    gender: 'ERKEK',
    district: 'Bakırköy',
    neighborhood: 'Yeşilköy Mah.',
    address: 'İstasyon Cad. No:24 D:2',
    floorNotes: 'Giriş Kat, Asansör Yok',
    chronicNotes: 'Son Dönem Böbrek Yetmezliği (SDBY), Haftada 3 Gün Diyaliz'
  },
  {
    tckn: '56789012345',
    fullName: 'Canberk Tan',
    phone: '0538 777 66 55',
    birthDate: '2012-05-18',
    age: 14,
    gender: 'ERKEK',
    district: 'Bakırköy',
    neighborhood: 'Ataköy 2-5-6. Kısım',
    address: 'Rauf Orbay Cad. A2 Blok D:18',
    floorNotes: '5. Kat (Çift Asansör)',
    chronicNotes: 'Serebral Palsi (SP), Skolyoz'
  },
  {
    tckn: '90234567890',
    fullName: 'Emine Özdoğan',
    phone: '0532 888 12 34',
    birthDate: '1938-02-10',
    age: 88,
    gender: 'KADIN',
    district: 'Bakırköy',
    neighborhood: 'Zuhuratbaba Mah.',
    address: 'Akasya Sok. No:8 D:2',
    floorNotes: '2. Kat (Asansör Var)',
    chronicNotes: 'Diyabet Tip-2, Yatağa Bağımlı Bası Yarası'
  }
]

const digitsOnly = (s: string) => s.replace(/\D/g, '')

export const findRegisteredPatient = (query: string): RegisteredPatient | null => {
  const q = query.trim()
  if (!q) return null
  const qDigits = digitsOnly(q)
  return (
    REGISTERED_PATIENTS.find(p => qDigits.length >= 4 && (p.tckn === qDigits || digitsOnly(p.phone).includes(qDigits))) ||
    REGISTERED_PATIENTS.find(p => p.fullName.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) ||
    null
  )
}

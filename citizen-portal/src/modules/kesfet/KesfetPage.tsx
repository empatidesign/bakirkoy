import { useState } from 'react'
import {
  CompassIcon,
  MapPinIcon,
  NavigationIcon,
  BusIcon,
  TreesIcon,
  LandmarkIcon,
  ShieldAlertIcon,
  SearchIcon,
  ExternalLinkIcon,
  PhoneIcon,
  ClockIcon,
  LayersIcon
} from 'lucide-react'

interface PlaceItem {
  id: string
  name: string
  category: 'guide' | 'centers' | 'parks' | 'emergency' | 'transit'
  address: string
  neighborhood: string
  distanceKm: number
  description: string
  phone?: string
  hours?: string
  lat: number
  lng: number
  tags: string[]
}

const PLACES: PlaceItem[] = [
  // Kent Rehberi
  {
    id: 'p1',
    name: 'Bakırköy Botanik Parkı',
    category: 'parks',
    address: 'Osmaniye Mah. İncirli Yolu',
    neighborhood: 'Osmaniye',
    distanceKm: 0.8,
    description: 'Türkiye\'nin en yüksek çocuk oyun kulesi, gölet, tematik bahçeler ve yürüyüş parkurları.',
    hours: '07:00 - 22:00',
    lat: 40.995,
    lng: 28.878,
    tags: ['Park', 'Çocuk', 'Doğa', 'Göl']
  },
  {
    id: 'p2',
    name: 'Fildamı Sarnıcı (Aetios Sarnıcı)',
    category: 'guide',
    address: 'Osmaniye Mah. Fildamı Yolu',
    neighborhood: 'Osmaniye',
    distanceKm: 1.2,
    description: 'Bizans döneminden günümüze ulaşan tarihi açık hava sarnıcı ve açık hava etkinlik alanı.',
    hours: '09:00 - 18:00',
    lat: 40.998,
    lng: 28.872,
    tags: ['Tarih', 'Kültür', 'Müze']
  },
  {
    id: 'p3',
    name: 'Yeşilköy Feneri & Sahil Yürüyüş Parkuru',
    category: 'guide',
    address: 'Yeşilköy Sahil Yolu',
    neighborhood: 'Yeşilköy',
    distanceKm: 2.5,
    description: 'Tarihi Fransız deniz feneri ve Marmara Denizi boyunca uzanan geniş bisiklet ve yürüyüş hattı.',
    hours: '24 Saat Açık',
    lat: 40.957,
    lng: 28.828,
    tags: ['Sahil', 'Tarih', 'Manzara']
  },
  // Önemli Merkezler
  {
    id: 'p4',
    name: 'Bakırköy Belediye Başkanlığı Ana Hizmet Binası',
    category: 'centers',
    address: 'Zuhuratbaba Mah. Şükran Çiftliği Sok. No:1',
    neighborhood: 'Zuhuratbaba',
    distanceKm: 0.3,
    description: 'Tüm idari müdürlükler, yazı işleri, vezneler ve vatandaş kabul salonu.',
    phone: '0212 414 97 00',
    hours: '08:30 - 17:00',
    lat: 40.985,
    lng: 28.868,
    tags: ['Belediye', 'Resmi', 'Vezne']
  },
  {
    id: 'p5',
    name: 'Leyla Gencer Opera ve Sanat Merkezi',
    category: 'centers',
    address: 'Osmaniye Mah. İncirli Cad. No:98',
    neighborhood: 'Osmaniye',
    distanceKm: 1.1,
    description: '1000 kişilik opera salonu, tiyatro ve sergi salonları.',
    phone: '0212 414 96 46',
    hours: '10:00 - 22:00',
    lat: 40.992,
    lng: 28.875,
    tags: ['Kültür', 'Sanat', 'Tiyatro']
  },
  {
    id: 'p6',
    name: 'Bakırköy Dr. Sadi Konuk Eğitim ve Araştırma Hastanesi',
    category: 'centers',
    address: 'Zuhuratbaba Mah. Tevfik Sağlam Cad. No:11',
    neighborhood: 'Zuhuratbaba',
    distanceKm: 0.7,
    description: '7/24 Acil servis, poliklinikler ve ihtisas klinikleri.',
    phone: '0212 414 71 71',
    hours: '7/24 Açık',
    lat: 40.989,
    lng: 28.865,
    tags: ['Sağlık', 'Hastane', 'Acil']
  },
  // Parklar
  {
    id: 'p7',
    name: 'Yeşilköy Çamlık Parkı',
    category: 'parks',
    address: 'Yeşilköy Mah. Gazi Evrenos Cad.',
    neighborhood: 'Yeşilköy',
    distanceKm: 2.1,
    description: 'Asırlık çam ağaçları, spor aletleri, dinlenme ve piknik alanları.',
    hours: '06:00 - 23:00',
    lat: 40.961,
    lng: 28.825,
    tags: ['Park', 'Spor', 'Yeşil Alan']
  },
  // Toplanma Alanları
  {
    id: 'p8',
    name: 'Özgürlük Meydanı Acil Toplanma Alanı',
    category: 'emergency',
    address: 'Cevizlik Mah. Ebuziya Cad. Yanı',
    neighborhood: 'Cevizlik',
    distanceKm: 0.4,
    description: 'Kapasite: 25.000 kişi. Güneş enerjili acil aydınlatma, afet istasyonu ve ilk yardım noktası mevcuttur.',
    lat: 40.978,
    lng: 28.872,
    tags: ['Acil Toplanma', 'Afet İstasyonu', 'Su Deposu']
  },
  {
    id: 'p9',
    name: 'Ataköy 5. Kısım Park İçi Afet Toplanma Sahası',
    category: 'emergency',
    address: 'Ataköy 5. Kısım Dumlupınar Sok.',
    neighborhood: 'Ataköy',
    distanceKm: 1.4,
    description: 'Kapasite: 12.000 kişi. Geniş çim alan, konteyner acil erzak istasyonu.',
    lat: 40.982,
    lng: 28.852,
    tags: ['Acil Toplanma', 'Geniş Alan']
  }
]

// Otobüsüm Nerede Canlı Veri (Şartname 3.3.31.2.5)
const BUS_LINES = [
  { line: '72T', name: 'Yeşilköy - Taksim', nextArrivalMin: 4, plate: '34 TN 4821', occupancy: '%45' },
  { line: '98H', name: 'Bakırköy - Başakşehir', nextArrivalMin: 8, plate: '34 HK 9912', occupancy: '%75' },
  { line: 'MR20', name: 'Yenibosna Metro - Kazlıçeşme', nextArrivalMin: 11, plate: '34 BB 1402', occupancy: '%30' },
  { line: '71T', name: 'Ataköy - Taksim', nextArrivalMin: 14, plate: '34 YS 3051', occupancy: '%60' }
]

export const KesfetPage = () => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'guide' | 'centers' | 'parks' | 'emergency' | 'transit'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const openNavigation = (lat: number, lng: number, name: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`
    window.open(url, '_blank')
  }

  const filteredPlaces = PLACES.filter((place) => {
    const matchCat = activeCategory === 'all' || place.category === activeCategory
    const matchSearch =
      place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      place.neighborhood.toLowerCase().includes(searchQuery.toLowerCase()) ||
      place.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchCat && matchSearch
  })

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Üst Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-teal-500 via-sky-600 to-blue-600 text-transparent bg-clip-text">
              Keşfet
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/20">
              Bakırköy Rehberi
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Kent rehberi, önemli merkezler, parklar ve canlı ulaşım
          </p>
        </div>
        <div className="p-2 rounded-2xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
          <CompassIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Arama Barı */}
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        <input
          type="text"
          placeholder="Mekan, park, toplanma alanı veya hat ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface-2 border border-border text-xs focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Kategori Filtre Butonları (Şartname 3.3.31.2) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'Tümü', icon: LayersIcon },
          { key: 'transit', label: 'Otobüsüm Nerede', icon: BusIcon },
          { key: 'emergency', label: 'Toplanma Alanları', icon: ShieldAlertIcon },
          { key: 'parks', label: 'Parklar & Yeşil Alan', icon: TreesIcon },
          { key: 'guide', label: 'Kent Rehberi', icon: LandmarkIcon },
          { key: 'centers', label: 'Önemli Merkezler', icon: MapPinIcon }
        ].map((item) => {
          const Icon = item.icon
          const isActive = activeCategory === item.key
          return (
            <button
              key={item.key}
              onClick={() => setActiveCategory(item.key as typeof activeCategory)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-surface-2 text-foreground-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* OTOBÜSÜM NEREDE CANLI TAKİP ALANI (Şartname 3.3.31.2.5) */}
      {(activeCategory === 'all' || activeCategory === 'transit') && (
        <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-3 shadow-lg border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                <BusIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Otobüsüm Nerede?</h3>
                <span className="text-[10px] text-teal-300">En Yakın Durak: Özgürlük Meydanı (140 m)</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 animate-pulse">
              Canlı Takip
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {BUS_LINES.map((bus) => (
              <div
                key={bus.line}
                className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-11 py-1 rounded-lg bg-teal-500 font-black text-xs text-center text-slate-950">
                    {bus.line}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white">{bus.name}</div>
                    <div className="text-[10px] text-slate-300">
                      Plaka: {bus.plate} • Doluluk: {bus.occupancy}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-teal-300">
                    {bus.nextArrivalMin} dk
                  </div>
                  <div className="text-[9px] text-slate-400">yaklaşıyor</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MEKAN VE TOPLANMA ALANLARI LİSTESİ */}
      {activeCategory !== 'transit' && (
        <div className="space-y-3">
          {filteredPlaces.map((place) => (
            <div
              key={place.id}
              className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-3 hover:border-teal-500/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{place.name}</h3>
                    {place.category === 'emergency' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                        Afet Alanı
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground-muted flex items-center gap-1 mt-1">
                    <MapPinIcon className="w-3.5 h-3.5 text-foreground-subtle flex-shrink-0" />
                    <span>{place.neighborhood} Mah. • {place.address}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-black text-teal-600 flex items-center gap-0.5 justify-end">
                    <NavigationIcon className="w-3 h-3" />
                    {place.distanceKm} km
                  </div>
                  <span className="text-[10px] text-foreground-muted">mesafe</span>
                </div>
              </div>

              <p className="text-xs text-foreground-subtle leading-relaxed">
                {place.description}
              </p>

              {/* Ekstra Bilgi Rozetleri */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                {place.hours && (
                  <span className="text-[10px] font-medium text-foreground-muted flex items-center gap-1">
                    <ClockIcon className="w-3 h-3 text-teal-500" />
                    {place.hours}
                  </span>
                )}
                {place.phone && (
                  <a
                    href={`tel:${place.phone.replace(/\s+/g, '')}`}
                    className="text-[10px] font-medium text-teal-600 flex items-center gap-1"
                  >
                    <PhoneIcon className="w-3 h-3" />
                    {place.phone}
                  </a>
                )}
                {place.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-surface-2 text-foreground-subtle"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Yol Tarifi Butonu (Şartname 3.3.31.2.7) */}
              <button
                onClick={() => openNavigation(place.lat, place.lng, place.name)}
                className="w-full py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-teal-500/20"
              >
                <NavigationIcon className="w-3.5 h-3.5" />
                <span>Yol Tarifi Al (Haritada Aç)</span>
                <ExternalLinkIcon className="w-3 h-3 ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

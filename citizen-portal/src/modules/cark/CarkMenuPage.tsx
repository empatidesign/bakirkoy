import { useState } from 'react'
import {
  TrophyIcon,
  HeartPulseIcon,
  GraduationCapIcon,
  DogIcon,
  PaletteIcon,
  HeartHandshakeIcon,
  BuildingIcon,
  VoteIcon,
  CompassIcon,
  ChevronRightIcon,
  LayersIcon,
  RotateCwIcon,
  ArrowRightIcon,
  SparklesIcon
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

interface WheelSlice {
  id: string
  title: string
  subtitle: string
  color: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  route: string
  badge?: string
}

const WHEEL_SLICES: WheelSlice[] = [
  {
    id: 'spor',
    title: 'Spor Hizmetleri',
    subtitle: 'Kurs kayıtları, spor tesisleri, havuz ve üyelikler',
    color: '#0EA5E9', // Sky blue
    icon: TrophyIcon,
    route: '/spor',
    badge: '12 Branş'
  },
  {
    id: 'genclik',
    title: 'Gençlik',
    subtitle: 'Etüt merkezi, kız yurdu, burs ve gençlik projeleri',
    color: '#8B5CF6', // Purple
    icon: GraduationCapIcon,
    route: '/genclik',
    badge: 'Burs Başvurusu'
  },
  {
    id: 'saglik',
    title: 'Sağlık',
    subtitle: 'Tıp merkezi muayene, evde sağlık ve ambulans',
    color: '#EF4444', // Red
    icon: HeartPulseIcon,
    route: '/saglik',
    badge: 'Randevu Açık'
  },
  {
    id: 'veterinerlik',
    title: 'Veterinerlik',
    subtitle: 'Vetbak, kedi kısırlaştırma ve hayvan sahiplenme',
    color: '#10B981', // Emerald
    icon: DogIcon,
    route: '/veterinerlik',
    badge: 'Vetbak'
  },
  {
    id: 'kultur-sanat',
    title: 'Kültür-Sanat',
    subtitle: 'Tiyatro oyunları, konserler, sergi ve sanat kursları',
    color: '#F59E0B', // Amber
    icon: PaletteIcon,
    route: '/etkinlikler',
    badge: 'Bu Hafta 6 Oyun'
  },
  {
    id: 'nikah',
    title: 'Nikah İşlemleri',
    subtitle: 'Nikah salonları, randevu alma ve başvuru evrakları',
    color: '#EC4899', // Pink
    icon: HeartHandshakeIcon,
    route: '/nikah',
    badge: 'Online Randevu'
  },
  {
    id: 'imar',
    title: 'İmar Hizmetleri',
    subtitle: 'E-İmar çapı, ruhsat başvuruları ve iskân takip',
    color: '#6366F1', // Indigo
    icon: BuildingIcon,
    route: '/imar',
    badge: 'Ada/Parsel'
  },
  {
    id: 'anket',
    title: 'Anket Sistemi',
    subtitle: 'Hizmet değerlendirme, katılım anketleri ve fikirler',
    color: '#14B8A6', // Teal
    icon: VoteIcon,
    route: '/anketler',
    badge: '+20 Puan'
  },
  {
    id: 'gezi',
    title: 'Gezi Sistemi',
    subtitle: 'Kültür gezileri, otobüs koltuk seçimi ve turlar',
    color: '#F97316', // Orange
    icon: CompassIcon,
    route: '/geziler',
    badge: 'Yeni Rota'
  },
  {
    id: 'tesisler',
    title: 'Sosyal Tesisler & Kütüphane',
    subtitle: 'Kütüphaneler, etüt alanları ve belediye sosyal tesisleri',
    color: '#A855F7', // Violet
    icon: BuildingIcon,
    route: '/hizmetler',
    badge: 'Tesislerimiz'
  }
]

export const CarkMenuPage = () => {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'wheel' | 'list'>('wheel')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [rotationAngle, setRotationAngle] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)

  const selectedSlice = WHEEL_SLICES[selectedIndex]

  // Çarkı rastgele çevir veya bir dilime git
  const spinWheel = () => {
    if (isSpinning) return
    setIsSpinning(true)

    const randomRotations = 3 + Math.floor(Math.random() * 3) // 3-5 tam tur
    const targetIdx = Math.floor(Math.random() * WHEEL_SLICES.length)
    const sliceAngle = 360 / WHEEL_SLICES.length
    const targetRotation = rotationAngle + (randomRotations * 360) + (targetIdx * sliceAngle)

    setRotationAngle(targetRotation)

    setTimeout(() => {
      setIsSpinning(false)
      // Çarkın en tepesine gelen dilimi hesapla
      const normalizedAngle = (targetRotation % 360 + 360) % 360
      const arrivedIdx = Math.round((360 - normalizedAngle) / sliceAngle) % WHEEL_SLICES.length
      setSelectedIndex(arrivedIdx)
    }, 2400)
  }

  const selectDirect = (index: number) => {
    setSelectedIndex(index)
    const sliceAngle = 360 / WHEEL_SLICES.length
    setRotationAngle((360 - index * sliceAngle))
  }

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Üst Başlık ve Mod Değiştirici (Şartname 3.3.19.3) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-600 via-sky-600 to-pink-500 text-transparent bg-clip-text">
              Hizmet Çarkı
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Bakırköy Belediyesi 360° Hizmet Menüsü
          </p>
        </div>

        {/* Görünüm Değiştirici */}
        <div className="flex p-0.5 bg-surface-2 rounded-xl border border-border">
          <button
            onClick={() => setViewMode('wheel')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
              viewMode === 'wheel'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-foreground-muted'
            }`}
          >
            <RotateCwIcon className="w-3 h-3" />
            Çark
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
              viewMode === 'list'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-foreground-muted'
            }`}
          >
            <LayersIcon className="w-3 h-3" />
            Liste
          </button>
        </div>
      </div>

      {viewMode === 'wheel' ? (
        <div className="space-y-6">
          {/* İnteraktif Dönen Çark Alanı */}
          <div className="relative flex flex-col items-center justify-center pt-2">
            {/* Üst İbre / Gösterge Oku */}
            <div className="absolute top-0 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-500 filter drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />

            {/* Çark Dairesi */}
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full p-2 bg-gradient-to-tr from-slate-800 to-slate-900 shadow-2xl border-4 border-slate-700/50">
              <div
                className="w-full h-full rounded-full relative overflow-hidden transition-transform ease-out"
                style={{
                  transform: `rotate(${rotationAngle}deg)`,
                  transitionDuration: isSpinning ? '2.4s' : '0.4s',
                  transitionTimingFunction: isSpinning ? 'cubic-bezier(0.15, 0.9, 0.2, 1)' : 'ease'
                }}
              >
                {/* 10 Dilim SVG Çizimi */}
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {WHEEL_SLICES.map((slice, i) => {
                    const angle = 360 / WHEEL_SLICES.length
                    const startAngle = i * angle
                    const endAngle = (i + 1) * angle
                    const startRad = ((startAngle - 90) * Math.PI) / 180
                    const endRad = ((endAngle - 90) * Math.PI) / 180
                    const x1 = 50 + 50 * Math.cos(startRad)
                    const y1 = 50 + 50 * Math.sin(startRad)
                    const x2 = 50 + 50 * Math.cos(endRad)
                    const y2 = 50 + 50 * Math.sin(endRad)
                    const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`

                    // İkon/yazı konumu (dilimin ortası)
                    const midAngle = startAngle + angle / 2
                    const midRad = ((midAngle - 90) * Math.PI) / 180
                    const textX = 50 + 33 * Math.cos(midRad)
                    const textY = 50 + 33 * Math.sin(midRad)

                    return (
                      <g key={slice.id} onClick={() => selectDirect(i)} className="cursor-pointer">
                        <path
                          d={pathData}
                          fill={slice.color}
                          stroke="#1e293b"
                          strokeWidth="1.2"
                          className="hover:opacity-90 transition-opacity"
                        />
                        <circle
                          cx={textX}
                          cy={textY}
                          r="6"
                          fill="rgba(255,255,255,0.25)"
                        />
                      </g>
                    )
                  })}
                </svg>

                {/* Dilim İkonları Overlay */}
                {WHEEL_SLICES.map((slice, i) => {
                  const angle = 360 / WHEEL_SLICES.length
                  const midAngle = i * angle + angle / 2
                  const rad = ((midAngle - 90) * Math.PI) / 180
                  const dist = 36 // Yüzde merkezden uzaklık
                  const left = 50 + dist * Math.cos(rad)
                  const top = 50 + dist * Math.sin(rad)
                  const Icon = slice.icon

                  return (
                    <div
                      key={slice.id}
                      onClick={() => selectDirect(i)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 text-white pointer-events-auto cursor-pointer"
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        transform: `translate(-50%, -50%) rotate(${midAngle}deg)`
                      }}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow" />
                    </div>
                  )
                })}
              </div>

              {/* Çark Merkezi Butonu */}
              <button
                onClick={spinWheel}
                disabled={isSpinning}
                className="absolute inset-0 m-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white font-black text-xs sm:text-sm shadow-xl flex flex-col items-center justify-center border-4 border-white/90 active:scale-95 transition-transform z-10"
              >
                <SparklesIcon className="w-4 h-4 mb-0.5 animate-pulse" />
                <span>ÇEVİR</span>
              </button>
            </div>
          </div>

          {/* Seçili Hizmet Detay Kartı */}
          <div className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                  style={{ backgroundColor: selectedSlice.color }}
                >
                  <selectedSlice.icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      {selectedSlice.title}
                    </h3>
                    {selectedSlice.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-foreground-muted border border-border">
                        {selectedSlice.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {selectedSlice.subtitle}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(selectedSlice.route)}
              className="w-full py-3 rounded-2xl text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              style={{ backgroundColor: selectedSlice.color }}
            >
              <span>{selectedSlice.title} Sayfasına Git</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Liste Görünümü (Şartname 3.3.19.3) */
        <div className="space-y-3">
          {WHEEL_SLICES.map((slice) => {
            const Icon = slice.icon
            return (
              <Link
                key={slice.id}
                to={slice.route}
                className="p-4 rounded-2xl bg-card border border-border hover:border-foreground/20 shadow-sm flex items-center justify-between gap-3 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: slice.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate">
                        {slice.title}
                      </span>
                      {slice.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-surface-2 text-foreground-subtle flex-shrink-0">
                          {slice.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground-muted truncate">
                      {slice.subtitle}
                    </p>
                  </div>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-foreground-muted flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

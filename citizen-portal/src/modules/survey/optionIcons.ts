import {
  SprayCanIcon, BusIcon, TreesIcon, ShieldIcon, HandHeartIcon, MoreHorizontalIcon,
  ConstructionIcon, DramaIcon, LeafIcon, BuildingIcon, GraduationCapIcon, DumbbellIcon,
  StethoscopeIcon, DogIcon, LightbulbIcon, DropletsIcon, TrashIcon, CarIcon, WifiIcon,
  UsersIcon, HeartHandshakeIcon, BabyIcon, AccessibilityIcon, CircleDotIcon,
  type LucideIcon,
} from 'lucide-react'

interface IconRule {
  /** Küçük harfe indirgenmiş seçenek metninde aranan anahtar kelimeler. */
  keywords: string[]
  icon: LucideIcon
  /** Tailwind metin rengi — kart seçili değilken ikonun rengi. */
  tone: string
}

const RULES: IconRule[] = [
  { keywords: ['temizlik', 'hijyen'], icon: SprayCanIcon, tone: 'text-sky-500' },
  { keywords: ['çöp', 'atık', 'geri dönüşüm'], icon: TrashIcon, tone: 'text-emerald-500' },
  { keywords: ['ulaşım', 'ulasim', 'otobüs', 'toplu taşıma'], icon: BusIcon, tone: 'text-blue-500' },
  { keywords: ['otopark', 'trafik', 'araç'], icon: CarIcon, tone: 'text-slate-500' },
  { keywords: ['park ve bahçe', 'park ve yeşil', 'yeşil alan', 'bahçe', 'park'], icon: TreesIcon, tone: 'text-green-600' },
  { keywords: ['güvenlik', 'guvenlik', 'asayiş'], icon: ShieldIcon, tone: 'text-violet-500' },
  { keywords: ['sosyal yardım', 'yardım', 'dayanışma'], icon: HandHeartIcon, tone: 'text-orange-500' },
  { keywords: ['sosyal hizmet', 'sosyal'], icon: UsersIcon, tone: 'text-pink-500' },
  { keywords: ['altyapı', 'altyapi', 'yol', 'kaldırım'], icon: ConstructionIcon, tone: 'text-amber-600' },
  { keywords: ['kültür', 'kultur', 'etkinlik', 'sanat'], icon: DramaIcon, tone: 'text-fuchsia-500' },
  { keywords: ['çevre', 'cevre', 'gürültü', 'hava'], icon: LeafIcon, tone: 'text-lime-600' },
  { keywords: ['kentsel dönüşüm', 'imar', 'bina', 'konut'], icon: BuildingIcon, tone: 'text-stone-500' },
  { keywords: ['eğitim', 'egitim', 'kurs', 'okul'], icon: GraduationCapIcon, tone: 'text-indigo-500' },
  { keywords: ['spor', 'salon'], icon: DumbbellIcon, tone: 'text-red-500' },
  { keywords: ['sağlık', 'saglik'], icon: StethoscopeIcon, tone: 'text-rose-500' },
  { keywords: ['veteriner', 'hayvan'], icon: DogIcon, tone: 'text-amber-500' },
  { keywords: ['aydınlatma', 'elektrik', 'ışık'], icon: LightbulbIcon, tone: 'text-yellow-500' },
  { keywords: ['kanalizasyon', 'içme suyu', 'su '], icon: DropletsIcon, tone: 'text-cyan-500' },
  { keywords: ['internet', 'dijital', 'wifi'], icon: WifiIcon, tone: 'text-teal-500' },
  { keywords: ['gençlik', 'genclik'], icon: HeartHandshakeIcon, tone: 'text-purple-500' },
  { keywords: ['çocuk', 'cocuk', 'kreş'], icon: BabyIcon, tone: 'text-orange-400' },
  { keywords: ['engelli', 'erişilebilir'], icon: AccessibilityIcon, tone: 'text-blue-600' },
]

const OTHER: IconRule = { keywords: [], icon: MoreHorizontalIcon, tone: 'text-slate-400' }
const FALLBACK: IconRule = { keywords: [], icon: CircleDotIcon, tone: 'text-slate-400' }

export interface OptionVisual {
  Icon: LucideIcon
  tone: string
}

/** Seçenek metnine göre ikon ve renk döndürür. */
export function optionVisual(option: string): OptionVisual {
  const text = option.toLocaleLowerCase('tr')
  if (text.startsWith('diğer') || text.startsWith('diger')) return { Icon: OTHER.icon, tone: OTHER.tone }
  const hit = RULES.find((r) => r.keywords.some((k) => text.includes(k)))
  const rule = hit ?? FALLBACK
  return { Icon: rule.icon, tone: rule.tone }
}

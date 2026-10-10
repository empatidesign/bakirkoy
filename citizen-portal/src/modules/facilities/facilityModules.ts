import { DumbbellIcon, WavesIcon, TentIcon, CompassIcon, FlaskConicalIcon, BabyIcon, AccessibilityIcon, HeartHandshakeIcon } from 'lucide-react'

export interface FacilityModuleInfo {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  gradient: string
  accent: string
  imageUrl?: string
}

export const FACILITY_MODULES: FacilityModuleInfo[] = [
  { key: 'sports',          label: 'Spor Salonu',   icon: DumbbellIcon,     color: '#EF4444', gradient: 'linear-gradient(135deg, #EF4444, #DC2626)', accent: 'bg-red-50 text-red-600' },
  { key: 'pool',            label: 'Yüzme Havuzu',  icon: WavesIcon,        color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', accent: 'bg-blue-50 text-blue-600' },
  { key: 'youth-camp',      label: 'Gençlik Kampı', icon: TentIcon,         color: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #059669)', accent: 'bg-emerald-50 text-emerald-600' },
  { key: 'scout-camp',      label: 'İzcilik Kampı', icon: CompassIcon,      color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', accent: 'bg-amber-50 text-amber-600' },
  { key: 'science-center',  label: 'Bilim Merkezi', icon: FlaskConicalIcon, color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', accent: 'bg-violet-50 text-violet-600' },
  { key: 'kasif',           label: 'Kaşif Çocuk',   icon: BabyIcon,         color: '#F97316', gradient: 'linear-gradient(135deg, #F97316, #EA580C)', accent: 'bg-orange-50 text-orange-600' },
  { key: 'accessible-life', label: 'Engelsiz Yaşam',icon: AccessibilityIcon,color: '#6366F1', gradient: 'linear-gradient(135deg, #6366F1, #4F46E5)', accent: 'bg-indigo-50 text-indigo-600' },
  { key: 'women-family',    label: 'Kadın ve Aile', icon: HeartHandshakeIcon,color: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899, #DB2777)', accent: 'bg-pink-50 text-pink-600' },
]

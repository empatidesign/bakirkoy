import type { Icon2DKind } from '@/components/Icon2D'

// Branş görselleri emoji idi; platforma göre değişen görünümü bitirmek için 2D ikona çevrildi.
export interface SportVisual {
  icon: Icon2DKind
  thumbBg: string
}

const DEFAULT_VISUAL: SportVisual = { icon: 'medal', thumbBg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' }

const SPORT_VISUALS: Record<string, SportVisual> = {
  Basketbol: { icon: 'basketball', thumbBg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)' },
  Badminton: { icon: 'badminton', thumbBg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' },
  Futsal: { icon: 'football', thumbBg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' },
  'Masa Tenisi': { icon: 'pingpong', thumbBg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' },
  Voleybol: { icon: 'volleyball', thumbBg: 'linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)' },
}

export const visualForBranch = (branchName: string): SportVisual =>
  SPORT_VISUALS[branchName] ?? DEFAULT_VISUAL

export interface LegendItem {
  key: string
  label: string
  color: string
  variant: 'pie' | 'dot'
}

export const OCCUPANCY_LEGEND: LegendItem[] = [
  { key: 'kontenjan', label: 'Kontenjan', color: '#7C3AED', variant: 'pie' },
  { key: 'kayitli', label: 'Kayıtlı', color: '#94A3B8', variant: 'pie' },
  { key: 'bos', label: 'Boş', color: '#10B981', variant: 'dot' },
  { key: 'dolu', label: 'Kontenjan Dolu', color: '#EF4444', variant: 'dot' },
]

import type { ComponentType } from 'react'
import { CoinsIcon, GiftIcon, SkipForwardIcon, CircleDashedIcon } from 'lucide-react'
import type { FullResidencyMode } from '@/lib/residency'

export type WheelStatus = 'Active' | 'Passive'

export type WheelSliceType = 'points' | 'gift' | 'pass' | 'empty'

export interface WheelSlice {
  id?: string
  label: string
  type: WheelSliceType
  value: number
  winRate: number
  color: string
  giftId?: string
  giftName?: string
}

export interface Wheel {
  id: string
  title: string
  description?: string
  slices: WheelSlice[]
  dailySpinLimit: number
  status: WheelStatus
  totalSpins: number
  createdAt: string
  // Kullanıcı isteği (2026-09-20): gün içinde çevirenin kaçıncı çevirmesi olduğuna göre
  // değişen puan algoritması. Kapalıysa dilimlerin sabit puanı (value) kullanılmaya devam eder.
  pointsAlgorithmEnabled: boolean
  pointsAlgorithmBase: number
  pointsAlgorithmStep: number
  pointsAlgorithmMax: number
  pointsAlgorithmMaxSpins: number
  residencyMode: FullResidencyMode
}

export interface WheelSliceInput {
  label: string
  type: WheelSliceType
  value: number
  winRate: number
  color: string
  giftId?: string
}

export interface WheelInput {
  title: string
  description?: string
  dailySpinLimit: number
  slices: WheelSliceInput[]
  pointsAlgorithmEnabled: boolean
  pointsAlgorithmBase: number
  pointsAlgorithmStep: number
  pointsAlgorithmMax: number
  pointsAlgorithmMaxSpins: number
  residencyMode: FullResidencyMode
}

export interface WheelSummary {
  total: number
  active: number
  passive: number
  totalSpins: number
}

type Tone = 'success' | 'neutral' | 'danger' | 'warning' | 'info' | 'primary'

export const WHEEL_STATUS_LABELS: Record<WheelStatus, string> = {
  Active: 'Aktif',
  Passive: 'Pasif',
}

export const WHEEL_STATUS_TONE: Record<WheelStatus, Tone> = {
  Active: 'success',
  Passive: 'neutral',
}

export const WHEEL_STATUS_OPTIONS: { value: WheelStatus; label: string }[] = [
  { value: 'Active', label: 'Aktif' },
  { value: 'Passive', label: 'Pasif' },
]

export interface WheelSliceTypeMeta {
  key: WheelSliceType
  label: string
  icon: ComponentType<{ className?: string }>
  tone: Tone
  color: string
  hint: string
}

export const WHEEL_SLICE_TYPE_META: WheelSliceTypeMeta[] = [
  { key: 'points', label: 'Puan', icon: CoinsIcon, tone: 'info', color: '#2563eb', hint: 'Kullanıcıya puan kazandırır' },
  { key: 'gift', label: 'Hediye', icon: GiftIcon, tone: 'primary', color: '#7c3aed', hint: 'Seçilen hediyeyi kazandırır' },
  { key: 'pass', label: 'Pas', icon: SkipForwardIcon, tone: 'warning', color: '#f59e0b', hint: 'Bir sonraki hakka geçer' },
  { key: 'empty', label: 'Boş', icon: CircleDashedIcon, tone: 'neutral', color: '#94a3b8', hint: 'Bu turda kazanç yok' },
]

export const wheelSliceTypeMeta = (t: WheelSliceType): WheelSliceTypeMeta =>
  WHEEL_SLICE_TYPE_META.find((m) => m.key === t) ?? WHEEL_SLICE_TYPE_META[0]

export const SLICE_PRESET_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c',
  '#f59e0b', '#16a34a', '#0891b2', '#4f46e5', '#0d9488',
]

export const emptyWheelSlice = (): WheelSlice => ({
  label: '',
  type: 'points',
  value: 100,
  winRate: 0,
  color: SLICE_PRESET_COLORS[0],
})

export const wheelWinRateTotal = (slices: WheelSlice[]): number =>
  slices.reduce((sum, s) => sum + (Number(s.winRate) || 0), 0)

export const STANDARD_WHEEL_SLICES: WheelSlice[] = [
  { label: '250 Puan', type: 'points', value: 250, winRate: 1, color: '#eab308' },
  { label: '10 Puan', type: 'points', value: 10, winRate: 18, color: '#0d9488' },
  { label: 'Pas', type: 'pass', value: 0, winRate: 10, color: '#64748b' },
  { label: '35 Puan', type: 'points', value: 35, winRate: 6, color: '#6366f1' },
  { label: '5 Puan', type: 'points', value: 5, winRate: 20, color: '#10b981' },
  { label: '100 Puan', type: 'points', value: 100, winRate: 1, color: '#8b5cf6' },
  { label: '20 Puan', type: 'points', value: 20, winRate: 12, color: '#3b82f6' },
  { label: 'Şansını Yeniden Dene', type: 'empty', value: 0, winRate: 10, color: '#ec4899' },
  { label: '30 Puan', type: 'points', value: 30, winRate: 8, color: '#06b6d4' },
  { label: '50 Puan', type: 'points', value: 50, winRate: 4, color: '#f97316' },
  { label: '25 Puan', type: 'points', value: 25, winRate: 10, color: '#16a34a' },
]

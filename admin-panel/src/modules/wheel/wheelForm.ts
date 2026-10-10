import type { Wheel, WheelInput, WheelSlice } from '@/types/wheel.types'
import { wheelWinRateTotal, STANDARD_WHEEL_SLICES } from '@/types/wheel.types'
import type { FullResidencyMode } from '@/lib/residency'

export interface WheelForm {
  title: string
  description: string
  dailySpinLimit: string
  slices: WheelSlice[]
  pointsAlgorithmEnabled: boolean
  pointsAlgorithmBase: string
  pointsAlgorithmStep: string
  pointsAlgorithmMax: string
  pointsAlgorithmMaxSpins: string
  residencyMode: FullResidencyMode
}

export const emptyWheelForm = (): WheelForm => ({
  title: 'Bakırköy Şans Çarkı',
  description: 'Günde 1 kez çarkı çevirin, sürpriz puanlar kazanın!',
  dailySpinLimit: '1',
  slices: STANDARD_WHEEL_SLICES.map((s) => ({ ...s })),
  pointsAlgorithmEnabled: false,
  pointsAlgorithmBase: '100',
  pointsAlgorithmStep: '0',
  pointsAlgorithmMax: '0',
  pointsAlgorithmMaxSpins: '0',
  residencyMode: 'anyone',
})

export const toWheelForm = (r: Wheel): WheelForm => ({
  title: r.title,
  description: r.description ?? '',
  dailySpinLimit: r.dailySpinLimit != null ? String(r.dailySpinLimit) : '0',
  slices: r.slices.map((s) => ({ ...s })),
  pointsAlgorithmEnabled: r.pointsAlgorithmEnabled,
  pointsAlgorithmBase: String(r.pointsAlgorithmBase ?? 0),
  pointsAlgorithmStep: String(r.pointsAlgorithmStep ?? 0),
  pointsAlgorithmMax: String(r.pointsAlgorithmMax ?? 0),
  pointsAlgorithmMaxSpins: String(r.pointsAlgorithmMaxSpins ?? 0),
  residencyMode: r.residencyMode ?? 'anyone',
})

export const toWheelInput = (f: WheelForm): WheelInput => ({
  title: f.title.trim(),
  description: f.description.trim() || undefined,
  dailySpinLimit: f.dailySpinLimit ? Number(f.dailySpinLimit) : 0,
  slices: f.slices.map((s) => ({
    label: s.label.trim(),
    type: s.type,
    value: s.type === 'points' ? Number(s.value) || 0 : 0,
    winRate: Number(s.winRate) || 0,
    color: s.color,
    giftId: s.type === 'gift' ? s.giftId : undefined,
  })),
  pointsAlgorithmEnabled: f.pointsAlgorithmEnabled,
  pointsAlgorithmBase: Number(f.pointsAlgorithmBase) || 0,
  pointsAlgorithmStep: Number(f.pointsAlgorithmStep) || 0,
  pointsAlgorithmMax: Number(f.pointsAlgorithmMax) || 0,
  pointsAlgorithmMaxSpins: Number(f.pointsAlgorithmMaxSpins) || 0,
  residencyMode: f.residencyMode,
})

export const getWheelFormErrors = (f: WheelForm): string[] => [
  !f.title.trim() && 'Çark başlığı zorunludur.',
  f.slices.length < 2 && 'En az 2 dilim eklenmelidir.',
  f.slices.some((s) => !s.label.trim()) && 'Tüm dilimlerin etiketi dolu olmalıdır.',
  f.slices.some((s) => s.type === 'gift' && !s.giftId) && 'Hediye tipindeki tüm dilimlere hediye seçilmelidir.',
  Math.round(wheelWinRateTotal(f.slices)) !== 100 && 'Dilim kazanma oranlarının toplamı %100 olmalıdır.',
  f.pointsAlgorithmEnabled && Number(f.pointsAlgorithmMax) > 0 && Number(f.pointsAlgorithmMax) < Number(f.pointsAlgorithmBase) && 'Azami puan, başlangıç puanından küçük olamaz.',
].filter(Boolean) as string[]

export type GiftStatus = 'Active' | 'Passive'

import type { FullResidencyMode } from '@/lib/residency'

export interface Gift {
  id: string
  name: string
  imageUrl?: string
  points: number
  stockLimit: number
  awardedCount: number
  remaining: number
  winnerPattern: number[]
  description?: string
  status: GiftStatus
  createdAt: string
  residencyMode: FullResidencyMode
}

export interface GiftInput {
  name: string
  imageUrl?: string
  points: number
  stockLimit: number
  winnerPattern: number[]
  description?: string
  residencyMode: FullResidencyMode
}

export interface GiftSummary {
  total: number
  active: number
  passive: number
  totalStock: number
  awarded: number
}

type Tone = 'success' | 'neutral' | 'danger' | 'warning' | 'info' | 'primary'

export const GIFT_STATUS_LABELS: Record<GiftStatus, string> = {
  Active: 'Aktif',
  Passive: 'Pasif',
}

export const GIFT_STATUS_TONE: Record<GiftStatus, Tone> = {
  Active: 'success',
  Passive: 'neutral',
}

export const GIFT_STATUS_OPTIONS: { value: GiftStatus; label: string }[] = [
  { value: 'Active', label: 'Aktif' },
  { value: 'Passive', label: 'Pasif' },
]

export const GIFT_IMAGE_SPEC = { width: 480, height: 480, maxSizeKb: 512 }

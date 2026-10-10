import type { Gift, GiftInput } from '@/types/gift.types'
import type { FullResidencyMode } from '@/lib/residency'

export interface GiftForm {
  name: string
  imageUrl: string
  points: string
  stockLimit: string
  winnerPattern: number[]
  description: string
  residencyMode: FullResidencyMode
}

export const emptyGiftForm: GiftForm = {
  name: '',
  imageUrl: '',
  points: '',
  stockLimit: '',
  winnerPattern: [],
  description: '',
  residencyMode: 'anyone',
}

export const toGiftForm = (r: Gift): GiftForm => ({
  name: r.name,
  imageUrl: r.imageUrl ?? '',
  points: r.points != null ? String(r.points) : '',
  stockLimit: r.stockLimit != null ? String(r.stockLimit) : '',
  winnerPattern: r.winnerPattern ?? [],
  description: r.description ?? '',
  residencyMode: r.residencyMode ?? 'anyone',
})

export const toGiftInput = (f: GiftForm): GiftInput => ({
  name: f.name.trim(),
  imageUrl: f.imageUrl || undefined,
  points: f.points ? Number(f.points) : 0,
  stockLimit: f.stockLimit ? Number(f.stockLimit) : 0,
  winnerPattern: f.winnerPattern,
  description: f.description.trim() || undefined,
  residencyMode: f.residencyMode,
})

export const getGiftFormErrors = (f: GiftForm): string[] => [
  !f.name.trim() && 'Hediye adı zorunludur.',
  (!f.stockLimit || Number(f.stockLimit) < 1) && 'Stok miktarı en az 1 olmalıdır.',
].filter(Boolean) as string[]

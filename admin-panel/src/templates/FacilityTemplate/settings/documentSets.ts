import type { FacilityModuleId } from '../moduleConfig'
import type { RequiredDocument } from '@/types/facility.types'

export type DocumentPreset = Omit<RequiredDocument, 'id' | 'required'>

const COMMON_PRESETS: DocumentPreset[] = [
  { label: 'Kimlik Fotokopisi', category: 'identity', verification: 'manual' },
  { label: 'Vesikalık Fotoğraf', category: 'identity', verification: 'manual' },
  { label: 'Veli İzin Belgesi', category: 'permission', verification: 'manual' },
  { label: 'Aile Yerleşim Belgesi', category: 'residence', verification: 'mernis' },
]

const SPORTS_PRESETS: DocumentPreset[] = [
  ...COMMON_PRESETS,
  { label: 'Adli Sicil Kaydı', category: 'identity', verification: 'system' },
  { label: 'Öğrenci Belgesi', category: 'education', verification: 'manual' },
  { label: 'Diploma / Mezuniyet Belgesi', category: 'education', verification: 'manual' },
  { label: 'Engelli Sağlık Kurulu Raporu', category: 'health', verification: 'manual' },
  { label: 'Gelir Belgesi', category: 'other', verification: 'manual' },
]

const ACCESSIBLE_PRESETS: DocumentPreset[] = [
  ...COMMON_PRESETS,
  { label: 'Vasi Belgesi', category: 'permission', verification: 'manual' },
  { label: 'Ergoterapi Yönlendirme', category: 'health', verification: 'manual' },
  { label: 'Konuşma Terapisi Yönlendirme', category: 'health', verification: 'manual' },
  { label: 'BEP Raporu (Bireyselleştirilmiş Eğitim Planı)', category: 'education', verification: 'manual' },
  { label: 'Düzenli İlaç Listesi', category: 'health', verification: 'manual' },
]

const ACCESSIBLE_DEFAULTS: RequiredDocument[] = [
  { id: 'sgk_disability', label: 'Engelli Sağlık Kurulu Raporu (SGK)', category: 'health', verification: 'manual', required: true },
  { id: 'health', label: 'Sağlık Raporu', category: 'health', verification: 'manual', required: true },
  { id: 'residence', label: 'İkametgâh Belgesi', category: 'residence', verification: 'mernis', required: true },
]

const STANDARD_DEFAULTS: RequiredDocument[] = [
  { id: 'health', label: 'Sağlık Raporu', category: 'health', verification: 'manual', required: true },
  { id: 'residence', label: 'İkametgâh Belgesi', category: 'residence', verification: 'mernis', required: true },
]

export const getDocumentPresets = (id: FacilityModuleId): DocumentPreset[] =>
  id === 'accessible' ? ACCESSIBLE_PRESETS : SPORTS_PRESETS

export const getDefaultDocuments = (id: FacilityModuleId): RequiredDocument[] =>
  (id === 'accessible' ? ACCESSIBLE_DEFAULTS : STANDARD_DEFAULTS).map((d) => ({ ...d }))

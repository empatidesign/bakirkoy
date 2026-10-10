type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

import type { ListParams } from '@/types/common'

export type PopupMediaType = 'image' | 'video' | 'text'

export const POPUP_MEDIA_TYPE_LABELS: Record<PopupMediaType, string> = {
  image: 'Resim',
  video: 'Video',
  text: 'Metin',
}

export const POPUP_MEDIA_TYPE_OPTIONS = (Object.keys(POPUP_MEDIA_TYPE_LABELS) as PopupMediaType[])
  .map((v) => ({ value: v, label: POPUP_MEDIA_TYPE_LABELS[v] }))

export type PopupTriggerType = 'first_login' | 'every_login' | 'module_enter'

export const POPUP_TRIGGER_LABELS: Record<PopupTriggerType, string> = {
  first_login: 'İlk Girişte (bir kez)',
  every_login: 'Her Girişte',
  module_enter: 'Belirli Bir Alana Girildiğinde',
}

export const POPUP_TRIGGER_HINTS: Record<PopupTriggerType, string> = {
  first_login: 'Vatandaş uygulamaya ilk kez girdiğinde bir kez gösterilir, bir daha tetiklenmez.',
  every_login: 'Vatandaş ana sayfayı her açtığında (kurallara uyuyorsa) tekrar gösterilebilir.',
  module_enter: 'Vatandaş seçilen modülün sayfasına her girdiğinde (kurallara uyuyorsa) gösterilir.',
}

export const POPUP_TRIGGER_OPTIONS = (Object.keys(POPUP_TRIGGER_LABELS) as PopupTriggerType[])
  .map((v) => ({ value: v, label: POPUP_TRIGGER_LABELS[v] }))

// Kullanıcı isteği (2026-09-20): "belirli programlardaki alanlara girdiğinde" — vatandaş
// portalı route'larıyla birebir eşleşen, admin'in seçebileceği modül anahtarları.
export const POPUP_MODULE_TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: 'home', label: 'Ana Sayfa' },
  { value: 'events', label: 'Etkinlikler' },
  { value: 'facilities', label: 'Hizmetler / Tesisler' },
  { value: 'travels', label: 'Geziler' },
  { value: 'library', label: 'Kütüphane' },
  { value: 'sports', label: 'Spor Salonu' },
  { value: 'campaigns', label: 'Kampanyalar' },
  { value: 'wheel', label: 'Hediye Çarkı' },
  { value: 'quiz', label: 'Bilgi Yarışması' },
  { value: 'survey', label: 'Anketler' },
  { value: 'seda', label: 'Seda Eğitim' },
  { value: 'loyalty', label: 'Sadakat Sistemi' },
  { value: 'submissions', label: 'Formlarım / Muhtarlık' },
  { value: 'emergency-areas', label: 'Acil Toplanma Alanları' },
]

export interface PopupMediaItem {
  order: number
  type: PopupMediaType
  url?: string | null
  text?: string | null
}

export interface PopupCampaign {
  id: string
  title: string
  isMandatory: boolean
  allowDismissForever: boolean
  repeatIntervalHours: number
  triggerType: PopupTriggerType
  triggerModuleKey?: string | null
  startDate?: string | null
  endDate?: string | null
  minDisplaySeconds: number
  isActive: boolean
  priority: number
  viewCount: number
  acknowledgeCount: number
  mediaItems: PopupMediaItem[]
  createdAt: string
  updatedAt?: string | null
}

export interface PopupForm {
  title: string
  isMandatory: boolean
  allowDismissForever: boolean
  repeatIntervalHours: number
  triggerType: PopupTriggerType
  triggerModuleKey: string
  startDate: string
  endDate: string
  minDisplaySeconds: number
  isActive: boolean
  priority: number
  mediaItems: PopupMediaItem[]
}

export interface PopupSummary {
  total: number
  active: number
  mandatory: number
}

export interface PopupListParams extends ListParams {
  isActive?: string
  isMandatory?: string
  triggerType?: string
}

export const POPUP_STATUS_TONE: Record<'active' | 'passive', BadgeTone> = {
  active: 'success',
  passive: 'neutral',
}

export const emptyPopupMediaItem = (order: number): PopupMediaItem => ({
  order,
  type: 'image',
  url: null,
  text: null,
})

export const emptyPopupForm = (): PopupForm => ({
  title: '',
  isMandatory: false,
  allowDismissForever: true,
  repeatIntervalHours: 24,
  triggerType: 'every_login',
  triggerModuleKey: '',
  startDate: '',
  endDate: '',
  minDisplaySeconds: 0,
  isActive: true,
  priority: 0,
  mediaItems: [emptyPopupMediaItem(0)],
})

export const popupToForm = (p: PopupCampaign): PopupForm => ({
  title: p.title,
  isMandatory: p.isMandatory,
  allowDismissForever: p.allowDismissForever,
  repeatIntervalHours: p.repeatIntervalHours,
  triggerType: p.triggerType,
  triggerModuleKey: p.triggerModuleKey ?? '',
  startDate: p.startDate ? p.startDate.slice(0, 10) : '',
  endDate: p.endDate ? p.endDate.slice(0, 10) : '',
  minDisplaySeconds: p.minDisplaySeconds,
  isActive: p.isActive,
  priority: p.priority,
  mediaItems: p.mediaItems.length > 0 ? p.mediaItems : [emptyPopupMediaItem(0)],
})

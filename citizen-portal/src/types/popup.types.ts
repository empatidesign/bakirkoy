export type CitizenPopupMediaType = 'image' | 'video' | 'text'

export interface CitizenPopupMedia {
  order: number
  type: CitizenPopupMediaType
  url?: string | null
  text?: string | null
}

export interface CitizenPopup {
  id: string
  title: string
  isMandatory: boolean
  allowDismissForever: boolean
  minDisplaySeconds: number
  mediaItems: CitizenPopupMedia[]
}

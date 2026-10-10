// NOT (2026-09-05, gerçek testte bulunan bug): Backend `JsonStringEnumConverter`
// kullanıyor (Program.cs) — bu enum'lar API'den STRING olarak dönüyor
// (ör. "Module", "Lucide"), sayı (0/1/2) değil. Eskiden `0|1|2` olarak
// tanımlanmıştı, bu da MobileMenuTab.tsx'teki LINK_LABEL badge'inin ve
// MobileMenuItemForm.tsx'teki düzenleme formunun (iconType===1 kontrolleri)
// GERÇEKTEN BOZUK render etmesine yol açıyordu (badge boş, düzenlemede görsel
// ikonlu öğe yanlışlıkla Lucide tipinde gösteriliyordu). PUT/POST istekleri
// için backend hem sayı hem string kabul ediyor (converter iki yönlü okuyor),
// ama biz artık gerçek response şekliyle tutarlı olsun diye string gönderiyoruz.
export type MenuIconType = 'Lucide' | 'Image'
export type MenuLinkType = 'Module' | 'WebView' | 'ExternalUrl'
export type BannerLinkType = 'None' | 'Module' | 'WebView' | 'ExternalUrl'

export interface MobileMenuItem {
  id: string
  title: string
  icon: string
  iconType: MenuIconType
  color: string
  colorSecondary: string | null
  description: string | null
  linkType: MenuLinkType
  linkTarget: string
  groupKey: string
  groupTitle: string
  isPopular: boolean
  isVisible: boolean
  requiresAuth: boolean
  order: number
}

export interface MobileMenuItemFormData {
  title: string
  icon: string
  iconType: MenuIconType
  color: string
  colorSecondary: string | null
  description: string | null
  linkType: MenuLinkType
  linkTarget: string
  groupKey: string
  groupTitle: string
  isPopular: boolean
  isVisible: boolean
  requiresAuth: boolean
}

export interface MobileMenuGroup {
  groupKey: string
  groupTitle: string
}

export interface MobileMenuBanner {
  id: string
  pageKey: string
  imageUrl: string
  linkType: BannerLinkType
  linkTarget: string | null
  isVisible: boolean
  order: number
}

export interface UpsertBannerData {
  imageUrl: string
  linkType: BannerLinkType
  linkTarget: string | null
  isVisible: boolean
}

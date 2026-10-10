export interface SystemModule {
  id: string
  key: string
  label: string
  icon: string
  color: string
  citizenRoute: string
  adminRoute: string
  isActive: boolean
  adminSidebarOrder: number
  showInAdminSidebar: boolean
}

export interface MenuItem {
  id: string
  sectionId: string
  moduleKey: string | null
  title: string
  icon: string
  iconType: 0 | 1
  color: string
  linkType: 0 | 1 | 2
  linkTarget: string
  mobileLinkTarget: string | null
  showInSidebar: boolean
  showInMobile: boolean
  isPopular: boolean
  isVisible: boolean
  requiresAuth: boolean
  badgeText: string | null
  badgeTone: string | null
  order: number
}

export interface MenuSection {
  id: string
  key: string
  title: string
  icon: string
  isVisible: boolean
  showInSidebar: boolean
  showInMobile: boolean
  order: number
  items: MenuItem[]
}

export interface CreateMenuSectionForm {
  key: string
  title: string
  icon: string
  isVisible: boolean
  showInSidebar: boolean
  showInMobile: boolean
}

export interface UpdateMenuSectionForm {
  title: string
  icon: string
  isVisible: boolean
  showInSidebar: boolean
  showInMobile: boolean
}

export interface MenuItemForm {
  sectionId: string
  moduleKey: string
  title: string
  icon: string
  iconType: 0 | 1
  color: string
  linkType: 0 | 1 | 2
  linkTarget: string
  mobileLinkTarget: string
  showInSidebar: boolean
  showInMobile: boolean
  isPopular: boolean
  isVisible: boolean
  requiresAuth: boolean
  badgeText: string
  badgeTone: string
}

export const LINK_TYPE_LABELS: Record<number, string> = {
  0: 'Modül (uygulama içi)',
  1: 'WebView (uygulama içi web)',
  2: 'Dış URL (tarayıcı)',
}

export const BADGE_TONE_OPTIONS = [
  { value: '', label: 'Yok' },
  { value: 'danger', label: 'Kırmızı' },
  { value: 'warning', label: 'Turuncu' },
  { value: 'success', label: 'Yeşil' },
  { value: 'info', label: 'Mavi' },
  { value: 'primary', label: 'Mor' },
]

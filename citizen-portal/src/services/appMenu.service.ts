import { api } from './api'

export interface PublicMenuItem {
  id: string
  title: string
  icon: string
  iconType: 0 | 1
  color: string
  linkType: 0 | 1 | 2
  linkTarget: string
  mobileLinkTarget: string | null
  showInSidebar: boolean
  showInMobile: boolean
  isVisible: boolean
  isPopular: boolean
  badgeText: string | null
  badgeTone: string | null
  requiresAuth: boolean
}

export interface PublicMenuSection {
  id: string
  key: string
  title: string
  icon: string
  isVisible: boolean
  showInSidebar: boolean
  showInMobile: boolean
  order: number
  items: PublicMenuItem[]
}

export interface PublicSystemModule {
  id: string
  key: string
  label: string
  icon: string
  color: string
  citizenRoute: string
  isActive: boolean
}

const appMenuService = {
  async getPublicMenu(): Promise<PublicMenuSection[]> {
    const res = await api.get<{ data: PublicMenuSection[] }>('/public/app-menu')
    return res.data.data
  },

  async getSystemModules(): Promise<PublicSystemModule[]> {
    const res = await api.get<{ data: PublicSystemModule[] }>('/public/app-menu/modules')
    return res.data.data
  },

  async getSidebarSections(): Promise<PublicMenuSection[]> {
    const visibleSections = (sections: PublicMenuSection[]) => sections
      .filter(section => section.isVisible && section.showInSidebar)
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.isVisible && item.showInSidebar),
      }))
      .filter(section => section.items.length > 0)

    try {
      const sections = visibleSections(await this.getPublicMenu())
      if (sections.length > 0) return sections
    } catch {
      // Menü tanımları okunamazsa aktif sistem modülleriyle yedek menü oluşturulur.
    }

    const modules = await this.getSystemModules()
    const items: PublicMenuItem[] = modules
      .filter(module => module.isActive && module.citizenRoute)
      .map(module => ({
        id: `module-${module.id}`,
        title: module.label,
        icon: module.icon,
        iconType: 0,
        color: module.color || '#6366F1',
        linkType: 0,
        linkTarget: module.citizenRoute,
        mobileLinkTarget: null,
        showInSidebar: true,
        showInMobile: true,
        isVisible: true,
        isPopular: false,
        badgeText: null,
        badgeTone: null,
        requiresAuth: true,
      }))

    return items.length === 0 ? [] : [{
      id: 'active-system-modules',
      key: 'active-system-modules',
      title: 'Modüller',
      icon: 'LayersIcon',
      isVisible: true,
      showInSidebar: true,
      showInMobile: true,
      order: 0,
      items,
    }]
  },
}

export default appMenuService

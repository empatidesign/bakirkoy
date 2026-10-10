import { api } from './api'

export type TopMenuLinkType = 0 | 1 | 2 // 0=Internal, 1=External, 2=WebView

export interface TopMenuItem {
  id: string
  title: string
  icon: string
  iconType: 0 | 1
  color: string
  linkType: TopMenuLinkType
  linkTarget: string
  openInBlank: boolean
  isVisible: boolean
  order: number
}

export interface TopMenuItemForm {
  title: string
  icon: string
  iconType: 0 | 1
  color: string
  linkType: TopMenuLinkType
  linkTarget: string
  openInBlank: boolean
  isVisible?: boolean
  order?: number
}

const topMenuService = {
  async getAll(): Promise<TopMenuItem[]> {
    const res = await api.get<{ data: TopMenuItem[] }>('/top-menu/')
    return res.data.data
  },

  async create(data: TopMenuItemForm): Promise<TopMenuItem> {
    const res = await api.post<{ data: TopMenuItem }>('/top-menu/', data)
    return res.data.data
  },

  async update(id: string, data: TopMenuItemForm & { isVisible: boolean; order: number }): Promise<TopMenuItem> {
    const res = await api.put<{ data: TopMenuItem }>(`/top-menu/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/top-menu/${id}`)
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await api.put('/top-menu/reorder', { orderedIds })
  },
}

export default topMenuService

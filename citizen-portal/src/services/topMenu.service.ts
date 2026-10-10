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

const topMenuService = {
  async getPublic(): Promise<TopMenuItem[]> {
    const res = await api.get<{ data: TopMenuItem[] }>('/public/top-menu')
    return res.data.data
  },
}

export default topMenuService

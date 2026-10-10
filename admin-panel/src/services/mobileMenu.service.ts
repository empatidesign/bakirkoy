import { api } from './api'
import type {
  MobileMenuItem, MobileMenuItemFormData, MobileMenuGroup,
  MobileMenuBanner, UpsertBannerData,
} from '@/types/mobileMenu.types'

const mobileMenuService = {
  async getItems(): Promise<MobileMenuItem[]> {
    const res = await api.get<{ data: MobileMenuItem[] }>('/mobile-menu/items')
    return res.data.data
  },

  async createItem(data: MobileMenuItemFormData): Promise<MobileMenuItem> {
    const res = await api.post<{ data: MobileMenuItem }>('/mobile-menu/items', data)
    return res.data.data
  },

  async updateItem(id: string, data: MobileMenuItemFormData): Promise<MobileMenuItem> {
    const res = await api.put<{ data: MobileMenuItem }>(`/mobile-menu/items/${id}`, data)
    return res.data.data
  },

  async deleteItem(id: string): Promise<void> {
    await api.delete(`/mobile-menu/items/${id}`)
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await api.put('/mobile-menu/items/reorder', { orderedIds })
  },

  async getGroups(): Promise<MobileMenuGroup[]> {
    const res = await api.get<{ data: MobileMenuGroup[] }>('/mobile-menu/groups')
    return res.data.data
  },

  async getBanners(): Promise<MobileMenuBanner[]> {
    const res = await api.get<{ data: MobileMenuBanner[] }>('/mobile-menu/banners')
    return res.data.data
  },

  async upsertBanner(pageKey: string, data: UpsertBannerData): Promise<MobileMenuBanner> {
    const res = await api.put<{ data: MobileMenuBanner }>(`/mobile-menu/banners/${pageKey}`, data)
    return res.data.data
  },

  async deleteBanner(pageKey: string): Promise<void> {
    await api.delete(`/mobile-menu/banners/${pageKey}`)
  },

  async uploadImage(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/mobile-menu/images', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
}

export default mobileMenuService

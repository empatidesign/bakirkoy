import { api } from './api'
import type {
  SystemModule, MenuSection, MenuItem,
  CreateMenuSectionForm, UpdateMenuSectionForm, MenuItemForm,
} from '@/types/appMenu.types'

const appMenuService = {
  async getModules(): Promise<SystemModule[]> {
    const res = await api.get<{ data: SystemModule[] }>('/app-menu/modules')
    return res.data.data
  },

  async upsertModule(key: string, data: Omit<SystemModule, 'id' | 'key'>): Promise<SystemModule> {
    const res = await api.put<{ data: SystemModule }>(`/app-menu/modules/${key}`, data)
    return res.data.data
  },

  async setModuleActive(key: string, isActive: boolean): Promise<void> {
    await api.patch(`/app-menu/modules/${key}/active`, { isActive })
  },

  async reorderModules(orderedIds: string[]): Promise<void> {
    await api.put('/app-menu/modules/reorder', { orderedIds })
  },

  async getSections(): Promise<MenuSection[]> {
    const res = await api.get<{ data: MenuSection[] }>('/app-menu/sections')
    return res.data.data
  },

  async createSection(data: CreateMenuSectionForm): Promise<MenuSection> {
    const res = await api.post<{ data: MenuSection }>('/app-menu/sections', data)
    return res.data.data
  },

  async updateSection(id: string, data: UpdateMenuSectionForm): Promise<MenuSection> {
    const res = await api.put<{ data: MenuSection }>(`/app-menu/sections/${id}`, data)
    return res.data.data
  },

  async deleteSection(id: string): Promise<void> {
    await api.delete(`/app-menu/sections/${id}`)
  },

  async reorderSections(orderedIds: string[]): Promise<void> {
    await api.put('/app-menu/sections/reorder', { orderedIds })
  },

  async createItem(data: MenuItemForm): Promise<MenuItem> {
    const res = await api.post<{ data: MenuItem }>('/app-menu/items', data)
    return res.data.data
  },

  async updateItem(id: string, data: MenuItemForm): Promise<MenuItem> {
    const res = await api.put<{ data: MenuItem }>(`/app-menu/items/${id}`, data)
    return res.data.data
  },

  async deleteItem(id: string): Promise<void> {
    await api.delete(`/app-menu/items/${id}`)
  },

  async reorderItems(sectionId: string, orderedIds: string[]): Promise<void> {
    await api.put(`/app-menu/sections/${sectionId}/items/reorder`, { orderedIds })
  },
}

export default appMenuService

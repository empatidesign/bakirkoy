import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  CatalogModule,
  PermissionRole,
  PermissionRoleDetail,
  SavePermissionRoleRequest,
} from '@/types/permission.types'

const permissionService = {
  async getCatalog(): Promise<CatalogModule[]> {
    const res = await api.get<{ data: CatalogModule[] }>('/permissions/catalog')
    return res.data.data
  },

  async getRoles(params: Record<string, unknown>): Promise<PagedResult<PermissionRole>> {
    const res = await api.get<{ data: PagedResult<PermissionRole> }>('/roles', { params })
    return res.data.data
  },

  async getRole(id: string): Promise<PermissionRoleDetail> {
    const res = await api.get<{ data: PermissionRoleDetail }>(`/roles/${id}`)
    return res.data.data
  },

  async create(data: SavePermissionRoleRequest): Promise<PermissionRole> {
    const res = await api.post<{ data: PermissionRole }>('/roles', data)
    return res.data.data
  },

  async update(id: string, data: SavePermissionRoleRequest): Promise<PermissionRole> {
    const res = await api.put<{ data: PermissionRole }>(`/roles/${id}`, data)
    return res.data.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/roles/${id}`)
  },

  async toggleStatus(id: string): Promise<void> {
    await api.patch(`/roles/${id}/toggle-status`)
  },
}

export default permissionService

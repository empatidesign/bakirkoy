import { api } from './api'
import type { RoleOption } from '@/types/role.types'

const roleService = {
  async getOptions(): Promise<RoleOption[]> {
    const res = await api.get<{ data: RoleOption[] }>('/roles/options')
    return res.data.data
  },
}

export default roleService

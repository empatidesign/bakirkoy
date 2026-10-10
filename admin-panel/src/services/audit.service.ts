import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { AuditLogItem, AuditLogDetail, AuditLogFilterOptions } from '@/types/audit.types'

const auditService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<AuditLogItem>> {
    const res = await api.get<{ data: PagedResult<AuditLogItem> }>('/audit-logs', { params })
    return res.data.data
  },

  async getById(id: string): Promise<AuditLogDetail> {
    const res = await api.get<{ data: AuditLogDetail }>(`/audit-logs/${id}`)
    return res.data.data
  },

  async getFilters(): Promise<AuditLogFilterOptions> {
    const res = await api.get<{ data: AuditLogFilterOptions }>('/audit-logs/filters')
    return res.data.data
  },
}

export default auditService

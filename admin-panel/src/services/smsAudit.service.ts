import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  SmsSendLogListItem, SmsDashboardSummary, SmsDailyStatItem, SmsUserStatItem, SmsDepartmentStatItem,
} from '@/types/smsAudit.types'

const smsAuditService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<SmsSendLogListItem>> {
    const res = await api.get<{ data: PagedResult<SmsSendLogListItem> }>('/sms-audit', { params })
    return res.data.data
  },

  async getSummary(): Promise<SmsDashboardSummary> {
    const res = await api.get<{ data: SmsDashboardSummary }>('/sms-audit/summary')
    return res.data.data
  },

  async getDailyStats(params: { from?: string; to?: string }): Promise<SmsDailyStatItem[]> {
    const res = await api.get<{ data: SmsDailyStatItem[] }>('/sms-audit/daily-stats', { params })
    return res.data.data
  },

  async getUserStats(params: { from?: string; to?: string }): Promise<SmsUserStatItem[]> {
    const res = await api.get<{ data: SmsUserStatItem[] }>('/sms-audit/user-stats', { params })
    return res.data.data
  },

  async getDepartmentStats(params: { from?: string; to?: string }): Promise<SmsDepartmentStatItem[]> {
    const res = await api.get<{ data: SmsDepartmentStatItem[] }>('/sms-audit/department-stats', { params })
    return res.data.data
  },
}

export default smsAuditService

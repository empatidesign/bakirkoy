import { api } from './api'
import { filenameFromContentDisposition } from '@/lib/utils'
import type { PagedResult } from '@/types/common'
import type { ActivityEntry, ActivitySummary } from '@/types/attendance.types'

const attendanceService = {
  async getActivity(params: Record<string, unknown>): Promise<PagedResult<ActivityEntry>> {
    const res = await api.get<{ data: PagedResult<ActivityEntry> }>('/event-activity', { params })
    return res.data.data
  },

  async getActivitySummary(params: Record<string, unknown>): Promise<ActivitySummary> {
    const res = await api.get<{ data: ActivitySummary }>('/event-activity/summary', { params: { page: 1, limit: 1, ...params } })
    return res.data.data
  },

  async exportActivity(params: Record<string, unknown> = {}): Promise<{ blob: Blob; fileName: string }> {
    const res = await api.get('/event-activity/export', { params, responseType: 'blob' })
    const fileName = filenameFromContentDisposition(
      res.headers['content-disposition'] as string | undefined, 'etkinlik-katilim.xlsx')
    return { blob: res.data as Blob, fileName }
  },
}

export default attendanceService

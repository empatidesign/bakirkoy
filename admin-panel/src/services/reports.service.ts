import { api } from './api'
import type {
  ReportsOverview, ReportsOverviewParams, ReportsParticipantDetail,
  ParticipantActivityReport, ParticipantActivityReportParams, ParticipantActivityDetail,
} from '@/types/reports.types'

const reportsService = {
  async getOverview(params: ReportsOverviewParams): Promise<ReportsOverview> {
    const res = await api.get<{ data: ReportsOverview }>('/reports/overview', { params })
    return res.data.data
  },

  async getParticipantDetail(
    identity: { participantId?: string; tckn?: string; fullName?: string },
    params: ReportsOverviewParams,
  ): Promise<ReportsParticipantDetail> {
    const res = await api.get<{ data: ReportsParticipantDetail }>('/reports/participant', {
      params: { ...identity, ...params },
    })
    return res.data.data
  },

  async getAiSummary(params: ReportsOverviewParams, provider?: string): Promise<string> {
    const res = await api.post<{ data: { summary: string } }>('/reports/overview/ai-summary', null, {
      params: { ...params, provider },
    })
    return res.data.data.summary
  },

  async getParticipantActivity(params: ParticipantActivityReportParams): Promise<ParticipantActivityReport> {
    const res = await api.get<{ data: ParticipantActivityReport }>('/reports/participant-activity', { params })
    return res.data.data
  },

  async getParticipantActivityDetail(
    identity: { participantId?: string; tckn?: string },
    params: ParticipantActivityReportParams,
  ): Promise<ParticipantActivityDetail> {
    const res = await api.get<{ data: ParticipantActivityDetail }>('/reports/participant-activity/detail', {
      params: { ...identity, ...params },
    })
    return res.data.data
  },
}

export default reportsService

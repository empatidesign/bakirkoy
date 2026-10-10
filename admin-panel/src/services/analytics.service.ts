import { api, silentRequest } from './api'
import type { AnalyticsOverview, AnalyticsOverviewParams, DashboardActivity, OnlineUsers } from '@/types/analytics.types'

const analyticsService = {
  async getOverview(params: AnalyticsOverviewParams): Promise<AnalyticsOverview> {
    const res = await api.get<{ data: AnalyticsOverview }>('/analytics/overview', { ...silentRequest, params })
    return res.data.data
  },

  async getDashboardActivity(): Promise<DashboardActivity> {
    const res = await api.get<{ data: DashboardActivity }>('/analytics/dashboard-activity', silentRequest)
    return res.data.data
  },

  // Anlık online kullanıcı sayısı + 5 dakikalık ölçümlerden oluşan trend.
  async getOnlineUsers(trendHours = 24): Promise<OnlineUsers> {
    const res = await api.get<{ data: OnlineUsers }>('/analytics/online-users', { ...silentRequest, params: { trendHours } })
    return res.data.data
  },
}

export default analyticsService

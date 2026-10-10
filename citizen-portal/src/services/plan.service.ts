import { api } from './api'

export interface TodayPlanItem {
  type: 'event' | 'travel' | 'facility'
  title: string
  time: string | null
  date: string
  personNames: (string | null)[]
  venueName: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface UpcomingFacilityParticipant {
  personName: string | null
  isSelf: boolean
}

export interface UpcomingFacilityPlan {
  title: string
  venueName: string | null
  date: string
  timeRange: string | null
  participants: UpcomingFacilityParticipant[]
  latitude?: number | null
  longitude?: number | null
}

const planService = {
  async todayPlans(): Promise<TodayPlanItem[]> {
    const res = await api.get<{ data: TodayPlanItem[] }>('/me/today-plans')
    return res.data.data
  },

  async upcomingFacilityPlans(): Promise<UpcomingFacilityPlan[]> {
    const res = await api.get<{ data: UpcomingFacilityPlan[] }>('/me/upcoming-facility-plans')
    return res.data.data
  },
}

export default planService

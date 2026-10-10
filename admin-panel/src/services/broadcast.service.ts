import { api } from './api'

export type BroadcastTarget = 'event' | 'session' | 'travel' | 'travelRoute' | 'facilityGroup' | 'facilityApplicationIds' | 'facilityIds' | 'facilityRegistrationIds' | 'quiz' | 'quizParticipation' | 'survey' | 'giftRequest' | 'sedaApplication' | 'participant' | 'allMembers'

export interface BroadcastResult {
  recipients: number
  smsSent: number
  notificationsCreated: number
  smsMockMode?: boolean
}

const broadcastService = {
  async send(payload: {
    target: BroadcastTarget
    ids: string[]
    sms: boolean
    notify: boolean
    message: string
  }): Promise<BroadcastResult> {
    const res = await api.post<{ data: BroadcastResult }>('/notifications/broadcast', payload)
    return res.data.data
  },
}

export default broadcastService

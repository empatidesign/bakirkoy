import { api, silentRequest } from './api'
import type { OnlinePerson } from '@/types/presence.types'

export interface BroadcastInput {
  target: 'all' | 'group'
  message: string
  alsoSms?: boolean
}

export interface BroadcastResult {
  recipientCount: number
}

export const presenceService = {
  async getOnline(): Promise<OnlinePerson[]> {
    const res = await api.get<{ data: OnlinePerson[] }>('/me/presence/online')
    return res.data.data ?? []
  },
  async heartbeat(device: 'web' | 'ios' | 'android' = 'web'): Promise<void> {
    await api.post('/me/presence/heartbeat', { device }, silentRequest)
  },
  async broadcast(input: BroadcastInput): Promise<BroadcastResult> {
    const res = await api.post<{ data: BroadcastResult }>('/me/presence/broadcast', input)
    return res.data.data ?? { recipientCount: 0 }
  },
}

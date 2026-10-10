import { api, silentRequest } from './api'
import type {
  TeamMember,
  TeamNote,
  CreateTeamNote,
  TeamTask,
  CreateTeamTask,
  TeamMessage,
  TeamNotification,
  SendTeamNotification,
  TeamUnreadSummary,
} from '@/types/team.types'

const base = '/me/team'

export const teamService = {
  async getMembers(): Promise<TeamMember[]> {
    return (await api.get<{ data: TeamMember[] }>(`${base}/members`)).data.data ?? []
  },
  async getSubordinates(): Promise<TeamMember[]> {
    return (await api.get<{ data: TeamMember[] }>(`${base}/subordinates`, silentRequest)).data.data ?? []
  },

  async getNotes(): Promise<TeamNote[]> {
    return (await api.get<{ data: TeamNote[] }>(`${base}/notes`, silentRequest)).data.data ?? []
  },
  async createNote(body: CreateTeamNote): Promise<TeamNote> {
    return (await api.post<{ data: TeamNote }>(`${base}/notes`, body)).data.data
  },
  async updateNote(id: string, body: Omit<CreateTeamNote, 'targetUserId'>): Promise<TeamNote> {
    return (await api.put<{ data: TeamNote }>(`${base}/notes/${id}`, body)).data.data
  },
  async pinNote(id: string): Promise<void> {
    await api.patch(`${base}/notes/${id}/pin`)
  },
  async deleteNote(id: string): Promise<void> {
    await api.delete(`${base}/notes/${id}`)
  },

  async getTasks(): Promise<TeamTask[]> {
    return (await api.get<{ data: TeamTask[] }>(`${base}/tasks`)).data.data ?? []
  },
  async createTask(body: CreateTeamTask): Promise<TeamTask> {
    return (await api.post<{ data: TeamTask }>(`${base}/tasks`, body)).data.data
  },
  async setTaskStatus(id: string, done: boolean): Promise<TeamTask> {
    return (await api.patch<{ data: TeamTask }>(`${base}/tasks/${id}/status?done=${done}`)).data.data
  },
  async deleteTask(id: string): Promise<void> {
    await api.delete(`${base}/tasks/${id}`)
  },

  async getThread(otherId: string): Promise<TeamMessage[]> {
    return (await api.get<{ data: TeamMessage[] }>(`${base}/messages/${otherId}`)).data.data ?? []
  },
  async sendMessage(recipientId: string, text: string): Promise<TeamMessage> {
    return (await api.post<{ data: TeamMessage }>(`${base}/messages`, { recipientId, text })).data.data
  },
  async getUnreadSummary(): Promise<TeamUnreadSummary> {
    return (await api.get<{ data: TeamUnreadSummary }>(`${base}/messages-unread`)).data.data ?? { total: 0, perSender: [] }
  },
  async markThreadRead(otherId: string): Promise<void> {
    await api.post(`${base}/messages/${otherId}/read`)
  },

  async getNotifications(): Promise<TeamNotification[]> {
    return (await api.get<{ data: TeamNotification[] }>(`${base}/notifications`)).data.data ?? []
  },
  async getNotificationsUnreadCount(): Promise<number> {
    return (await api.get<{ data: { unreadCount: number } }>(`${base}/notifications/unread-count`, silentRequest)).data.data?.unreadCount ?? 0
  },
  async sendNotification(body: SendTeamNotification): Promise<void> {
    await api.post(`${base}/notifications`, body)
  },
  async markNotificationRead(id: string): Promise<void> {
    await api.patch(`${base}/notifications/${id}/read`)
  },
}

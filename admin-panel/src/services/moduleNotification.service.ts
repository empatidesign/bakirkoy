import { api } from './api'
import type { ModuleManualMessageRequest, ModuleManualMessageResult, ModuleNotificationSettings } from '@/types/moduleNotification.types'

const unwrap = <T>(res: { data: { data: T } }) => res.data.data

const settingsPath: Record<string, string> = {
  quiz: '/quiz/notification-settings',
  survey: '/surveys/notification-settings',
  wheel: '/wheel/notification-settings',
  muhtarlik: '/muhtarlik/notification-settings',
}

const sendPath: Record<string, string> = {
  quiz: '/quizzes/messages/send',
  survey: '/surveys/messages/send',
  wheel: '/wheel/gift-requests/messages/send',
  muhtarlik: '/muhtarlik/messages/send',
}

export const moduleNotificationService = {
  async getSettings(module: keyof typeof settingsPath) {
    return unwrap<ModuleNotificationSettings>(await api.get(settingsPath[module]))
  },
  async saveSettings(module: keyof typeof settingsPath, settings: ModuleNotificationSettings) {
    return unwrap<ModuleNotificationSettings>(await api.put(settingsPath[module], settings))
  },
  async send(module: keyof typeof sendPath, request: ModuleManualMessageRequest) {
    return unwrap<ModuleManualMessageResult>(await api.post(sendPath[module], request))
  },
}

export default moduleNotificationService

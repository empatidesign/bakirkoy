import { api } from './api'
import { tokenStorage } from './tokenStorage'
import type { PublicMapConfig } from '@/types/integrationSettings.types'

const integrationSettingsService = {
  async getMapConfig(): Promise<PublicMapConfig> {
    const hasSession = !!tokenStorage.getAccessToken()
    const path = !hasSession
      ? '/public/integration-settings/map-config'
      : tokenStorage.getKind() === 'company'
        ? '/company/me/integration-settings/map-config'
        : '/me/integration-settings/map-config'
    const res = await api.get<{ data: PublicMapConfig }>(path)
    return res.data.data
  },
}

export default integrationSettingsService

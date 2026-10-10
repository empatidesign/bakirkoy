import { api } from './api'
import type { IntegrationSettings, PublicMapConfig, UlakbelTestResult, UpdateIntegrationSettingsRequest } from '@/types/integrationSettings.types'

const integrationSettingsService = {
  async get(): Promise<IntegrationSettings> {
    const res = await api.get<{ data: IntegrationSettings }>('/integration-settings')
    return res.data.data
  },

  async save(data: UpdateIntegrationSettingsRequest): Promise<IntegrationSettings> {
    const res = await api.put<{ data: IntegrationSettings }>('/integration-settings', data)
    return res.data.data
  },

  async getMapConfig(): Promise<PublicMapConfig> {
    const res = await api.get<{ data: PublicMapConfig }>('/integration-settings/map-config')
    return res.data.data
  },

  async testUlakbel(): Promise<UlakbelTestResult> {
    const res = await api.post<{ data: UlakbelTestResult }>('/integration-settings/ulakbel/test')
    return res.data.data
  },

  async testFlexcity(tckn?: string): Promise<UlakbelTestResult> {
    const res = await api.post<{ data: UlakbelTestResult }>('/integration-settings/flexcity/test', { tckn: tckn || null })
    return res.data.data
  },

  async testBridge360(): Promise<UlakbelTestResult> {
    const res = await api.post<{ data: UlakbelTestResult }>('/integration-settings/bridge360/test')
    return res.data.data
  },
}

export default integrationSettingsService


export interface MapProviderSettings {
  enabled: boolean
  hasApiKey: boolean
  maskedApiKey: string | null
}

export interface AiProviderSettings {
  enabled: boolean
  hasApiKey: boolean
  maskedApiKey: string | null
  model: string | null
}

export interface UlakbelSettings {
  enabled: boolean
  baseUrl: string | null
  hasApiToken: boolean
  maskedApiToken: string | null
  notifyCitizenOnUpdate: boolean
  sourceId: number | null
}

export interface IntegrationSettings {
  googleMaps: MapProviderSettings
  openAi: AiProviderSettings
  anthropic: AiProviderSettings
  gemini: AiProviderSettings
  defaultAiProvider: string | null
  ulakbel: UlakbelSettings
  flexcity?: FlexcitySettings | null
  bridge360?: Bridge360Settings | null
}

export interface FlexcitySettings {
  enabled: boolean
  baseUrl: string | null
  hasAppKey: boolean
  maskedAppKey: string | null
  hasSecurityCode: boolean
}

// Bridge360 belediye çağrı merkezi entegrasyonu — Kullanıcı isteği (2026-10-07): Halk Masası
// mock modülü kaldırılırken, ileride eklenecek Bridge360 iletimi için ayar ekranı hazırlandı.
// Gerçek Bridge360 API dokümanı henüz sağlanmadığından sadece bağlantı ayarları ve genel bir
// erişim testi vardır; Ulakbell'deki gibi gerçek bir "/forward" çağrısı YOKTUR.
export interface Bridge360Settings {
  enabled: boolean
  baseUrl: string | null
  hasApiKey: boolean
  maskedApiKey: string | null
}

export interface UpdateBridge360SettingsRequest {
  enabled: boolean
  baseUrl: string | null
  apiKey: string | null
  clearApiKey: boolean
}

export interface UpdateFlexcitySettingsRequest {
  enabled: boolean
  baseUrl: string | null
  appKey: string | null
  securityCode: string | null
  clearCredentials: boolean
}

export interface UpdateMapProviderRequest {
  enabled: boolean
  apiKey: string | null
  clearApiKey: boolean
}

export interface UpdateAiProviderRequest {
  enabled: boolean
  apiKey: string | null
  clearApiKey: boolean
  model: string | null
}

export interface UpdateUlakbelSettingsRequest {
  enabled: boolean
  baseUrl: string | null
  apiToken: string | null
  clearApiToken: boolean
  notifyCitizenOnUpdate: boolean
  sourceId: number | null
}

export interface UpdateIntegrationSettingsRequest {
  googleMaps: UpdateMapProviderRequest
  openAi: UpdateAiProviderRequest
  anthropic: UpdateAiProviderRequest
  gemini: UpdateAiProviderRequest
  defaultAiProvider: string | null
  ulakbel: UpdateUlakbelSettingsRequest
  flexcity?: UpdateFlexcitySettingsRequest
  bridge360?: UpdateBridge360SettingsRequest
}

export interface UlakbelTestResult {
  reachable: boolean
  statusCode?: number
  message: string
}

export interface PublicMapConfig {
  enabled: boolean
  apiKey: string | null
}

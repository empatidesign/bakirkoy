import { api } from './api'

export interface MobileAppConfig {
  webViewEnabled: boolean
  webViewUrl: string
  webViewMaxVersion: string | null
  webViewMessage: string | null
  androidMinVersion: string | null
  androidLatestVersion: string | null
  androidStoreUrl: string | null
  iosMinVersion: string | null
  iosLatestVersion: string | null
  iosStoreUrl: string | null
  updateMessage: string | null
  updateReleaseNotes: string | null
  splashImageUrl: string | null
  homeLogoUrl: string | null
  tabBarLogoUrl: string | null
  onboardingImageUrls: string[]
  legalDocuments: LegalDocuments
  updatedAt: string | null
}

export interface LegalDocuments {
  citizenKvkk: string
  citizenNotification: string
  companyKvkk: string
  companyNotification: string
  companyStaffKvkk: string
  companyStaffNotification: string
}

export interface UpdateMobileWebViewRequest {
  enabled: boolean
  url: string
  maxVersion: string | null
  message: string | null
}

export interface UpdateVersionControlRequest {
  androidMinVersion: string | null
  androidLatestVersion: string | null
  androidStoreUrl: string | null
  iosMinVersion: string | null
  iosLatestVersion: string | null
  iosStoreUrl: string | null
  updateMessage: string | null
  updateReleaseNotes: string | null
}

export const mobileConfigService = {
  async get(): Promise<MobileAppConfig> {
    const res = await api.get<{ data: MobileAppConfig }>('/mobile-config')
    return res.data.data
  },

  async updateWebView(req: UpdateMobileWebViewRequest): Promise<MobileAppConfig> {
    const res = await api.put<{ data: MobileAppConfig }>('/mobile-config/webview', req)
    return res.data.data
  },

  async updateVersionControl(req: UpdateVersionControlRequest): Promise<MobileAppConfig> {
    const res = await api.put<{ data: MobileAppConfig }>('/mobile-config/version-control', req)
    return res.data.data
  },

  async updateSplashImage(imageUrl: string | null): Promise<MobileAppConfig> {
    const res = await api.put<{ data: MobileAppConfig }>('/mobile-config/splash-image', { imageUrl })
    return res.data.data
  },

  async uploadSplashImage(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/mobile-config/splash-image/upload', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async updateOnboardingImages(imageUrls: string[]): Promise<MobileAppConfig> {
    const res = await api.put<{ data: MobileAppConfig }>('/mobile-config/onboarding-images', { imageUrls })
    return res.data.data
  },

  async uploadOnboardingImage(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/mobile-config/onboarding-images/upload', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async updateHomeLogo(imageUrl: string | null): Promise<MobileAppConfig> {
    const res = await api.put<{ data: MobileAppConfig }>('/mobile-config/home-logo', { imageUrl })
    return res.data.data
  },

  async updateTabBarLogo(imageUrl: string | null): Promise<MobileAppConfig> {
    const res = await api.put<{ data: MobileAppConfig }>('/mobile-config/tabbar-logo', { imageUrl })
    return res.data.data
  },

  async uploadLogo(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/mobile-config/logo/upload', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async updateLegalDocuments(req: LegalDocuments): Promise<MobileAppConfig> {
    const res = await api.put<{ data: MobileAppConfig }>('/mobile-config/legal-documents', req)
    return res.data.data
  },
}

export interface MobileQuickAction {
  id: string
  target: string
  label: string
  icon: string
  color: string
  sortOrder: number
  isActive: boolean
  requiresAuth: boolean
  targetUrl: string | null
  updatedAt: string | null
}

export interface MobileQuickActionTarget {
  target: string
  displayName: string
  requiresUrl: boolean
}

export interface MobileQuickActionTargetsResponse {
  targets: MobileQuickActionTarget[]
  maxActiveCount: number
  appScreens: string[]
}

export interface SaveMobileQuickActionRequest {
  target: string
  label: string
  icon: string
  color: string
  isActive: boolean
  requiresAuth: boolean
  targetUrl: string | null
}

export const mobileQuickActionService = {
  async list(): Promise<MobileQuickAction[]> {
    const res = await api.get<{ data: MobileQuickAction[] }>('/mobile-config/quick-actions')
    return res.data.data
  },

  async targets(): Promise<MobileQuickActionTargetsResponse> {
    const res = await api.get<{ data: MobileQuickActionTargetsResponse }>('/mobile-config/quick-actions/targets')
    return res.data.data
  },

  async create(req: SaveMobileQuickActionRequest): Promise<MobileQuickAction> {
    const res = await api.post<{ data: MobileQuickAction }>('/mobile-config/quick-actions', req)
    return res.data.data
  },

  async update(id: string, req: SaveMobileQuickActionRequest): Promise<MobileQuickAction> {
    const res = await api.put<{ data: MobileQuickAction }>(`/mobile-config/quick-actions/${id}`, req)
    return res.data.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/mobile-config/quick-actions/${id}`)
  },

  async reorder(orderedIds: string[]): Promise<MobileQuickAction[]> {
    const res = await api.put<{ data: MobileQuickAction[] }>('/mobile-config/quick-actions/reorder', { orderedIds })
    return res.data.data
  },
}

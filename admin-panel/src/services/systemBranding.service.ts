import axios from 'axios'
import { api } from './api'

export interface SystemBrandingData {
  logoUrl: string | null
  horizontalLogoUrl: string | null
  updatedAt: string | null
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

const systemBrandingService = {
  async get(): Promise<SystemBrandingData> {
    const res = await api.get<{ data: SystemBrandingData }>('/system-branding')
    return res.data.data
  },

  async getPublic(): Promise<SystemBrandingData> {
    const res = await axios.get<{ data: SystemBrandingData }>(
      `${BASE_URL}/api/v1/public/system-branding`,
    )
    return res.data.data
  },

  async uploadLogo(file: File): Promise<{ objectName: string; url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { objectName: string; url: string } }>(
      '/system-branding/logo',
      body,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data
  },

  async removeLogo(): Promise<SystemBrandingData> {
    const res = await api.delete<{ data: SystemBrandingData }>('/system-branding/logo')
    return res.data.data
  },

  async uploadHorizontalLogo(file: File): Promise<{ objectName: string; url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { objectName: string; url: string } }>(
      '/system-branding/logo-horizontal',
      body,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data
  },

  async removeHorizontalLogo(): Promise<SystemBrandingData> {
    const res = await api.delete<{ data: SystemBrandingData }>('/system-branding/logo-horizontal')
    return res.data.data
  },
}

export default systemBrandingService

import { api } from './api'

export interface DeviceMonitorItem {
  id: string
  source: string
  name: string
  direction: string
  deviceCode?: string | null
  deviceId?: string | null
  isActive: boolean
  isOnline: boolean
  lastSeenAt?: string | null
  parentId: string
  parentName: string
  parentModule?: string | null
  operationMode?: 'directional' | 'toggle' | null
}

export interface DeviceMonitorSnapshot {
  devices: DeviceMonitorItem[]
  onlineCount: number
  offlineCount: number
  generatedAt: string
}

const deviceMonitorService = {
  async getSnapshot(): Promise<DeviceMonitorSnapshot> {
    const res = await api.get<{ data: DeviceMonitorSnapshot }>('/device-monitor/snapshot')
    return res.data.data
  },
}

export default deviceMonitorService

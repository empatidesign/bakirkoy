import type { ComponentType } from 'react'
import { ToiletIcon, DropletIcon, ZapIcon, BatteryChargingIcon, FlameIcon, TentIcon } from 'lucide-react'

export type EmergencyAreaStatus = 'Active' | 'Passive'

export type EmergencyEquipmentKey =
  | 'toilet'
  | 'water'
  | 'electricity'
  | 'generator'
  | 'heating'
  | 'tentArea'

export type EmergencyEquipment = Record<EmergencyEquipmentKey, boolean>

export interface EmergencyArea {
  id: string
  name: string
  neighborhood: string
  address: string
  latitude?: number
  longitude?: number
  capacity: number
  areaSizeM2: number
  equipment: EmergencyEquipment

  managerId?: string
  managerRoleKey?: string
  managerRoleName?: string
  manager: string
  managerPhone: string
  managerEmail?: string
  emergencyPhone?: string

  description?: string
  status: EmergencyAreaStatus
  createdAt: string
  externalSource?: string | null
  externalId?: number | null
  externalSyncedAt?: string | null
}

export interface AfadSyncStatus {
  configured: boolean
  lastSyncedAt?: string | null
  syncedCount: number
}

export interface AfadSyncResult {
  success: boolean
  fetched: number
  created: number
  updated: number
  removed: number
  error?: string | null
}

export interface EmergencyAreaRequest {
  name: string
  neighborhood: string
  address: string
  latitude?: number
  longitude?: number
  capacity: number
  areaSizeM2: number
  equipment: EmergencyEquipment

  managerId?: string
  manager: string
  managerPhone: string
  managerEmail?: string
  emergencyPhone?: string

  grantAccess?: boolean
  tckn?: string
  roleTemplateKey?: string

  description?: string
}

export interface EmergencyAreaMapPoint {
  id: string
  name: string
  neighborhood: string
  latitude?: number
  longitude?: number
  capacity: number
  status: EmergencyAreaStatus
}

export interface EmergencyAreaSummary {
  total: number
  active: number
  passive: number
  totalCapacity: number
  totalAreaM2: number
}

type Tone = 'success' | 'neutral' | 'danger' | 'warning' | 'info' | 'primary'

export const EMERGENCY_STATUS_LABELS: Record<EmergencyAreaStatus, string> = {
  Active: 'Aktif',
  Passive: 'Pasif',
}

export const EMERGENCY_STATUS_TONE: Record<EmergencyAreaStatus, Tone> = {
  Active: 'success',
  Passive: 'neutral',
}

export const EMERGENCY_STATUS_OPTIONS: { value: EmergencyAreaStatus; label: string }[] = [
  { value: 'Active', label: 'Aktif' },
  { value: 'Passive', label: 'Pasif' },
]

export interface EmergencyEquipmentMeta {
  key: EmergencyEquipmentKey
  label: string
  icon: ComponentType<{ className?: string }>
  color: string
}

export const EMERGENCY_EQUIPMENT_META: EmergencyEquipmentMeta[] = [
  { key: 'toilet', label: 'Tuvalet', icon: ToiletIcon, color: '#3b82f6' },
  { key: 'water', label: 'İçme Suyu', icon: DropletIcon, color: '#06b6d4' },
  { key: 'electricity', label: 'Elektrik', icon: ZapIcon, color: '#f59e0b' },
  { key: 'generator', label: 'Jeneratör', icon: BatteryChargingIcon, color: '#f97316' },
  { key: 'heating', label: 'Isıtma', icon: FlameIcon, color: '#f43f5e' },
  { key: 'tentArea', label: 'Çadır Alanı', icon: TentIcon, color: '#10b981' },
]

export const emptyEquipment = (): EmergencyEquipment => ({
  toilet: false,
  water: false,
  electricity: false,
  generator: false,
  heating: false,
  tentArea: false,
})

export const enabledEquipment = (equipment: EmergencyEquipment): EmergencyEquipmentMeta[] =>
  EMERGENCY_EQUIPMENT_META.filter((m) => equipment[m.key])

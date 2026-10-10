import type { EmergencyArea, EmergencyAreaRequest, EmergencyEquipment } from '@/types/emergencyArea.types'
import { emptyEquipment } from '@/types/emergencyArea.types'
import { isResponsiblePersonValid } from '@/components/specialized/ResponsiblePersonField'

export interface EmergencyAreaForm {
  name: string
  neighborhood: string
  address: string
  latitude?: number
  longitude?: number
  capacity: string
  areaSizeM2: string
  equipment: EmergencyEquipment

  managerId: string
  managerRoleKey: string
  managerRoleName: string
  manager: string
  managerPhone: string
  managerEmail: string
  emergencyPhone: string

  grantAccess: boolean
  tckn: string

  description: string
}

export const emptyEmergencyAreaForm: EmergencyAreaForm = {
  name: '',
  neighborhood: '',
  address: '',
  latitude: undefined,
  longitude: undefined,
  capacity: '',
  areaSizeM2: '',
  equipment: emptyEquipment(),
  managerId: '',
  managerRoleKey: '',
  managerRoleName: '',
  manager: '',
  managerPhone: '',
  managerEmail: '',
  emergencyPhone: '',
  grantAccess: false,
  tckn: '',
  description: '',
}

export const toEmergencyAreaForm = (r: EmergencyArea): EmergencyAreaForm => ({
  name: r.name,
  neighborhood: r.neighborhood,
  address: r.address,
  latitude: r.latitude,
  longitude: r.longitude,
  capacity: r.capacity != null ? String(r.capacity) : '',
  areaSizeM2: r.areaSizeM2 != null ? String(r.areaSizeM2) : '',
  equipment: { ...emptyEquipment(), ...r.equipment },
  managerId: r.managerId ?? '',
  managerRoleKey: r.managerRoleKey ?? '',
  managerRoleName: r.managerRoleName ?? '',
  manager: r.manager ?? '',
  managerPhone: r.managerPhone ?? '',
  managerEmail: r.managerEmail ?? '',
  emergencyPhone: r.emergencyPhone ?? '',
  grantAccess: false,
  tckn: '',
  description: r.description ?? '',
})

export const toEmergencyAreaRequest = (f: EmergencyAreaForm): EmergencyAreaRequest => ({
  name: f.name.trim(),
  neighborhood: f.neighborhood.trim(),
  address: f.address.trim(),
  latitude: f.latitude,
  longitude: f.longitude,
  capacity: f.capacity ? Number(f.capacity) : 0,
  areaSizeM2: f.areaSizeM2 ? Number(f.areaSizeM2) : 0,
  equipment: f.equipment,
  managerId: f.managerId || undefined,
  manager: f.manager.trim(),
  managerPhone: f.managerPhone || '',
  managerEmail: f.managerEmail.trim() || undefined,
  emergencyPhone: f.emergencyPhone || undefined,
  grantAccess: f.grantAccess,
  tckn: f.tckn || undefined,
  roleTemplateKey: f.grantAccess ? 'acil-alan-sorumlusu' : undefined,
  description: f.description.trim() || undefined,
})

export const getEmergencyAreaFormErrors = (f: EmergencyAreaForm): string[] => [
  !f.name.trim() && 'Alan adı zorunludur.',
  !f.neighborhood.trim() && 'Mahalle zorunludur.',
  !f.address.trim() && 'Adres zorunludur.',
  !isResponsiblePersonValid(f) && 'Sorumlu kişi bilgileri eksik veya hatalı.',
].filter(Boolean) as string[]

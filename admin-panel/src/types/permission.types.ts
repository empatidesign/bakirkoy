export interface CatalogModule {
  key: string
  name: string
  group: string
  displayOrder: number
  scopable: boolean
  actions: string[]
}

export interface PermissionRole {
  id: string
  name: string
  key: string
  description?: string
  isActive: boolean
  isSystem: boolean
  isSuperAdmin: boolean
  permissionCount: number
  assignedUserCount: number
  createdAt: string
  color?: string
}

export interface PermissionRoleDetail extends PermissionRole {
  permissionKeys: string[]
}

export interface SavePermissionRoleRequest {
  name: string
  description?: string
  permissionKeys: string[]
}

export const ACTION_ORDER = [
  'view', 'create', 'edit', 'delete', 'approve', 'export', 'assign', 'scan',
  'manage', 'send', 'impersonate', 'manual-open', 'door-access', 'devices',
] as const

export const ACTION_LABELS: Record<string, string> = {
  view: 'Görüntüleme',
  create: 'Ekleme',
  edit: 'Düzenleme',
  delete: 'Silme',
  approve: 'Onaylama',
  export: 'Dışa Aktarma',
  assign: 'Atama',
  scan: 'Tarama',
  manage: 'Yönetim',
  send: 'Gönderme',
  impersonate: 'Kimlik Devralma',
  'manual-open': 'Manuel Kapı Açma',
  'door-access': 'Kapı QR/Manyetik Erişim Yetkisi',
  devices: 'Cihaz Ayarları',
}

export const ACTION_SHORT: Record<string, string> = {
  view: 'Görüntüle',
  create: 'Ekle',
  edit: 'Düzenle',
  delete: 'Sil',
  approve: 'Onayla',
  export: 'Dışa Aktar',
  assign: 'Ata',
  scan: 'Tara',
  manage: 'Yönet',
  send: 'Gönder',
  impersonate: 'Kimliğini Devral',
  'manual-open': 'Kapıyı Aç',
  'door-access': 'Kapı Erişimi',
  devices: 'Cihazlar',
}

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action
export const actionShort = (action: string) => ACTION_SHORT[action] ?? action

export const permKey = (moduleKey: string, action: string) => `${moduleKey}.${action}`

export const orderActions = (actions: string[]): string[] =>
  [...actions].sort((a, b) => {
    const ia = ACTION_ORDER.indexOf(a as (typeof ACTION_ORDER)[number])
    const ib = ACTION_ORDER.indexOf(b as (typeof ACTION_ORDER)[number])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

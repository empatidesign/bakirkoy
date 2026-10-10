export interface Role {
  id: string
  name: string
  key: string
  description?: string
  isActive: boolean
  isSystem: boolean
  isSuperAdmin: boolean
  assignedUserCount: number
  permissionCount?: number
  createdAt: string
  color?: string
}

export interface RoleOption {
  key: string
  name: string
  color?: string
  facilityModule?: string | null
  hasLibraryDoorPermission?: boolean
}

export interface CreateRoleRequest {
  name: string
  description?: string
  permissionKeys?: string[]
}

export interface UpdateRoleRequest {
  name: string
  description?: string
  permissionKeys?: string[]
}

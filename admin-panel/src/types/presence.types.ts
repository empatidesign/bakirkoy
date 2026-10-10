export type PresenceDevice = 'web' | 'ios' | 'android'

export interface OnlinePerson {
  id: string
  fullName: string
  roleName: string
  roleColor?: string
  facilityName?: string
  branchName?: string
  device: PresenceDevice
  lastSeenSeconds: number
  online: boolean
}

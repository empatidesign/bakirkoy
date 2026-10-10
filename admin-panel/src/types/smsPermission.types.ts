// Kullanıcı isteği (2026-10-04): "tüm sistemde toplu sms gönderme sistemi kişilere veya
// yetki gruplarında sms gönderme yetkisinin kimde olacağı tanımlanmalı ... tesislere
// gruplara seanslara toplu eşleştirme atamalarının yapılabileceği bir alan olsun admin
// panelinde roller bölümünde toplu işlemlerin yapılacağı bir sayfa kurulumu yap."

export interface SmsPermissionRole {
  id: string
  key: string
  name: string
  color: string
  isSuperAdmin: boolean
  assignedUserCount: number
  hasSmsSendPermission: boolean
}

export type BulkSmsSendAction = 'grant' | 'revoke'

export interface BulkSmsSendAccessRequest {
  userIds?: string[]
  roleIds?: string[]
  action: BulkSmsSendAction
}

export interface BulkSmsSendAccessResult {
  usersAffected: number
  rolesAffected: number
}

export type ScopeAssignmentKind = 'facility' | 'group' | 'session'

export interface ScopeAssignmentTarget {
  kind: ScopeAssignmentKind
  moduleKey?: string | null
  refId: string
}

export interface BulkScopeAssignmentRequest {
  userIds?: string[]
  roleIds?: string[]
  targets: ScopeAssignmentTarget[]
}

export interface BulkScopeAssignmentResult {
  usersAffected: number
  targetCount: number
  assignmentsApplied: number
}

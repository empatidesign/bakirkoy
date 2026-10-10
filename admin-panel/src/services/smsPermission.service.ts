import { api } from './api'
import type {
  SmsPermissionRole,
  BulkSmsSendAccessRequest,
  BulkSmsSendAccessResult,
  BulkScopeAssignmentRequest,
  BulkScopeAssignmentResult,
} from '@/types/smsPermission.types'

const smsPermissionService = {
  async getRoles(): Promise<SmsPermissionRole[]> {
    const res = await api.get<{ data: SmsPermissionRole[] }>('/sms-permissions/roles')
    return res.data.data
  },

  async getUsersWithAccess(): Promise<string[]> {
    const res = await api.get<{ data: string[] }>('/sms-permissions/users-with-access')
    return res.data.data
  },

  async bulkSetAccess(req: BulkSmsSendAccessRequest): Promise<BulkSmsSendAccessResult> {
    const res = await api.post<{ data: BulkSmsSendAccessResult }>('/sms-permissions/bulk-access', req)
    return res.data.data
  },

  async bulkAssignScope(req: BulkScopeAssignmentRequest): Promise<BulkScopeAssignmentResult> {
    const res = await api.post<{ data: BulkScopeAssignmentResult }>('/sms-permissions/bulk-scope', req)
    return res.data.data
  },
}

export default smsPermissionService

export interface CitizenNotification {
  id: string
  title: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
  personId: string
  personName: string
  isSelf: boolean
  referenceType?: string | null
  referenceId?: string | null
  facilityName?: string | null
  sessionInfo?: string | null
  statusInfo?: string | null
  /** true ise duyuru kapatılamaz popup olarak gösterilir, "Okudum" onayı zorunludur. */
  requiresAck?: boolean
  acknowledgedAt?: string | null
}

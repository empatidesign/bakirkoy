export interface TeamMember {
  id: string
  fullName: string
  roleName: string
  roleColor?: string
  facilityName?: string
  branchName?: string
}

export type NoteTone = 'warning' | 'info' | 'success' | 'danger' | 'primary'

export interface TeamNote {
  id: string
  authorId: string
  authorName: string
  targetUserId: string
  targetName: string
  title: string
  content: string
  tone: NoteTone
  pinned: boolean
  mine: boolean
  createdAt: string
}

export interface CreateTeamNote {
  targetUserId?: string | null
  title: string
  content: string
  tone: NoteTone
}

export interface TeamTask {
  id: string
  assignerId: string
  assignerName: string
  assigneeId: string
  assigneeName: string
  title: string
  description?: string | null
  status: 'pending' | 'done'
  dueDate?: string | null
  completedAt?: string | null
  assignedByMe: boolean
  assignedToMe: boolean
  createdAt: string
}

export interface CreateTeamTask {
  assigneeId: string
  title: string
  description?: string | null
  dueDate?: string | null
}

export interface TeamMessage {
  id: string
  senderId: string
  recipientId: string
  text: string
  mine: boolean
  readAt?: string | null
  sentAt: string
}

export interface TeamUnreadSender {
  senderId: string
  count: number
}

export interface TeamUnreadSummary {
  total: number
  perSender: TeamUnreadSender[]
}

export interface TeamNotification {
  id: string
  title: string
  body: string
  type: string
  referenceType?: string
  referenceId?: string
  isRead: boolean
  createdAt: string
}

export interface SendTeamNotification {
  recipientId: string
  title: string
  message: string
  kind: 'info' | 'warning'
  alsoSms: boolean
}

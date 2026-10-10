export interface SmsSendLogListItem {
  id: string
  createdAt: string
  adminUserId: string
  adminUserName: string
  department?: string | null
  module: string
  description?: string | null
  recipientCount: number
  usedPinOverride: boolean
  usedOtp: boolean
  wasBlocked: boolean
  blockReason?: string | null
  ipAddress?: string | null
}

export interface SmsDashboardSummary {
  todaySentCount: number
  todayBlockedCount: number
  todayPinOverrideCount: number
  todayOtpVerifiedCount: number
  todayTotalRecipients: number
  activeUserCount: number
}

export interface SmsDailyStatItem {
  date: string
  sent: number
  blocked: number
  pinOverrides: number
  otpVerified: number
}

export interface SmsUserStatItem {
  adminUserId: string
  adminUserName: string
  department?: string | null
  sent: number
  blocked: number
  pinOverrides: number
  otpVerified: number
  totalRecipients: number
}

export interface SmsDepartmentStatItem {
  department: string
  sent: number
  blocked: number
  pinOverrides: number
  otpVerified: number
  totalRecipients: number
}

export interface Session {
  id: string
  code: string
  eventId: string
  eventName: string
  eventCategoryName: string
  eventCategoryColor: string
  hallId?: string
  hallName?: string
  facilityId?: string
  facilityName?: string
  date: string
  day: string
  startTime: string
  endTime: string
  capacity: number
  reserveCapacity: number
  registeredCount: number
  reserveCount: number
  isActive: boolean
  instructor?: string
  instructorId?: string
  instructorPhone?: string
  instructorEmail?: string
  emergencyPhone?: string
  createdBy?: string
}

export interface SessionTimeSlot {
  startTime: string
  endTime: string
}

export interface SessionDayPlan {
  day: string
  slots: SessionTimeSlot[]
}

export interface SessionForm {
  eventId: string
  hallId: string
  mode: 'single' | 'recurring'
  date: string
  startTime: string
  endTime: string
  startDate: string
  endDate: string
  dayPlans: SessionDayPlan[]
  capacity: number
  reserveCapacity: number
  instructor: string
  instructorId: string
  instructorPhone: string
  instructorEmail: string
  emergencyPhone: string
  isActive: boolean
  grantAccess: boolean
  tckn: string
}

export interface SessionConflict {
  date: string
  day: string
  startTime: string
  endTime: string
  reason: string
  hallName?: string
  conflictEventName?: string
}

export interface SessionSummary {
  total: number
  active: number
  passive: number
  totalRegistered: number
  totalCapacity: number
}

export const emptySessionForm = (): SessionForm => ({
  eventId: '',
  hallId: '',
  mode: 'single',
  date: '',
  startTime: '09:00',
  endTime: '10:00',
  startDate: '',
  endDate: '',
  dayPlans: [],
  capacity: 0,
  reserveCapacity: 0,
  instructor: '',
  instructorId: '',
  instructorPhone: '',
  instructorEmail: '',
  emergencyPhone: '',
  isActive: true,
  grantAccess: false,
  tckn: '',
})

import type { CitizenEventDetail, CitizenEventSession } from '@/types/event.types'

export interface EventDetailScope {
  session: CitizenEventSession | null
  date: string
  capacity: number
  registered: number
  reserve: number
  waitlist: number
  applied: boolean
}

export const resolveEventDetailScope = (
  detail: CitizenEventDetail,
  sessionId: string | null,
  firstUpcomingSession: CitizenEventSession | null,
): EventDetailScope => {
  const selected = detail.sessions.find((s) => s.id === sessionId) ?? null
  const session = detail.hasSessions ? (selected ?? firstUpcomingSession) : null
  return {
    session,
    date: detail.hasSessions ? (session?.date ?? detail.startDate) : detail.startDate,
    capacity: detail.hasSessions ? (session?.capacity ?? 0) : (detail.capacity ?? 0),
    registered: detail.hasSessions ? (session?.registeredCount ?? 0) : (detail.registeredCount ?? 0),
    reserve: detail.hasSessions ? (session?.reserveCapacity ?? 0) : (detail.reserveCapacity ?? 0),
    waitlist: detail.hasSessions ? (session?.waitlistCount ?? 0) : (detail.waitlistCount ?? 0),
    applied: detail.hasSessions
      ? (!!sessionId && detail.applicants.some((a) => a.appliedSessionIds?.includes(sessionId)))
      : (detail.alreadyApplied ?? false),
  }
}

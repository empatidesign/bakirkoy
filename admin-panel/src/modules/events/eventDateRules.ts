const datePart = (value: string): string => value.slice(0, 10)

export const deriveSingleDay = (startDate: string, endDate: string): boolean =>
  !endDate || datePart(endDate) === datePart(startDate)

export const applicationEndMax = (eventLastDate: string, applicationStartDate: string): string | undefined => {
  if (!eventLastDate) return undefined
  if (applicationStartDate && datePart(eventLastDate) < datePart(applicationStartDate)) return undefined
  return eventLastDate
}

export const withEventEndFallback = <T extends { startDate: string; endDate: string }>(data: T): T =>
  data.endDate ? data : { ...data, endDate: data.startDate }

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Skeleton, IconButton, Button } from '@/design-system'
import { cn } from '@/lib/utils'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

interface MonthCalendarProps {
  year: number
  month: number
  selectedDate: string
  onSelectDate: (date: string) => void
  onMonthChange: (year: number, month: number) => void
  counts?: Record<string, number>
  countLabel?: string
  loading?: boolean
}

export const MonthCalendar = ({
  year, month, selectedDate, onSelectDate, onMonthChange,
  counts = {}, countLabel = '', loading,
}: MonthCalendarProps) => {
  const now = new Date()
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate())
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadOffset = (new Date(year, month, 1).getDay() + 6) % 7

  const step = (delta: number) => {
    const m = month + delta
    if (m < 0) onMonthChange(year - 1, 11)
    else if (m > 11) onMonthChange(year + 1, 0)
    else onMonthChange(year, m)
  }
  const goToday = () => { onMonthChange(now.getFullYear(), now.getMonth()); onSelectDate(todayIso) }

  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton tone="default" title="Önceki ay" onClick={() => step(-1)}><ChevronLeftIcon className="h-4 w-4" /></IconButton>
          <p className="type-section min-w-[128px] text-center">{MONTHS[month]} {year}</p>
          <IconButton tone="default" title="Sonraki ay" onClick={() => step(1)}><ChevronRightIcon className="h-4 w-4" /></IconButton>
        </div>
        <Button variant="ghost" size="sm" onClick={goToday}>Bugün</Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={cn('py-1 text-center type-caption font-medium', i >= 5 && 'text-foreground-subtle')}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadOffset }).map((_, i) => <div key={`lead-${i}`} aria-hidden />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const date = iso(year, month, day)
              const count = counts[date] ?? 0
              const hasSession = count > 0
              const isSelected = selectedDate === date
              const isToday = date === todayIso
              return (
                <button
                  key={day}
                  type="button"
                  title={hasSession ? `${count}${countLabel ? ` ${countLabel}` : ''}` : undefined}
                  onClick={() => onSelectDate(date)}
                  className={cn(
                    'relative flex aspect-square items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors',
                    isSelected
                      ? 'bg-primary text-white shadow-pop'
                      : hasSession
                        ? 'bg-accent-orange-soft text-accent-orange hover:brightness-95'
                        : 'text-foreground-default hover:bg-surface-2',
                    !isSelected && isToday && 'ring-1 ring-inset ring-primary',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 type-caption">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-accent-orange-soft ring-1 ring-inset ring-accent-orange" /> {countLabel ? `${countLabel} var` : 'Kayıt var'}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-1 ring-inset ring-primary" /> Bugün</span>
          </div>
        </>
      )}
    </div>
  )
}

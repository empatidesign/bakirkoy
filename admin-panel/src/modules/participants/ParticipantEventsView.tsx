import { useState, useEffect, useCallback } from 'react'
import { SearchIcon, CalendarDaysIcon } from 'lucide-react'
import {
  DataTable, FilterBar, FilterField, Input, Select, DatePicker, Badge, EmptyState, ToggleChip,
  type DataTableColumn, type SortState, type ToggleChipProps,
} from '@/design-system'
import { cn, formatDate } from '@/lib/utils'
import participantEventService from '@/services/participantEvent.service'
import participantService from '@/services/participant.service'
import type { Participant, ParticipantEvent, ParticipantEventResult } from '@/types/participant.types'
import { ATTENDANCE_LABELS, ATTENDANCE_TONE, APPROVAL_LABELS, APPROVAL_TONE } from '@/types/participant.types'

type AttendanceFilter = '' | 'Attended' | 'Missed' | 'Excused'

const columns: DataTableColumn<ParticipantEvent>[] = [
  { key: 'person', header: 'Katılımcı', cell: (r) => <span className="font-medium text-foreground-strong">{r.personName}</span> },
  { key: 'event', header: 'Etkinlik', sortable: true, sortKey: 'eventName', cell: (r) => <span className="text-foreground-default">{r.eventName}</span> },
  { key: 'date', header: 'Tarih', sortable: true, sortKey: 'date', cell: (r) => <span className="text-foreground-muted">{formatDate(r.date)}{r.time ? ` · ${r.time}` : ''}</span> },
  { key: 'venue', header: 'Salon', cell: (r) => <span className="text-foreground-muted">{r.venue}</span> },
  { key: 'category', header: 'Kategori', cell: (r) => <Badge tone="neutral">{r.category}</Badge> },
  { key: 'attendance', header: 'Katılım', align: 'center', sortable: true, sortKey: 'attendance', cell: (r) => <Badge tone={ATTENDANCE_TONE[r.attendance]}>{ATTENDANCE_LABELS[r.attendance]}</Badge> },
  { key: 'approval', header: 'Onay', align: 'center', cell: (r) => <Badge tone={APPROVAL_TONE[r.approval]}>{APPROVAL_LABELS[r.approval]}</Badge> },
]

const CHIP_TONE: Record<AttendanceFilter, NonNullable<ToggleChipProps['tone']>> = {
  '': 'primary',
  Attended: 'success',
  Missed: 'danger',
  Excused: 'warning',
}

export const ParticipantEventsView = ({ participant }: { participant: Participant }) => {
  const [children, setChildren] = useState<Participant[]>([])
  const [personId, setPersonId] = useState('')
  const [attendance, setAttendance] = useState<AttendanceFilter>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [sort, setSort] = useState<SortState | null>({ key: 'date', dir: 'desc' })
  const [result, setResult] = useState<ParticipantEventResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    participantService.getList({ guardianId: participant.id, page: 1, limit: 100 })
      .then((r) => { if (active) setChildren(r.items) })
      .catch(() => { if (active) setChildren([]) })
    return () => { active = false }
  }, [participant.id])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { participantId: participant.id, page, limit }
      if (personId) params.personId = personId
      if (attendance) params.attendance = attendance
      if (search) params.search = search
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (sort) { params.sort = sort.key; params.order = sort.dir }
      setResult(await participantEventService.getList(params))
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [participant.id, personId, attendance, search, startDate, endDate, page, limit, sort])
  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const counts = result?.counts
  const rows = result?.items ?? []

  const chips: { key: AttendanceFilter; label: string; count?: number }[] = [
    { key: '', label: 'Tümü', count: counts?.all },
    { key: 'Attended', label: 'Katıldı', count: counts?.attended },
    { key: 'Missed', label: 'Katılmadı', count: counts?.missed },
    { key: 'Excused', label: 'Mazeret', count: counts?.excused },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => {
            const active = attendance === c.key
            return (
              <ToggleChip
                key={c.key || 'all'}
                active={active}
                tone={CHIP_TONE[c.key]}
                onClick={() => { setAttendance(c.key); setPage(1) }}
              >
                {c.label}
                {typeof c.count === 'number' && (
                  <span className={cn('rounded-pill px-1.5 text-[10px] font-semibold', active ? 'bg-surface-0/60' : 'bg-surface-2 text-foreground-muted')}>{c.count}</span>
                )}
              </ToggleChip>
            )
          })}
        </div>
        <div className="w-full sm:w-64">
          <Select searchable searchPlaceholder="Kişi ara..." value={personId} onChange={(e) => { setPersonId(e.target.value); setPage(1) }}>
            <option value="">Tümü (kendisi + çocukları)</option>
            <option value={participant.id}>{participant.fullName} (kendisi)</option>
            {children.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </Select>
        </div>
      </div>

      <FilterBar
        columns={3}
        hasActiveFilters={!!searchInput || !!startDate || !!endDate}
        onClear={() => { setSearchInput(''); setSearch(''); setStartDate(''); setEndDate(''); setPage(1) }}
      >
        <FilterField label="Ara">
          <Input
            placeholder="Etkinlik, kategori veya salon ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        </FilterField>
        <FilterField label="Başlangıç"><DatePicker value={startDate} max={endDate || undefined} onChange={(v) => { setStartDate(v); setPage(1) }} /></FilterField>
        <FilterField label="Bitiş"><DatePicker value={endDate} min={startDate || undefined} onChange={(v) => { setEndDate(v); setPage(1) }} /></FilterField>
      </FilterBar>

      <DataTable<ParticipantEvent>
        title="Etkinlik Geçmişi"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        showRowNumbers
        page={result?.page ?? 1}
        totalPages={result?.totalPages ?? 1}
        total={result?.total ?? 0}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(n) => { setLimit(n); setPage(1) }}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1) }}
        empty={<EmptyState icon={CalendarDaysIcon} title="Etkinlik kaydı yok" description="Seçilen filtrelere uygun etkinlik bulunamadı." />}
      />
    </div>
  )
}

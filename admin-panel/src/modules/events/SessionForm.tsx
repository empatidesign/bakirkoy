import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { CalendarIcon, ClockIcon, AlertTriangleIcon, UsersIcon } from 'lucide-react'
import {
  Select, Combobox, SegmentedControl, DatePicker, TimePicker,
  Field, LockedField, NumberInput,
} from '@/design-system'
import { todayIso, formatDate } from '@/lib/utils'

import { ResponsiblePersonField } from '@/components/specialized/ResponsiblePersonField'
import { RecurringScheduleField } from '@/components/specialized/RecurringScheduleField'
import { EventFormHeader } from './EventFormHeader'
import eventService from '@/services/event.service'
import sessionService from '@/services/session.service'
import hallService from '@/services/hall.service'
import serviceFacilityService from '@/services/serviceFacility.service'
import type { Session, SessionForm as SessionFormData, SessionTimeSlot } from '@/types/session.types'

interface WorkingHours { weekdayOpen: string; weekdayClose: string; weekendOpen: string; weekendClose: string }

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const WEEKEND = new Set(['saturday', 'sunday'])

const RESERVATION_LABELS: Record<string, string> = { none: 'Rezervasyon yok', row: 'Sıra rezervasyonu', seat: 'Koltuk rezervasyonu' }

const hoursFor = (hours: WorkingHours | null, dayKey: string) => {
  if (!hours) return null
  const open = WEEKEND.has(dayKey) ? hours.weekendOpen : hours.weekdayOpen
  const close = WEEKEND.has(dayKey) ? hours.weekendClose : hours.weekdayClose
  return open && close ? { open, close } : null
}
const slotWarn = (hours: WorkingHours | null, dayKey: string, slot: SessionTimeSlot) => {
  const h = hoursFor(hours, dayKey)
  if (!h) return null
  return slot.startTime < h.open || slot.endTime > h.close ? `Çalışma saatleri dışında (${h.open}-${h.close})` : null
}

interface HallOption { value: string; label: string; capacity: number; available: number; floorCount: number }

interface Props {
  form: SessionFormData
  setForm: Dispatch<SetStateAction<SessionFormData>>
  mode: 'create' | 'edit'
  editingRow: Session | null
  readOnly?: boolean
  lockEvent?: boolean
}

export const SessionForm = ({ form, setForm, mode, editingRow, readOnly, lockEvent }: Props) => {
  const locked = mode === 'edit' || readOnly
  const lockedEvent = locked || lockEvent
  const [eventLabel, setEventLabel] = useState('')
  const [halls, setHalls] = useState<HallOption[]>([])
  const [hours, setHours] = useState<WorkingHours | null>(null)
  const [eventHallId, setEventHallId] = useState('')
  const [facilityLabel, setFacilityLabel] = useState('')
  const [seating, setSeating] = useState<{ hasSeating: boolean; reservationType: string } | null>(null)
  const [eventRange, setEventRange] = useState<{ start: string; end: string; single: boolean } | null>(null)
  const [eventVenueType, setEventVenueType] = useState('')
  const [existingSessions, setExistingSessions] = useState<Session[]>([])

  useEffect(() => {
    if (!form.eventId) { setHalls([]); setHours(null); setEventHallId(''); setFacilityLabel(''); setSeating(null); setEventRange(null); setEventVenueType(''); return }
    let cancelled = false
    eventService.getById(form.eventId)
      .then(async (ev) => {
        if (!cancelled) {
          setEventLabel(ev.name); setEventHallId(ev.hallId ?? ''); setFacilityLabel(ev.facilityName ?? ''); setEventVenueType(ev.venueType)
          setSeating({ hasSeating: ev.access.hasSeating, reservationType: ev.access.reservationType })
          if (mode === 'create') {
            const single = ev.startDate.slice(0, 10) === ev.endDate.slice(0, 10)
            setEventRange({ start: ev.startDate.slice(0, 10), end: ev.endDate.slice(0, 10), single })
            setForm((prev) => ({
              ...prev,
              mode: single ? 'single' : 'recurring',
              date: single ? (prev.date || ev.startDate.slice(0, 10)) : prev.date,
              startDate: !single ? (prev.startDate || ev.startDate.slice(0, 10)) : prev.startDate,
              endDate: !single ? (prev.endDate || ev.endDate.slice(0, 10)) : prev.endDate,
              capacity: prev.capacity || ev.capacity,
              reserveCapacity: prev.reserveCapacity || ev.reserveCapacity,
            }))
          }
        }
        if (!ev.facilityId) {
          if (!cancelled) { setHalls([]); setHours(null) }
          return
        }
        const hs = await hallService.getHallOptions(ev.facilityId)
        if (!cancelled) {
          setHalls(hs)
          if (mode === 'create' && ev.hallId) {
            const dh = hs.find((h) => h.value === ev.hallId)
            if (dh) setForm((prev) => prev.hallId ? prev : { ...prev, hallId: dh.value, capacity: dh.available })
          }
        }
        const f = await serviceFacilityService.getById(ev.facilityId)
        if (!cancelled) setHours({ weekdayOpen: f.weekdayOpen, weekdayClose: f.weekdayClose, weekendOpen: f.weekendOpen, weekendClose: f.weekendClose })
      })
      .catch(() => { if (!cancelled) { setHalls([]); setHours(null) } })
    return () => { cancelled = true }
  }, [form.eventId, mode, setForm])

  useEffect(() => {
    if (!form.eventId || mode !== 'create') { setExistingSessions([]); return }
    let cancelled = false
    sessionService.getList({ eventId: form.eventId, page: 1, limit: 100 })
      .then((r) => { if (!cancelled) setExistingSessions(r.items) })
      .catch(() => { if (!cancelled) setExistingSessions([]) })
    return () => { cancelled = true }
  }, [form.eventId, mode])

  const patch = (p: Partial<SessionFormData>) => setForm((f) => ({ ...f, ...p }))
  const selectedHall = halls.find((h) => h.value === form.hallId)
  const scheduleLocked = mode === 'create' && !!eventRange
  const hoursBanner = hours ? `Hafta içi ${hours.weekdayOpen}-${hours.weekdayClose} · Hafta sonu ${hours.weekendOpen}-${hours.weekendClose}` : ''
  const singleDayKey = form.date ? DAY_KEYS[new Date(form.date).getDay()] : ''

  return (
    <EventFormHeader icon={ClockIcon} title="Seans Formu" subtitle="Seans bilgilerini doldurun">
      <>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Temel Bilgiler</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <Field label="Etkinlik" required hint={lockedEvent ? 'Seans bu etkinliğe aittir — değiştirilemez' : undefined}>
              {lockedEvent ? (
                <LockedField value={editingRow?.eventName ?? eventLabel} />
              ) : (
                <Combobox
                  value={form.eventId}
                  displayValue={eventLabel}
                  onChange={(v, opt) => { patch({ eventId: v }); setEventLabel(opt?.label ?? '') }}
                  onSearch={(q) => eventService.getList({ search: q, page: 1, limit: 50 })
                    .then((r) => r.items
                      .filter((e) => e.access?.hasSessions && (e.isActive || (e.sessionCount ?? 0) === 0))
                      .slice(0, 10)
                      .map((e) => ({ value: e.id, label: e.name, description: e.categoryName })))}
                  placeholder="Etkinlik ara..."
                  emptyText="Etkinlik bulunamadı"
                  iconLeft={<CalendarIcon className="h-4 w-4" />}
                />
              )}
            </Field>

            <Field label="Hizmet Tesisi" hint="Etkinliğin bağlı olduğu hizmet tesisi — değiştirilemez">
              <LockedField value={facilityLabel} placeholder={form.eventId ? 'Bu etkinliğe tesis tanımlı değil' : 'Önce etkinlik seçin'} />
            </Field>

            {eventVenueType !== 'outdoor' && (
              <Field label="Salon" hint={!form.eventId ? 'Salonlar seçilen etkinliğin hizmet tesisine göre gelir' : eventHallId ? 'Etkinlik bu salona tanımlı — değiştirilemez' : halls.length === 0 ? 'Bu etkinliğin bağlı bir hizmet tesisi yok — salon seçilemez' : 'Yalnızca etkinliğin hizmet tesisindeki salonlar listelenir'}>
                {!readOnly && !!form.eventId && halls.length > 0 && !eventHallId ? (
                  <Select
                    value={form.hallId}
                    onChange={(e) => {
                      const hall = halls.find((h) => h.value === e.target.value)
                      patch(hall ? { hallId: hall.value, capacity: hall.available } : { hallId: e.target.value })
                    }}
                    placeholder="Salon seçin (opsiyonel)"
                  >
                    <option value="">Salon yok</option>
                    {halls.map((h) => <option key={h.value} value={h.value}>{h.label} ({h.capacity.toLocaleString('tr-TR')} kişi)</option>)}
                  </Select>
                ) : (
                  <LockedField
                    value={selectedHall ? `${selectedHall.label} (${selectedHall.capacity.toLocaleString('tr-TR')} kişi)` : ''}
                    placeholder={!form.eventId ? 'Önce etkinlik seçin' : halls.length === 0 ? 'Bağlı hizmet tesisi yok' : 'Salon atanmamış'}
                  />
                )}
              </Field>
            )}
          </div>
        </div>

        {mode === 'create' && existingSessions.length > 0 && (
          <div className="space-y-2 rounded-card border border-border bg-[hsl(var(--info-soft))] p-3">
            <p className="flex items-center gap-1.5 type-body-strong text-[hsl(var(--info))]">
              <ClockIcon className="h-3.5 w-3.5 shrink-0" /> Bu etkinlikte zaten {existingSessions.length} seans var — aynısını eklemeyin
            </p>
            <div className="flex flex-wrap gap-1.5">
              {existingSessions.slice(0, 40).map((s) => (
                <span key={s.id} className="rounded-pill border border-border bg-surface-0 px-2 py-0.5 type-caption tabular-nums">
                  {formatDate(s.date)}{s.day ? ` · ${s.day}` : ''} · {s.startTime}–{s.endTime}
                </span>
              ))}
              {existingSessions.length > 40 && <span className="type-caption">+{existingSessions.length - 40} daha</span>}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ClockIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Tarih / Saat</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {!locked && (
              <Field label="Seans Planı" hint={scheduleLocked ? 'Etkinlik yapısına göre belirlendi — değiştirilemez' : undefined}>
                <SegmentedControl
                  value={form.mode}
                  onChange={(v) => patch({ mode: v as SessionFormData['mode'] })}
                  columns={2}
                  disabled={scheduleLocked}
                  options={[
                    { value: 'single', label: 'Tek Seans', description: 'Tek tarih ve saat' },
                    { value: 'recurring', label: 'Tekrarlı', description: 'Gün ve saat aralıklarından üret' },
                  ]}
                />
              </Field>
            )}

            {form.mode === 'single' || locked ? (
              <div className="space-y-2">
                <div className="grid gap-[15px] sm:grid-cols-3">
                  <Field label="Tarih" required>
                    {scheduleLocked ? <LockedField value={form.date ? formatDate(form.date) : ''} /> : <DatePicker value={form.date} onChange={(v) => patch({ date: v })} min={todayIso()} disabled={readOnly} clearable />}
                  </Field>
                  <Field label="Başlangıç Saati" required>
                    <TimePicker value={form.startTime} onChange={(v) => patch({ startTime: v })} disabled={readOnly} />
                  </Field>
                  <Field label="Bitiş Saati" required>
                    <TimePicker value={form.endTime} onChange={(v) => patch({ endTime: v })} disabled={readOnly} />
                  </Field>
                </div>
                {!locked && hours && (
                  <p className="flex items-center gap-1.5 type-caption text-[hsl(var(--info))]">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" /> Tesis çalışma saatleri — {hoursBanner}
                  </p>
                )}
                {form.startTime && form.endTime && form.endTime <= form.startTime && (
                  <p className="flex items-center gap-1.5 type-caption text-[hsl(var(--danger))]">
                    <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" /> Bitiş saati başlangıç saatinden sonra olmalıdır.
                  </p>
                )}
                {!locked && singleDayKey && slotWarn(hours, singleDayKey, { startTime: form.startTime, endTime: form.endTime }) && (
                  <p className="flex items-center gap-1.5 type-caption text-[hsl(var(--warning))]">
                    <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" /> {slotWarn(hours, singleDayKey, { startTime: form.startTime, endTime: form.endTime })}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-[15px] rounded-card border border-border bg-surface-1 p-3">
                <div className="grid gap-[15px] sm:grid-cols-2">
                  <Field label="Başlangıç Tarihi" required>
                    {scheduleLocked ? <LockedField value={form.startDate ? formatDate(form.startDate) : ''} /> : <DatePicker value={form.startDate} onChange={(v) => patch({ startDate: v })} min={todayIso()} clearable />}
                  </Field>
                  <Field label="Bitiş Tarihi" required hint={scheduleLocked ? 'Etkinlik bitişine kadar — bitiş uzatılırsa seanslar otomatik üretilir' : undefined}>
                    {scheduleLocked ? <LockedField value={form.endDate ? formatDate(form.endDate) : ''} /> : <DatePicker value={form.endDate} min={form.startDate || undefined} onChange={(v) => patch({ endDate: v })} clearable />}
                  </Field>
                </div>
                {hours && (
                  <p className="flex items-center gap-1.5 type-caption text-[hsl(var(--info))]">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" /> Tesis çalışma saatleri — {hoursBanner}
                  </p>
                )}
                <RecurringScheduleField
                  value={form.dayPlans}
                  onChange={(plans) => setForm((f) => ({ ...f, dayPlans: plans }))}
                  workingHours={hours}
                />
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <UsersIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">{eventVenueType === 'outdoor' ? 'Kontenjan' : 'Koltuk Ayarları'}</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-[15px] sm:grid-cols-2">
              <Field
                label="Kontenjan"
                hint={readOnly ? undefined : (selectedHall ? `Salon kapasitesi: ${selectedHall.capacity.toLocaleString('tr-TR')} kişi — bu seans için ayrı bir sayı girebilirsiniz` : 'Etkinlikteki kontenjan varsayılan olarak önerilir — bu seans için ayrı bir sayı girebilirsiniz')}
              >
                {readOnly
                  ? <LockedField value={`${form.capacity.toLocaleString('tr-TR')} kişi`} />
                  : <NumberInput value={form.capacity} onChange={(n) => patch({ capacity: n })} min={0} max={selectedHall ? selectedHall.capacity : undefined} suffix="kişi" />}
              </Field>
              <Field
                label="Yedek Kontenjan"
                hint={readOnly ? undefined : 'Etkinlikteki yedek kontenjan varsayılan olarak önerilir — bu seans için ayrı bir sayı girebilirsiniz'}
              >
                {readOnly
                  ? <LockedField value={`${form.reserveCapacity.toLocaleString('tr-TR')} kişi`} />
                  : <NumberInput value={form.reserveCapacity} onChange={(n) => patch({ reserveCapacity: n })} min={0} suffix="kişi" />}
              </Field>
            </div>
            {seating && eventVenueType !== 'outdoor' && (
              <p className="type-caption">
                Koltuk düzeni: <span className="text-foreground-default">{seating.hasSeating ? (RESERVATION_LABELS[seating.reservationType] ?? 'Koltuk düzeni') : 'Koltuk düzeni yok'}</span> — etkinlik ayarından gelir
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <UsersIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Eğitmen / Sorumlu</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <ResponsiblePersonField
              label="Eğitmen / Sorumlu"
              allowCreate
              allowAccessGrant
              roleTemplate={{ name: 'Eğitmen', scopeHint: 'yalnız bu seans' }}
              disabled={readOnly}
              value={{
                managerId: form.instructorId,
                manager: form.instructor,
                managerPhone: form.instructorPhone,
                managerEmail: form.instructorEmail,
                emergencyPhone: form.emergencyPhone,
                grantAccess: form.grantAccess,
                tckn: form.tckn,
              }}
              onChange={(p) => {
                const next: Partial<SessionFormData> = {}
                if ('managerId' in p) next.instructorId = p.managerId ?? ''
                if ('manager' in p) next.instructor = p.manager ?? ''
                if ('managerPhone' in p) next.instructorPhone = p.managerPhone ?? ''
                if ('managerEmail' in p) next.instructorEmail = p.managerEmail ?? ''
                if ('emergencyPhone' in p) next.emergencyPhone = p.emergencyPhone ?? ''
                if ('grantAccess' in p) next.grantAccess = p.grantAccess ?? false
                if ('tckn' in p) next.tckn = p.tckn ?? ''
                patch(next)
              }}
            />
          </div>
        </div>
      </>
    </EventFormHeader>
  )
}

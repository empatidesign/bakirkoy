import { useEffect, useState } from 'react'
import { UserIcon, CalendarIcon, ArmchairIcon, ClipboardCheckIcon, FileTextIcon } from 'lucide-react'
import { Select, Combobox, Badge, Button, Field, ReadonlyField } from '@/design-system'
import { EventFormHeader } from './EventFormHeader'
import participantService from '@/services/participant.service'
import eventService from '@/services/event.service'
import sessionService from '@/services/session.service'
import { SeatPickerModal } from '@/components/specialized/seating/SeatPickerModal'
import type { Application, ApplicationForm as ApplicationFormData } from '@/types/application.types'
import {
  APPLICATION_STATUS_OPTIONS,
} from '@/types/application.types'
import { GENDER_LABELS } from '@/types/participant.types'
import type { Dispatch, SetStateAction } from 'react'

interface Props {
  form: ApplicationFormData
  setForm: Dispatch<SetStateAction<ApplicationFormData>>
  mode: 'create' | 'edit'
  editingRow: Application | null
  readOnly?: boolean
}

const parseSeatLabel = (key: string, mode: 'seat' | 'row') => {
  const parts = key.split(':')
  const rowIdx = Number(parts[1] ?? 0)
  return mode === 'row' ? `${rowIdx + 1}. sıra` : `Sıra ${rowIdx + 1} · Koltuk ${parts[2] ?? '?'}`
}

interface EventSeating {
  hasSeating: boolean
  venueType: string
  reservationType: string
}

export const ApplicationForm = ({ form, setForm, mode, editingRow, readOnly }: Props) => {
  const locked = mode === 'edit' || readOnly
  const [participantLabel, setParticipantLabel] = useState('')
  const [eventLabel, setEventLabel] = useState('')
  const [sessions, setSessions] = useState<{ value: string; label: string }[]>([])
  const [seating, setSeating] = useState<EventSeating | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [seatLabel, setSeatLabel] = useState('')

  useEffect(() => {
    if (form.eventId) sessionService.getOptionsByEvent(form.eventId).then(setSessions).catch(() => setSessions([]))
    else setSessions([])
  }, [form.eventId])

  useEffect(() => {
    if (!form.eventId) { setSeating(null); return }
    let cancelled = false
    eventService.getById(form.eventId)
      .then((ev) => { if (!cancelled) setSeating({ hasSeating: ev.access?.hasSeating ?? false, venueType: ev.venueType, reservationType: ev.access?.reservationType ?? 'none' }) })
      .catch(() => { if (!cancelled) setSeating(null) })
    return () => { cancelled = true }
  }, [form.eventId])

  const patch = (p: Partial<ApplicationFormData>) => setForm((f) => ({ ...f, ...p }))

  const needsSeat = !!seating?.hasSeating && seating.venueType === 'indoor' && seating.reservationType !== 'none'
  const seatMode: 'seat' | 'row' = seating?.reservationType === 'row' ? 'row' : 'seat'
  const seatDisplay = form.seatNumber ? (seatLabel || parseSeatLabel(form.seatNumber, seatMode)) : ''

  return (
    <EventFormHeader icon={FileTextIcon} title="Başvuru Formu" subtitle="Başvuru bilgilerini doldurun">
      <>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <UserIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Katılımcı</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {locked ? (
              <div className="grid gap-[15px] sm:grid-cols-3">
                <Field label="Ad Soyad"><ReadonlyField>{editingRow?.participantName ?? '—'}</ReadonlyField></Field>
                <Field label="T.C. Kimlik No"><ReadonlyField><span className="tabular-nums">{editingRow?.tckn ?? '—'}</span></ReadonlyField></Field>
                <Field label="Yaş"><ReadonlyField><span className="tabular-nums">{editingRow?.age ?? '—'}</span></ReadonlyField></Field>
                <Field label="Cinsiyet"><ReadonlyField>{editingRow ? GENDER_LABELS[editingRow.gender] : '—'}</ReadonlyField></Field>
                <Field label="Telefon"><ReadonlyField>{editingRow?.phone ?? '—'}</ReadonlyField></Field>
                <Field label="E-posta"><ReadonlyField>{editingRow?.email ?? '—'}</ReadonlyField></Field>
              </div>
            ) : (
              <Field label="Katılımcı" required>
                <Combobox
                  value={form.participantId}
                  displayValue={participantLabel}
                  onChange={(v, opt) => { patch({ participantId: v }); setParticipantLabel(opt?.label ?? '') }}
                  onSearch={(q) => participantService.getList({ search: q, page: 1, limit: 10 })
                    .then((r) => r.items.map((p) => ({ value: p.id, label: p.fullName, description: `${p.tckn} · ${p.phone ?? '—'}` })))}
                  placeholder="TC, ad veya telefon ile ara..."
                  emptyText="Katılımcı bulunamadı"
                  iconLeft={<UserIcon className="h-4 w-4" />}
                />
              </Field>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Etkinlik</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {locked ? (
              <div className="grid gap-[15px] sm:grid-cols-2">
                <Field label="Etkinlik">
                  <ReadonlyField>
                    {editingRow?.eventName ?? '—'}
                    {editingRow?.eventCategoryName && <Badge color={editingRow.eventCategoryColor} className="ml-2">{editingRow.eventCategoryName}</Badge>}
                  </ReadonlyField>
                </Field>
                <Field label="Seans"><ReadonlyField>{editingRow?.sessionLabel ?? 'Seans yok'}</ReadonlyField></Field>
              </div>
            ) : (
              <div className="grid gap-[15px] sm:grid-cols-2">
                <Field label="Etkinlik" required>
                  <Combobox
                    value={form.eventId}
                    displayValue={eventLabel}
                    onChange={(v, opt) => { patch({ eventId: v, sessionId: '', seatNumber: '' }); setEventLabel(opt?.label ?? ''); setSeatLabel('') }}
                    onSearch={(q) => eventService.getList({ search: q, page: 1, limit: 10 })
                      .then((r) => r.items.map((e) => ({ value: e.id, label: e.name, description: e.categoryName })))}
                    placeholder="Etkinlik ara..."
                    emptyText="Etkinlik bulunamadı"
                    iconLeft={<CalendarIcon className="h-4 w-4" />}
                  />
                </Field>
                <Field label="Seans">
                  <Select value={form.sessionId} onChange={(e) => { patch({ sessionId: e.target.value, seatNumber: '' }); setSeatLabel('') }} disabled={!form.eventId || sessions.length === 0} placeholder={form.eventId ? (sessions.length ? 'Seans seçin' : 'Seans yok') : 'Önce etkinlik seçin'}>
                    <option value="">Seans yok</option>
                    {sessions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </Field>
              </div>
            )}
          </div>
        </div>

        {needsSeat && (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4 bg-surface-1">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <ArmchairIcon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground-strong">{seatMode === 'row' ? 'Sıra Seçimi' : 'Koltuk Seçimi'}</p>
                <Badge tone="warning">Zorunlu</Badge>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {readOnly ? (
                <ReadonlyField>{seatDisplay || '—'}</ReadonlyField>
              ) : (
                <div className="flex items-center gap-[15px]">
                  <div className="flex h-10 flex-1 items-center rounded-field border border-border bg-surface-2 px-3 text-sm">
                    {seatDisplay
                      ? <span className="text-foreground-strong">{seatDisplay}</span>
                      : <span className="type-muted">{seatMode === 'row' ? 'Sıra seçilmedi' : 'Koltuk seçilmedi'}</span>}
                  </div>
                  {form.seatNumber && (
                    <Button variant="ghost" size="sm" onClick={() => { patch({ seatNumber: '' }); setSeatLabel('') }}>Temizle</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    <ArmchairIcon className="h-4 w-4" /> {seatMode === 'row' ? 'Sıra Seç' : 'Koltuk Seç'}
                  </Button>
                </div>
              )}
              <SeatPickerModal
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                eventId={form.eventId}
                sessionId={form.sessionId || undefined}
                mode={seatMode}
                value={form.seatNumber}
                onSelect={(seatNumber, label) => { patch({ seatNumber }); setSeatLabel(label) }}
              />
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardCheckIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Başvuru Durumu</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-[15px] sm:grid-cols-3">
              <Field label="Onay Durumu">
                <Select value={form.status} onChange={(e) => patch({ status: e.target.value as ApplicationFormData['status'] })} disabled={readOnly}>
                  {APPLICATION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              {/* TODO: Ödeme alanları geçici gizlendi (2026-08-05, kullanıcı isteği) — geri açılacaksa bu bloğu aç
              <Field label="Ödeme Durumu">
                <Select value={form.paymentStatus} onChange={(e) => patch({ paymentStatus: e.target.value as ApplicationFormData['paymentStatus'] })} disabled>
                  {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              */}
            </div>

          </div>
        </div>
      </>
    </EventFormHeader>
  )
}

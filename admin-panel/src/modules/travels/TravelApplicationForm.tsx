import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { UserIcon, MapPinIcon, BusIcon, ClipboardCheckIcon } from 'lucide-react'
import { Select, Combobox, Textarea, FormSection, Field, NumberInput, ReadonlyField, ToggleRow } from '@/design-system'
import participantService from '@/services/participant.service'
import travelService from '@/services/travel.service'
import travelBusService from '@/services/travelBus.service'
import type { TravelApplicationFormData, TravelApplication, TravelBus } from '@/types/travel.types'
import { APPLICATION_STATUS_OPTIONS, DOCUMENT_STATUS_OPTIONS } from './travelFormDefaults'

interface Props {
  form: TravelApplicationFormData
  setForm: Dispatch<SetStateAction<TravelApplicationFormData>>
  mode: 'create' | 'edit'
  editingRow: TravelApplication | null
  readOnly?: boolean
}

export const TravelApplicationForm = ({ form, setForm, mode, editingRow, readOnly }: Props) => {
  const locked = mode === 'edit' || readOnly
  const [participantLabel, setParticipantLabel] = useState(editingRow?.participantName ?? '')
  const [travelLabel, setTravelLabel] = useState(editingRow?.travelName ?? '')
  const [buses, setBuses] = useState<TravelBus[]>([])

  const patch = (p: Partial<TravelApplicationFormData>) => setForm((f) => ({ ...f, ...p }))
  const selectedBus = buses.find((b) => b.id === form.busId)

  useEffect(() => {
    if (!form.travelId) { setBuses([]); return }
    travelBusService.getByTravel(form.travelId).then(setBuses).catch(() => setBuses([]))
  }, [form.travelId])

  return (
    <div className="space-y-[15px]">
      <FormSection variant="card" icon={UserIcon} title="Katılımcı">
        {locked ? (
          <div className="grid gap-[15px] sm:grid-cols-2">
            <Field label="Ad Soyad"><ReadonlyField>{editingRow?.participantName ?? '—'}</ReadonlyField></Field>
            <Field label="T.C. Kimlik No"><ReadonlyField><span className="tabular-nums">{editingRow?.tckn ?? '—'}</span></ReadonlyField></Field>
            {editingRow?.isGuest && (
              <>
                <Field label="Başvuruyu Yapan"><ReadonlyField>{editingRow.applicantName ?? '—'}</ReadonlyField></Field>
                <Field label="Başvuran T.C. Kimlik No"><ReadonlyField><span className="tabular-nums">{editingRow.applicantTckn ?? '—'}</span></ReadonlyField></Field>
              </>
            )}
          </div>
        ) : (
          <>
            <Field label="Katılımcı" required>
              <Combobox
                value={form.participantId}
                displayValue={participantLabel}
                onChange={(v, opt) => { patch({ participantId: v }); setParticipantLabel(opt?.label ?? '') }}
                onSearch={(q) => participantService.getList({ search: q, page: 1, limit: 10 })
                  .then((r) => r.items.map((p) => ({ value: p.id, label: p.fullName, description: `${p.tckn} · ${p.phone ?? '—'}` })))}
                placeholder="TC, ad veya telefon ile ara..."
              />
            </Field>
            {mode === 'create' && (
              <ToggleRow
                label="Serbest ekleme (kısıtları atla)"
                description="Açıksa bu katılımcı, gezinin ikamet/cinsiyet/yaş kısıtlarına uymasa bile eklenir (ör. istisnai/özel izinli katılımcı). Kontenjan, koltuk, tekrar-başvuru ve tarih çakışması kontrolleri her zaman uygulanmaya devam eder."
                checked={!!form.overrideEligibility}
                onChange={(v) => patch({ overrideEligibility: v })}
              />
            )}
          </>
        )}
      </FormSection>

      <FormSection variant="card" icon={MapPinIcon} title="Gezi">
        {locked ? (
          <Field label="Gezi"><ReadonlyField>{editingRow?.travelName ?? '—'}</ReadonlyField></Field>
        ) : (
          <Field label="Gezi" required>
            <Combobox
              value={form.travelId}
              displayValue={travelLabel}
              onChange={(v, opt) => { patch({ travelId: v, busId: '', seatNumber: '' }); setTravelLabel(opt?.label ?? '') }}
              onSearch={(q) => travelService.getOptions(q)}
              placeholder="Gezi ara..."
            />
          </Field>
        )}
      </FormSection>

      <FormSection variant="card" icon={BusIcon} title="Araç & Koltuk">
        <div className="grid gap-[15px] sm:grid-cols-2">
          <Field label="Araç" hint={form.travelId && buses.length === 0 ? 'Bu geziye araç tanımlı değil' : undefined}>
            <Select value={form.busId} onChange={(e) => patch({ busId: e.target.value, seatNumber: '' })} disabled={readOnly || !form.travelId || buses.length === 0}>
              <option value="">Araç atanmadı</option>
              {buses.map((b) => <option key={b.id} value={b.id}>{b.name}{b.vehicleType === 'capacity' ? ' (Kontenjanlı)' : ` · ${b.plateNumber}`}</option>)}
            </Select>
          </Field>
          {selectedBus?.vehicleType !== 'capacity' && (
            <Field label="Koltuk No" hint="Koltuk planını Araç Yönetimi'nden detaylı düzenleyebilirsiniz">
              <NumberInput value={Number(form.seatNumber) || 0} onChange={(n) => patch({ seatNumber: n ? String(n) : '' })} min={0} placeholder="Koltuk" />
            </Field>
          )}
        </div>
      </FormSection>

      <FormSection variant="card" icon={ClipboardCheckIcon} title="Başvuru Durumu">
        <div className="grid gap-[15px] sm:grid-cols-3">
          <Field label="Onay Durumu">
            <Select value={form.status} onChange={(e) => patch({ status: e.target.value as TravelApplicationFormData['status'] })} disabled={readOnly}>
              {APPLICATION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Evrak Durumu">
            <Select value={form.documentStatus} onChange={(e) => patch({ documentStatus: e.target.value as TravelApplicationFormData['documentStatus'] })} disabled={readOnly}>
              {DOCUMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          {/* TODO: Ödeme alanları geçici gizlendi (2026-08-05, kullanıcı isteği) — geri açılacaksa bu bloğu aç
          <Field label="Ödeme Durumu">
            <Select value={form.paymentStatus} onChange={(e) => patch({ paymentStatus: e.target.value as TravelApplicationFormData['paymentStatus'] })} disabled={readOnly}>
              {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          */}
        </div>


        <Field label="Notlar">
          <Textarea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} placeholder="Başvuruya dair notlar..." disabled={readOnly} />
        </Field>
      </FormSection>
    </div>
  )
}

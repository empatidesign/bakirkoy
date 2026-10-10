import { useEffect, useMemo, useState } from 'react'
import { LinkIcon } from 'lucide-react'
import { Field, Select } from '@/design-system'
import { createFacilityService } from '@/templates/FacilityTemplate/createFacilityService'
import { FACILITY_MODULES, type FacilityModuleId } from '@/templates/FacilityTemplate/moduleConfig'
import eventService from '@/services/event.service'
import travelService from '@/services/travel.service'
import libraryService from '@/services/library.service'
import type { FacilityRecord } from '@/types/facility.types'

interface Props {
  sourceType: string | null
  sourceId: string | null
  onChange: (sourceType: string | null, sourceId: string | null) => void
  disabled?: boolean
}

type SimpleOption = { value: string; label: string; description?: string | null }

const SOURCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Bağlantısız (Genel Anket)' },
  { value: 'Event', label: 'Etkinlik' },
  { value: 'Travel', label: 'Gezi' },
  { value: 'Facility', label: 'Tesis / Program (Spor, Kütüphane Dışı)' },
  { value: 'Library', label: 'Kütüphane' },
]

export const SurveySourcePicker = ({ sourceType, sourceId, onChange, disabled }: Props) => {
  const [module, setModule] = useState<FacilityModuleId>('sports')
  const [facilities, setFacilities] = useState<FacilityRecord[]>([])
  const [events, setEvents] = useState<SimpleOption[]>([])
  const [travels, setTravels] = useState<SimpleOption[]>([])
  const [libraries, setLibraries] = useState<SimpleOption[]>([])
  const [loading, setLoading] = useState(false)

  const service = useMemo(() => createFacilityService(FACILITY_MODULES[module].basePath), [module])

  useEffect(() => {
    if (sourceType !== 'Facility') return
    setLoading(true)
    service.facilities.getOptions()
      .then(setFacilities)
      .catch(() => setFacilities([]))
      .finally(() => setLoading(false))
  }, [service, sourceType])

  useEffect(() => {
    if (sourceType !== 'Event') return
    setLoading(true)
    eventService.getOptions()
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [sourceType])

  useEffect(() => {
    if (sourceType !== 'Travel') return
    setLoading(true)
    travelService.getOptions()
      .then(setTravels)
      .catch(() => setTravels([]))
      .finally(() => setLoading(false))
  }, [sourceType])

  useEffect(() => {
    if (sourceType !== 'Library') return
    setLoading(true)
    libraryService.getOptions()
      .then((res) => setLibraries(res.map((l) => ({ value: l.value, label: l.label, description: l.district }))))
      .catch(() => setLibraries([]))
      .finally(() => setLoading(false))
  }, [sourceType])

  const hintForType: Record<string, string> = {
    '': 'Bu anket herkese ya da yukarıda seçilen hedef kitleye açık olur; belirli bir etkinlik/gezi/tesise bağlı değildir.',
    Event: 'Anket belirli bir etkinlikle ilişkilendirilirse, hedef kitle "Etkinlik Katılımcıları" seçiliyse sadece o etkinliğe başvurmuş/katılmış vatandaşlara gösterilir.',
    Travel: 'Anket belirli bir geziyle ilişkilendirilirse, hedef kitle "Gezi Katılımcıları" seçiliyse sadece o geziye katılmış vatandaşlara gösterilir.',
    Facility: 'Anket belirli bir tesis/program ile ilişkilendirilirse, sadece o tesise devam etmiş (yoklaması alınmış) katılımcılara gösterilir.',
    Library: 'Anket belirli bir kütüphaneyle ilişkilendirilirse, sadece o kütüphaneyi kullanmış vatandaşlara gösterilir.',
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <div className="flex items-center gap-2">
        <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[13px] font-medium text-foreground-strong">Kaynak Bağlantısı</p>
      </div>
      <p className="text-[12px] text-muted-foreground">
        {hintForType[sourceType ?? ''] ?? hintForType['']}
      </p>
      <Field label="Bağlantı Türü">
        <Select
          value={sourceType ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange(v || null, null)
          }}
          disabled={disabled}
        >
          {SOURCE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>

      {sourceType === 'Event' && (
        <Field label="Etkinlik" hint={loading ? 'Yükleniyor...' : undefined}>
          <Select value={sourceId ?? ''} onChange={(e) => onChange('Event', e.target.value || null)} disabled={disabled || loading}>
            <option value="">Etkinlik seçin</option>
            {events.map((e) => <option key={e.value} value={e.value}>{e.label}{e.description ? ` — ${e.description}` : ''}</option>)}
          </Select>
        </Field>
      )}

      {sourceType === 'Travel' && (
        <Field label="Gezi" hint={loading ? 'Yükleniyor...' : undefined}>
          <Select value={sourceId ?? ''} onChange={(e) => onChange('Travel', e.target.value || null)} disabled={disabled || loading}>
            <option value="">Gezi seçin</option>
            {travels.map((t) => <option key={t.value} value={t.value}>{t.label}{t.description ? ` — ${t.description}` : ''}</option>)}
          </Select>
        </Field>
      )}

      {sourceType === 'Library' && (
        <Field label="Kütüphane" hint={loading ? 'Yükleniyor...' : undefined}>
          <Select value={sourceId ?? ''} onChange={(e) => onChange('Library', e.target.value || null)} disabled={disabled || loading}>
            <option value="">Kütüphane seçin</option>
            {libraries.map((l) => <option key={l.value} value={l.value}>{l.label}{l.description ? ` — ${l.description}` : ''}</option>)}
          </Select>
        </Field>
      )}

      {sourceType === 'Facility' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Modül">
            <Select value={module} onChange={(e) => setModule(e.target.value as FacilityModuleId)} disabled={disabled}>
              {Object.values(FACILITY_MODULES).map((m) => (
                <option key={m.id} value={m.id}>{m.pageTitle}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tesis" hint={loading ? 'Yükleniyor...' : undefined}>
            <Select value={sourceId ?? ''} onChange={(e) => onChange('Facility', e.target.value || null)} disabled={disabled || loading}>
              <option value="">Tesis seçin</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </Field>
        </div>
      )}
    </div>
  )
}

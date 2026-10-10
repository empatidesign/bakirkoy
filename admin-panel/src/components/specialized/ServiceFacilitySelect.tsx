import { useCallback, useEffect, useState } from 'react'
import { ListIcon, PlusIcon, Building2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Select, MultiSelect, IconButton, Drawer, Button } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import hallService from '@/services/hall.service'
import serviceFacilityService from '@/services/serviceFacility.service'
import type { FacilityOption } from '@/types/hall.types'
import { FacilityFormTabs } from '@/modules/service-facilities/FacilityFormTabs'
import { emptyFacilityForm, toFacilityRequest, getFacilityFormErrors, type FacilityForm } from '@/modules/service-facilities/facilityForm'

export interface ServiceFacilitySelectProps {
  value: string
  onChange: (value: string, option?: FacilityOption) => void
  kind?: 'indoor' | 'outdoor'
  placeholder?: string
  disabled?: boolean
  currentLabel?: string
  /** Çoklu seçim: value/onChange yerine values/onChangeMany kullanılır. */
  multiple?: boolean
  values?: string[]
  onChangeMany?: (values: string[], options: FacilityOption[]) => void
}

const matchesKind = (locationType: string, kind?: 'indoor' | 'outdoor') =>
  !kind || (kind === 'outdoor' ? locationType === 'Outdoor' : locationType !== 'Outdoor')

export const ServiceFacilitySelect = ({ value, onChange, kind, placeholder = 'Hizmet tesisi seçin...', disabled, currentLabel, multiple, values = [], onChangeMany }: ServiceFacilitySelectProps) => {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [createForm, setCreateForm] = useState<FacilityForm | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => hallService.getFacilityOptions().then((list) => { setFacilities(list); return list }).catch(() => { setFacilities([]); return [] as FacilityOption[] }), [])
  useEffect(() => { load() }, [load])

  const options = facilities.filter((f) => matchesKind(f.locationType, kind))
  const hasCurrentInOptions = !value || options.some((f) => f.value === value)
  const injectedOptions = !hasCurrentInOptions && currentLabel
    ? [{ value, label: `${currentLabel} (pasif/eski)`, locationType: 'Indoor' } as FacilityOption, ...options]
    : options

  const openCreate = () => setCreateForm({ ...emptyFacilityForm, locationType: kind === 'outdoor' ? 'Outdoor' : 'Indoor' })

  const saveCreate = async () => {
    if (!createForm) return
    const errors = getFacilityFormErrors(createForm)
    if (errors.length) { toast.error(errors[0]); return }
    setSaving(true)
    try {
      const created = await serviceFacilityService.create(toFacilityRequest(createForm))
      toast.success('Hizmet tesisi oluşturuldu.')
      const list = await load()
      if (multiple) {
        const next = [...values, created.id]
        onChangeMany?.(next, list.filter((f) => next.includes(f.value)))
      } else {
        onChange(created.id, list.find((f) => f.value === created.id))
      }
      setCreateForm(null)
    } catch {
      toast.error('Hizmet tesisi oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        {multiple ? (
          <MultiSelect
            values={values}
            onChange={(next) => onChangeMany?.(next, facilities.filter((f) => next.includes(f.value)))}
            options={options.map((f) => ({ value: f.value, label: f.label }))}
            disabled={disabled}
            placeholder={placeholder}
            searchPlaceholder="Tesis ara..."
            emptyText="Eşleşen tesis yok"
          />
        ) : (
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value, facilities.find((f) => f.value === e.target.value))}
          disabled={disabled}
          placeholder={placeholder}
          searchable
          searchPlaceholder="Tesis ara..."
        >
          {injectedOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </Select>
        )}
      </div>
      {can('service-facilities.view') && (
        <IconButton type="button" tone="default" title="Hizmet tesisleri listesi" onClick={() => navigate('/service-facilities')}>
          <ListIcon className="h-4 w-4" />
        </IconButton>
      )}
      {can('service-facilities.create') && !disabled && (
        <IconButton type="button" tone="primary" title="Yeni hizmet tesisi ekle" onClick={openCreate}>
          <PlusIcon className="h-4 w-4" />
        </IconButton>
      )}

      <Drawer
        open={!!createForm}
        onClose={() => !saving && setCreateForm(null)}
        title="Yeni Hizmet Tesisi Ekle"
        subtitle="Kaydedince bu alanda otomatik seçilir"
        icon={Building2Icon}
        width={760}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateForm(null)} disabled={saving}>İptal</Button>
            <Button variant="primary" onClick={saveCreate} isLoading={saving}>Kaydet</Button>
          </div>
        }
      >
        {createForm && <FacilityFormTabs form={createForm} setForm={setCreateForm as React.Dispatch<React.SetStateAction<FacilityForm>>} />}
      </Drawer>
    </div>
  )
}

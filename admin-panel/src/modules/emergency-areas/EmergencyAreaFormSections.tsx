import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { MapPinIcon, SlidersHorizontalIcon, UserCogIcon } from 'lucide-react'
import {
  Field, FormSection, Input, Textarea, Combobox, ToggleChip,
} from '@/design-system'
import { MapPicker } from '@/components/specialized/MapPicker'
import { ResponsiblePersonField } from '@/components/specialized/ResponsiblePersonField'
import emergencyAreaService from '@/services/emergencyArea.service'
import type { SelectOption } from '@/types/common'
import { EMERGENCY_EQUIPMENT_META } from '@/types/emergencyArea.types'
import type { EmergencyAreaForm } from './emergencyAreaForm'

type SetForm = Dispatch<SetStateAction<EmergencyAreaForm>>

interface Props {
  form: EmergencyAreaForm
  setForm: SetForm
}

export const EmergencyAreaFormSections = ({ form, setForm }: Props) => {
  const [neighborhoods, setNeighborhoods] = useState<SelectOption[]>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const data = await emergencyAreaService.getNeighborhoodOptions()
        if (active) setNeighborhoods(data)
      } catch {
        if (active) setNeighborhoods([])
      }
    }
    load()
    return () => { active = false }
  }, [])

  const toggleEquipment = (key: keyof EmergencyAreaForm['equipment']) =>
    setForm((p) => ({ ...p, equipment: { ...p.equipment, [key]: !p.equipment[key] } }))

  return (
    <div className="space-y-[15px]">
      <Field label="Alan Adı" required>
        <Input
          placeholder="Örn. Cebeci Park Acil Toplanma Alanı"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
      </Field>

      <Field label="Mahalle" required>
        <Combobox
          value={form.neighborhood}
          options={neighborhoods.map((n) => ({ value: n.value, label: n.label }))}
          onChange={(v) => setForm((p) => ({ ...p, neighborhood: v }))}
          allowCustom
          clearable
          placeholder="Mahalle seçin..."
          emptyText="Mahalle listesi yüklenemedi — yazıp ekleyin"
          iconLeft={<MapPinIcon className="h-4 w-4" />}
        />
      </Field>

      <Field label="Açık Adres" required>
        <Textarea
          rows={2}
          placeholder="Cadde, sokak, no, tarif..."
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
        />
      </Field>

      <FormSection title="Konum" subtitle="Adres arayıp sonuçtan seçin ya da koordinatları elle girin. Seçilen konum haritada ve mobil uygulamada gösterilir." icon={MapPinIcon} variant="card">
        <MapPicker
          value={{ latitude: form.latitude, longitude: form.longitude }}
          onChange={(c) => setForm((p) => ({ ...p, latitude: c.latitude, longitude: c.longitude }))}
          height={300}
        />
      </FormSection>

      <div className="grid grid-cols-2 gap-[15px]">
        <Field label="Kapasite (kişi)">
          <Input
            sanitize="digits"
            inputMode="numeric"
            placeholder="Örn. 2000"
            value={form.capacity}
            onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
          />
        </Field>
        <Field label="Alan Büyüklüğü (m²)">
          <Input
            sanitize="digits"
            inputMode="numeric"
            placeholder="Örn. 3500"
            value={form.areaSizeM2}
            onChange={(e) => setForm((p) => ({ ...p, areaSizeM2: e.target.value }))}
          />
        </Field>
      </div>

      <FormSection title="Donanım / Olanaklar" subtitle="Alanda mevcut imkanları işaretleyin." icon={SlidersHorizontalIcon} variant="card">
        <div className="flex flex-wrap gap-[15px]">
          {EMERGENCY_EQUIPMENT_META.map((m) => (
            <ToggleChip
              key={m.key}
              active={form.equipment[m.key]}
              color={m.color}
              onClick={() => toggleEquipment(m.key)}
            >
              {m.label}
            </ToggleChip>
          ))}
        </div>
      </FormSection>

      <FormSection title="Sorumlu & İletişim" icon={UserCogIcon} variant="card">
        <ResponsiblePersonField
          label="Sorumlu Kişi"
          allowCreate
          allowAccessGrant
          roleTemplate={{ name: 'Acil Alan Sorumlusu', scopeHint: 'yalnız bu toplanma alanı' }}
          value={{
            managerId: form.managerId,
            manager: form.manager,
            managerRoleKey: form.managerRoleKey,
            managerRoleName: form.managerRoleName,
            managerPhone: form.managerPhone,
            managerEmail: form.managerEmail,
            emergencyPhone: form.emergencyPhone,
            grantAccess: form.grantAccess,
            tckn: form.tckn,
          }}
          onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
        />
      </FormSection>

      <Field label="Açıklama">
        <Textarea
          rows={3}
          placeholder="Alan hakkında not, erişim bilgisi vb."
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
      </Field>
    </div>
  )
}

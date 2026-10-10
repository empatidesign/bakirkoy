import { useState } from 'react'
import { BusIcon, ShipIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Input, Field, SegmentedControl, NumberInput, FormSection } from '@/design-system'
import {
  BusSeatPlanner, getBusTemplate, generateBusSeatPositions, createInitialBusSeatStates,
} from '@/components/specialized/seating'
import travelBusService from '@/services/travelBus.service'
import type { TravelBus, TravelBusFormData, TravelVehicleType } from '@/types/travel.types'

const emptyBusForm = (): TravelBusFormData => {
  const tmpl = getBusTemplate()
  return {
    name: '', plateNumber: '', templateId: tmpl.id,
    seatStates: createInitialBusSeatStates(generateBusSeatPositions(tmpl)),
    vehicleType: 'bus', capacity: 0,
  }
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (bus: TravelBus) => void | Promise<void>
}

export const TravelBusQuickCreateModal = ({ open, onClose, onCreated }: Props) => {
  const [form, setForm] = useState<TravelBusFormData>(emptyBusForm())
  const [saving, setSaving] = useState(false)
  const patch = (p: Partial<TravelBusFormData>) => setForm((f) => ({ ...f, ...p }))

  const changeTemplate = (id: string) => {
    const positions = generateBusSeatPositions(getBusTemplate(id))
    patch({ templateId: id, seatStates: createInitialBusSeatStates(positions) })
  }

  const reset = () => setForm(emptyBusForm())

  const errors = [
    !form.name.trim() && 'Araç adı zorunludur.',
    form.vehicleType === 'bus' && !form.plateNumber.trim() && 'Plaka numarası zorunludur.',
    form.vehicleType === 'capacity' && form.capacity <= 0 && 'Toplam kontenjan 0\'dan büyük olmalıdır.',
  ].filter(Boolean) as string[]

  const save = async () => {
    if (errors.length > 0) { toast.error(errors[0]); return }
    setSaving(true)
    try {
      const bus = await travelBusService.create(form)
      await onCreated(bus)
      toast.success(`"${bus.name}" eklendi.`)
      reset()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Yeni Araç Ekle"
      subtitle="Otobüs veya numarasız kontenjanlı vapur/tekne oluşturun"
      width={640}
      className="max-w-[96vw]"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }}>İptal</Button>
          <Button variant="primary" isLoading={saving} onClick={save}>Araç Ekle</Button>
        </div>
      }
    >
      <div className="max-h-[70vh] overflow-y-auto p-5 space-y-5">
        <FormSection icon={BusIcon} title="Araç Bilgileri" variant="card">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Araç Adı" required>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Örn: 1 Numaralı Otobüs / Vapur Seferi" />
            </Field>
            <Field label="Plaka / Sefer No" required={form.vehicleType === 'bus'}>
              <Input value={form.plateNumber} onChange={(e) => patch({ plateNumber: e.target.value.toUpperCase() })} placeholder={form.vehicleType === 'bus' ? '34 ABC 123' : 'Opsiyonel'} />
            </Field>
          </div>

          <Field label="Araç Tipi" hint={form.vehicleType === 'capacity'
            ? 'Vapur, tekne gibi koltuk numarası olmayan araçlar için. Başvurular koltuk seçmeden, yalnızca toplam kontenjana göre kabul edilir.'
            : 'Koltuk numaralı klasik otobüs/minibüs. Başvuru sırasında koltuk seçilir.'}>
            <SegmentedControl
              value={form.vehicleType}
              onChange={(v) => patch({ vehicleType: v as TravelVehicleType })}
              columns={2}
              options={[
                { value: 'bus', label: 'Otobüs (Koltuk Numaralı)', icon: BusIcon, tone: 'blue' },
                { value: 'capacity', label: 'Kontenjanlı (Vapur / Tekne)', icon: ShipIcon, tone: 'violet' },
              ]}
            />
          </Field>

          {form.vehicleType === 'capacity' ? (
            <Field label="Toplam Kontenjan" required hint="Bu araca (ör. vapur seferi) kabul edilecek toplam kişi sayısı — koltuk numarası yok.">
              <NumberInput value={form.capacity} onChange={(n) => patch({ capacity: n })} min={0} placeholder="Örn: 150" />
            </Field>
          ) : (
            <Field label="Koltuk Düzeni" hint="Koltuğa tıklayarak dolu/rezerve/bloke durumunu ayarlayın">
              <BusSeatPlanner
                templateId={form.templateId}
                onTemplateChange={changeTemplate}
                seatStates={form.seatStates}
                onSeatChange={(s) => patch({ seatStates: s })}
                allowTemplateChange
              />
            </Field>
          )}
        </FormSection>
      </div>
    </Modal>
  )
}

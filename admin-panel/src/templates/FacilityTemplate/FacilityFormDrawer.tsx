import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Building2Icon, TreePineIcon, FileClockIcon, XIcon } from 'lucide-react'
import { Drawer, Button, Input, Switch, SegmentedControl, FormSection, Field, AdminFormShell } from '@/design-system'
import { ServiceFacilitySelect } from '@/components/specialized/ServiceFacilitySelect'
import { useFormDraft, formatDraftAge } from '@/hooks/useFormDraft'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { FacilityRecord, FacilityForm } from '@/types/facility.types'

interface Props {
  open: boolean
  onClose: () => void
  config: FacilityModuleConfig
  service: FacilityModuleService
  editing: FacilityRecord | null
  onSaved: () => void
}

const blank = (config: FacilityModuleConfig): FacilityForm => ({
  name: '',
  kind: config.defaultFacilityKind === 'outdoor' ? 'outdoor' : 'indoor',
  serviceFacilityId: '',
  capacity: '',
  managerId: '',
  manager: '',
  managerRoleKey: '',
  managerRoleName: '',
  managerPhone: '',
  managerEmail: '',
  emergencyPhone: '',
  grantAccess: false,
  tckn: '',
  isActive: true,
})

export const FacilityFormDrawer = ({ open, onClose, config, service, editing, onSaved }: Props) => {
  const T = config.terminology
  const [form, setForm] = useState<FacilityForm>(blank(config))
  const [saving, setSaving] = useState(false)
  const [targets, setTargets] = useState<{ id: string; label: string }[]>([])

  const { pendingDraft, restoreDraft, discardDraft, notifyChange } = useFormDraft<FacilityForm>({
    resourceKey: `facility.${config.id}`,
    scope: editing?.id ?? 'create',
    emptyForm: blank(config),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setForm(editing
      ? {
          name: editing.name,
          kind: editing.kind,
          serviceFacilityId: editing.serviceFacilityId ?? '',
          capacity: editing.capacity > 0 ? String(editing.capacity) : '',
          managerId: editing.managerId ?? '',
          manager: editing.managerName ?? '',
          managerRoleKey: editing.managerRoleKey ?? '',
          managerRoleName: editing.managerRoleName ?? '',
          managerPhone: editing.managerPhone ?? '',
          managerEmail: editing.managerEmail ?? '',
          emergencyPhone: editing.emergencyPhone ?? '',
          grantAccess: false,
          tckn: '',
          isActive: editing.isActive,
        }
      : blank(config))
    setTargets([])
  }, [open, editing, config])

  useEffect(() => {
    if (!open) return
    notifyChange(form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, open])

  const valid = editing ? !!form.name.trim() && !!form.serviceFacilityId : targets.length > 0

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      if (editing) {
        await service.facilities.update(editing.id, form)
        toast.success('Değişiklikler kaydedildi.')
      } else {
        const multi = targets.length > 1
        const base = form.name.trim()
        let ok = 0
        for (const t of targets) {
          try {
            await service.facilities.create({ ...form, serviceFacilityId: t.id, name: !base ? t.label : multi ? `${base} - ${t.label}` : base })
            ok++
          } catch { continue }
        }
        if (ok === 0) return
        toast.success(multi ? `${ok}/${targets.length} ${T.facilitySingular.toLocaleLowerCase('tr-TR')} oluşturuldu.` : `${T.facilitySingular} oluşturuldu.`)
      }
      discardDraft()
      onSaved()
      onClose()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={config.icon}
      title={editing ? `${T.facilitySingular} Düzenle` : `Yeni ${T.facilitySingular} Ekle`}
      subtitle={editing?.name}
      width={560}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" disabled={!valid} isLoading={saving} onClick={submit}>
            {editing ? 'Güncelle' : 'Ekle'}
          </Button>
        </div>
      }
    >
      <AdminFormShell
        icon={config.icon}
        title={editing ? `${T.facilitySingular} Düzenle` : `Yeni ${T.facilitySingular} Ekle`}
        subtitle={editing ? 'Temel bilgiler ve hizmet tesisi' : 'Hizmet tesislerini seçin, her biri için tesis oluşturulur'}
        badge={editing ? 'Düzenleme' : 'Yeni kayıt'}
        tone="green"
      >
        {pendingDraft && (
          <div className="flex items-center justify-between gap-3 rounded-field border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning-soft))] px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileClockIcon className="h-4 w-4 flex-shrink-0 text-[hsl(var(--warning))]" />
              <div className="min-w-0">
                <p className="type-body-strong">Kaydedilmemiş taslağınız var</p>
                <p className="type-caption">{formatDraftAge(pendingDraft.savedAt)} bırakılmış, devam edebilirsiniz.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={discardDraft}>
                <XIcon className="h-3.5 w-3.5" /> Sil
              </Button>
              <Button variant="primary" size="sm" onClick={() => restoreDraft(setForm)}>
                Devam Et
              </Button>
            </div>
          </div>
        )}
        <FormSection title="Temel Bilgiler" icon={Building2Icon} variant="card">
          <Field
            label={`${T.facilitySingular} Adı`}
            required={!!editing}
            hint={editing ? undefined : 'Boş bırakılırsa seçilen hizmet tesisinin adı kullanılır.'}
          >
            <Input placeholder={editing ? `${T.facilitySingular} adını giriniz...` : 'Opsiyonel'} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </Field>

          <Field label="Mekan Türü">
            <SegmentedControl
              value={form.kind}
              onChange={(v) => { setForm((p) => ({ ...p, kind: v as FacilityForm['kind'], serviceFacilityId: '' })); setTargets([]) }}
              columns={2}
              options={[
                { value: 'indoor', label: 'Kapalı Tesis', description: 'Bina içi mekan', icon: Building2Icon },
                { value: 'outdoor', label: 'Açık Alan', description: 'Açık hava / arazi', icon: TreePineIcon },
              ]}
            />
          </Field>

          <Field
            label={editing ? 'Hizmet Tesisi' : 'Hizmet Tesis(ler)i'}
            required
            hint={editing
              ? 'Konum, ilçe ve adres bilgisi seçilen hizmet tesisinden alınır.'
              : 'Birden fazla seçebilirsiniz; her hizmet tesisi için ayrı kayıt oluşur.'}
          >
            {editing ? (
              <ServiceFacilitySelect value={form.serviceFacilityId} kind={form.kind === 'outdoor' ? 'outdoor' : 'indoor'} onChange={(v) => setForm((p) => ({ ...p, serviceFacilityId: v }))} />
            ) : (
              <ServiceFacilitySelect
                multiple
                value=""
                onChange={() => {}}
                values={targets.map((t) => t.id)}
                onChangeMany={(ids, opts) => setTargets(ids.map((id) => ({ id, label: opts.find((o) => o.value === id)?.label ?? '' })))}
                kind={form.kind === 'outdoor' ? 'outdoor' : 'indoor'}
              />
            )}
          </Field>

          {editing && (
            <Field label="Kapasite (kişi)" hint="Boş bırakılırsa veya 0 girilirse tesis kapasitesi sınırsızdır.">
              <Input sanitize="digits" placeholder="Örn. 120" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} />
            </Field>
          )}
        </FormSection>

        {editing && (
          <FormSection title="Durum" icon={TreePineIcon} variant="card">
            <div className="flex items-center justify-between gap-[15px]">
              <p className="type-caption">Pasif tesis başvuru ve seans listesinde görünmez.</p>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
            </div>
          </FormSection>
        )}
      </AdminFormShell>
    </Drawer>
  )
}

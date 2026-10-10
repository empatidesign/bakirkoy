import { useState } from 'react'
import { toast } from 'sonner'
import { GraduationCapIcon, CheckCircle2Icon, XCircleIcon, PlusIcon, ShieldCheckIcon, ContactIcon, PowerIcon, XIcon, MessageSquareIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { Modal, Button, Input, EmailInput, PhoneInput, TcknInput, isValidTckn, Label, Switch, Badge, CredentialDeliveryCard, AdminFormShell, FormSection, Field } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { FacilitySendMessageModal } from './FacilitySendMessageModal'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { InstructorRecord, InstructorForm, InstructorDeliveryChannel } from '@/types/facility.types'

interface Props {
  open: boolean
  onClose: () => void
  config: FacilityModuleConfig
  service: FacilityModuleService
}

const emptyForm: InstructorForm = { fullName: '', tckn: '', phone: '', email: '', specialty: '', isActive: true }

const isInstructorFormValid = (f: InstructorForm): boolean =>
  !!f.fullName.trim() && isValidTckn(f.tckn) && f.phone.length === 11

const isCreateValid = (f: InstructorForm): boolean =>
  isInstructorFormValid(f) && !!f.email.trim()

export const FacilityInstructorsModal = ({ open, onClose, config, service }: Props) => {
  const { can } = useAuth()
  const [createSignal, setCreateSignal] = useState(0)
  const [templateMessageIds, setTemplateMessageIds] = useState<string[] | null>(null)

  const sendCreate = async (form: InstructorForm, channel: InstructorDeliveryChannel, close: () => void) => {
    if (!isCreateValid(form)) return
    await service.instructors.create(form, channel)
    toast.success(`Eğitmen oluşturuldu. Geçici şifre ${channel === 'Email' ? 'e-posta' : 'SMS'} ile gönderildi.`)
    close()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={1120}
      className="max-w-[calc(100vw-2rem)] overflow-hidden"
      hideCloseButton
    >
      <div className="flex min-h-full flex-col">
        <div className="relative overflow-hidden ds-hero">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
          <div className="absolute bottom-0 left-6 h-16 w-16 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
          <div className="relative flex min-h-[84px] items-center gap-4 border-b border-white/15 px-6 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <GraduationCapIcon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white">Eğitmenler</p>
              <p className="text-[12px] text-white/70 mt-0.5">Eğitmen ekleyin, düzenleyin; gruplara atanmak üzere kullanın</p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              {can('service-facilities.create') && (
                <Button variant="outline" size="sm" onClick={() => setCreateSignal((s) => s + 1)} iconLeft={<PlusIcon className="h-3.5 w-3.5" />}
                  style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
                  Yeni Eğitmen
                </Button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                title="Kapat"
                className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/15 text-white shadow-sm transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        <div className="p-5">
          <CrudListTemplate<InstructorRecord, InstructorForm>
          icon={GraduationCapIcon}
          title="Eğitmenler"
          resourceName="Eğitmen"
          embedded
          createSignal={createSignal}
          service={{
            getList: (p) => service.instructors.getList(p),
            remove: can('service-facilities.delete') ? (id) => service.instructors.remove(id) : undefined,
            toggleStatus: can('service-facilities.edit') ? (id) => service.instructors.toggleStatus(id) : undefined,
          }}
          rowKey={(r) => r.id}
          searchPlaceholder="Eğitmen adı ara..."
          selectable
          bulkActions={(rows) => (
            <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateMessageIds(rows.map((r) => r.id))}>
              Şablonlu Mesaj Gönder
            </Button>
          )}
          columns={[
            { key: 'fullName', header: 'Ad Soyad', sortable: true, sortKey: 'fullName', cell: (r) => <span className="type-body-strong">{r.fullName}</span> },
            { key: 'specialty', header: 'Uzmanlık', cell: (r) => <span className="type-muted">{r.specialty || '—'}</span> },
            { key: 'phone', header: 'Telefon', cell: (r) => r.phone || '—' },
            { key: 'groupCount', header: 'Grup', align: 'right', cell: (r) => r.groupCount ?? 0 },
            { key: 'isActive', header: 'Durum', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
          ]}
          stats={({ rows, total }) => [
            { label: 'Toplam Eğitmen', value: total, icon: GraduationCapIcon, accent: 'blue' },
            { label: 'Aktif', value: rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
            { label: 'Pasif', value: rows.filter((r) => !r.isActive).length, icon: XCircleIcon, accent: 'orange' },
          ]}
          emptyForm={emptyForm}
          toForm={(r) => ({ fullName: r.fullName, tckn: r.tckn ?? '', phone: r.phone ?? '', email: r.email ?? '', specialty: r.specialty ?? '', isActive: r.isActive })}
          isFormValid={isInstructorFormValid}
          canEdit={() => can('service-facilities.edit')}
          canDelete={() => can('service-facilities.delete')}
          onUpdate={can('service-facilities.edit') ? async (id, f) => { await service.instructors.update(id, f) } : undefined}
          isActive={(r) => r.isActive}
          emptyDescription={'Üstteki "Yeni Eğitmen" butonunu kullanın'}
          deleteConfirm={{ title: 'Eğitmen Sil', description: 'Bu eğitmeni silmek istediğinizden emin misiniz?' }}
          renderFormFooter={({ mode, saving, submit, close }) =>
            mode === 'edit' ? (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={close}>İptal</Button>
                <Button variant="primary" className="flex-1" isLoading={saving} onClick={submit}>Güncelle</Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={close}>İptal</Button>
            )
          }
          renderForm={({ form, setForm, mode, close }) => (
            <AdminFormShell
              icon={GraduationCapIcon}
              title={mode === 'edit' ? 'Eğitmen Düzenle' : 'Yeni Eğitmen Ekle'}
              subtitle="Kimlik, iletişim, uzmanlık ve erişim bilgileri"
              badge={mode === 'edit' ? 'Düzenleme' : 'Yeni kayıt'}
              tone="blue"
            >
              <FormSection icon={ContactIcon} title="Kimlik ve İletişim" variant="card">
                <Field label="Ad Soyad" required>
                  <Input sanitize="letters" placeholder="Eğitmen adı soyadı..." value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
                </Field>
                <div className="grid grid-cols-2 gap-[15px]">
                  <Field label="T.C. Kimlik No" required>
                    <TcknInput value={form.tckn} onChange={(d) => setForm((p) => ({ ...p, tckn: d }))} />
                  </Field>
                  <Field label="Telefon" required>
                    <PhoneInput value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
                  </Field>
                </div>
                <Field label="E-posta" required={mode === 'create'}>
                  <EmailInput value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={mode === 'edit'} />
                </Field>
                <Field label="Uzmanlık / Branş">
                  <Input placeholder="Örn. Yüzme, Basketbol..." value={form.specialty} onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))} />
                </Field>
              </FormSection>

              <FormSection icon={PowerIcon} title="Durum" variant="card">
                <div className="flex items-center justify-between gap-[15px]">
                  <Label>Aktif</Label>
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
                </div>
              </FormSection>

              {mode === 'create' && (
                <>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-1 px-4 py-3">
                    <ShieldCheckIcon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="type-body-strong">Verilecek yetki:</span>
                    <Badge tone="success">Eğitmen</Badge>
                    <span className="type-caption text-foreground-muted">· yalnız atandığı tesisler</span>
                  </div>
                  <CredentialDeliveryCard
                    title="Şifre"
                    description="Eğitmen için bir hesap oluşturulur ve güçlü, rastgele bir geçici şifre üretilir. İlk girişte şifresini değiştirmek zorundadır. Şifrenin nasıl iletileceğini seçin:"
                    onSend={(ch) => sendCreate(form, ch as InstructorDeliveryChannel, close)}
                    disabled={!isCreateValid(form)}
                    disabledHint="Göndermeden önce ad, T.C. kimlik no, telefon ve e-posta alanlarını doldurun."
                  />
                </>
              )}
            </AdminFormShell>
          )}
        />
        </div>
      </div>
      <FacilitySendMessageModal
        open={!!templateMessageIds}
        module={config.routeId}
        target="instructor"
        ids={templateMessageIds ?? []}
        service={service}
        onClose={() => setTemplateMessageIds(null)}
      />
    </Modal>
  )
}

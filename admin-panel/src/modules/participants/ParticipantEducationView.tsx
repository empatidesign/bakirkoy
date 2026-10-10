import { useState, useEffect } from 'react'
import { SchoolIcon, PlusCircleIcon, PencilIcon, Trash2Icon, GraduationCapIcon as GradIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button, Badge, Field, Select, Input, ToggleRow, EmptyState, SkeletonRows, ConfirmModal,
} from '@/design-system'
import { AdminFormShell } from '@/design-system/AdminFormShell'
import { Drawer } from '@/design-system/Drawer'
import { useAuth } from '@/framework/auth/AuthContext'
import educationService from '@/services/education.service'
import type {
  EducationHistory, EducationHistoryForm, EducationInstitutionOption, EducationLevel,
} from '@/types/education.types'
import type { ParticipantDetail } from '@/types/participant.types'

const LEVELS: { value: EducationLevel; label: string }[] = [
  { value: 'Ilkokul', label: 'İlkokul' },
  { value: 'Ortaokul', label: 'Ortaokul' },
  { value: 'Lise', label: 'Lise' },
  { value: 'Onlisans', label: 'Ön Lisans' },
  { value: 'Lisans', label: 'Lisans' },
  { value: 'YuksekLisans', label: 'Yüksek Lisans' },
  { value: 'Doktora', label: 'Doktora' },
]

const EMPTY_FORM: EducationHistoryForm = {
  institutionId: '',
  level: '',
  startYear: '',
  endYear: '',
  isGraduated: false,
}

interface Props {
  participant: ParticipantDetail
}

export const ParticipantEducationView = ({ participant }: Props) => {
  const { can } = useAuth()
  const canEdit = can('participants.edit')
  const [histories, setHistories] = useState<EducationHistory[]>([])
  const [options, setOptions] = useState<EducationInstitutionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EducationHistory | null>(null)
  const [form, setForm] = useState<EducationHistoryForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EducationHistory | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [h, o] = await Promise.all([
        educationService.getHistories(participant.id),
        educationService.getInstitutionOptions(),
      ])
      setHistories(h)
      setOptions(o)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load useCallback'e sarılı değil; eklenirse her render'da gereksiz yeniden fetch olur
  useEffect(() => { load() }, [participant.id])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  const openEdit = (h: EducationHistory) => {
    setEditTarget(h)
    setForm({
      institutionId: h.institutionId ?? '',
      level: h.level,
      startYear: String(h.startYear),
      endYear: h.endYear ? String(h.endYear) : '',
      isGraduated: h.isGraduated,
    })
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    if (!form.level || !form.startYear) return
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await educationService.updateHistory(participant.id, editTarget.id, form)
        setHistories((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
        toast.success('Eğitim kaydı güncellendi.')
      } else {
        const created = await educationService.createHistory(participant.id, form)
        setHistories((prev) => [...prev, created])
        toast.success('Eğitim kaydı eklendi.')
      }
      setDrawerOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await educationService.deleteHistory(participant.id, deleteTarget.id)
    setHistories((prev) => prev.filter((h) => h.id !== deleteTarget.id))
    setDeleteTarget(null)
    toast.success('Eğitim kaydı silindi.')
  }

  const isFormValid = !!form.level && !!form.startYear
  const institutionOptions = options.map((o) => ({
    value: o.id,
    label: o.faculty ? `${o.name} › ${o.faculty}${o.department ? ` › ${o.department}` : ''}` : o.name,
  }))

  return (
    <div className="space-y-4 p-4">
      {(participant.sedaEducations?.length ?? 0) > 0 && (
        <div className="rounded-card border border-border bg-card shadow-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <GradIcon className="h-4 w-4 text-primary" />
            <h3 className="type-section">SEDA Eğitimi</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-4">
            {participant.sedaEducations?.map((e) => (
              <Badge key={e.academicYear} tone="success">SEDA'dan eğitim aldı — {e.academicYear}</Badge>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-card border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="type-section">Eğitim Geçmişi</h3>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={openCreate}>
              <PlusCircleIcon className="h-4 w-4" /> Ekle
            </Button>
          )}
        </div>

        <div className="p-4 space-y-2">
      {loading ? (
        <SkeletonRows rows={3} />
      ) : histories.length === 0 ? (
        <EmptyState icon={SchoolIcon} title="Eğitim kaydı yok" description="Henüz eğitim bilgisi girilmemiş." />
      ) : (
        <>
          {histories.map((h) => (
            <div key={h.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-1 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                  <GradIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="type-body-strong">{h.levelLabel}</p>
                  {h.institutionName && (
                    <p className="type-caption text-foreground-muted">
                      {h.institutionName}{h.faculty ? ` › ${h.faculty}` : ''}{h.department ? ` › ${h.department}` : ''}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="type-caption">{h.startYear}{h.endYear ? ` – ${h.endYear}` : ' – devam ediyor'}</span>
                    {h.isGraduated && <Badge tone="success">Mezun</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(h)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground-default"
                      title="Düzenle"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(h)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      title="Sil"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </>
      )}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title=""
        hideHeader
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDrawerOpen(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={() => void handleSave()} isLoading={saving} disabled={!isFormValid}>Kaydet</Button>
          </div>
        }
      >
        <AdminFormShell
          icon={SchoolIcon}
          title={editTarget ? 'Eğitim Kaydını Düzenle' : 'Yeni Eğitim Kaydı'}
          subtitle={participant.fullName}
          tone="blue"
        >
          <Field label="Kurum">
            <Select
              searchable
              searchPlaceholder="Kurum ara..."
              value={form.institutionId}
              onChange={(e) => setForm((p) => ({ ...p, institutionId: e.target.value }))}
              placeholder="Kurum seçin (opsiyonel)"
            >
              <option value="">— Kurum seçilmedi —</option>
              {institutionOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Eğitim Seviyesi" required>
            <Select
              value={form.level}
              onChange={(e) => setForm((p) => ({ ...p, level: e.target.value as EducationLevel }))}
              placeholder="Seviye seçin"
            >
              {LEVELS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Başlangıç Yılı" required>
              <Input
                type="number"
                value={form.startYear}
                onChange={(e) => setForm((p) => ({ ...p, startYear: e.target.value }))}
                placeholder="2010"
                min={1950}
                max={2030}
              />
            </Field>
            <Field label="Bitiş Yılı">
              <Input
                type="number"
                value={form.endYear}
                onChange={(e) => setForm((p) => ({ ...p, endYear: e.target.value }))}
                placeholder="2014"
                min={1950}
                max={2030}
              />
            </Field>
          </div>
          <ToggleRow
            label="Mezun"
            description="Bu okuldan mezun oldu mu?"
            checked={form.isGraduated}
            onChange={(v) => setForm((p) => ({ ...p, isGraduated: v }))}
          />
        </AdminFormShell>
      </Drawer>

      <ConfirmModal
        open={!!deleteTarget}
        title="Eğitim Kaydı Silinsin mi?"
        description={`${deleteTarget?.levelLabel} kaydı kalıcı olarak silinecek.`}
        tone="danger"
        confirmLabel="Sil"
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

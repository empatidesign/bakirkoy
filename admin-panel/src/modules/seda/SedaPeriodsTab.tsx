import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { CalendarRangeIcon, CalendarCheckIcon, LayersIcon, ArmchairIcon, PowerIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Input, Field, FilterField, ToggleRow, NumberInput, Textarea, DatePicker, IconButton, FormSection } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import sedaService from '@/services/seda.service'
import { emptySedaPeriodForm, sedaPeriodToForm, todayIso } from './sedaConstants'
import type { SedaPeriod, SedaPeriodForm } from '@/types/seda.types'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

const PeriodFormFields = ({ form, setForm, mode }: {
  form: SedaPeriodForm; setForm: Dispatch<SetStateAction<SedaPeriodForm>>; mode: 'create' | 'edit'
}) => {
  const patch = (p: Partial<SedaPeriodForm>) => setForm((f) => ({ ...f, ...p }))
  return (
    <div className="p-5 space-y-5">
      <FormSection icon={CalendarRangeIcon} title="Dönem Bilgileri" variant="card">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dönem Adı" required>
            <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Örn. 2026-2027 Güz Dönemi" />
          </Field>
          <Field label="Maksimum Başvuru">
            <NumberInput value={form.maxApplications} onChange={(n) => patch({ maxApplications: n })} min={0} suffix="kişi" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Başlangıç Tarihi" required>
            <DatePicker value={form.startDate} onChange={(v) => patch({ startDate: v })} min={mode === 'create' ? todayIso() : undefined} clearable />
          </Field>
          <Field label="Bitiş Tarihi" required>
            <DatePicker value={form.endDate} onChange={(v) => patch({ endDate: v })} min={form.startDate || (mode === 'create' ? todayIso() : undefined)} clearable />
          </Field>
        </div>
        <Field label="Açıklama">
          <Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} rows={3} placeholder="Dönem hakkında açıklama..." />
        </Field>
      </FormSection>
    </div>
  )
}

export const SedaPeriodsTab = () => {
  const { can } = useAuth()
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [activating, setActivating] = useState(false)
  // Kullanıcı isteği (2026-08-11): "belirli dönemlerde belirli kurslar günü geçmişler olabilir" —
  // gezi/travels modülündeki "Geçmiş Seferleri Göster" filtresiyle aynı desen. Varsayılan olarak
  // bitiş tarihi geçmiş dönemler gizlenir (aktif dönem hariç, o her zaman görünür).
  const [showPast, setShowPast] = useState(false)

  const activatePeriod = async (id: string) => {
    if (activating) return
    setActivating(true)
    try {
      await sedaService.activatePeriod(id)
      toast.success('Dönem aktif edildi.')
      setRefreshSignal((s) => s + 1)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Dönem aktif edilemedi.')
    } finally {
      setActivating(false)
    }
  }

  return (
    <CrudListTemplate<SedaPeriod, SedaPeriodForm>
      icon={CalendarRangeIcon}
      title="Dönemler"
      subtitle="Başvuru dönemlerini tanımlayın ve aktif dönemi belirleyin"
      resourceName="Dönem"
      listTitle="Dönem Listesi"
      searchPlaceholder="Dönem adı ara..."
      service={{
        getList: (p) => sedaService.getPeriods(p),
        remove: can('seda.delete') ? (id) => sedaService.deletePeriod(id) : undefined,
      }}
      rowKey={(r) => r.id}
      defaultSort={{ key: 'startDate', dir: 'desc' }}
      refreshSignal={refreshSignal}
      drawerWidth={560}
      extraParams={showPast ? {} : { hidePast: 'true' }}
      hasActiveFilters={showPast}
      filterCount={showPast ? 1 : 0}
      onClearFilters={() => setShowPast(false)}
      renderFilters={() => (
        <FilterField label="Geçmiş Dönemler">
          <ToggleRow
            label="Geçmiş Dönemleri Göster"
            description="Açıksa, bitiş tarihi geçmişte kalan dönemler de listede görünür."
            checked={showPast}
            onChange={setShowPast}
          />
        </FilterField>
      )}
      stats={({ rows, total }) => [
        { label: 'Toplam Dönem', value: total, icon: LayersIcon, accent: 'blue' },
        { label: 'Aktif Dönem', value: rows.filter((r) => r.isActive).length, icon: CalendarCheckIcon, accent: 'green' },
        { label: 'Toplam Kontenjan', value: rows.reduce((a, r) => a + r.maxApplications, 0), icon: ArmchairIcon, accent: 'violet' },
      ]}
      columns={[
        { key: 'name', header: 'Dönem', sortable: true, sortKey: 'name', cell: (r) => <span className="type-body-strong">{r.name}</span> },
        { key: 'range', header: 'Tarih Aralığı', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span> },
        { key: 'fill', header: 'Doluluk', align: 'center', cell: (r) => <span className="tabular-nums type-muted">{r.currentApplications} / {r.maxApplications}</span> },
        { key: 'isActive', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
      ]}
      emptyForm={emptySedaPeriodForm()}
      toForm={sedaPeriodToForm}
      getFormErrors={(f) => [
        !f.name.trim() && 'Dönem adı zorunludur.',
        !f.startDate && 'Başlangıç tarihi zorunludur.',
        !f.endDate && 'Bitiş tarihi zorunludur.',
        (!!f.startDate && !!f.endDate && f.endDate < f.startDate) && 'Bitiş tarihi başlangıç tarihinden önce olamaz.',
      ].filter(Boolean) as string[]}
      renderForm={({ form, setForm, mode }) => <PeriodFormFields form={form} setForm={setForm} mode={mode} />}
      creatable={can('seda.create')}
      canEdit={() => can('seda.edit')}
      onCreate={can('seda.create') ? (f) => sedaService.createPeriod(f).then(() => undefined) : undefined}
      onUpdate={can('seda.edit') ? (id, f) => sedaService.updatePeriod(id, f).then(() => undefined) : undefined}
      canDelete={(r) => can('seda.delete') && !r.isActive}
      selectable
      deleteConfirm={{ title: 'Dönemi Sil', description: 'Bu dönemi silmek istediğinizden emin misiniz? Aktif dönem silinemez.' }}
      extraRowActions={(row) => (
        <IconButton
          tone="primary"
          title={!can('seda.edit') ? 'Dönem aktifleştirme yetkiniz yok' : row.isActive ? 'Zaten aktif' : 'Aktif Et'}
          disabled={row.isActive || activating || !can('seda.edit')}
          onClick={() => activatePeriod(row.id)}
        >
          <PowerIcon className="h-4 w-4" />
        </IconButton>
      )}
    />
  )
}

import { FacilitySettingsDialog } from './pilot/FacilitySettingsDialog'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { SettingsIcon, SlidersHorizontalIcon } from 'lucide-react'
import { Drawer, Tabs, Select, Switch, Label, Button, Badge, EmptyState, AdminFormShell, FormSection, Field } from '@/design-system'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { FacilityRecord, GeneralSettings, FacilityScopeSettings, BranchRecord } from '@/types/facility.types'
import { GeneralSettingsForm } from './settings/GeneralSettingsForm'
import { ScopedSettingsForm } from './settings/ScopedSettingsForm'
import { FacilityStaticQrSection } from './settings/FacilityStaticQrSection'
import { FacilityBranchSettingsManager } from './settings/FacilityBranchSettingsManager'
import { getDefaultGeneralSettings, DEFAULT_SCOPED_SETTINGS } from './settings/defaults'

interface Props {
  open: boolean
  onClose: () => void
  config: FacilityModuleConfig
  service: FacilityModuleService
  facilities: FacilityRecord[]
  initialFacilityId?: string
}

export const FacilitySettingsModal = ({ open, onClose, config, service, facilities, initialFacilityId }: Props) => {
  // Kullanıcı isteği (2026-10-01): pilot tasarım artık tüm Hizmetlerimiz modüllerinde açık.
  const pilot = true
  const [generalLoading, setGeneralLoading] = useState(true)
  const [facilityLoading, setFacilityLoading] = useState(true)
  const [generalError, setGeneralError] = useState(false)
  const [facilityError, setFacilityError] = useState(false)
  const T = config.terminology
  const [tab, setTab] = useState('general')
  const [general, setGeneral] = useState<GeneralSettings>(() => getDefaultGeneralSettings(config.id))
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [facId, setFacId] = useState('')
  const [facScope, setFacScope] = useState<FacilityScopeSettings>({ useGeneral: true, settings: DEFAULT_SCOPED_SETTINGS })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTab(initialFacilityId ? 'facility' : 'general')
    setFacId(initialFacilityId || facilities[0]?.id || '')
    let active = true
    setGeneralLoading(true)
    setGeneralError(false)
    service.settings.getGeneral()
      .then((s) => { if (active) setGeneral(s ? { ...getDefaultGeneralSettings(config.id), ...s } : getDefaultGeneralSettings(config.id)) })
      .catch(() => { if (active) { setGeneralError(true); setGeneral(getDefaultGeneralSettings(config.id)) } })
      .finally(() => { if (active) setGeneralLoading(false) })
    service.branches.getList({ page: 1, limit: 200 }).then((r) => setBranches(r.items)).catch(() => setBranches([]))
    return () => { active = false }
  }, [open, service, initialFacilityId, facilities, config.id])

  useEffect(() => {
    if (!open || tab !== 'facility' || !facId) return
    let active = true
    setFacilityLoading(true)
    setFacilityError(false)
    service.settings.getForFacility(facId)
      .then((s) => { if (active) setFacScope(s
        ? { useGeneral: s.useGeneral ?? true, settings: { ...DEFAULT_SCOPED_SETTINGS, ...(s.settings ?? {}) } }
        : { useGeneral: true, settings: DEFAULT_SCOPED_SETTINGS }) })
      .catch(() => { if (active) setFacilityError(true) })
      .finally(() => { if (active) setFacilityLoading(false) })
    return () => { active = false }
  }, [open, tab, service, facId])
  const loading = tab === 'general' ? generalLoading : facilityLoading
  const loadError = tab === 'general' ? generalError : facilityError

  const save = async () => {
    if (pilot && (loading || loadError || (tab === 'facility' && !facId))) return
    setSaving(true)
    try {
      if (tab === 'general') {
        setGeneral(await service.settings.saveGeneral(general))
        toast.success('Genel ayarlar kaydedildi.')
      } else {
        setFacScope(await service.settings.saveForFacility(facId, facScope))
        toast.success(`${T.facilitySingular} ayarları kaydedildi.`)
      }
    } catch {
      toast.error('Ayarlar kaydedilemedi. Lütfen tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  const settingsContent = (
    <>
        {tab === 'general' ? (
          <GeneralSettingsForm config={config} service={service} facilities={facilities} value={general} onChange={setGeneral} />
        ) : tab === 'branches' ? (
          <FacilityBranchSettingsManager config={config} service={service} />
        ) : (
          <>
            <FormSection icon={SlidersHorizontalIcon} title={`${T.facilitySingular} Kapsamı`} variant="card">
              <div className="grid grid-cols-2 gap-[15px]">
                <Field label={`${T.facilitySingular} Seçin`}>
                  <Select value={facId} onChange={(e) => { setFacId(e.target.value); setFacilityLoading(true) }} searchable searchPlaceholder={`${T.facilitySingular} ara...`}>
                    {facilities.length === 0 && <option value="">Tesis yok</option>}
                    {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                </Field>
              </div>
            </FormSection>

            {!facId ? (
              <EmptyState icon={SlidersHorizontalIcon} title={`Lütfen bir ${T.facilitySingular.toLowerCase()} seçin`} description="" />
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border bg-primary-soft px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <Label htmlFor="facility-use-general">Genel Ayarları Kullan</Label>
                      <p className="type-caption">Bu {T.facilitySingular.toLowerCase()} için genel ayarları kullan</p>
                    </div>
                    <Badge tone={facScope.useGeneral ? 'info' : 'warning'}>{facScope.useGeneral ? 'Ortak' : 'Özel'}</Badge>
                  </div>
                  <Switch id="facility-use-general" aria-label="Genel ayarları kullan" checked={facScope.useGeneral} onCheckedChange={(v) => setFacScope((p) => ({ ...p, useGeneral: v }))} />
                </div>

                {facScope.useGeneral ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface-1 px-4 py-6 text-center type-muted">
                    Bu {T.facilitySingular.toLowerCase()} genel ayarları kullanıyor. Özelleştirmek için yukarıdaki anahtarı kapatın.
                  </div>
                ) : (
                  <ScopedSettingsForm value={facScope.settings} onChange={(s) => setFacScope((p) => ({ ...p, settings: s }))} branches={branches} branchLabel={T.branchSingular} />
                )}

                <FacilityStaticQrSection
                  facilityId={facId}
                  facilityName={facilities.find((f) => f.id === facId)?.name ?? ''}
                  service={service}
                />
              </>
            )}
          </>
        )}
    </>
  )
  if (pilot) return <FacilitySettingsDialog
    open={open}
    onClose={onClose}
    title={`${T.facilitySingular} Ayarları`}
    tab={tab}
    onTabChange={(next) => { setTab(next); if (next === 'facility' && next !== tab && facId) setFacilityLoading(true) }}
    branchTabLabel={T.branchPlural}
    footer={
      tab === 'branches' ? undefined : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="pilot-muted">Değişiklikleri uygulamak için kaydedin.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Vazgeç</Button>
            <Button type="button" isLoading={saving} disabled={loading || loadError || (tab === 'facility' && !facId)} onClick={save}>Değişiklikleri kaydet</Button>
          </div>
        </div>
      )
    }
  >
    {loadError && tab !== 'branches' && <div role="alert" className="mb-4 rounded-lg border border-danger p-4 text-danger">Ayarlar yüklenemedi. Kaydetme kapatıldı; paneli yeniden açarak tekrar deneyin.</div>}
    {loading && tab !== 'branches' && (tab === 'general' || facId) && <p role="status" className="mb-4 pilot-muted">Ayarlar yükleniyor…</p>}
    <div className="min-w-0 space-y-4">{settingsContent}</div>
  </FacilitySettingsDialog>

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`${T.facilitySingular} Ayarları`}
      hideHeader
      width={760}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button variant="primary" isLoading={saving} onClick={save}>Kaydet</Button>
        </div>
      }
    >
      <AdminFormShell
        icon={SettingsIcon}
        title={`${T.facilitySingular} Ayarları`}
        subtitle="Genel kurallar ve tesis bazlı özelleştirmeler"
        badge={tab === 'general' ? 'Genel' : 'Tesis'}
        tone="orange"
      >
        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            { key: 'general', label: 'Genel Ayarlar', icon: SettingsIcon },
            { key: 'facility', label: `${T.facilitySingular} Ayarları`, icon: SlidersHorizontalIcon },
          ]}
        />

        {settingsContent}
      </AdminFormShell>
    </Drawer>
  )
}

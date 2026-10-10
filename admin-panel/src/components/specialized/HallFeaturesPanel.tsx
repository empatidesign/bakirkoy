import { useEffect, useState } from 'react'
import {
  XIcon, SearchIcon, Settings2Icon, FolderOpenIcon, BookmarkIcon,
  PlusIcon, CheckIcon, Trash2Icon, PencilIcon, SlidersHorizontalIcon, AlertTriangleIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Input, Textarea, Label, ToggleChip } from '@/design-system'
import { cn } from '@/lib/utils'
import hallService from '@/services/hall.service'
import type { HallFeatureCatalog, HallFeatureTemplate, HallFeatureColor } from '@/types/hall.types'
import { DEFAULT_HALL_FEATURE_CATALOG, DEFAULT_HALL_FEATURE_TEMPLATES, HALL_FEATURE_COLORS } from '@/types/hall.types'

const GROUP_STYLE: Record<HallFeatureColor, { dot: string; soft: string; solid: string; text: string }> = {
  blue: { dot: 'bg-accent-blue', soft: 'bg-accent-blue-soft', solid: 'bg-accent-blue', text: 'text-accent-blue' },
  green: { dot: 'bg-accent-green', soft: 'bg-accent-green-soft', solid: 'bg-accent-green', text: 'text-accent-green' },
  orange: { dot: 'bg-accent-orange', soft: 'bg-accent-orange-soft', solid: 'bg-accent-orange', text: 'text-accent-orange' },
  violet: { dot: 'bg-accent-violet', soft: 'bg-accent-violet-soft', solid: 'bg-accent-violet', text: 'text-accent-violet' },
  cyan: { dot: 'bg-info', soft: 'bg-info-soft', solid: 'bg-info', text: 'text-info' },
  red: { dot: 'bg-danger', soft: 'bg-danger-soft', solid: 'bg-danger', text: 'text-danger' },
}
// Backend'den tanınmayan bir renk gelirse panel çökmesin; mavi stile düşülür.
const styleOf = (color: string) => GROUP_STYLE[color as HallFeatureColor] ?? GROUP_STYLE.blue
const COLOR_LABEL: Record<HallFeatureColor, string> = {
  blue: 'Mavi', green: 'Yeşil', orange: 'Turuncu', violet: 'Mor', cyan: 'Camgöbeği', red: 'Kırmızı',
}

interface HallFeaturesPanelProps {
  open: boolean
  onClose: () => void
  value: string[]
  onChange: (ids: string[]) => void
}

export const HallFeaturesPanel = ({ open, onClose, value, onChange }: HallFeaturesPanelProps) => {
  const [catalog, setCatalog] = useState<HallFeatureCatalog>(DEFAULT_HALL_FEATURE_CATALOG)
  const [templates, setTemplates] = useState<HallFeatureTemplate[]>(DEFAULT_HALL_FEATURE_TEMPLATES)
  const [panel, setPanel] = useState<'select' | 'manage' | 'templates'>('select')
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [busy, setBusy] = useState(false)

  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupColor, setGroupColor] = useState<HallFeatureColor>('blue')
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  const [addFeatGroup, setAddFeatGroup] = useState<string | null>(null)
  const [featName, setFeatName] = useState('')
  const [editFeatId, setEditFeatId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const [saveOpen, setSaveOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplDesc, setTplDesc] = useState('')

  useEffect(() => {
    if (!open) return
    setPanel('select'); setSearch(''); setGroupFilter('all'); setSelectedOnly(false)
    setNewGroupOpen(false); setEditGroupId(null); setAddFeatGroup(null); setEditFeatId(null); setConfirmId(null); setSaveOpen(false)
    let cancelled = false
    ;(async () => {
      try { const c = await hallService.getFeatureCatalog(); if (!cancelled && c?.groups?.length) setCatalog(c) } catch { /* fallback seed */ }
      try { const t = await hallService.getFeatureTemplates(); if (!cancelled && t) setTemplates(t) } catch { /* fallback seed */ }
    })()
    return () => { cancelled = true }
  }, [open])

  const prune = (c: HallFeatureCatalog) => {
    const ids = new Set(c.features.map((f) => f.id))
    const next = value.filter((v) => ids.has(v))
    if (next.length !== value.length) onChange(next)
  }
  const runCatalog = async (fn: () => Promise<HallFeatureCatalog>, okMsg: string, pruneAfter = false) => {
    setBusy(true)
    try { const c = await fn(); setCatalog(c); if (pruneAfter) prune(c); toast.success(okMsg) } finally { setBusy(false) }
  }
  const reloadTemplates = async () => { try { setTemplates(await hallService.getFeatureTemplates()) } catch { /* keep */ } }

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  const q = search.trim().toLocaleLowerCase('tr')
  const matches = (name: string) => !q || name.toLocaleLowerCase('tr').includes(q)
  const visibleFeatures = catalog.features.filter((f) => {
    if (selectedOnly && !value.includes(f.id)) return false
    if (groupFilter !== 'all' && f.group !== groupFilter) return false
    return matches(f.name)
  })
  const groupsWithVisible = catalog.groups.filter((g) => visibleFeatures.some((f) => f.group === g.id))

  const startEditGroup = (id: string, name: string, color: HallFeatureColor) => {
    setEditGroupId(id); setGroupName(name); setGroupColor(color); setNewGroupOpen(false)
  }
  const submitGroup = async () => {
    const name = groupName.trim()
    if (!name) return
    if (editGroupId) await runCatalog(() => hallService.updateFeatureGroup(editGroupId, { name, color: groupColor }), 'Grup güncellendi.')
    else await runCatalog(() => hallService.createFeatureGroup({ name, color: groupColor }), 'Grup eklendi.')
    setEditGroupId(null); setNewGroupOpen(false); setGroupName(''); setGroupColor('blue')
  }
  const submitFeature = async (groupId: string) => {
    const name = featName.trim()
    if (!name) return
    await runCatalog(() => hallService.createFeature({ name, group: groupId }), 'Özellik eklendi.')
    setFeatName(''); setAddFeatGroup(null)
  }
  const submitRename = async (id: string) => {
    const name = featName.trim()
    const feat = catalog.features.find((f) => f.id === id)
    if (!name || !feat) { setEditFeatId(null); return }
    await runCatalog(() => hallService.updateFeature(id, { name, group: feat.group }), 'Özellik güncellendi.')
    setEditFeatId(null); setFeatName('')
  }
  const doDelete = async () => {
    if (!confirmId) return
    const isGroup = catalog.groups.some((g) => g.id === confirmId)
    if (isGroup) await runCatalog(() => hallService.deleteFeatureGroup(confirmId), 'Grup silindi.', true)
    else await runCatalog(() => hallService.deleteFeature(confirmId), 'Özellik silindi.', true)
    setConfirmId(null)
  }

  const applyTemplate = (t: HallFeatureTemplate, mode: 'replace' | 'merge') => {
    onChange(mode === 'replace' ? [...t.featureIds] : Array.from(new Set([...value, ...t.featureIds])))
    setPanel('select')
  }
  const saveTemplate = async () => {
    const name = tplName.trim()
    if (!name || value.length === 0) return
    setBusy(true)
    try {
      await hallService.createFeatureTemplate({ name, description: tplDesc.trim() || undefined, featureIds: [...value] })
      toast.success('Şablon kaydedildi.')
      setTplName(''); setTplDesc(''); setSaveOpen(false)
      await reloadTemplates()
    } finally { setBusy(false) }
  }
  const deleteTemplate = async (id: string) => {
    setBusy(true)
    try { await hallService.deleteFeatureTemplate(id); toast.success('Şablon silindi.'); await reloadTemplates() } finally { setBusy(false) }
  }

  const totalFeatures = catalog.features.length

  const templateBreakdown = (ids: string[]) => {
    const counts: Record<string, number> = {}
    for (const id of ids) {
      const feat = catalog.features.find((f) => f.id === id)
      if (feat) counts[feat.group] = (counts[feat.group] ?? 0) + 1
    }
    return catalog.groups.filter((g) => counts[g.id]).map((g) => ({ group: g, count: counts[g.id] }))
  }

  return (
    <Modal open={open} onClose={onClose} width={760} className="max-w-[96vw]">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4 pr-14">
        <div className="flex h-9 w-9 items-center justify-center rounded-field bg-primary-soft">
          <SlidersHorizontalIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground-strong">Salon Özellikleri</h3>
          <p className="type-caption">Katalogdan seç · şablon yükle/kaydet · katalogu yönet</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-2.5">
        <span className="type-caption text-foreground-muted">
          <strong className="text-foreground-strong">{value.length}</strong> seçili · katalogda {totalFeatures} özellik
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant={panel === 'manage' ? 'primary' : 'outline'} size="sm" onClick={() => setPanel(panel === 'manage' ? 'select' : 'manage')}>
            <Settings2Icon className="h-3.5 w-3.5" /> {panel === 'manage' ? 'Yönetimi Bitir' : 'Katalogu Yönet'}
          </Button>
          <Button variant={panel === 'templates' ? 'primary' : 'outline'} size="sm" onClick={() => setPanel(panel === 'templates' ? 'select' : 'templates')}>
            <FolderOpenIcon className="h-3.5 w-3.5" /> Şablon Yükle ({templates.length})
          </Button>
          <Button variant="outline" size="sm" disabled={value.length === 0} onClick={() => { setPanel('templates'); setSaveOpen(true) }}>
            <BookmarkIcon className="h-3.5 w-3.5" /> Şablon Kaydet
          </Button>
        </div>
      </div>

      <div className="max-h-[64vh] overflow-y-auto px-6 py-4">
        {panel === 'manage' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning-soft px-3 py-2">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
              <p className="type-caption text-foreground-default">
                <strong>Yönetim modu</strong> — gruplar ve özellikler düzenlenebilir. Değişiklikler tüm salonları etkiler.
              </p>
              <Button variant="outline" size="sm" className="ml-auto flex-shrink-0" onClick={() => { setNewGroupOpen(true); setEditGroupId(null); setGroupName(''); setGroupColor('blue') }}>
                <PlusIcon className="h-3.5 w-3.5" /> Yeni Grup
              </Button>
            </div>

            {(newGroupOpen || editGroupId) && (
              <div className="space-y-2 rounded-card border border-border bg-surface-1/60 p-3">
                <Label>{editGroupId ? 'Grubu düzenle' : 'Yeni grup'}</Label>
                <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Grup adı..." className="h-9" />
                <div className="flex flex-wrap gap-1.5">
                  {HALL_FEATURE_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setGroupColor(c)} title={COLOR_LABEL[c]}
                      className={cn('flex h-7 items-center gap-1.5 rounded-field border px-2 type-caption', groupColor === c ? 'border-primary bg-primary-soft' : 'border-border')}>
                      <span className={cn('h-3 w-3 rounded-full', GROUP_STYLE[c].dot)} /> {COLOR_LABEL[c]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" isLoading={busy} disabled={!groupName.trim()} onClick={submitGroup}>Kaydet</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setNewGroupOpen(false); setEditGroupId(null); setGroupName('') }}>Vazgeç</Button>
                </div>
              </div>
            )}

            {catalog.groups.map((g) => {
              const st = styleOf(g.color)
              return (
                <div key={g.id} className="space-y-2 rounded-card border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 type-section">
                      <span className={cn('h-2.5 w-2.5 rounded-full', st.dot)} /> {g.name}
                      <span className="type-caption text-foreground-muted">· {catalog.features.filter((f) => f.group === g.id).length}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setAddFeatGroup(g.id); setFeatName(''); setEditFeatId(null) }} className="type-link-sm">+ Özellik</button>
                      <button type="button" onClick={() => startEditGroup(g.id, g.name, g.color)} className="flex h-7 w-7 items-center justify-center rounded-field text-foreground-muted hover:bg-surface-1"><PencilIcon className="h-3.5 w-3.5" /></button>
                      {confirmId === g.id ? (
                        <span className="flex items-center gap-1">
                          <button type="button" onClick={doDelete} className="flex h-7 w-7 items-center justify-center rounded-field bg-danger-soft text-danger"><CheckIcon className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => setConfirmId(null)} className="flex h-7 w-7 items-center justify-center rounded-field text-foreground-muted hover:bg-surface-1"><XIcon className="h-3.5 w-3.5" /></button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmId(g.id)} title="Grubu sil" className="flex h-7 w-7 items-center justify-center rounded-field text-foreground-muted hover:bg-danger-soft hover:text-danger"><Trash2Icon className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </div>
                  {addFeatGroup === g.id && (
                    <div className="flex items-center gap-2">
                      <Input value={featName} onChange={(e) => setFeatName(e.target.value)} placeholder="Özellik adı..." className="h-8" />
                      <Button variant="primary" size="sm" isLoading={busy} disabled={!featName.trim()} onClick={() => submitFeature(g.id)}>Ekle</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setAddFeatGroup(null); setFeatName('') }}>Vazgeç</Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {catalog.features.filter((f) => f.group === g.id).map((f) => (
                      editFeatId === f.id ? (
                        <span key={f.id} className="flex items-center gap-1">
                          <Input value={featName} onChange={(e) => setFeatName(e.target.value)} className="h-8 w-40" />
                          <button type="button" onClick={() => submitRename(f.id)} className="flex h-7 w-7 items-center justify-center rounded-field bg-primary-soft text-primary"><CheckIcon className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => { setEditFeatId(null); setFeatName('') }} className="flex h-7 w-7 items-center justify-center rounded-field text-foreground-muted hover:bg-surface-1"><XIcon className="h-3.5 w-3.5" /></button>
                        </span>
                      ) : (
                        <span key={f.id} className={cn('inline-flex items-center gap-1 rounded-field border border-border px-2 py-1 type-caption', st.soft, st.text)}>
                          {f.name}
                          <button type="button" onClick={() => { setEditFeatId(f.id); setFeatName(f.name); setAddFeatGroup(null) }} className="hover:text-foreground-strong"><PencilIcon className="h-3 w-3" /></button>
                          {confirmId === f.id ? (
                            <button type="button" onClick={doDelete} className="text-danger"><CheckIcon className="h-3 w-3" /></button>
                          ) : (
                            <button type="button" onClick={() => setConfirmId(f.id)} className="hover:text-danger"><Trash2Icon className="h-3 w-3" /></button>
                          )}
                        </span>
                      )
                    ))}
                    {catalog.features.filter((f) => f.group === g.id).length === 0 && (
                      <span className="type-caption text-foreground-subtle">Bu grupta henüz özellik yok.</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : panel === 'templates' ? (
          <div className="space-y-3">
            {saveOpen && (
              <div className="space-y-2 rounded-card border border-border bg-surface-1/60 p-3">
                <Label required>Şablon adı</Label>
                <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Örn. Konferans Kurulumu" className="h-9" />
                <Label>Açıklama</Label>
                <Textarea rows={2} value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} placeholder="Kısa açıklama (opsiyonel)..." />
                <p className="type-caption text-foreground-muted">{value.length} seçili özellik bu şablona kaydedilecek.</p>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" isLoading={busy} disabled={!tplName.trim() || value.length === 0} onClick={saveTemplate}>Kaydet</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSaveOpen(false)}>Vazgeç</Button>
                </div>
              </div>
            )}
            {templates.length === 0 && !saveOpen && <p className="py-8 text-center type-muted">Kayıtlı şablon yok. Seçim yapıp "Şablon Kaydet" ile oluşturabilirsiniz.</p>}
            {templates.map((t) => (
              <div key={t.id} className="space-y-2 rounded-card border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="type-section">{t.name}</p>
                    {t.description && <p className="type-caption text-foreground-muted">{t.description}</p>}
                  </div>
                  <button type="button" onClick={() => deleteTemplate(t.id)} title="Şablonu sil" className="flex h-7 w-7 items-center justify-center rounded-field text-foreground-muted hover:bg-danger-soft hover:text-danger"><Trash2Icon className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="type-caption text-foreground-muted">{t.featureIds.length} özellik:</span>
                  {templateBreakdown(t.featureIds).map(({ group, count }) => (
                    <span key={group.id} className={cn('inline-flex items-center gap-1 rounded-pill px-2 py-0.5 type-caption', styleOf(group.color).soft, styleOf(group.color).text)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', styleOf(group.color).dot)} /> {group.name} {count}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => applyTemplate(t, 'replace')}>Yükle (Değiştir)</Button>
                  <Button variant="outline" size="sm" onClick={() => applyTemplate(t, 'merge')}>Üstüne Ekle</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Özellik ara..." iconLeft={<SearchIcon className="h-3.5 w-3.5" />} className="h-9 flex-1" />
              <ToggleChip active={selectedOnly} disabled={value.length === 0} onClick={() => setSelectedOnly((s) => !s)}>Sadece seçili ({value.length})</ToggleChip>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setGroupFilter('all')} className={cn('rounded-field border px-2.5 py-1 type-caption transition-colors', groupFilter === 'all' ? 'border-primary bg-primary-soft text-primary' : 'border-border text-foreground-muted hover:border-primary/40')}>
                Tümü ({catalog.features.length})
              </button>
              {catalog.groups.map((g) => {
                const st = styleOf(g.color)
                const count = catalog.features.filter((f) => f.group === g.id).length
                return (
                  <button key={g.id} type="button" onClick={() => setGroupFilter(g.id)} className={cn('flex items-center gap-1.5 rounded-field border px-2.5 py-1 type-caption transition-colors', groupFilter === g.id ? 'border-primary bg-primary-soft text-primary' : 'border-border text-foreground-muted hover:border-primary/40')}>
                    <span className={cn('h-2 w-2 rounded-full', st.dot)} /> {g.name} ({count})
                  </button>
                )
              })}
            </div>
            {groupsWithVisible.length === 0 ? (
              <p className="py-8 text-center type-muted">Eşleşen özellik yok.</p>
            ) : groupsWithVisible.map((g) => {
              const st = styleOf(g.color)
              const feats = visibleFeatures.filter((f) => f.group === g.id)
              return (
                <div key={g.id} className="space-y-1.5">
                  <span className="flex items-center gap-1.5 type-caption font-medium text-foreground-muted">
                    <span className={cn('h-2 w-2 rounded-full', st.dot)} /> {g.name.toLocaleUpperCase('tr')} · {feats.length}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {feats.map((f) => {
                      const sel = value.includes(f.id)
                      return (
                        <button key={f.id} type="button" onClick={() => toggle(f.id)}
                          className={cn('inline-flex items-center gap-1.5 rounded-field border px-2.5 py-1.5 type-caption transition-colors',
                            sel ? cn(st.solid, 'border-transparent text-white') : cn(st.soft, st.text, 'border-transparent hover:opacity-80'))}>
                          {sel && <CheckIcon className="h-3 w-3" />} {f.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
        <Button variant="ghost" size="sm" disabled={value.length === 0} onClick={() => onChange([])}>Tümünü temizle</Button>
        <Button variant="primary" onClick={onClose}>Tamam ({value.length})</Button>
      </div>
    </Modal>
  )
}

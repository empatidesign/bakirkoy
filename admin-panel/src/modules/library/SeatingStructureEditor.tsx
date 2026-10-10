import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  LayersIcon, PlusIcon, Trash2Icon, PencilIcon, SaveIcon, XIcon, InfoIcon, SettingsIcon, CopyIcon,
} from 'lucide-react'
import {
  SectionToolbar, Button, IconButton, Card, Badge, Banner, Switch, Field, Label, Input,
  NumberInput, Select, ConfirmModal, Modal, CheckboxRow, ToggleChip, SkeletonRows, ColorSwatchPicker,
} from '@/design-system'
import { KrokiUploader } from '@/components/specialized/KrokiUploader'
import { SeatCountPreview } from '@/components/specialized/LibrarySeatGrid'
import libraryService from '@/services/library.service'
import { SECTION_TYPE_OPTIONS, SECTION_TYPE_LABELS, SECTION_COLOR_PRESETS } from '@/types/library.types'
import type { SeatStructureFloor, LibrarySection, LibraryTable } from '@/types/library.types'

interface Props {
  libraryId: string
  seatingMode: string
  onSaved: () => void
  onCancel: () => void
}

const FLOOR_NAMES = ['Zemin Kat', '1. Kat', '2. Kat', '3. Kat', '4. Kat', '5. Kat']
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id${Math.floor(performance.now() * 1000)}`)

const sectionUsed = (sec: LibrarySection) => sec.tables.reduce((t, tbl) => t + tbl.seatCount, 0)
const floorAllocated = (f: SeatStructureFloor) => f.sections.reduce((s, sec) => s + sec.capacity, 0)

interface FloorDraft { name: string; krokiUrl?: string | null; active: boolean; autoOpenWhenPreviousFull: boolean }
interface SectionDraft { name: string; type: string; color: string; capacity: number }
interface TableDraft { name: string; seatCount: number }

export const SeatingStructureEditor = ({ libraryId, seatingMode, onSaved, onCancel }: Props) => {
  const masali = seatingMode === 'masali'
  const [floors, setFloors] = useState<SeatStructureFloor[]>([])
  const [isMultiFloor, setIsMultiFloor] = useState(false)
  const [activeFloorId, setActiveFloorId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [floorModal, setFloorModal] = useState<{ open: boolean; id: string | null; draft: FloorDraft }>({ open: false, id: null, draft: { name: '', krokiUrl: null, active: true, autoOpenWhenPreviousFull: false } })
  const [sectionModal, setSectionModal] = useState<{ open: boolean; floorId: string; id: string | null; draft: SectionDraft }>({ open: false, floorId: '', id: null, draft: { name: '', type: 'general', color: SECTION_COLOR_PRESETS[0], capacity: 8 } })
  const [tableModal, setTableModal] = useState<{ open: boolean; floorId: string; sectionId: string; id: string | null; draft: TableDraft }>({ open: false, floorId: '', sectionId: '', id: null, draft: { name: '', seatCount: 4 } })
  const [confirm, setConfirm] = useState<{ open: boolean; message: string; onYes: () => void }>({ open: false, message: '', onYes: () => {} })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const lib = await libraryService.getById(libraryId)
      const fs: SeatStructureFloor[] = (lib.floors ?? []).map((f) => ({
        id: f.id || uid(),
        name: f.name,
        capacity: f.capacity,
        active: f.active,
        autoOpenWhenPreviousFull: f.autoOpenWhenPreviousFull,
        krokiUrl: f.krokiUrl ?? null,
        sections: (f.sections ?? []).map((s) => {
          const tables = (s.tables ?? []).map((t) => ({ id: t.id || uid(), name: t.name, seatCount: t.seatCount }))
          const used = tables.reduce((a, t) => a + t.seatCount, 0)
          return { id: s.id || uid(), name: s.name, type: s.type, color: s.color, capacity: s.capacity && s.capacity > 0 ? s.capacity : used, tables }
        }),
      }))
      if (fs.length === 0) fs.push({ id: uid(), name: FLOOR_NAMES[0], capacity: 50, active: true, autoOpenWhenPreviousFull: false, krokiUrl: null, sections: [] })
      setFloors(fs)
      setIsMultiFloor(lib.isMultiFloor ?? fs.length > 1)
      setActiveFloorId(fs[0].id)
    } finally {
      setLoading(false)
    }
  }, [libraryId])
  useEffect(() => { load() }, [load])

  const patchFloor = (id: string, patch: Partial<SeatStructureFloor>) =>
    setFloors((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const updateSections = (floorId: string, fn: (secs: LibrarySection[]) => LibrarySection[]) =>
    setFloors((p) => p.map((f) => (f.id === floorId ? { ...f, sections: fn(f.sections) } : f)))

  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0]
  const showSelector = isMultiFloor || floors.length > 1

  const setFloorDraft = (patch: Partial<FloorDraft>) => setFloorModal((m) => ({ ...m, draft: { ...m.draft, ...patch } }))
  const setSectionDraft = (patch: Partial<SectionDraft>) => setSectionModal((m) => ({ ...m, draft: { ...m.draft, ...patch } }))
  const setTableDraft = (patch: Partial<TableDraft>) => setTableModal((m) => ({ ...m, draft: { ...m.draft, ...patch } }))

  const openAddFloor = () => setFloorModal({ open: true, id: null, draft: { name: FLOOR_NAMES[floors.length] ?? `${floors.length}. Kat`, krokiUrl: null, active: true, autoOpenWhenPreviousFull: false } })
  const openEditFloor = (f: SeatStructureFloor) => setFloorModal({ open: true, id: f.id, draft: { name: f.name, krokiUrl: f.krokiUrl ?? null, active: f.active, autoOpenWhenPreviousFull: f.autoOpenWhenPreviousFull } })
  const saveFloorModal = () => {
    const d = floorModal.draft
    if (!d.name.trim()) return
    if (floorModal.id) patchFloor(floorModal.id, { name: d.name.trim(), krokiUrl: d.krokiUrl, active: d.active, autoOpenWhenPreviousFull: d.autoOpenWhenPreviousFull })
    else {
      const nf: SeatStructureFloor = { id: uid(), name: d.name.trim(), capacity: 50, active: d.active, autoOpenWhenPreviousFull: d.autoOpenWhenPreviousFull, krokiUrl: d.krokiUrl, sections: [] }
      setFloors((p) => [...p, nf])
      setActiveFloorId(nf.id)
    }
    setFloorModal((m) => ({ ...m, open: false }))
  }
  const removeFloor = (id: string) => {
    setFloors((p) => {
      const next = p.filter((f) => f.id !== id)
      if (id === activeFloorId && next.length > 0) setActiveFloorId(next[0].id)
      return next
    })
  }

  const openAddSection = (floorId: string) => {
    const f = floors.find((x) => x.id === floorId)
    const remaining = f ? Math.max(1, f.capacity - floorAllocated(f)) : 8
    setSectionModal({ open: true, floorId, id: null, draft: { name: '', type: 'general', color: SECTION_COLOR_PRESETS[0], capacity: Math.min(8, remaining) } })
  }
  const openEditSection = (floorId: string, sec: LibrarySection) => setSectionModal({ open: true, floorId, id: sec.id, draft: { name: sec.name, type: sec.type, color: sec.color, capacity: sec.capacity } })
  const editingSectionUsed = (() => {
    if (!sectionModal.id) return 0
    const f = floors.find((x) => x.id === sectionModal.floorId)
    const s = f?.sections.find((x) => x.id === sectionModal.id)
    return s ? sectionUsed(s) : 0
  })()
  const sectionCapMax = (() => {
    const f = floors.find((x) => x.id === sectionModal.floorId)
    if (!f) return 999
    const editedCap = sectionModal.id ? (f.sections.find((x) => x.id === sectionModal.id)?.capacity ?? 0) : 0
    return Math.max(Math.max(1, editingSectionUsed), f.capacity - floorAllocated(f) + editedCap)
  })()
  const sectionDraftValid = sectionModal.draft.name.trim() !== '' && sectionModal.draft.capacity >= Math.max(1, editingSectionUsed) && sectionModal.draft.capacity <= sectionCapMax
  const saveSectionModal = () => {
    const { floorId, id, draft } = sectionModal
    if (!sectionDraftValid) return
    if (id) updateSections(floorId, (secs) => secs.map((s) => (s.id === id ? { ...s, name: draft.name.trim(), type: draft.type, color: draft.color, capacity: draft.capacity } : s)))
    else updateSections(floorId, (secs) => [...secs, { id: uid(), name: draft.name.trim(), type: draft.type, color: draft.color, capacity: draft.capacity, tables: [] }])
    setSectionModal((m) => ({ ...m, open: false }))
  }
  const removeSection = (floorId: string, secId: string) => updateSections(floorId, (secs) => secs.filter((s) => s.id !== secId))

  const tableSection = floors.find((f) => f.id === tableModal.floorId)?.sections.find((s) => s.id === tableModal.sectionId)
  const tableMax = tableSection
    ? Math.max(1, tableSection.capacity - sectionUsed(tableSection) + (tableModal.id ? (tableSection.tables.find((t) => t.id === tableModal.id)?.seatCount ?? 0) : 0))
    : 50
  const openAddTable = (floorId: string, sec: LibrarySection) => {
    const remaining = sec.capacity - sectionUsed(sec)
    setTableModal({ open: true, floorId, sectionId: sec.id, id: null, draft: { name: `Masa ${sec.tables.length + 1}`, seatCount: Math.min(4, Math.max(1, remaining)) } })
  }
  const openEditTable = (floorId: string, sectionId: string, tbl: LibraryTable) => setTableModal({ open: true, floorId, sectionId, id: tbl.id, draft: { name: tbl.name, seatCount: tbl.seatCount } })
  const saveTableModal = () => {
    const { floorId, sectionId, id, draft } = tableModal
    const seatCount = Math.min(draft.seatCount, tableMax)
    if (!draft.name.trim() || seatCount < 1) return
    updateSections(floorId, (secs) => secs.map((s) => {
      if (s.id !== sectionId) return s
      if (id) return { ...s, tables: s.tables.map((t) => (t.id === id ? { ...t, name: draft.name.trim(), seatCount } : t)) }
      return { ...s, tables: [...s.tables, { id: uid(), name: draft.name.trim(), seatCount }] }
    }))
    setTableModal((m) => ({ ...m, open: false }))
  }
  const removeTable = (floorId: string, sectionId: string, tableId: string) =>
    updateSections(floorId, (secs) => secs.map((s) => (s.id === sectionId ? { ...s, tables: s.tables.filter((t) => t.id !== tableId) } : s)))
  const addSeat = (floorId: string, sectionId: string, tableId: string) =>
    updateSections(floorId, (secs) => secs.map((s) => {
      if (s.id !== sectionId || sectionUsed(s) >= s.capacity) return s
      return { ...s, tables: s.tables.map((t) => (t.id === tableId ? { ...t, seatCount: t.seatCount + 1 } : t)) }
    }))
  const duplicateTable = (floorId: string, sec: LibrarySection, tbl: LibraryTable) =>
    updateSections(floorId, (secs) => secs.map((s) => {
      if (s.id !== sec.id || sectionUsed(s) + tbl.seatCount > s.capacity) return s
      return { ...s, tables: [...s.tables, { id: uid(), name: `Masa ${s.tables.length + 1}`, seatCount: tbl.seatCount }] }
    }))

  const ask = (message: string, onYes: () => void) => setConfirm({ open: true, message, onYes })

  const save = async () => {
    setSaving(true)
    try {
      await libraryService.seatPlan.saveStructure(libraryId, { isMultiFloor: isMultiFloor || floors.length > 1, floors })
      toast.success('Oturma planı yapısı kaydedildi.')
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Card padded><SkeletonRows rows={5} /></Card>

  return (
    <div className="space-y-4">
      <SectionToolbar
        icon={SettingsIcon}
        title="Oturma Planı Yönetimi"
        subtitle="Kat, bölüm ve masa düzenini kurun"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}><XIcon className="h-4 w-4" /> İptal</Button>
            <Button variant="primary" size="sm" isLoading={saving} onClick={save}><SaveIcon className="h-4 w-4" /> Kaydet</Button>
          </div>
        }
      />

      <Banner tone="info" variant="soft" icon={InfoIcon}>
        {masali
          ? 'Kata renkli bölümler, bölümlere masalar ekleyin. Her bölümün bir kapasitesi vardır; masalardaki koltukların toplamı bölüm kapasitesini aşamaz. Basit bir kat için bölüm eklemeden doğrudan kapasite de girebilirsiniz.'
          : 'Bu kütüphane sıralı sistemdedir (koltuk seçimi yok). Her kat için yalnız toplam kapasite girilir.'}
      </Banner>

      <Card padded>
        <div className="flex items-center justify-between">
          <div><Label>Çoklu kat</Label><p className="type-caption">Binada birden fazla kat varsa açın.</p></div>
          <Switch checked={isMultiFloor} onCheckedChange={setIsMultiFloor} />
        </div>
        {showSelector && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {floors.map((f) => (
              <ToggleChip key={f.id} active={activeFloorId === f.id} onClick={() => setActiveFloorId(f.id)}>
                {f.name}{!f.active ? ' · pasif' : ''}
              </ToggleChip>
            ))}
            <Button variant="outline" size="sm" onClick={openAddFloor}><PlusIcon className="h-4 w-4" /> Kat Ekle</Button>
          </div>
        )}
      </Card>

      {activeFloor && (
        <Card padded>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayersIcon className="h-4 w-4 text-primary" />
              <span className="type-section">{activeFloor.name}</span>
              {!activeFloor.active && <Badge tone="neutral">Pasif</Badge>}
              <Badge tone="info">{activeFloor.sections.length > 0 ? `${floorAllocated(activeFloor)} / ${activeFloor.capacity}` : activeFloor.capacity} koltuk</Badge>
            </div>
            <div className="flex gap-1">
              <IconButton title="Katı düzenle" onClick={() => openEditFloor(activeFloor)}><PencilIcon className="h-4 w-4" /></IconButton>
              {floors.length > 1 && (
                <IconButton tone="danger" title="Katı kaldır" onClick={() => ask(`"${activeFloor.name}" katını ve içindeki tüm bölüm/masaları kaldırmak istediğinize emin misiniz?`, () => removeFloor(activeFloor.id))}>
                  <Trash2Icon className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          </div>

          <div className="mt-3">
            <KrokiUploader
              label="Kat Krokisi (bu katın yerleşim planı görseli)"
              value={activeFloor.krokiUrl}
              onUpload={libraryService.uploadKroki}
              onChange={(url) => patchFloor(activeFloor.id, { krokiUrl: url })}
            />
          </div>

          {!masali ? (
            <div className="mt-3">
              <Field label="Kat kapasitesi">
                <NumberInput value={activeFloor.capacity} onChange={(n) => patchFloor(activeFloor.id, { capacity: n })} min={0} suffix="koltuk" />
              </Field>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <Field label="Kat Kontenjanı (toplam koltuk)" hint="Bölümlerin toplam kapasitesi bu sayıyı aşamaz." error={activeFloor.capacity < floorAllocated(activeFloor) ? `Bölümlere ayrılan ${floorAllocated(activeFloor)} koltuktan az olamaz.` : undefined}>
                <NumberInput value={activeFloor.capacity} onChange={(n) => patchFloor(activeFloor.id, { capacity: n })} min={floorAllocated(activeFloor)} suffix="koltuk" />
              </Field>
              <div className="flex items-center justify-between gap-3">
                <span className="type-caption text-foreground-muted">
                  {activeFloor.sections.length === 0 ? 'Koltukları bölümlere ayırın' : `${floorAllocated(activeFloor)} / ${activeFloor.capacity} koltuk bölümlere ayrıldı`}
                </span>
                <Button variant="outline" size="sm" disabled={floorAllocated(activeFloor) >= activeFloor.capacity} title={floorAllocated(activeFloor) >= activeFloor.capacity ? 'Kat kontenjanı dolu' : undefined} onClick={() => openAddSection(activeFloor.id)}><PlusIcon className="h-4 w-4" /> Bölüm Ekle</Button>
              </div>
              {activeFloor.sections.map((sec) => {
                const used = sectionUsed(sec)
                const full = used >= sec.capacity
                return (
                  <div key={sec.id} className="rounded-card border border-border bg-surface-0 p-3.5" style={{ borderLeft: `4px solid ${sec.color}` }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: sec.color }} />
                      <span className="type-body-strong">{sec.name}</span>
                      <Badge tone="neutral">{SECTION_TYPE_LABELS[sec.type] ?? sec.type}</Badge>
                      <Badge tone={full ? 'success' : 'warning'}>{used} / {sec.capacity} koltuk</Badge>
                      <div className="ml-auto flex items-center gap-1">
                        <Button variant="outline" size="sm" disabled={full} title={full ? 'Bölüm kapasitesi dolu' : undefined} onClick={() => openAddTable(activeFloor.id, sec)}>
                          <PlusIcon className="h-4 w-4" /> Masa
                        </Button>
                        <IconButton title="Bölümü düzenle" onClick={() => openEditSection(activeFloor.id, sec)}><PencilIcon className="h-4 w-4" /></IconButton>
                        <IconButton tone="danger" title="Bölümü kaldır" onClick={() => ask(`"${sec.name}" bölümünü ve masalarını kaldırmak istediğinize emin misiniz?`, () => removeSection(activeFloor.id, sec.id))}>
                          <Trash2Icon className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                    {sec.tables.length === 0 ? (
                      <p className="mt-3 type-caption text-foreground-muted">Henüz masa yok. "Masa" ile ekleyin.</p>
                    ) : (
                      <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, max-content))' }}>
                        {sec.tables.map((tbl, ti) => (
                          <div key={tbl.id} className="relative rounded-card border border-border bg-surface-0 p-3 pt-4">
                            <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{ti + 1}</span>
                            <p className="text-center type-body-strong">{tbl.name}</p>
                            <div className="my-2 flex justify-center gap-0.5">
                              <IconButton title="Koltuk ekle" disabled={full} onClick={() => addSeat(activeFloor.id, sec.id, tbl.id)}><PlusIcon className="h-3.5 w-3.5" /></IconButton>
                              <IconButton title="Masayı kopyala" disabled={sec.capacity - used < tbl.seatCount} onClick={() => duplicateTable(activeFloor.id, sec, tbl)}><CopyIcon className="h-3.5 w-3.5" /></IconButton>
                              <IconButton title="Masayı düzenle" onClick={() => openEditTable(activeFloor.id, sec.id, tbl)}><PencilIcon className="h-3.5 w-3.5" /></IconButton>
                              <IconButton tone="danger" title="Masayı kaldır" onClick={() => removeTable(activeFloor.id, sec.id, tbl.id)}><Trash2Icon className="h-3.5 w-3.5" /></IconButton>
                            </div>
                            <div className="mb-2 rounded-md bg-surface-2 py-1 text-center type-caption text-foreground-muted">{tbl.seatCount} Koltuk</div>
                            <SeatCountPreview count={tbl.seatCount} color={sec.color} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      <Modal
        open={floorModal.open}
        onClose={() => setFloorModal((m) => ({ ...m, open: false }))}
        title={floorModal.id ? 'Katı Düzenle' : 'Yeni Kat'}
        width={480}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setFloorModal((m) => ({ ...m, open: false }))}>İptal</Button>
            <Button variant="primary" className="flex-1" disabled={!floorModal.draft.name.trim()} onClick={saveFloorModal}>{floorModal.id ? 'Güncelle' : 'Ekle'}</Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <Field label="Kat Adı"><Input value={floorModal.draft.name} onChange={(e) => setFloorDraft({ name: e.target.value })} placeholder="Örn. Zemin Kat" /></Field>
          <Field label="Kat Krokisi (opsiyonel)"><KrokiUploader compact value={floorModal.draft.krokiUrl} onUpload={libraryService.uploadKroki} onChange={(url) => setFloorDraft({ krokiUrl: url })} /></Field>
          <div className="flex items-center justify-between"><Label>Aktif</Label><Switch checked={floorModal.draft.active} onCheckedChange={(v) => setFloorDraft({ active: v })} /></div>
          {!floorModal.draft.active && (
            <CheckboxRow variant="inline" label="Önceki kat dolunca otomatik aç" checked={floorModal.draft.autoOpenWhenPreviousFull} onChange={(v) => setFloorDraft({ autoOpenWhenPreviousFull: v })} />
          )}
        </div>
      </Modal>

      <Modal
        open={sectionModal.open}
        onClose={() => setSectionModal((m) => ({ ...m, open: false }))}
        title={sectionModal.id ? 'Bölümü Düzenle' : 'Yeni Bölüm'}
        width={480}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setSectionModal((m) => ({ ...m, open: false }))}>İptal</Button>
            <Button variant="primary" className="flex-1" disabled={!sectionDraftValid} onClick={saveSectionModal}>{sectionModal.id ? 'Güncelle' : 'Ekle'}</Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <Field label="Bölüm Adı"><Input value={sectionModal.draft.name} onChange={(e) => setSectionDraft({ name: e.target.value })} placeholder="Örn. Sessiz Çalışma Alanı" /></Field>
          <Field label="Bölüm Türü">
            <Select value={sectionModal.draft.type} onChange={(e) => setSectionDraft({ type: e.target.value })}>
              {SECTION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Bölüm Kapasitesi" hint={`Kat kontenjanından bu bölüme en fazla ${sectionCapMax} koltuk ayrılabilir.`} error={sectionModal.draft.capacity < Math.max(1, editingSectionUsed) ? `En az ${Math.max(1, editingSectionUsed)} koltuk olmalı.` : undefined}>
            <NumberInput value={sectionModal.draft.capacity} onChange={(n) => setSectionDraft({ capacity: n })} min={Math.max(1, editingSectionUsed)} max={sectionCapMax} suffix="koltuk" />
          </Field>
          <Field label="Renk"><ColorSwatchPicker value={sectionModal.draft.color} onChange={(c) => setSectionDraft({ color: c })} presets={SECTION_COLOR_PRESETS} /></Field>
        </div>
      </Modal>

      <Modal
        open={tableModal.open}
        onClose={() => setTableModal((m) => ({ ...m, open: false }))}
        title={tableModal.id ? 'Masayı Düzenle' : 'Yeni Masa'}
        width={420}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setTableModal((m) => ({ ...m, open: false }))}>İptal</Button>
            <Button variant="primary" className="flex-1" disabled={!tableModal.draft.name.trim() || tableModal.draft.seatCount < 1} onClick={saveTableModal}>{tableModal.id ? 'Güncelle' : 'Ekle'}</Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <Field label="Masa Adı"><Input value={tableModal.draft.name} onChange={(e) => setTableDraft({ name: e.target.value })} placeholder="Örn. Masa 1" /></Field>
          <Field label="Koltuk Sayısı" hint={`Bu bölümde en fazla ${tableMax} koltuk eklenebilir.`}>
            <NumberInput value={tableModal.draft.seatCount} onChange={(n) => setTableDraft({ seatCount: n })} min={1} max={tableMax} suffix="koltuk" />
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={confirm.open}
        onClose={() => setConfirm((c) => ({ ...c, open: false }))}
        onConfirm={() => { confirm.onYes(); setConfirm((c) => ({ ...c, open: false })) }}
        title="Kaldır"
        description={confirm.message}
        confirmLabel="Kaldır"
        tone="danger"
        icon={Trash2Icon}
      />
    </div>
  )
}

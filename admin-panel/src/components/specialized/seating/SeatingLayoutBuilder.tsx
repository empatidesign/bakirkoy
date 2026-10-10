import { useState } from 'react'
import { PlusIcon, XIcon, Trash2Icon, LayersIcon, ArmchairIcon } from 'lucide-react'
import { Button, Input, Label, ToggleChip, IconButton, Select } from '@/design-system'
import { cn } from '@/lib/utils'
import type { SeatingFloor, SeatingLayout, SeatingTemplateId } from '@/types/hall.types'
import { FloorPreview } from './FloorPreview'
import {
  SEATING_TEMPLATES,
  createLayoutFromTemplate,
  makeFloor,
  calculateTotalSeats,
  getFloorSeatCount,
  getRowSegments,
  getRowLabels,
  isRowBasedTemplate,
} from './seatingModel'

const toInt = (s: string, fallback = 0): number => {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : fallback
}
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const NumField = ({
  value, onChange, min = 0, max = 999, className, placeholder,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  className?: string
  placeholder?: string
}) => {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      sanitize="digits"
      className={className}
      placeholder={placeholder}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        if (raw !== '') {
          const n = parseInt(raw, 10)
          if (!Number.isNaN(n)) onChange(Math.min(max, n))
        }
      }}
      onBlur={() => {
        if (draft === null) return
        const n = parseInt(draft, 10)
        onChange(Number.isNaN(n) ? min : clamp(n, min, max))
        setDraft(null)
      }}
    />
  )
}

const SegmentEditor = ({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) => {
  const setAt = (i: number, n: number) => onChange(value.map((v, idx) => (idx === i ? n : v)))
  const removeAt = (i: number) => onChange(value.length > 1 ? value.filter((_, idx) => idx !== i) : value)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((seg, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && <span className="type-caption text-foreground-subtle">koridor</span>}
          <div className="flex items-center gap-1 rounded-field border border-border bg-surface-0 pr-1">
            <NumField value={seg} onChange={(n) => setAt(i, n)} min={1} max={80} className="h-8 w-12 border-0 text-center" />
            <span className="type-caption text-foreground-subtle">koltuk</span>
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-foreground-subtle hover:bg-danger-soft hover:text-danger"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...value, 6])}>
        <PlusIcon className="h-3.5 w-3.5" /> Blok
      </Button>
    </div>
  )
}

const CrossAisleEditor = ({ floor, onChange }: { floor: SeatingFloor; onChange: (v: number[]) => void }) => {
  const [val, setVal] = useState('')
  const add = () => {
    const n = toInt(val, 0)
    if (n < 1 || n >= floor.rows || floor.crossAisles.includes(n)) return
    onChange([...floor.crossAisles, n].sort((a, b) => a - b))
    setVal('')
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input sanitize="digits" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Sıra no" className="h-8 w-24" />
        <span className="type-caption text-foreground-muted">sırasından sonra koridor</span>
        <Button variant="outline" size="sm" onClick={add}>
          <PlusIcon className="h-3.5 w-3.5" /> Ekle
        </Button>
      </div>
      {floor.crossAisles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {floor.crossAisles.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 type-caption text-foreground-default">
              {n}. sıradan sonra
              <button type="button" onClick={() => onChange(floor.crossAisles.filter((x) => x !== n))} className="text-foreground-subtle hover:text-danger">
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const RowOverrideEditor = ({ floor, onChange }: { floor: SeatingFloor; onChange: (next: Record<number, number[]>) => void }) => {
  const labels = getRowLabels(floor)
  const [rowSel, setRowSel] = useState('')
  const [draft, setDraft] = useState<number[] | null>(null)
  const overrides = Object.entries(floor.rowOverrides).map(([k, v]) => ({ idx: Number(k), segments: v }))

  const startEdit = () => {
    const idx = toInt(rowSel, 0) - 1
    if (idx < 0 || idx >= floor.rows) return
    setDraft([...getRowSegments(floor, idx)])
  }
  const apply = () => {
    const idx = toInt(rowSel, 0) - 1
    if (idx < 0 || idx >= floor.rows || !draft) return
    onChange({ ...floor.rowOverrides, [idx]: draft })
    setDraft(null)
    setRowSel('')
  }
  const remove = (idx: number) => {
    const next = { ...floor.rowOverrides }
    delete next[idx]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={rowSel} onChange={(e) => { setRowSel(e.target.value); setDraft(null) }} className="h-8 w-36">
          <option value="">Sıra seçin...</option>
          {Array.from({ length: floor.rows }, (_, i) => (
            <option key={i} value={String(i + 1)}>{labels[i]} ({i + 1}. sıra)</option>
          ))}
        </Select>
        {rowSel && !draft && <Button variant="outline" size="sm" onClick={startEdit}>Düzenle</Button>}
      </div>
      {draft && (
        <div className="space-y-2 rounded-card border border-border bg-surface-0 p-3">
          <SegmentEditor value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={apply}>Uygula</Button>
            <Button variant="ghost" size="sm" onClick={() => { setDraft(null); setRowSel('') }}>Vazgeç</Button>
          </div>
        </div>
      )}
      {overrides.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {overrides.map((o) => (
            <span key={o.idx} className="inline-flex items-center gap-1 rounded-pill bg-primary-soft px-2 py-0.5 type-caption text-primary">
              {labels[o.idx]}: {o.segments.join(' · ')}
              <button type="button" onClick={() => remove(o.idx)} className="hover:text-danger">
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface SeatingLayoutBuilderProps {
  value: SeatingLayout
  onChange: (layout: SeatingLayout) => void
}

export const SeatingLayoutBuilder = ({ value, onChange }: SeatingLayoutBuilderProps) => {
  const [active, setActive] = useState(0)
  const floors = value.floors
  const activeIdx = Math.min(active, floors.length - 1)
  const floor = floors[activeIdx]
  const rowBased = isRowBasedTemplate(value.template)

  const updateFloor = (patch: Partial<SeatingFloor>) =>
    onChange({ ...value, floors: floors.map((f, i) => (i === activeIdx ? { ...f, ...patch } : f)) })

  const selectTemplate = (id: SeatingTemplateId) => { onChange(createLayoutFromTemplate(id)); setActive(0) }

  const addFloor = () => {
    const name = `${floors.length}. Balkon`
    onChange({ ...value, floors: [...floors, makeFloor(name, 6, [8, 8])] })
    setActive(floors.length)
  }
  const removeFloor = (idx: number) => {
    if (floors.length <= 1) return
    onChange({ ...value, floors: floors.filter((_, i) => i !== idx) })
    setActive(0)
  }

  const total = calculateTotalSeats(value)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Şablon</Label>
        <div className="flex flex-wrap gap-1.5">
          {SEATING_TEMPLATES.map((t) => (
            <ToggleChip key={t.id} active={value.template === t.id} onClick={() => selectTemplate(t.id)}>
              {t.label}
            </ToggleChip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Katlar / Seviyeler</Label>
          <Button variant="outline" size="sm" onClick={addFloor}>
            <PlusIcon className="h-3.5 w-3.5" /> Kat Ekle
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {floors.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-field border px-2.5 py-1 type-caption transition-colors',
                i === activeIdx
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-surface-0 text-foreground-muted hover:border-primary/40',
              )}
            >
              <LayersIcon className="h-3 w-3" />
              {f.name} · {getFloorSeatCount(f)}
            </button>
          ))}
        </div>
      </div>

      {floor && (
        <>
          <div className="space-y-3 rounded-card border border-border bg-surface-1/60 p-3">
            <div className="flex items-center justify-between">
              <span className="type-section">Kat ayarları</span>
              {floors.length > 1 && (
                <IconButton tone="danger" title="Katı sil" onClick={() => removeFloor(activeIdx)}>
                  <Trash2Icon className="h-4 w-4" />
                </IconButton>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kat adı</Label>
                <Input value={floor.name} onChange={(e) => updateFloor({ name: e.target.value })} className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label>Sıra sayısı</Label>
                <NumField value={floor.rows} onChange={(n) => updateFloor({ rows: n })} min={1} max={80} className="h-8" />
              </div>
            </div>

            {rowBased ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Başlangıç harfi</Label>
                    <Input
                      value={floor.rowLabelStart}
                      onChange={(e) => updateFloor({ rowLabelStart: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'A' })}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>I/O harfleri</Label>
                    <ToggleChip active={floor.skipIO} onClick={() => updateFloor({ skipIO: !floor.skipIO })}>
                      {floor.skipIO ? 'Atlanıyor' : 'Kullanılıyor'}
                    </ToggleChip>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Varsayılan sıra düzeni (bloklar)</Label>
                  <SegmentEditor value={floor.defaultSegments} onChange={(v) => updateFloor({ defaultSegments: v })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Enine koridorlar</Label>
                  <CrossAisleEditor floor={floor} onChange={(v) => updateFloor({ crossAisles: v })} />
                </div>

                <div className="space-y-1.5">
                  <Label>Sıraya özel düzen</Label>
                  <RowOverrideEditor floor={floor} onChange={(v) => updateFloor({ rowOverrides: v })} />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>{value.template === 'banquet' ? 'Sütun (masa) sayısı' : 'Üst sıra koltuk sayısı'}</Label>
                <NumField value={floor.defaultSegments[0] ?? 8} onChange={(n) => updateFloor({ defaultSegments: [n] })} min={1} max={40} className="h-8 w-28" />
                <p className="type-caption text-foreground-muted">
                  {value.template === 'banquet' ? 'Her satırdaki yuvarlak masa sayısı.' : 'U düzeninde üst sıradaki koltuk sayısı.'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="type-section">Önizleme · {floor.name}</span>
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary-soft px-2.5 py-1 type-body-strong text-primary">
                <ArmchairIcon className="h-3.5 w-3.5" /> {total} koltuk
              </span>
            </div>
            <FloorPreview floor={floor} template={value.template} />
          </div>
        </>
      )}
    </div>
  )
}

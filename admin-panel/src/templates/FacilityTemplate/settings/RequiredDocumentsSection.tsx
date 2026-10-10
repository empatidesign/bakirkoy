import { ClipboardCheckIcon, SmartphoneIcon, FileTextIcon, Trash2Icon } from 'lucide-react'
import { Badge, Switch, IconButton, Select, EmptyState, Label } from '@/design-system'
import { SettingsSection } from './ui'
import { DOCUMENT_CATEGORY_META, DOCUMENT_VERIFICATION_META } from './defaults'
import type { DocumentPreset } from './documentSets'
import type { RequiredDocument } from '@/types/facility.types'

interface Props {
  documents: RequiredDocument[]
  presets: DocumentPreset[]
  onDocumentsChange: (docs: RequiredDocument[]) => void
}

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`)

export const RequiredDocumentsSection = ({ documents, presets, onDocumentsChange }: Props) => {
  const available = presets.filter((p) => !documents.some((d) => d.label === p.label))

  const addDoc = (label: string) => {
    const preset = presets.find((p) => p.label === label)
    if (!preset) return
    onDocumentsChange([...documents, { ...preset, id: newId(), required: true }])
  }
  const setRequired = (id: string, required: boolean) => onDocumentsChange(documents.map((d) => (d.id === id ? { ...d, required } : d)))
  const removeDoc = (id: string) => onDocumentsChange(documents.filter((d) => d.id !== id))

  return (
    <SettingsSection icon={ClipboardCheckIcon} title="Evrak Kütüphanesi" subtitle="Bu modül için telefondan yüklenebilen evrak tanımları — hangi evrakın hangi grupta zorunlu olduğu grup formunda seçilir">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label>Evrak Kütüphanesi</Label>
          <div className="w-full sm:w-60">
            <Select aria-label="Evrak kütüphanesine belge ekle" value="" onChange={(e) => e.target.value && addDoc(e.target.value)} disabled={available.length === 0}>
              <option value="">+ Belge Kütüphanesinden Ekle</option>
              {available.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            </Select>
          </div>
        </div>
        <p className="flex items-center gap-1.5 type-caption">
          <SmartphoneIcon className="h-3.5 w-3.5" />
          Üye telefonundan fotoğraf çekerek veya PDF yükleyerek evrakları gönderir.
        </p>

        {documents.length === 0 ? (
          <EmptyState icon={FileTextIcon} title="Henüz belge seçilmedi" description="Yukarıdan belge kütüphanesinden ekleyin." />
        ) : (
          <div className="space-y-2">
            {documents.map((d, i) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-border bg-surface-1 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="type-caption tabular-nums">{i + 1}.</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="type-body-strong">{d.label}</span>
                      <Badge tone={DOCUMENT_CATEGORY_META[d.category].tone}>{DOCUMENT_CATEGORY_META[d.category].label}</Badge>
                      <Badge tone="neutral">{DOCUMENT_VERIFICATION_META[d.verification]}</Badge>
                    </div>
                    {d.description && <p className="type-caption">{d.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="type-caption">Zorunlu</span>
                    <Switch aria-label={`${d.label} zorunlu`} checked={d.required} onCheckedChange={(v) => setRequired(d.id, v)} />
                  </span>
                  <IconButton tone="danger" title="Kaldır" onClick={() => removeDoc(d.id)}><Trash2Icon className="h-4 w-4" /></IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsSection>
  )
}

import { useEffect, useState } from 'react'
import { PlusIcon, PinIcon, PinOffIcon, Trash2Icon, StickyNoteIcon } from 'lucide-react'
import { Input, Textarea, Button, IconButton, ToggleChip, Badge, Select, EmptyState, SkeletonRows } from '@/design-system'
import { teamService } from '@/services/team.service'
import type { TeamNote, TeamMember, NoteTone } from '@/types/team.types'

const TONES: NoteTone[] = ['warning', 'info', 'success', 'danger', 'primary']
const emptyDraft = { title: '', content: '', tone: 'warning' as NoteTone, targetUserId: '' }

export const NotesTab = () => {
  const [notes, setNotes] = useState<TeamNote[]>([])
  const [subordinates, setSubordinates] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [n, s] = await Promise.all([teamService.getNotes(), teamService.getSubordinates()])
      setNotes(n)
      setSubordinates(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    if (!draft.title.trim() && !draft.content.trim()) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      await teamService.createNote({
        targetUserId: draft.targetUserId || null,
        title: draft.title,
        content: draft.content,
        tone: draft.tone,
      })
      setDraft(emptyDraft)
      setOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const pin = async (id: string) => {
    await teamService.pinNote(id)
    await load()
  }
  const remove = async (id: string) => {
    await teamService.deleteNote(id)
    await load()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="type-section">Notlar</span>
        <Button variant="primary" size="sm" onClick={() => setOpen((o) => !o)}>
          <PlusIcon className="h-4 w-4" /> Yeni
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-b border-border bg-surface-1 p-3">
          <Input size="sm" placeholder="Başlık" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          <Textarea rows={3} placeholder="Not içeriği…" value={draft.content} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} />
          {subordinates.length > 0 && (
            <Select value={draft.targetUserId} onChange={(e) => setDraft((d) => ({ ...d, targetUserId: e.target.value }))}>
              <option value="">Kişisel not (sadece ben)</option>
              {subordinates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.roleName})
                </option>
              ))}
            </Select>
          )}
          <div className="flex flex-wrap gap-1">
            {TONES.map((tone) => (
              <ToggleChip key={tone} tone={tone} active={draft.tone === tone} onClick={() => setDraft((d) => ({ ...d, tone }))}>
                <span className="capitalize">{tone}</span>
              </ToggleChip>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>İptal</Button>
            <Button variant="primary" size="sm" isLoading={saving} onClick={save}>Kaydet</Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="p-2"><SkeletonRows rows={4} /></div>
        ) : notes.length === 0 ? (
          <EmptyState icon={StickyNoteIcon} title="Not yok" description="Kendine veya bir astına not bırak." />
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-card border border-border bg-surface-0 p-2.5">
                <div className="flex items-start gap-2">
                  <Badge tone={n.tone}>•</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {n.pinned && <PinIcon className="h-3 w-3 text-danger" />}
                      <span className="type-body-strong truncate">{n.title}</span>
                    </div>
                    {n.content && <p className="type-muted mt-1 whitespace-pre-wrap break-words">{n.content}</p>}
                    <p className="type-caption mt-1">
                      {n.mine
                        ? n.targetUserId === n.authorId ? 'Kişisel' : `→ ${n.targetName}`
                        : `${n.authorName} → size`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <IconButton title={n.pinned ? 'Sabiti kaldır' : 'Sabitle'} onClick={() => pin(n.id)}>
                      {n.pinned ? <PinOffIcon className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
                    </IconButton>
                    {n.mine && (
                      <IconButton tone="danger" title="Sil" onClick={() => remove(n.id)}>
                        <Trash2Icon className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

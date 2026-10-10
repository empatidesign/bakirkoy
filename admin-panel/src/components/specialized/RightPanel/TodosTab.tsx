import { useEffect, useState } from 'react'
import { PlusIcon, Trash2Icon, CheckSquareIcon } from 'lucide-react'
import { Input, Button, IconButton, Checkbox, Select, Badge, EmptyState, SkeletonRows } from '@/design-system'
import { cn } from '@/lib/utils'
import { teamService } from '@/services/team.service'
import type { TeamTask, TeamMember } from '@/types/team.types'

const emptyDraft = { title: '', assigneeId: '' }

export const TodosTab = () => {
  const [tasks, setTasks] = useState<TeamTask[]>([])
  const [subordinates, setSubordinates] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([teamService.getTasks(), teamService.getSubordinates()])
      setTasks(t)
      setSubordinates(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    if (!draft.title.trim() || !draft.assigneeId) return
    setSaving(true)
    try {
      await teamService.createTask({ assigneeId: draft.assigneeId, title: draft.title })
      setDraft(emptyDraft)
      setOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (t: TeamTask) => {
    await teamService.setTaskStatus(t.id, t.status !== 'done')
    await load()
  }
  const remove = async (id: string) => {
    await teamService.deleteTask(id)
    await load()
  }

  const canAssign = subordinates.length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="type-section">Görevler</span>
        <Button variant="primary" size="sm" disabled={!canAssign} onClick={() => setOpen((o) => !o)}>
          <PlusIcon className="h-4 w-4" /> Ata
        </Button>
      </div>

      {open && canAssign && (
        <div className="space-y-2 border-b border-border bg-surface-1 p-3">
          <Select value={draft.assigneeId} onChange={(e) => setDraft((d) => ({ ...d, assigneeId: e.target.value }))}>
            <option value="">Kime atanacak?</option>
            {subordinates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.roleName})
              </option>
            ))}
          </Select>
          <Input
            size="sm"
            placeholder="Görev başlığı…"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>İptal</Button>
            <Button variant="primary" size="sm" isLoading={saving} disabled={!draft.title.trim() || !draft.assigneeId} onClick={create}>
              Görev Ver
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="p-2"><SkeletonRows rows={4} /></div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CheckSquareIcon}
            title="Görev yok"
            description={canAssign ? 'Bir astına görev ata.' : 'Size atanmış görev yok.'}
          />
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2 rounded-field px-2 py-1.5 hover:bg-surface-1">
                <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggle(t)} />
                <div className="min-w-0 flex-1">
                  <span className={cn('type-body block truncate', t.status === 'done' && 'text-foreground-muted line-through')}>
                    {t.title}
                  </span>
                  <div className="mt-0.5 flex items-center gap-1">
                    {t.assignedByMe ? (
                      <Badge tone="info">→ {t.assigneeName}</Badge>
                    ) : (
                      <Badge tone="warning">{t.assignerName}'den</Badge>
                    )}
                  </div>
                </div>
                {t.assignedByMe && (
                  <IconButton tone="danger" title="Sil" onClick={() => remove(t.id)}>
                    <Trash2Icon className="h-4 w-4" />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

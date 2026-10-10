import { useMemo, useState } from 'react'
import { PlusIcon, TagsIcon } from 'lucide-react'
import { Button, Input, ToggleChip } from '@/design-system'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
  options: ServiceCategoryRef[]
  onCreate?: (name: string) => Promise<ServiceCategoryRef>
  disabled?: boolean
  emptyText?: string
  max?: number
}

export const ServiceCategoryPicker = ({
  value, onChange, options, onCreate, disabled, emptyText = 'Henüz hizmet kategorisi yok.', max,
}: Props) => {
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState(false)

  const merged = useMemo(() => {
    const map = new Map<string, ServiceCategoryRef>()
    for (const o of options) map.set(o.id, o)
    return Array.from(map.values())
  }, [options])

  const atMax = max !== undefined && value.length >= max

  const toggle = (id: string) => {
    if (disabled) return
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      if (atMax) return
      onChange([...value, id])
    }
  }

  const canCreate = !!onCreate && draft.trim().length > 0 && !merged.some(
    (o) => o.name.toLocaleLowerCase('tr-TR') === draft.trim().toLocaleLowerCase('tr-TR'),
  ) && !atMax

  const create = async () => {
    if (!onCreate || !canCreate || creating) return
    setCreating(true)
    try {
      const created = await onCreate(draft.trim())
      setDraft('')
      if (!value.includes(created.id)) onChange([...value, created.id])
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      {merged.length === 0 ? (
        <div className="flex items-center gap-2 rounded-card border border-dashed border-border bg-surface-1 p-3 type-muted">
          <TagsIcon className="h-4 w-4" />
          {emptyText}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {merged.map((o) => {
            const selected = value.includes(o.id)
            return (
              <ToggleChip
                key={o.id}
                active={selected}
                color={o.color}
                disabled={disabled || (!selected && atMax)}
                onClick={() => toggle(o.id)}
              >
                {o.name}
              </ToggleChip>
            )
          })}
        </div>
      )}

      {max !== undefined && (
        <p className={`type-caption ${atMax ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--foreground-muted))]'}`}>
          {value.length}/{max} kategori seçildi{atMax ? ' — limite ulaşıldı' : ''}
        </p>
      )}

      {onCreate && !disabled && (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void create() } }}
            placeholder={atMax ? `En fazla ${max} kategori seçilebilir` : 'Yeni kategori adı'}
            disabled={atMax}
            sanitize="alnum"
          />
          <Button
            type="button"
            variant="outline"
            isLoading={creating}
            disabled={!canCreate}
            onClick={() => void create()}
            iconLeft={<PlusIcon className="h-4 w-4" />}
          >
            Ekle
          </Button>
        </div>
      )}
    </div>
  )
}

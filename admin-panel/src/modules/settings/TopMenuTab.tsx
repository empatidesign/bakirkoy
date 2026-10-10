import { useState, useEffect, useCallback } from 'react'
import {
  PlusIcon, GripVerticalIcon, EyeIcon, EyeOffIcon,
  PencilIcon, Trash2Icon, ExternalLinkIcon, LinkIcon, AppWindowIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/design-system/Button'
import { IconButton } from '@/design-system/IconButton'
import { Badge } from '@/design-system/Badge'
import { Card } from '@/design-system/Card'
import { Input } from '@/design-system/Input'
import { Field } from '@/design-system/Field'
import { Select } from '@/design-system/Select'
import { EmptyState } from '@/design-system/EmptyState'
import { Skeleton } from '@/design-system/Skeleton'
import { ConfirmModal } from '@/design-system'
import { ColorSwatchPicker } from '@/design-system'
import topMenuService, { type TopMenuItem, type TopMenuItemForm, type TopMenuLinkType } from '@/services/topMenu.service'

const LINK_TYPE_LABELS: Record<number, string> = {
  0: 'Uygulama İçi',
  1: 'Dış URL',
  2: 'WebView',
}

const LINK_TYPE_OPTIONS = [
  { value: '0', label: 'Uygulama İçi' },
  { value: '1', label: 'Dış URL (External)' },
  { value: '2', label: 'WebView' },
]

const LINK_TYPE_ICONS: Record<number, React.ComponentType<{ className?: string }>> = {
  0: AppWindowIcon,
  1: ExternalLinkIcon,
  2: LinkIcon,
}

const EMPTY_FORM: TopMenuItemForm = {
  title: '',
  icon: 'Link',
  iconType: 0,
  color: '#1486C9',
  linkType: 0,
  linkTarget: '',
  openInBlank: false,
}

interface ItemFormProps {
  initial?: TopMenuItemForm & { isVisible?: boolean; order?: number }
  onSave: (data: TopMenuItemForm) => Promise<void>
  onCancel: () => void
}

const ItemForm = ({ initial, onSave, onCancel }: ItemFormProps) => {
  const [form, setForm] = useState<TopMenuItemForm>(initial ?? EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof TopMenuItemForm>(key: K, val: TopMenuItemForm[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.linkTarget.trim()) {
      toast.error('Başlık ve link hedefi zorunludur.')
      return
    }
    setSaving(true)
    try { await onSave(form) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-surface-1 p-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Başlık" required>
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Örn: Ana Sayfa" />
        </Field>
        <Field label="Renk">
          <ColorSwatchPicker value={form.color} onChange={c => set('color', c)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Menü Tipi">
          <Select
            value={String(form.linkType)}
            onChange={e => set('linkType', Number(e.target.value) as TopMenuLinkType)}
          >
            {LINK_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Hedef URL / Rota" required>
          <Input
            value={form.linkTarget}
            onChange={e => set('linkTarget', e.target.value)}
            placeholder={form.linkType === 0 ? '/basvurularim' : 'https://...'}
          />
        </Field>
      </div>

      {form.linkType !== 0 && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.openInBlank}
            onChange={e => set('openInBlank', e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm text-text-2">Yeni sekmede aç (_blank)</span>
        </label>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>İptal</Button>
        <Button type="submit" isLoading={saving}>Kaydet</Button>
      </div>
    </form>
  )
}

export const TopMenuTab = () => {
  const [items, setItems] = useState<TopMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TopMenuItem | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<TopMenuItem | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try { setItems(await topMenuService.getAll()) }
    catch { toast.error('Menü yüklenemedi.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const handleCreate = async (data: TopMenuItemForm) => {
    await topMenuService.create(data)
    toast.success('Menü öğesi eklendi.')
    setFormOpen(false)
    void reload()
  }

  const handleUpdate = async (data: TopMenuItemForm) => {
    if (!editing) return
    await topMenuService.update(editing.id, {
      ...data,
      isVisible: editing.isVisible,
      order: editing.order,
    })
    toast.success('Güncellendi.')
    setEditing(null)
    void reload()
  }

  const toggleVisible = async (item: TopMenuItem) => {
    await topMenuService.update(item.id, {
      title: item.title,
      icon: item.icon,
      iconType: item.iconType,
      color: item.color,
      linkType: item.linkType,
      linkTarget: item.linkTarget,
      openInBlank: item.openInBlank,
      isVisible: !item.isVisible,
      order: item.order,
    })
    void reload()
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    await topMenuService.delete(deleteItem.id)
    toast.success('Silindi.')
    setDeleteItem(null)
    void reload()
  }

  const handleDrop = async (targetId: string) => {
    if (!dragging || dragging === targetId) return
    const arr = [...items]
    const from = arr.findIndex(i => i.id === dragging)
    const to = arr.findIndex(i => i.id === targetId)
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    setItems(arr)
    setDragging(null)
    await topMenuService.reorder(arr.map(i => i.id))
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <ConfirmModal
        open={!!deleteItem}
        title="Menü Öğesini Sil"
        description={`"${deleteItem?.title}" öğesi silinecek.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteItem(null)}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-text-1">Üst Menü Linkleri</h3>
          <p className="text-sm text-text-2 mt-0.5">
            Vatandaş portalında hizmet kartlarının üstünde görünen hızlı erişim linkleri
          </p>
        </div>
        <Button size="sm" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true) }}>
          Ekle
        </Button>
      </div>

      {formOpen && !editing && (
        <ItemForm onSave={handleCreate} onCancel={() => setFormOpen(false)} />
      )}

      {items.length === 0 && !formOpen ? (
        <EmptyState
          icon={LinkIcon}
          title="Henüz menü öğesi yok"
          description="Vatandaş portalı üst menüsüne link ekleyin."
        />
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const LinkIcon_ = LINK_TYPE_ICONS[item.linkType] ?? LinkIcon
            return (
              <div key={item.id}>
                <Card
                  className="flex items-center gap-3 p-3 cursor-move"
                  draggable
                  onDragStart={() => setDragging(item.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => void handleDrop(item.id)}
                >
                  <GripVerticalIcon className="h-4 w-4 text-text-3 shrink-0" />
                  <span
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: item.color + '22', color: item.color }}
                  >
                    <LinkIcon_ className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-text-1 truncate">{item.title}</span>
                      <Badge tone={item.isVisible ? 'success' : 'neutral'}>
                        {item.isVisible ? 'Görünür' : 'Gizli'}
                      </Badge>
                      <Badge tone="info">{LINK_TYPE_LABELS[item.linkType]}</Badge>
                    </div>
                    <p className="text-xs text-text-3 truncate">{item.linkTarget}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton size="sm" title="Görünürlük" onClick={() => void toggleVisible(item)}>
                      {item.isVisible ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
                    </IconButton>
                    <IconButton size="sm" title="Düzenle" onClick={() => { setFormOpen(false); setEditing(item) }}>
                      <PencilIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton size="sm" tone="danger" title="Sil" onClick={() => setDeleteItem(item)}>
                      <Trash2Icon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </Card>
                {editing?.id === item.id && (
                  <div className="mt-2">
                    <ItemForm
                      initial={{
                        title: item.title,
                        icon: item.icon,
                        iconType: item.iconType,
                        color: item.color,
                        linkType: item.linkType,
                        linkTarget: item.linkTarget,
                        openInBlank: item.openInBlank,
                      }}
                      onSave={handleUpdate}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

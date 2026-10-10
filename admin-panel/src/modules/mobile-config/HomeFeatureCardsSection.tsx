import {useCallback, useEffect, useState} from 'react'
import {ChevronDownIcon, ChevronUpIcon, EyeIcon, EyeOffIcon, LayoutGridIcon, PencilIcon, PlusIcon, Trash2Icon} from 'lucide-react'
import {toast} from 'sonner'
import {Badge, Button, ConfirmModal, EmptyState, FormSection, IconButton, SkeletonRows} from '@/design-system'
import mobileMenuService from '@/services/mobileMenu.service'
import type {MobileMenuGroup, MobileMenuItem} from '@/types/mobileMenu.types'
import {MobileMenuItemForm} from '@/modules/settings/MobileMenuItemForm'

const GROUP = {groupKey: 'features', groupTitle: 'Öne Çıkanlar'}
const MAX_VISIBLE = 4
const LINK_LABEL: Record<string, string> = {Module: 'Uygulama ekranı', WebView: 'WebView', ExternalUrl: 'Dış bağlantı'}

export function HomeFeatureCardsSection() {
  const [allItems, setAllItems] = useState<MobileMenuItem[]>([])
  const [groups, setGroups] = useState<MobileMenuGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [reordering, setReordering] = useState(false)
  const [editing, setEditing] = useState<MobileMenuItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<MobileMenuItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [items, menuGroups] = await Promise.all([
        mobileMenuService.getItems(),
        mobileMenuService.getGroups(),
      ])
      setAllItems(items)
      setGroups(menuGroups)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rows = allItems.filter(item => item.groupKey === GROUP.groupKey)
  const visibleCount = rows.filter(item => item.isVisible).length
  const activationBlocked = visibleCount >= MAX_VISIBLE

  const toggle = async (item: MobileMenuItem) => {
    if (!item.isVisible && activationBlocked) {
      toast.warning(`Ana sayfada en fazla ${MAX_VISIBLE} kart yayınlanabilir.`)
      return
    }
    await mobileMenuService.updateItem(item.id, {...item, isVisible: !item.isVisible})
    toast.success(item.isVisible ? 'Kart yayından kaldırıldı.' : 'Kart yayınlandı.')
    await load()
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const reordered = [...rows]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    const ids = [...allItems]
    let featureIndex = 0
    const orderedIds = ids.map(item => item.groupKey === GROUP.groupKey ? reordered[featureIndex++].id : item.id)
    setReordering(true)
    try {
      await mobileMenuService.reorder(orderedIds)
      await load()
    } finally {
      setReordering(false)
    }
  }

  return (
    <FormSection
      icon={LayoutGridIcon}
      title="Ana Sayfa Hızlı Kartları"
      subtitle="Mobil ana sayfanın üst bölümünde 2×2 düzende gösterilen dört kart. Başlık, ikon, renk, hedef ve sıralamayı buradan yönetin."
      action={
        <Button iconLeft={<PlusIcon className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true) }}>
          Kart Ekle
        </Button>
      }>
      {loading ? <SkeletonRows rows={4} /> : rows.length === 0 ? (
        <EmptyState icon={LayoutGridIcon} title="Henüz hızlı kart yok" description="Mobil ana sayfa için ilk kartı ekleyin." />
      ) : (
        <div className="space-y-3">
          <p className="type-muted">Yayındaki kartlar: {visibleCount}/{MAX_VISIBLE}. Mobil uygulama ilk dört aktif kartı gösterir.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((row, index) => (
              <div key={row.id} className={`flex items-center gap-3 rounded-card border border-border bg-surface-0 p-3 ${row.isVisible ? '' : 'opacity-60'}`}>
                <span
                  className="h-10 w-10 shrink-0 rounded-card border border-white/20"
                  style={{backgroundImage: `linear-gradient(135deg, ${row.color}, ${row.colorSecondary ?? row.color})`}}
                />
                <div className="min-w-0 flex-1">
                  <p className="type-body-strong truncate">{row.title}</p>
                  {row.description && <p className="type-caption truncate">{row.description}</p>}
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={row.isVisible ? 'success' : 'neutral'}>{row.isVisible ? 'Yayında' : 'Pasif'}</Badge>
                    <span className="type-caption truncate">{LINK_LABEL[row.linkType]} · {row.linkTarget}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton title="Yukarı taşı" disabled={index === 0 || reordering} onClick={() => void move(index, -1)}><ChevronUpIcon className="h-4 w-4" /></IconButton>
                  <IconButton title="Aşağı taşı" disabled={index === rows.length - 1 || reordering} onClick={() => void move(index, 1)}><ChevronDownIcon className="h-4 w-4" /></IconButton>
                  <IconButton title={row.isVisible ? 'Yayından kaldır' : 'Yayınla'} onClick={() => void toggle(row)}>{row.isVisible ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}</IconButton>
                  <IconButton tone="primary" title="Düzenle" onClick={() => { setEditing(row); setFormOpen(true) }}><PencilIcon className="h-4 w-4" /></IconButton>
                  <IconButton tone="danger" title="Sil" onClick={() => setDeleting(row)}><Trash2Icon className="h-4 w-4" /></IconButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <MobileMenuItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        groups={groups}
        fixedGroup={GROUP}
        activationBlocked={activationBlocked}
        defaultVisible={!activationBlocked}
        onSaved={load}
      />
      <ConfirmModal
        open={!!deleting}
        title="Hızlı kartı sil"
        description={`“${deleting?.title}” kartı silinsin mi?`}
        confirmLabel="Sil"
        tone="danger"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await mobileMenuService.deleteItem(deleting.id)
          setDeleting(null)
          toast.success('Kart silindi.')
          await load()
        }}
      />
    </FormSection>
  )
}

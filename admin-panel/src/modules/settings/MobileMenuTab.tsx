import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PlusIcon, GripVerticalIcon, EyeIcon, EyeOffIcon, StarIcon,
  PencilIcon, Trash2Icon, ImageIcon, LinkIcon, UploadIcon,
  LayoutGridIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/design-system/Button'
import { IconButton } from '@/design-system/IconButton'
import { Badge } from '@/design-system/Badge'
import { Card } from '@/design-system/Card'
import { Input } from '@/design-system/Input'
import { Field } from '@/design-system/Field'
import { EmptyState } from '@/design-system/EmptyState'
import { Skeleton } from '@/design-system/Skeleton'
import { SegmentedControl } from '@/design-system/SegmentedControl'
import { ConfirmModal } from '@/design-system'
import mobileMenuService from '@/services/mobileMenu.service'
import { MobileMenuItemForm } from './MobileMenuItemForm'
import type { MobileMenuItem, MobileMenuGroup, MobileMenuBanner } from '@/types/mobileMenu.types'

const LINK_LABEL: Record<string, string> = { Module: 'Modül', WebView: 'WebView', ExternalUrl: 'Dış URL' }
const HOME_FEATURE_GROUP_KEY = 'features'

const SECTION_OPTIONS = [
  { value: 'items', label: 'Menü Öğeleri', icon: LayoutGridIcon },
  { value: 'banners', label: "Banner'lar", icon: ImageIcon },
]

export const MobileMenuTab = () => {
  const [section, setSection] = useState<'items' | 'banners'>('items')
  const [items, setItems] = useState<MobileMenuItem[]>([])
  const [groups, setGroups] = useState<MobileMenuGroup[]>([])
  const [banners, setBanners] = useState<MobileMenuBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MobileMenuItem | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<MobileMenuItem | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [it, gr, bn] = await Promise.all([
        mobileMenuService.getItems(),
        mobileMenuService.getGroups(),
        mobileMenuService.getBanners(),
      ])
      setItems(it)
      setGroups(gr)
      setBanners(bn)
    } catch { } finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const menuItems = items.filter((item) => item.groupKey !== HOME_FEATURE_GROUP_KEY)
  const menuGroups = groups.filter((group) => group.groupKey !== HOME_FEATURE_GROUP_KEY)

  const toggleVisible = async (item: MobileMenuItem) => {
    await mobileMenuService.updateItem(item.id, { ...item, isVisible: !item.isVisible })
    void reload()
  }

  const handleDrop = async (targetId: string) => {
    if (!dragging || dragging === targetId) return
    const arr = [...menuItems]
    const from = arr.findIndex((i) => i.id === dragging)
    const to = arr.findIndex((i) => i.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    let menuIndex = 0
    const merged = items.map((item) => (
      item.groupKey === HOME_FEATURE_GROUP_KEY ? item : arr[menuIndex++]
    ))
    setItems(merged)
    setDragging(null)
    await mobileMenuService.reorder(merged.map((i) => i.id))
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5">
      <SegmentedControl
        value={section}
        onChange={(v) => setSection(v as 'items' | 'banners')}
        options={SECTION_OPTIONS}
        columns={2}
        className="max-w-xs"
      />

      {section === 'items' ? (
        <>
          <div className="flex justify-end">
            <Button
              variant="primary"
              iconLeft={<PlusIcon className="h-4 w-4" />}
              onClick={() => { setEditing(null); setFormOpen(true) }}
            >
              Öğe Ekle
            </Button>
          </div>

          <div className="space-y-2">
            {menuItems.length === 0 ? (
              <EmptyState
                icon={LayoutGridIcon}
                title="Henüz menü öğesi yok."
                description="Mobil uygulamada gösterilecek menü öğeleri buradan eklenir."
              />
            ) : (
              menuItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragging(item.id)}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(item.id)}
                  className={`flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-opacity ${dragging === item.id ? 'opacity-40' : ''} ${!item.isVisible ? 'opacity-60' : ''}`}
                >
                  <span className="cursor-grab text-[hsl(var(--foreground-subtle))]">
                    <GripVerticalIcon className="h-5 w-5" />
                  </span>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card border border-border bg-surface-1">
                    {item.iconType === 'Image'
                      ? <img src={item.icon} alt="" className="h-5 w-5 object-contain" />
                      : <span className="truncate px-1 text-[9px] font-mono text-[hsl(var(--foreground-muted))]">{item.icon.slice(0, 5)}</span>}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="type-body-strong truncate">{item.title}</p>
                      {item.isPopular && <StarIcon className="h-3.5 w-3.5 shrink-0 fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge tone="neutral">{LINK_LABEL[item.linkType]}</Badge>
                      <span className="type-caption truncate">{item.linkTarget}</span>
                      <span className="type-caption text-[hsl(var(--foreground-subtle))]">·</span>
                      <span className="type-caption">{item.groupTitle}</span>
                    </div>
                  </div>

                  <IconButton
                    tone="default"
                    title={item.isVisible ? 'Gizle' : 'Göster'}
                    onClick={() => toggleVisible(item)}
                  >
                    {item.isVisible
                      ? <EyeIcon className="h-4 w-4" />
                      : <EyeOffIcon className="h-4 w-4 text-[hsl(var(--danger))]" />}
                  </IconButton>

                  <IconButton
                    tone="primary"
                    title="Düzenle"
                    onClick={() => { setEditing(item); setFormOpen(true) }}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </IconButton>

                  <IconButton
                    tone="danger"
                    title="Sil"
                    onClick={() => setDeleteItem(item)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </IconButton>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <BannerSection banners={banners} onChanged={reload} />
      )}

      <MobileMenuItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        groups={menuGroups}
        onSaved={reload}
      />

      <ConfirmModal
        open={!!deleteItem}
        title="Menü öğesini sil"
        description={`"${deleteItem?.title}" silinsin mi? Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        tone="danger"
        onClose={() => setDeleteItem(null)}
        onConfirm={async () => {
          if (!deleteItem) return
          await mobileMenuService.deleteItem(deleteItem.id)
          toast.success('Öğe silindi.')
          setDeleteItem(null)
          void reload()
        }}
      />
    </div>
  )
}

interface BannerSectionProps {
  banners: MobileMenuBanner[]
  onChanged: () => void
}

function BannerSection({ banners, onChanged }: BannerSectionProps) {
  const [pageKey, setPageKey] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleteBannerKey, setDeleteBannerKey] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File, key: string) => {
    if (!key.trim()) { toast.warning('Önce sayfa anahtarı girin.'); return }
    setUploading(true)
    try {
      const { url } = await mobileMenuService.uploadImage(file)
      await mobileMenuService.upsertBanner(key.trim(), { imageUrl: url, linkType: 'None', linkTarget: null, isVisible: true })
      toast.success('Banner kaydedildi.')
      setPageKey('')
      onChanged()
    } catch { } finally { setUploading(false) }
  }

  return (
    <>
      <div className="space-y-4">
        <Card padded>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Sayfa anahtarı">
                <Input
                  value={pageKey}
                  onChange={(e) => setPageKey(e.target.value)}
                  placeholder="ör. etkinlikler"
                />
              </Field>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, pageKey) }}
            />
            <Button
              variant="outline"
              iconLeft={<UploadIcon className="h-4 w-4" />}
              isLoading={uploading}
              disabled={!pageKey.trim()}
              onClick={() => {
                if (!pageKey.trim()) { toast.warning('Önce sayfa anahtarı girin.'); return }
                fileInputRef.current?.click()
              }}
              type="button"
            >
              Banner Yükle
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {banners.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="Henüz banner yok."
              description="Sayfa anahtarı ve görsel seçerek banner ekleyebilirsiniz."
            />
          ) : (
            banners.map((b) => (
              <Card key={b.id} className="overflow-hidden">
                <img src={b.imageUrl} alt={b.pageKey} className="h-28 w-full object-cover" />
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[hsl(var(--foreground-subtle))]" />
                    <span className="type-body font-mono">{b.pageKey}</span>
                    {b.linkTarget && (
                      <span className="flex items-center gap-1 type-caption text-[hsl(var(--foreground-muted))]">
                        <LinkIcon className="h-3 w-3" />
                        {b.linkTarget}
                      </span>
                    )}
                  </div>
                  <IconButton
                    tone="danger"
                    title="Banner'ı sil"
                    onClick={() => setDeleteBannerKey(b.pageKey)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </IconButton>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleteBannerKey}
        title="Banner'ı sil"
        description={`"${deleteBannerKey}" sayfasının banner'ı silinsin mi?`}
        confirmLabel="Sil"
        tone="danger"
        onClose={() => setDeleteBannerKey(null)}
        onConfirm={async () => {
          if (!deleteBannerKey) return
          await mobileMenuService.deleteBanner(deleteBannerKey)
          toast.success('Banner silindi.')
          setDeleteBannerKey(null)
          onChanged()
        }}
      />
    </>
  )
}

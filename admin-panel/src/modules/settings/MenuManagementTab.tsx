import { useCallback, useEffect, useState } from 'react'
import {
  LayoutGridIcon, PlusIcon, GripVerticalIcon, PencilIcon, Trash2Icon,
  EyeIcon, EyeOffIcon, ToggleLeftIcon, ToggleRightIcon, ChevronDownIcon,
  ChevronRightIcon, StarIcon, LinkIcon, BoxIcon, SaveIcon,
  MonitorIcon, SmartphoneIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Button, IconButton, Badge, Input, Field, Select, ToggleRow,
  ConfirmModal, EmptyState, Skeleton, SegmentedControl, FormSection,
} from '@/design-system'
import { ColorSwatchPicker } from '@/design-system'
import appMenuService from '@/services/appMenu.service'
import type { SystemModule, MenuSection, MenuItem, MenuItemForm, CreateMenuSectionForm, UpdateMenuSectionForm } from '@/types/appMenu.types'
import { LINK_TYPE_LABELS, BADGE_TONE_OPTIONS } from '@/types/appMenu.types'

const SECTION_TABS = [
  { value: 'modules', label: 'Sistem Modülleri', icon: BoxIcon },
  { value: 'sections', label: 'Menü Bölümleri', icon: LayoutGridIcon },
]


const ModulesPanel = () => {
  const [modules, setModules] = useState<SystemModule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try { setModules(await appMenuService.getModules()) }
    catch { } finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const toggleActive = async (m: SystemModule) => {
    setSaving(m.id)
    try {
      await appMenuService.setModuleActive(m.key, !m.isActive)
      toast.success(`${m.label} ${!m.isActive ? 'aktif edildi' : 'pasife alındı'}.`)
      void reload()
    } catch { } finally { setSaving(null) }
  }

  const handleDrop = async (targetId: string) => {
    if (!dragging || dragging === targetId) return
    const arr = [...modules]
    const from = arr.findIndex((m) => m.id === dragging)
    const to = arr.findIndex((m) => m.id === targetId)
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    setModules(arr)
    setDragging(null)
    await appMenuService.reorderModules(arr.map((m) => m.id))
  }

  if (loading) return <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>

  return (
    <div className="space-y-2">
      <p className="type-muted mb-3">
        Aktif modüller vatandaş menüsünde ve admin sidebar'da gösterilir. Sürükle-bırak ile sidebar sıralamasını değiştirebilirsiniz.
      </p>
      {modules.length === 0 ? (
        <EmptyState icon={BoxIcon} title="Modül yok" description="Henüz kayıtlı sistem modülü bulunmuyor." />
      ) : (
        modules.map((m) => (
          <div
            key={m.id}
            draggable
            onDragStart={() => setDragging(m.id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(m.id)}
            className={`flex items-center gap-3 rounded-card border border-border bg-surface-0 px-4 py-3 shadow-card transition-opacity ${dragging === m.id ? 'opacity-40' : ''} ${!m.isActive ? 'opacity-60' : ''}`}
          >
            <span className="cursor-grab text-foreground-subtle"><GripVerticalIcon className="h-5 w-5" /></span>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ background: m.color }}
            >
              {m.label.slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="type-body-strong truncate">{m.label}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="type-caption font-mono text-foreground-subtle">{m.key}</span>
                <span className="type-caption text-foreground-subtle">·</span>
                <span className="type-caption text-foreground-muted">{m.citizenRoute}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {m.showInAdminSidebar && (
                <Badge tone="neutral">Sidebar</Badge>
              )}
              <Badge tone={m.isActive ? 'success' : 'neutral'}>
                {m.isActive ? 'Aktif' : 'Pasif'}
              </Badge>
            </div>
            <IconButton
              tone={m.isActive ? 'danger' : 'primary'}
              title={m.isActive ? 'Pasife al' : 'Aktif et'}
              onClick={() => toggleActive(m)}
              disabled={saving === m.id}
            >
              {m.isActive
                ? <ToggleRightIcon className="h-5 w-5" />
                : <ToggleLeftIcon className="h-5 w-5" />}
            </IconButton>
          </div>
        ))
      )}
    </div>
  )
}


const EMPTY_ITEM: MenuItemForm = {
  sectionId: '',
  moduleKey: '',
  title: '',
  icon: 'Star',
  iconType: 0,
  color: '#1486C9',
  linkType: 0,
  linkTarget: '',
  mobileLinkTarget: '',
  showInSidebar: true,
  showInMobile: true,
  isPopular: false,
  isVisible: true,
  requiresAuth: true,
  badgeText: '',
  badgeTone: '',
}

interface ItemFormProps {
  sectionId: string
  modules: SystemModule[]
  item?: MenuItem
  onSave: (form: MenuItemForm) => Promise<void>
  onCancel: () => void
}

const ItemForm = ({ sectionId, modules, item, onSave, onCancel }: ItemFormProps) => {
  const [form, setForm] = useState<MenuItemForm>(() => item
    ? {
        sectionId: item.sectionId,
        moduleKey: item.moduleKey ?? '',
        title: item.title,
        icon: item.icon,
        iconType: item.iconType,
        color: item.color,
        linkType: item.linkType,
        linkTarget: item.linkTarget,
        mobileLinkTarget: item.mobileLinkTarget ?? '',
        showInSidebar: item.showInSidebar,
        showInMobile: item.showInMobile,
        isPopular: item.isPopular,
        isVisible: item.isVisible,
        requiresAuth: item.requiresAuth,
        badgeText: item.badgeText ?? '',
        badgeTone: item.badgeTone ?? '',
      }
    : { ...EMPTY_ITEM, sectionId }
  )
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof MenuItemForm>(k: K, v: MenuItemForm[K]) => setForm(p => ({ ...p, [k]: v }))

  const handleModuleSelect = (key: string) => {
    const mod = modules.find(m => m.key === key)
    set('moduleKey', key)
    if (mod && !form.title) set('title', mod.label)
    if (mod && form.linkType === 0) {
      set('linkTarget', mod.citizenRoute)
      if (!form.mobileLinkTarget) set('mobileLinkTarget', mod.citizenRoute)
    }
    if (mod && !form.icon) set('icon', mod.icon)
    if (mod) set('color', mod.color)
  }

  const submit = async () => {
    if (!form.title.trim()) { toast.warning('Başlık zorunludur.'); return }
    if (!form.linkTarget.trim()) { toast.warning('Link hedefi zorunludur.'); return }
    setSaving(true)
    try { await onSave(form) }
    catch { } finally { setSaving(false) }
  }

  return (
    <div className="rounded-card border border-primary/30 bg-primary-soft/20 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bağlı Modül">
          <Select value={form.moduleKey} onChange={(e) => handleModuleSelect(e.target.value)}>
            <option value="">— Modüle bağlama —</option>
            {modules.filter(m => m.isActive).map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Başlık" required>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Etkinlikler" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Link Tipi">
          <Select value={String(form.linkType)} onChange={(e) => set('linkType', Number(e.target.value) as 0 | 1 | 2)}>
            {Object.entries(LINK_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sidebar Link" required hint="Desktop sol menüde açılacak URL">
          <Input
            value={form.linkTarget}
            onChange={(e) => set('linkTarget', e.target.value)}
            placeholder={form.linkType === 0 ? '/etkinlikler' : 'https://...'}
          />
        </Field>
        <Field label="Mobil Link" hint="Boş bırakılırsa Sidebar linki kullanılır">
          <Input
            value={form.mobileLinkTarget}
            onChange={(e) => set('mobileLinkTarget', e.target.value)}
            placeholder={form.linkTarget || '/etkinlikler'}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-surface-1 p-3 space-y-2">
        <p className="type-caption text-foreground-muted font-medium">Görünürlük</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <ToggleRow label="Vatandaş Portalı'nda göster" checked={form.showInSidebar} onChange={(v) => set('showInSidebar', v)} />
          <ToggleRow label="Mobil Menü'de göster" checked={form.showInMobile} onChange={(v) => set('showInMobile', v)} />
          <ToggleRow label="Popüler" checked={form.isPopular} onChange={(v) => set('isPopular', v)} />
          <ToggleRow label="Görünür" checked={form.isVisible} onChange={(v) => set('isVisible', v)} />
          <ToggleRow label="Giriş gerekli" checked={form.requiresAuth} onChange={(v) => set('requiresAuth', v)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="İkon (Lucide adı)">
          <Input value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="CalendarDays" />
        </Field>
        <Field label="Renk">
          <ColorSwatchPicker value={form.color} onChange={(hex) => set('color', hex)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rozet Metni (opsiyonel)">
          <Input value={form.badgeText} onChange={(e) => set('badgeText', e.target.value)} placeholder="Yeni" maxLength={10} />
        </Field>
        <Field label="Rozet Rengi">
          <Select value={form.badgeTone} onChange={(e) => set('badgeTone', e.target.value)}>
            {BADGE_TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>İptal</Button>
        <Button variant="primary" size="sm" isLoading={saving} iconLeft={<SaveIcon className="h-3.5 w-3.5" />} onClick={submit}>
          {item ? 'Güncelle' : 'Ekle'}
        </Button>
      </div>
    </div>
  )
}


interface SectionCardProps {
  section: MenuSection
  modules: SystemModule[]
  draggingSection: string | null
  onDragStartSection: (id: string) => void
  onDragEndSection: () => void
  onDropSection: (id: string) => void
  onUpdate: (id: string, form: UpdateMenuSectionForm) => Promise<void>
  onDelete: (section: MenuSection) => void
  onAddItem: (sectionId: string, form: MenuItemForm) => Promise<void>
  onUpdateItem: (id: string, form: MenuItemForm) => Promise<void>
  onDeleteItem: (item: MenuItem) => void
  onDragItem: (sectionId: string, orderedIds: string[]) => Promise<void>
}

const SectionCard = ({
  section, modules,
  draggingSection, onDragStartSection, onDragEndSection, onDropSection,
  onUpdate, onDelete, onAddItem, onUpdateItem, onDeleteItem, onDragItem,
}: SectionCardProps) => {
  const [expanded, setExpanded] = useState(true)
  const [editingSection, setEditingSection] = useState(false)
  const [sectionForm, setSectionForm] = useState({
    title: section.title,
    icon: section.icon,
    isVisible: section.isVisible,
    showInSidebar: section.showInSidebar,
    showInMobile: section.showInMobile,
  })
  const [addingItem, setAddingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [draggingItem, setDraggingItem] = useState<string | null>(null)
  const [items, setItems] = useState(section.items)

  useEffect(() => { setItems(section.items) }, [section.items])

  const handleItemDrop = async (targetId: string) => {
    if (!draggingItem || draggingItem === targetId) return
    const arr = [...items]
    const from = arr.findIndex((i) => i.id === draggingItem)
    const to = arr.findIndex((i) => i.id === targetId)
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    setItems(arr)
    setDraggingItem(null)
    await onDragItem(section.id, arr.map((i) => i.id))
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStartSection(section.id)}
      onDragEnd={onDragEndSection}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.stopPropagation(); onDropSection(section.id) }}
      className={`rounded-card border border-border bg-surface-0 shadow-card transition-opacity ${draggingSection === section.id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <span className="cursor-grab text-foreground-subtle"><GripVerticalIcon className="h-5 w-5" /></span>
        <button
          type="button"
          className="flex items-center gap-1.5 text-foreground-muted hover:text-foreground-default"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
        </button>

        {editingSection ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              size="sm"
              value={sectionForm.title}
              onChange={(e) => setSectionForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Bölüm adı"
              className="flex-1"
            />
            <Input
              size="sm"
              value={sectionForm.icon}
              onChange={(e) => setSectionForm(p => ({ ...p, icon: e.target.value }))}
              placeholder="İkon"
              className="w-32"
            />
            <ToggleRow
              label="Görünür"
              checked={sectionForm.isVisible}
              onChange={(v) => setSectionForm(p => ({ ...p, isVisible: v }))}
            />
            <ToggleRow
              label="Vatandaş Portalı"
              checked={sectionForm.showInSidebar}
              onChange={(v) => setSectionForm(p => ({ ...p, showInSidebar: v }))}
            />
            <ToggleRow
              label="Mobil Menü"
              checked={sectionForm.showInMobile}
              onChange={(v) => setSectionForm(p => ({ ...p, showInMobile: v }))}
            />
            <Button variant="primary" size="sm" onClick={async () => { await onUpdate(section.id, sectionForm); setEditingSection(false) }}>
              Kaydet
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditingSection(false)}>İptal</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <span className="type-body-strong truncate">{section.title}</span>
              <span className="type-caption font-mono text-foreground-subtle">{section.key}</span>
              {!section.isVisible && <Badge tone="neutral">Gizli</Badge>}
              {!section.showInSidebar && <Badge tone="warning">Portalda gizli</Badge>}
              {!section.showInMobile && <Badge tone="warning">Mobilde gizli</Badge>}
              <Badge tone="neutral">{items.length} öğe</Badge>
            </div>
            <div className="flex items-center gap-1">
              <IconButton tone="default" title="Düzenle" onClick={() => setEditingSection(true)}>
                <PencilIcon className="h-4 w-4" />
              </IconButton>
              <IconButton tone="danger" title="Sil" onClick={() => onDelete(section)}>
                <Trash2Icon className="h-4 w-4" />
              </IconButton>
            </div>
          </>
        )}
      </div>

      {expanded && (
        <div className="p-3 space-y-2">
          {items.map((item) => (
            <div key={item.id}>
              {editingItem === item.id ? (
                <ItemForm
                  sectionId={section.id}
                  modules={modules}
                  item={item}
                  onSave={async (form) => { await onUpdateItem(item.id, form); setEditingItem(null) }}
                  onCancel={() => setEditingItem(null)}
                />
              ) : (
                <div
                  draggable
                  onDragStart={() => setDraggingItem(item.id)}
                  onDragEnd={() => setDraggingItem(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleItemDrop(item.id)}
                  className={`flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2 transition-opacity ${draggingItem === item.id ? 'opacity-40' : ''} ${!item.isVisible ? 'opacity-50' : ''}`}
                >
                  <span className="cursor-grab text-foreground-subtle"><GripVerticalIcon className="h-4 w-4" /></span>
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-bold"
                    style={{ background: item.color }}
                  >
                    {item.icon.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="type-body truncate">{item.title}</span>
                      {item.isPopular && <StarIcon className="h-3 w-3 fill-warning text-warning" />}
                      {item.badgeText && (
                        <Badge tone={(item.badgeTone as 'danger' | 'warning' | 'success' | 'info' | 'primary' | 'neutral') || 'neutral'}>
                          {item.badgeText}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <title className="sr-only">Görünürlük</title>
                      <MonitorIcon
                        className="h-3 w-3"
                        style={{ color: item.showInSidebar ? 'hsl(var(--success))' : 'hsl(var(--foreground-subtle))' }}
                      />
                      <SmartphoneIcon
                        className="h-3 w-3"
                        style={{ color: item.showInMobile ? 'hsl(var(--success))' : 'hsl(var(--foreground-subtle))' }}
                      />
                      <LinkIcon className="h-3 w-3 text-foreground-subtle" />
                      <span className="type-caption font-mono truncate">{item.linkTarget}</span>
                      {item.mobileLinkTarget && item.mobileLinkTarget !== item.linkTarget && (
                        <span className="type-caption font-mono text-foreground-muted truncate">
                          · 📱 {item.mobileLinkTarget}
                        </span>
                      )}
                      {item.moduleKey && <Badge tone="info">{item.moduleKey}</Badge>}
                    </div>
                  </div>
                  <IconButton tone="default" title="Düzenle" onClick={() => setEditingItem(item.id)}>
                    <PencilIcon className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    tone="default"
                    title={item.isVisible ? 'Gizle' : 'Göster'}
                    onClick={async () => {
                      await onUpdateItem(item.id, {
                        sectionId: item.sectionId,
                        moduleKey: item.moduleKey ?? '',
                        title: item.title, icon: item.icon,
                        iconType: item.iconType, color: item.color,
                        linkType: item.linkType, linkTarget: item.linkTarget,
                        mobileLinkTarget: item.mobileLinkTarget ?? '',
                        showInSidebar: item.showInSidebar,
                        showInMobile: item.showInMobile,
                        isPopular: item.isPopular, isVisible: !item.isVisible,
                        requiresAuth: item.requiresAuth,
                        badgeText: item.badgeText ?? '', badgeTone: item.badgeTone ?? '',
                      })
                    }}
                  >
                    {item.isVisible ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5 text-danger" />}
                  </IconButton>
                  <IconButton tone="danger" title="Sil" onClick={() => onDeleteItem(item)}>
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              )}
            </div>
          ))}

          {addingItem ? (
            <ItemForm
              sectionId={section.id}
              modules={modules}
              onSave={async (form) => { await onAddItem(section.id, form); setAddingItem(false) }}
              onCancel={() => setAddingItem(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingItem(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 type-caption text-foreground-muted hover:border-primary hover:text-primary transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Öğe ekle
            </button>
          )}
        </div>
      )}
    </div>
  )
}


const SectionsPanel = ({ modules }: { modules: SystemModule[] }) => {
  const [sections, setSections] = useState<MenuSection[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingSection, setDraggingSection] = useState<string | null>(null)
  const [addingSection, setAddingSection] = useState(false)
  const [newSection, setNewSection] = useState<CreateMenuSectionForm>({ key: '', title: '', icon: 'Layers', isVisible: true, showInSidebar: true, showInMobile: true })
  const [deleteTarget, setDeleteTarget] = useState<MenuSection | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<MenuItem | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try { setSections(await appMenuService.getSections()) }
    catch { } finally { setLoading(false) }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const handleSectionDrop = async (targetId: string) => {
    if (!draggingSection || draggingSection === targetId) return
    const arr = [...sections]
    const from = arr.findIndex((s) => s.id === draggingSection)
    const to = arr.findIndex((s) => s.id === targetId)
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    setSections(arr)
    setDraggingSection(null)
    await appMenuService.reorderSections(arr.map((s) => s.id))
  }

  const handleCreateSection = async () => {
    if (!newSection.key.trim() || !newSection.title.trim()) { toast.warning('Anahtar ve başlık zorunludur.'); return }
    await appMenuService.createSection(newSection)
    toast.success('Bölüm eklendi.')
    setAddingSection(false)
    setNewSection({ key: '', title: '', icon: 'Layers', isVisible: true, showInSidebar: true, showInMobile: true })
    void reload()
  }

  const handleUpdateSection = async (id: string, form: UpdateMenuSectionForm) => {
    await appMenuService.updateSection(id, form)
    toast.success('Bölüm güncellendi.')
    void reload()
  }

  const handleAddItem = async (sectionId: string, form: MenuItemForm) => {
    await appMenuService.createItem({ ...form, sectionId })
    toast.success('Öğe eklendi.')
    void reload()
  }

  const handleUpdateItem = async (id: string, form: MenuItemForm) => {
    await appMenuService.updateItem(id, form)
    toast.success('Öğe güncellendi.')
    void reload()
  }

  const handleDragItem = async (sectionId: string, orderedIds: string[]) => {
    await appMenuService.reorderItems(sectionId, orderedIds)
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>

  return (
    <div className="space-y-3">
      <p className="type-muted">
        Tüm menü öğelerini buradan yönetin. Her öğe için <strong>Vatandaş Portalı'nda göster</strong> (web sol menüsü) ve <strong>Mobil Menü'de göster</strong> (mobil alt sekme barı) seçenekleri ayrı ayrı ayarlanabilir.
      </p>

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          iconLeft={<PlusIcon className="h-4 w-4" />}
          onClick={() => setAddingSection(true)}
        >
          Bölüm Ekle
        </Button>
      </div>

      {addingSection && (
        <div className="rounded-card border border-primary/30 bg-primary-soft/20 p-4 space-y-3">
          <p className="type-body-strong">Yeni Bölüm</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Başlık" required>
              <Input
                value={newSection.title}
                onChange={(e) => {
                  const title = e.target.value
                  setNewSection(p => ({
                    ...p, title,
                    key: p.key || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                  }))
                }}
                placeholder="Ulaşım"
              />
            </Field>
            <Field label="Anahtar (key)">
              <Input
                value={newSection.key}
                onChange={(e) => setNewSection(p => ({ ...p, key: e.target.value }))}
                className="font-mono"
                placeholder="ulasim"
              />
            </Field>
            <Field label="İkon">
              <Input
                value={newSection.icon}
                onChange={(e) => setNewSection(p => ({ ...p, icon: e.target.value }))}
                placeholder="Bus"
              />
            </Field>
          </div>
          <ToggleRow label="Görünür" checked={newSection.isVisible} onChange={(v) => setNewSection(p => ({ ...p, isVisible: v }))} />
          <ToggleRow label="Vatandaş Portalı'nda göster" checked={newSection.showInSidebar} onChange={(v) => setNewSection(p => ({ ...p, showInSidebar: v }))} />
          <ToggleRow label="Mobil Menü'de göster" checked={newSection.showInMobile} onChange={(v) => setNewSection(p => ({ ...p, showInMobile: v }))} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddingSection(false)}>İptal</Button>
            <Button variant="primary" size="sm" onClick={handleCreateSection}>Oluştur</Button>
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <EmptyState icon={LayoutGridIcon} title="Bölüm yok" description="Henüz menü bölümü oluşturulmamış." />
      ) : (
        sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            modules={modules}
            draggingSection={draggingSection}
            onDragStartSection={setDraggingSection}
            onDragEndSection={() => setDraggingSection(null)}
            onDropSection={handleSectionDrop}
            onUpdate={handleUpdateSection}
            onDelete={setDeleteTarget}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={setDeleteItemTarget}
            onDragItem={handleDragItem}
          />
        ))
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Bölümü sil"
        description={`"${deleteTarget?.title}" bölümü ve içindeki tüm öğeler silinsin mi?`}
        confirmLabel="Sil"
        tone="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await appMenuService.deleteSection(deleteTarget.id)
          toast.success('Bölüm silindi.')
          setDeleteTarget(null)
          void reload()
        }}
      />

      <ConfirmModal
        open={!!deleteItemTarget}
        title="Öğeyi sil"
        description={`"${deleteItemTarget?.title}" silinsin mi?`}
        confirmLabel="Sil"
        tone="danger"
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={async () => {
          if (!deleteItemTarget) return
          await appMenuService.deleteItem(deleteItemTarget.id)
          toast.success('Öğe silindi.')
          setDeleteItemTarget(null)
          void reload()
        }}
      />
    </div>
  )
}


export const MenuManagementTab = () => {
  const [panel, setPanel] = useState<'modules' | 'sections'>('modules')
  const [modules, setModules] = useState<SystemModule[]>([])

  useEffect(() => {
    appMenuService.getModules().then(setModules).catch(() => {})
  }, [])

  return (
    <div className="max-w-4xl space-y-5">
      <FormSection
        variant="card"
        icon={LayoutGridIcon}
        title="Menü Yönetimi"
        action={
          <SegmentedControl
            value={panel}
            onChange={(v) => setPanel(v as 'modules' | 'sections')}
            options={SECTION_TABS}
            columns={2}
            className="w-72"
          />
        }
      >
        {panel === 'modules'
          ? <ModulesPanel />
          : <SectionsPanel modules={modules} />}
      </FormSection>
    </div>
  )
}

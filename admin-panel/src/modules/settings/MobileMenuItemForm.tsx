import { useState, useEffect, useRef } from 'react'
import { LayoutGridIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Drawer } from '@/design-system/Drawer'
import { Field, ToggleRow } from '@/design-system'
import { Input } from '@/design-system'
import { Select } from '@/design-system'
import { Button } from '@/design-system'
import { ColorSwatchPicker } from '@/design-system'
import mobileMenuService from '@/services/mobileMenu.service'
import type {
  MobileMenuItem, MobileMenuItemFormData, MobileMenuGroup,
  MenuIconType, MenuLinkType,
} from '@/types/mobileMenu.types'

interface Props {
  open: boolean
  onClose: () => void
  item: MobileMenuItem | null
  groups: MobileMenuGroup[]
  onSaved: () => void
  fixedGroup?: { groupKey: string; groupTitle: string }
  activationBlocked?: boolean
  defaultVisible?: boolean
}

const EMPTY: MobileMenuItemFormData = {
  title: '', icon: 'Palette', iconType: 'Lucide', color: '#1486C9',
  colorSecondary: null, description: null,
  linkType: 'Module', linkTarget: '', groupKey: '', groupTitle: '',
  isPopular: false, isVisible: true, requiresAuth: false,
}

export const MobileMenuItemForm = ({ open, onClose, item, groups, onSaved, fixedGroup, activationBlocked = false, defaultVisible = true }: Props) => {
  const [form, setForm] = useState<MobileMenuItemFormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [newGroup, setNewGroup] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title, icon: item.icon, iconType: item.iconType, color: item.color,
        colorSecondary: item.colorSecondary, description: item.description,
        linkType: item.linkType, linkTarget: item.linkTarget,
        groupKey: item.groupKey, groupTitle: item.groupTitle,
        isPopular: item.isPopular, isVisible: item.isVisible, requiresAuth: item.requiresAuth,
      })
    } else {
      setForm(fixedGroup ? { ...EMPTY, ...fixedGroup, isVisible: defaultVisible } : EMPTY)
    }
    setNewGroup(false)
  }, [item, open, fixedGroup, defaultVisible])

  const set = <K extends keyof MobileMenuItemFormData>(k: K, v: MobileMenuItemFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const handleIconUpload = async (file: File) => {
    try {
      const { url } = await mobileMenuService.uploadImage(file)
      setForm((p) => ({ ...p, icon: url, iconType: 'Image' as MenuIconType }))
      toast.success('İkon yüklendi.')
    } catch { }
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.warning('Başlık zorunludur.'); return }
    if (!form.linkTarget.trim()) { toast.warning('Link hedefi zorunludur.'); return }
    if (!form.groupKey.trim() || !form.groupTitle.trim()) { toast.warning('Grup seçimi zorunludur.'); return }
    if (!fixedGroup && form.groupKey.trim().toLowerCase() === 'features') {
      toast.warning('Ana sayfa kartlarını Mobil Uygulama Ayarları ekranından yönetin.')
      return
    }
    if (form.isVisible && activationBlocked && !item?.isVisible) {
      toast.warning('Ana sayfada en fazla 4 kart yayınlanabilir.')
      return
    }
    setSaving(true)
    try {
      if (item) await mobileMenuService.updateItem(item.id, form)
      else await mobileMenuService.createItem(form)
      toast.success(item ? 'Öğe güncellendi.' : 'Öğe eklendi.')
      onSaved()
      onClose()
    } catch { } finally { setSaving(false) }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? 'Menü Öğesini Düzenle' : 'Menü Öğesi Ekle'}
      subtitle="İkon, etiket, link ve grubu belirleyin"
      icon={LayoutGridIcon}
      width={520}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            İptal
          </Button>
          <Button variant="primary" className="flex-1" isLoading={saving} onClick={handleSubmit}>
            {item ? 'Güncelle' : 'Ekle'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-1">

        <Field label="Başlık" required>
          <Input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ör. Etkinlikler"
          />
        </Field>

        <Field label="Açıklama" hint="Başlığın altında görünen kısa satır. Boş bırakılırsa yalnızca başlık gösterilir.">
          <Input
            value={form.description ?? ''}
            maxLength={200}
            onChange={(e) => set('description', e.target.value || null)}
            placeholder="Ör. Tüm Etkinlikleri Keşfedin"
          />
        </Field>

        <Field label="İkon">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
              {form.iconType === 'Image'
                ? <img src={form.icon} alt="" className="h-6 w-6 object-contain" />
                : <span className="truncate px-1 text-[10px] font-mono text-[hsl(var(--foreground-muted))]">{form.icon}</span>}
            </div>
            <Input
              value={form.iconType === 'Lucide' ? form.icon : ''}
              disabled={form.iconType === 'Image'}
              onChange={(e) => set('icon', e.target.value)}
              placeholder="Lucide ikon adı (ör. CalendarDays)"
              className="flex-1"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIconUpload(f) }}
            />
            <Button
              variant="outline"
              size="sm"
              iconLeft={<UploadIcon className="h-4 w-4" />}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Görsel
            </Button>
          </div>
          {form.iconType === 'Image' && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              type="button"
              onClick={() => set('iconType', 'Lucide' as MenuIconType)}
            >
              Lucide ikona dön
            </Button>
          )}
        </Field>

        <Field label="Renk">
          <ColorSwatchPicker
            value={form.color}
            onChange={(hex) => set('color', hex)}
          />
        </Field>

        <Field label="Degrade ikinci rengi" hint="Kart soldan sağa bu renge geçer. Kapalıyken kart tek düz renk olur.">
          <div className="space-y-2">
            <ToggleRow
              label="Degrade kullan"
              checked={form.colorSecondary !== null}
              onChange={(v) => set('colorSecondary', v ? form.color : null)}
            />
            {form.colorSecondary !== null && (
              <ColorSwatchPicker
                value={form.colorSecondary}
                onChange={(hex) => set('colorSecondary', hex)}
              />
            )}
          </div>
        </Field>

        <Field label="Önizleme">
          <div
            className="flex h-[88px] items-center gap-3 rounded-lg px-3"
            style={{backgroundImage: `linear-gradient(90deg, ${form.color}, ${form.colorSecondary ?? form.color})`}}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              {form.iconType === 'Image'
                ? <img src={form.icon} alt="" className="h-8 w-8 object-contain" />
                : <span className="type-caption font-mono text-white/90">{form.icon}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="type-body-strong truncate text-white">{form.title || 'Başlık'}</p>
              {form.description && (
                <p className="type-caption mt-0.5 line-clamp-2 text-white/90">{form.description}</p>
              )}
            </div>
          </div>
        </Field>

        <Field label="Link Tipi">
          <Select
            value={form.linkType}
            onChange={(e) => set('linkType', e.target.value as MenuLinkType)}
          >
            <option value="Module">Modül (uygulama içi sayfa)</option>
            <option value="WebView">WebView (uygulama içi web)</option>
            <option value="ExternalUrl">Dış URL (tarayıcı)</option>
          </Select>
        </Field>

        <Field label={form.linkType === 'Module' ? 'Sayfa yolu (ör. /etkinlikler)' : 'URL (https://…)'}>
          <Input
            value={form.linkTarget}
            onChange={(e) => set('linkTarget', e.target.value)}
            placeholder={form.linkType === 'Module' ? '/etkinlikler' : 'https://example.com'}
          />
        </Field>

        {!fixedGroup && <Field label="Grup">
          {!newGroup ? (
            <div className="flex gap-2">
              <Select
                value={form.groupKey}
                onChange={(e) => {
                  const g = groups.find((x) => x.groupKey === e.target.value)
                  set('groupKey', e.target.value)
                  set('groupTitle', g?.groupTitle ?? '')
                }}
                placeholder="Grup seçin"
                className="flex-1"
              >
                {groups.map((g) => (
                  <option key={g.groupKey} value={g.groupKey}>{g.groupTitle}</option>
                ))}
              </Select>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => { setNewGroup(true); set('groupKey', ''); set('groupTitle', '') }}
              >
                + Yeni
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={form.groupTitle}
                onChange={(e) => {
                  set('groupTitle', e.target.value)
                  set('groupKey', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
                }}
                placeholder="Grup adı (ör. Şehir Hizmetleri)"
              />
              <Input
                value={form.groupKey}
                onChange={(e) => set('groupKey', e.target.value)}
                className="font-mono"
                placeholder="anahtar (otomatik)"
              />
            </div>
          )}
        </Field>}

        <div className="space-y-2">
          <ToggleRow
            label="Popüler / Öne çıkan"
            checked={form.isPopular}
            onChange={(v) => set('isPopular', v)}
          />
          <ToggleRow
            label="Yayında (görünür)"
            checked={form.isVisible}
            disabled={activationBlocked && !item?.isVisible}
            onChange={(v) => set('isVisible', v)}
          />
          <ToggleRow
            label="Sadece giriş yapmış kullanıcıya göster"
            checked={form.requiresAuth}
            onChange={(v) => set('requiresAuth', v)}
          />
        </div>

      </div>
    </Drawer>
  )
}

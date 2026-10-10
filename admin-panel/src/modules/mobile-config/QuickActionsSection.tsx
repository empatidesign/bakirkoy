import { useEffect, useState } from 'react'
import {
  GripVerticalIcon, PlusIcon, Trash2Icon, PencilIcon, ChevronUpIcon, ChevronDownIcon, ZapIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Button, IconButton, Input, Field, FormSection, ToggleRow, Select,
  ColorSwatchPicker, isHexColor, Drawer, ConfirmModal, Badge, SkeletonRows, EmptyState, Banner,
} from '@/design-system'
import {
  mobileQuickActionService,
  type MobileQuickAction,
  type MobileQuickActionTarget,
  type SaveMobileQuickActionRequest,
} from '@/services/mobileConfig.service'

const ICON_NAMES = [
  'Siren', 'Pill', 'Landmark', 'Clock', 'MessageSquare', 'FileText', 'Building2', 'Calendar',
  'Megaphone', 'LayoutGrid', 'MapPin', 'Award', 'Ticket', 'Phone', 'PhoneCall', 'Search',
  'Globe', 'QrCode', 'Wallet', 'Heart', 'Bus', 'BookOpen', 'Users', 'Trophy', 'Sparkles',
]

const EMPTY_FORM: SaveMobileQuickActionRequest = {
  target: '',
  label: '',
  icon: 'Sparkles',
  color: '#2563eb',
  isActive: true,
  requiresAuth: false,
  targetUrl: null,
}

const toForm = (row: MobileQuickAction): SaveMobileQuickActionRequest => ({
  target: row.target,
  label: row.label,
  icon: row.icon,
  color: row.color,
  isActive: row.isActive,
  requiresAuth: row.requiresAuth,
  targetUrl: row.targetUrl,
})

export const QuickActionsSection = () => {
  const [rows, setRows] = useState<MobileQuickAction[]>([])
  const [targets, setTargets] = useState<MobileQuickActionTarget[]>([])
  const [maxActive, setMaxActive] = useState(12)
  const [appScreens, setAppScreens] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<MobileQuickAction | null>(null)
  const [form, setForm] = useState<SaveMobileQuickActionRequest>(EMPTY_FORM)
  const [deleting, setDeleting] = useState<MobileQuickAction | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const [list, targetInfo] = await Promise.all([
          mobileQuickActionService.list(),
          mobileQuickActionService.targets(),
        ])
        if (!active) return
        setRows(list)
        setTargets(targetInfo.targets)
        setMaxActive(targetInfo.maxActiveCount)
        setAppScreens(targetInfo.appScreens)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const selectedTarget = targets.find(t => t.target === form.target)
  const needsUrl = selectedTarget?.requiresUrl ?? false

  const isManualScreen = form.target === 'screen'
  const screenName = form.targetUrl?.trim() ?? ''
  const screenNameValid = /^[A-Za-z][A-Za-z0-9_]*$/.test(screenName)
  const screenUnknown = isManualScreen && screenNameValid && !appScreens.includes(screenName)

  const activeCount = rows.filter(r => r.isActive).length
  const limitReached = activeCount >= maxActive
  const wasActive = editing?.isActive ?? false
  const activateBlocked = limitReached && !wasActive

  const isValid =
    !(form.isActive && activateBlocked) &&
    !!form.target &&
    !!form.label.trim() &&
    !!form.icon &&
    isHexColor(form.color) &&
    (!needsUrl || !!form.targetUrl?.trim()) &&
    (!isManualScreen || screenNameValid)

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, isActive: !limitReached })
    setDrawerOpen(true)
  }

  const openEdit = (row: MobileQuickAction) => {
    setEditing(row)
    setForm(toForm(row))
    setDrawerOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload: SaveMobileQuickActionRequest = {
        ...form,
        label: form.label.trim(),
        targetUrl: needsUrl ? (form.targetUrl?.trim() ?? null) : null,
      }
      if (editing) {
        const updated = await mobileQuickActionService.update(editing.id, payload)
        setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)))
        toast.success('Kart güncellendi.')
      } else {
        const created = await mobileQuickActionService.create(payload)
        setRows(prev => [...prev, created])
        toast.success('Kart eklendi.')
      }
      setDrawerOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    await mobileQuickActionService.remove(deleting.id)
    setRows(prev => prev.filter(r => r.id !== deleting.id))
    setDeleting(null)
    toast.success('Kart silindi.')
  }

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...rows]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setRows(next)
    setReordering(true)
    try {
      const saved = await mobileQuickActionService.reorder(next.map(r => r.id))
      setRows(saved)
    } finally {
      setReordering(false)
    }
  }

  return (
    <FormSection
      icon={ZapIcon}
      title="Hızlı İşlem Kartları"
      subtitle="Mobil uygulamada alt menünün ortasındaki butona basınca açılan kartlar. Sıra, içerik ve yönlendirme buradan yönetilir."
      action={
        <Button
          onClick={openCreate}
          disabled={limitReached}
          title={limitReached ? `En fazla ${maxActive} kart aktif olabilir.` : undefined}
          iconLeft={<PlusIcon className="h-4 w-4" />}
        >
          Kart Ekle
        </Button>
      }
    >
      {loading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ZapIcon}
          title="Henüz kart yok"
          description="Mobil uygulamadaki hızlı işlem menüsü için ilk kartı ekleyin."
        />
      ) : (
        <div className="space-y-3">
          <p className="type-muted">
            Uygulamada en fazla {maxActive} kart gösterilir. Şu an {activeCount}/{maxActive} kart aktif.
            {limitReached && ' Yeni kart eklemek için önce bir kartı pasife alın.'}
          </p>

          <div className="space-y-2">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-card border border-border bg-surface-0 p-3"
              >
                <GripVerticalIcon className="h-4 w-4 shrink-0 text-foreground-subtle" />

                <span
                  className="h-9 w-9 shrink-0 rounded-field border border-border"
                  style={{ backgroundColor: row.color }}
                />

                <div className="min-w-0 flex-1">
                  <p className="type-body-strong truncate">{row.label.replace('\n', ' ')}</p>
                  <p className="type-caption truncate">
                    {targets.find(t => t.target === row.target)?.displayName ?? row.target}
                    {row.targetUrl ? ` · ${row.targetUrl}` : ''}
                  </p>
                </div>

                {row.requiresAuth && <Badge tone="info">Giriş gerekli</Badge>}
                <Badge tone={row.isActive ? 'success' : 'neutral'}>
                  {row.isActive ? 'Aktif' : 'Pasif'}
                </Badge>

                <IconButton
                  tone="default"
                  title="Yukarı taşı"
                  disabled={index === 0 || reordering}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  tone="default"
                  title="Aşağı taşı"
                  disabled={index === rows.length - 1 || reordering}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </IconButton>
                <IconButton tone="primary" title="Düzenle" onClick={() => openEdit(row)}>
                  <PencilIcon className="h-4 w-4" />
                </IconButton>
                <IconButton tone="danger" title="Sil" onClick={() => setDeleting(row)}>
                  <Trash2Icon className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Kartı Düzenle' : 'Yeni Kart'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Vazgeç</Button>
            <Button onClick={save} disabled={!isValid} isLoading={saving}>Kaydet</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Yönlendirme" required hint="Karta dokunulduğunda açılacak ekran.">
            <Select
              searchable
              searchPlaceholder="Hedef ara..."
              value={form.target}
              onChange={e => setForm(p => ({ ...p, target: e.target.value }))}
            >
              <option value="">Hedef seçin</option>
              {targets.map(t => (
                <option key={t.target} value={t.target}>{t.displayName}</option>
              ))}
            </Select>
          </Field>

          {isManualScreen && (
            <Field
              label="Ekran Adı"
              required
              hint="Uygulamadaki ekranın adı. Listeden seçebilir veya elle yazabilirsiniz."
              error={
                screenName && !screenNameValid
                  ? 'Ekran adı harfle başlamalı; yalnızca harf, rakam ve alt çizgi içerebilir.'
                  : undefined
              }
            >
              <div className="space-y-2">
                <Input
                  value={form.targetUrl ?? ''}
                  onChange={e => setForm(p => ({ ...p, targetUrl: e.target.value }))}
                  placeholder="Pharmacy"
                  className="font-mono"
                />
                <Select
                  searchable
                  searchPlaceholder="Ekran ara..."
                  value=""
                  onChange={e => {
                    if (e.target.value) setForm(p => ({ ...p, targetUrl: e.target.value }))
                  }}
                >
                  <option value="">Bilinen ekranlardan seç ({appScreens.length})</option>
                  {appScreens.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </Select>
                {screenUnknown && (
                  <Banner tone="warning">
                    "{screenName}" bilinen ekranlar arasında yok. Uygulamada böyle bir ekran
                    gerçekten varsa sorun değil; yoksa karta dokunulduğunda hiçbir şey olmaz.
                  </Banner>
                )}
              </div>
            </Field>
          )}

          {needsUrl && !isManualScreen && (
            <Field
              label={form.target === 'phone' ? 'Telefon Numarası' : 'Web Adresi'}
              required
              hint={form.target === 'phone' ? 'Örn: 4442332' : 'https:// ile başlamalıdır.'}
            >
              <Input
                value={form.targetUrl ?? ''}
                onChange={e => setForm(p => ({ ...p, targetUrl: e.target.value }))}
                placeholder={form.target === 'phone' ? '4442332' : 'https://ornek.bel.tr'}
              />
            </Field>
          )}

          <Field label="Kart Başlığı" required hint="Uzun başlıkları bölmek için iki satır kullanabilirsiniz.">
            <Input
              value={form.label}
              onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              placeholder="Nöbetçi Eczane"
            />
          </Field>

          <Field label="İkon" required>
            <Select
              searchable
              searchPlaceholder="İkon ara..."
              value={form.icon}
              onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
            >
              {ICON_NAMES.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Renk" required hint="Kartın zemin ve kenar tonları bu renkten üretilir.">
            <ColorSwatchPicker
              value={form.color}
              onChange={color => setForm(p => ({ ...p, color }))}
            />
          </Field>

          <ToggleRow
            label="Aktif"
            description={
              activateBlocked
                ? `En fazla ${maxActive} kart aktif olabilir. Bu kartı aktif etmek için önce başka bir kartı pasife alın.`
                : 'Pasif kartlar uygulamada görünmez.'
            }
            checked={form.isActive}
            disabled={activateBlocked}
            onChange={checked => setForm(p => ({ ...p, isActive: checked }))}
          />

          <ToggleRow
            label="Giriş yapan kullanıcıya özel"
            description="Açıkken kart yalnızca giriş yapmış kullanıcılara gösterilir."
            checked={form.requiresAuth}
            onChange={checked => setForm(p => ({ ...p, requiresAuth: checked }))}
          />
        </div>
      </Drawer>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        tone="danger"
        title="Kartı sil"
        description={`"${deleting?.label.replace('\n', ' ')}" kartı mobil uygulamadaki hızlı işlemler menüsünden kaldırılacak.`}
      />
    </FormSection>
  )
}

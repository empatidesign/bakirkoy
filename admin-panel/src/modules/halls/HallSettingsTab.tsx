import { useEffect, useState, type ReactNode } from 'react'
import {
  SettingsIcon, UsersIcon, CalendarCheckIcon,
  ShieldCheckIcon, BookOpenIcon, PlusIcon, Trash2Icon,
  SaveIcon, CheckIcon, InfoIcon, AlertCircleIcon, type LucideIcon,
} from 'lucide-react'
import { safeUuid } from '@/lib/utils'
import { SectionToolbar, NumberInput, Select, Switch, Button, Banner } from '@/design-system'

export interface HallSettings {
  general: {
    maxCapacity: number
    advanceBookingDays: number
    cancellationDeadlineDays: number
    requireApproval: boolean
    reserveListEnabled: boolean
  }
  usage: {
    defaultPeriod: 'none' | 'weekly' | 'monthly' | 'yearly'
    defaultLimitCount: number
  }
  restrictions: Array<{ id: string; description: string; active: boolean }>
  rules: Array<{ id: string; title: string; content: string; active: boolean }>
}

const DEFAULT_SETTINGS: HallSettings = {
  general: { maxCapacity: 500, advanceBookingDays: 7, cancellationDeadlineDays: 3, requireApproval: true, reserveListEnabled: true },
  usage: { defaultPeriod: 'none', defaultLimitCount: 1 },
  restrictions: [],
  rules: [],
}

const STORAGE_KEY = 'hall_settings'
const load = (): HallSettings => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}
const save = (s: HallSettings): HallSettings => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  return s
}

const USAGE_PERIOD_OPTIONS = [
  { value: 'none', label: 'Sınırsız' },
  { value: 'weekly', label: 'Haftada' },
  { value: 'monthly', label: 'Ayda' },
  { value: 'yearly', label: 'Yılda' },
]

interface CardSectionProps {
  icon: LucideIcon
  title: string
  subtitle: string
  accent: string
  accentBg: string
  children: ReactNode
}

const CardSection = ({ icon: Icon, title, subtitle, accent, accentBg, children }: CardSectionProps) => (
  <div className="rounded-xl border border-[hsl(var(--border))] bg-card overflow-hidden shadow-sm">
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[hsl(var(--border))]" style={{ background: accentBg }}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: accent + '20' }}>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: accent }}>{title}</p>
        <p className="text-[11px] text-[hsl(var(--foreground-muted))]">{subtitle}</p>
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
)

interface ToggleItemProps { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; accent: string }
const ToggleItem = ({ label, desc, checked, onChange, accent }: ToggleItemProps) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3.5">
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="h-2 w-2 rounded-full shrink-0 transition-colors"
        style={{ background: checked ? accent : '#d1d5db' }}
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[hsl(var(--foreground-strong))]">{label}</p>
        <p className="text-[11px] text-[hsl(var(--foreground-muted))] mt-0.5">{desc}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
)

interface FieldProps { label: string; hint?: string; children: ReactNode; className?: string }
const F = ({ label, hint, children, className }: FieldProps) => (
  <div className={className}>
    <label className="block text-[12px] font-semibold text-[hsl(var(--foreground-default))] mb-1.5 uppercase tracking-wide">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-[hsl(var(--foreground-muted))]">{hint}</p>}
  </div>
)

export const HallSettingsTab = () => {
  const [settings, setSettings] = useState<HallSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(load())
    setLoading(false)
  }, [])

  const patch = (p: Partial<HallSettings>) => setSettings((prev) => ({ ...prev, ...p }))
  const pG = (p: Partial<HallSettings['general']>) => patch({ general: { ...settings.general, ...p } })
  const pU = (p: Partial<HallSettings['usage']>) => patch({ usage: { ...settings.usage, ...p } })

  const addRestriction = () => patch({ restrictions: [...settings.restrictions, { id: safeUuid(), description: '', active: true }] })
  const updateRestriction = (id: string, desc: string) => patch({ restrictions: settings.restrictions.map((r) => r.id === id ? { ...r, description: desc } : r) })
  const toggleRestriction = (id: string) => patch({ restrictions: settings.restrictions.map((r) => r.id === id ? { ...r, active: !r.active } : r) })
  const removeRestriction = (id: string) => patch({ restrictions: settings.restrictions.filter((r) => r.id !== id) })
  const addRule = () => patch({ rules: [...settings.rules, { id: safeUuid(), title: '', content: '', active: true }] })
  const updateRule = (id: string, key: 'title' | 'content', val: string) => patch({ rules: settings.rules.map((r) => r.id === id ? { ...r, [key]: val } : r) })
  const removeRule = (id: string) => patch({ rules: settings.rules.filter((r) => r.id !== id) })

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = save(settings)
      setSettings(r)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-[hsl(var(--foreground-muted))]">
        <div className="h-8 w-8 rounded-full animate-spin" style={{ border: '2px solid hsl(var(--primary))', borderTopColor: 'transparent' }} />
        <span className="text-[13px]">Ayarlar yükleniyor…</span>
      </div>
    )
  }

  const hasUsageRule = settings.usage.defaultPeriod !== 'none'
  const periodLabel = USAGE_PERIOD_OPTIONS.find((o) => o.value === settings.usage.defaultPeriod)?.label ?? ''

  return (
    <div className="space-y-4 pb-10">
      <Banner tone="warning" icon={AlertCircleIcon}>
        <span className="font-semibold">Bu ayarlar henüz sunucuya kaydedilmiyor.</span>{' '}
        Girilen değerler yalnızca bu tarayıcıda saklanır; başka bir bilgisayardan giriş yapıldığında
        görünmez ve vatandaş portalındaki davranışı etkilemez.
      </Banner>

      <SectionToolbar
        icon={SettingsIcon}
        title="Salon Genel Ayarları"
        subtitle="Tüm salonlara varsayılan olarak uygulanır — salona özel ayar bu değerleri geçersiz kılar"
        actions={
          <Button
            variant={saved ? 'success' : 'primary'}
            size="sm"
            iconLeft={saved ? <CheckIcon className="h-4 w-4" /> : <SaveIcon className="h-4 w-4" />}
            isLoading={saving}
            onClick={handleSave}
          >
            {saved ? 'Bu tarayıcıya kaydedildi' : 'Kaydet'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4">

        <CardSection
          icon={UsersIcon}
          title="Genel Ayarlar"
          subtitle="Kapasite limitleri ve rezervasyon penceresi"
          accent="#0f4c81"
          accentBg="#eef3f8"
        >
          <div className="grid grid-cols-2 gap-4">
            <F label="Maks. Kapasite Limiti" hint="Salona alınabilecek maksimum kişi sayısı">
              <NumberInput value={settings.general.maxCapacity} onChange={(n) => pG({ maxCapacity: n })} min={1} max={100000} suffix="kişi" />
            </F>
            <F label="Önceden Rezervasyon Süresi" hint="Etkinlikten kaç gün önce rezervasyon açılır">
              <NumberInput value={settings.general.advanceBookingDays} onChange={(n) => pG({ advanceBookingDays: n })} min={0} max={365} suffix="gün" />
            </F>
            <F label="İptal Süresi" hint="Etkinlikten kaç gün önce iptal kabul edilir" className="col-span-2">
              <div className="w-40">
                <NumberInput value={settings.general.cancellationDeadlineDays} onChange={(n) => pG({ cancellationDeadlineDays: n })} min={0} max={365} suffix="gün" />
              </div>
            </F>
          </div>
          <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] overflow-hidden divide-y divide-[hsl(var(--border))] bg-card">
            <ToggleItem label="Onay Gerekli" desc="Rezervasyonlar admin onayına düşer, otomatik onaylanmaz" checked={settings.general.requireApproval} onChange={(v) => pG({ requireApproval: v })} accent="#0f4c81" />
            <ToggleItem label="Yedek Liste" desc="Kapasite dolduğunda başvurular yedek sıraya alınır" checked={settings.general.reserveListEnabled} onChange={(v) => pG({ reserveListEnabled: v })} accent="#0f4c81" />
          </div>
        </CardSection>

        <CardSection
          icon={CalendarCheckIcon}
          title="Kullanım Politikası"
          subtitle="Salon kullanım sıklığı ve dönem politikası"
          accent="#5a8a2a"
          accentBg="#f1f7e8"
        >
          <div className="mb-4 rounded-xl border border-[#5a8a2a]/20 bg-[#f1f7e8] p-4 space-y-2">
            {[
              'Bu limit, salona özel ayar yoksa tüm salonlara otomatik uygulanır.',
              'Bir üye aynı anda yalnızca 1 aktif salon rezervasyonuna sahip olabilir.',
              'Daha önce aynı salonu kullanan üye tekrar başvurabilir (kural yoksa).',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <InfoIcon className="h-3.5 w-3.5 text-[#5a8a2a] mt-0.5 shrink-0" />
                <p className="text-[12px] text-[#3f5d1a] leading-relaxed">{t}</p>
              </div>
            ))}
          </div>

          <F label="Varsayılan Dönem Seçimi">
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  value={settings.usage.defaultPeriod}
                  onChange={(e) => pU({ defaultPeriod: e.target.value as HallSettings['usage']['defaultPeriod'] })}
                >
                  {USAGE_PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              {hasUsageRule && (
                <div className="w-28">
                  <NumberInput value={settings.usage.defaultLimitCount} onChange={(n) => pU({ defaultLimitCount: n })} min={1} suffix="kez" />
                </div>
              )}
            </div>
          </F>

          {hasUsageRule && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3.5 py-2.5">
              <CheckIcon className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <p className="text-[12px] text-green-700">
                Üyeler <strong>{periodLabel.toLowerCase()} en fazla {settings.usage.defaultLimitCount} kez salon rezervasyonu</strong> yapabilir.
              </p>
            </div>
          )}

          {!hasUsageRule && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-[hsl(var(--surface-1))] border border-[hsl(var(--border))] px-3.5 py-2.5">
              <AlertCircleIcon className="h-3.5 w-3.5 text-[hsl(var(--foreground-subtle))] shrink-0" />
              <p className="text-[12px] text-[hsl(var(--foreground-muted))]">Dönem limiti uygulanmıyor — üyeler istedikleri kadar salon rezervasyonu yapabilir.</p>
            </div>
          )}
        </CardSection>

        <CardSection
          icon={ShieldCheckIcon}
          title="Katılım Şartları"
          subtitle="Tüm salonlara otomatik eklenen koşullar"
          accent="#d97706"
          accentBg="#fffbeb"
        >
          {settings.restrictions.length === 0 ? (
            <div className="rounded-xl border-dashed border-[hsl(var(--border))] py-8 text-center mb-3">
              <ShieldCheckIcon className="mx-auto h-7 w-7 text-[hsl(var(--foreground-subtle))] mb-2" />
              <p className="text-[12px] text-[hsl(var(--foreground-muted))]">Henüz katılım şartı eklenmedi</p>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {settings.restrictions.map((r, i) => (
                <div
                  key={r.id}
                  className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${r.active ? 'border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning-soft))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]'}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleRestriction(r.id)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${r.active ? 'bg-[hsl(var(--warning))] text-white' : 'bg-[hsl(var(--surface-1))] text-transparent'}`}
                    style={{ border: r.active ? 'none' : '1.5px solid hsl(var(--border))' }}
                  >
                    <CheckIcon className="h-3 w-3" />
                  </button>
                  <span className="text-[11px] font-bold text-[hsl(var(--foreground-subtle))] w-4 shrink-0">{i + 1}.</span>
                  <input
                    value={r.description}
                    onChange={(e) => updateRestriction(r.id, e.target.value)}
                    placeholder="Katılım şartını yazın…"
                    className={`flex-1 bg-transparent text-[13px] outline-none placeholder:text-[hsl(var(--foreground-subtle))] ${!r.active ? 'line-through text-[hsl(var(--foreground-muted))]' : 'text-[hsl(var(--foreground-strong))]'}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRestriction(r.id)}
                    className="invisible group-hover:visible flex h-6 w-6 items-center justify-center rounded-md hover:bg-[hsl(var(--danger-soft))] hover:text-[hsl(var(--danger))] text-[hsl(var(--foreground-subtle))] transition-colors"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button variant="primary" size="sm" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={addRestriction}>Şart Ekle</Button>
        </CardSection>

        <CardSection
          icon={BookOpenIcon}
          title="Salon Kuralları"
          subtitle="Katılımcılara gösterilecek genel salon bilgilendirme metinleri"
          accent="#0f4c81"
          accentBg="#eef3f8"
        >
          {settings.rules.length === 0 ? (
            <div className="rounded-xl border-dashed border-[hsl(var(--border))] py-8 text-center mb-3">
              <BookOpenIcon className="mx-auto h-7 w-7 text-[hsl(var(--foreground-subtle))] mb-2" />
              <p className="text-[12px] text-[hsl(var(--foreground-muted))]">Henüz kural eklenmedi</p>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {settings.rules.map((r, i) => (
                <div key={r.id} className="group rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--input-bg))]">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-[hsl(var(--input-bg))] border-b border-[hsl(var(--border))]">
                    <span className="text-[11px] font-bold text-[#0f4c81] w-5 shrink-0">{i + 1}.</span>
                    <input
                      value={r.title}
                      onChange={(e) => updateRule(r.id, 'title', e.target.value)}
                      placeholder="Kural başlığı…"
                      className="flex-1 bg-transparent text-[13px] font-semibold text-[hsl(var(--foreground-strong))] outline-none placeholder:font-normal placeholder:text-[hsl(var(--foreground-subtle))]"
                    />
                    <button
                      type="button"
                      onClick={() => removeRule(r.id)}
                      className="invisible group-hover:visible flex h-6 w-6 items-center justify-center rounded-md hover:bg-[hsl(var(--danger-soft))] hover:text-[hsl(var(--danger))] text-[hsl(var(--foreground-subtle))] transition-colors"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={r.content}
                    onChange={(e) => updateRule(r.id, 'content', e.target.value)}
                    placeholder="Kural açıklaması…"
                    rows={3}
                    className="w-full resize-none bg-[hsl(var(--input-bg))] px-3 py-2.5 text-[13px] text-[hsl(var(--foreground-default))] outline-none placeholder:text-[hsl(var(--foreground-subtle))]"
                  />
                </div>
              ))}
            </div>
          )}
          <Button variant="primary" size="sm" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={addRule}>Kural Ekle</Button>
        </CardSection>

      </div>
    </div>
  )
}

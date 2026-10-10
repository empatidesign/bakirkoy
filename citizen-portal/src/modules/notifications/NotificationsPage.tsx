import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BellIcon, BellOffIcon, CheckCheckIcon, CheckIcon,
  CalendarDaysIcon, BusIcon, GraduationCapIcon, BookOpenIcon,
  TagIcon, ClipboardListIcon, InfoIcon, DumbbellIcon, HeartIcon,
  TrophyIcon, UsersIcon, MicIcon, TreePineIcon,
  Building2 as BuildingIcon, Clock as ClockIcon, SettingsIcon,
} from 'lucide-react'
import { ModuleHeader, SkeletonRows } from '@/design-system'
import { formatDate, formatDateTime, localDayIso, todayIso } from '@/lib/utils'
import type { CitizenNotification } from '@/types/notification.types'
import notificationService from '@/services/notification.service'
import { citizenRealtime } from '@/services/citizenRealtime'
import { useNotifications } from '@/framework/notifications/NotificationContext'
import { FACILITY_MODULES } from '@/modules/facilities/facilityModules'

const withAlpha = (hex: string, a: number): string =>
  hex + Math.round(a * 255).toString(16).padStart(2, '0')

const moduleConfig = (n: CitizenNotification): {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  grad: string
  shadow: string
} | null => {
  const hay = `${n.facilityName ?? ''} ${n.title} ${n.body}`.toLocaleLowerCase('tr')
  const mod = FACILITY_MODULES.find(m => hay.includes(m.label.toLocaleLowerCase('tr')))
  if (!mod) return null
  return { Icon: mod.icon, color: mod.color, grad: mod.gradient, shadow: withAlpha(mod.color, 0.35) }
}

const typeConfig = (title: string): {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  grad: string
  shadow: string
} => {
  const t = title.toLowerCase()
  if (t.includes('gezi') || t.includes('seyahat') || t.includes('tur '))
    return { Icon: BusIcon,            color: '#10B981', grad: 'linear-gradient(135deg,#10B981,#059669)', shadow: 'rgba(16,185,129,0.35)' }
  if (t.includes('spor') || t.includes('yüzme') || t.includes('havuz') || t.includes('fitness') || t.includes('voleybol') || t.includes('satranç') || t.includes('turnuva'))
    return { Icon: DumbbellIcon,       color: '#EF4444', grad: 'linear-gradient(135deg,#EF4444,#DC2626)', shadow: 'rgba(239,68,68,0.35)' }
  if (t.includes('sağlık') || t.includes('yoga') || t.includes('meditasyon') || t.includes('beslenme'))
    return { Icon: HeartIcon,          color: '#F43F5E', grad: 'linear-gradient(135deg,#F43F5E,#E11D48)', shadow: 'rgba(244,63,94,0.35)' }
  if (t.includes('kültür') || t.includes('tiyatro') || t.includes('konser') || t.includes('müzik') || t.includes('sanat') || t.includes('sergi'))
    return { Icon: MicIcon,            color: '#EC4899', grad: 'linear-gradient(135deg,#EC4899,#DB2777)', shadow: 'rgba(236,72,153,0.35)' }
  if (t.includes('çevre') || t.includes('park') || t.includes('ağaç') || t.includes('doğa'))
    return { Icon: TreePineIcon,       color: '#16A34A', grad: 'linear-gradient(135deg,#16A34A,#15803D)', shadow: 'rgba(22,163,74,0.35)' }
  if (t.includes('ödül') || t.includes('puan') || t.includes('çark') || t.includes('kazandı'))
    return { Icon: TrophyIcon,         color: '#F59E0B', grad: 'linear-gradient(135deg,#F59E0B,#d97706)', shadow: 'rgba(245,158,11,0.4)' }
  if (t.includes('toplantı') || t.includes('seminer') || t.includes('atölye') || t.includes('workshop'))
    return { Icon: UsersIcon,          color: '#6366F1', grad: 'linear-gradient(135deg,#6366F1,#4F46E5)', shadow: 'rgba(99,102,241,0.35)' }
  if (t.includes('kurs') || t.includes('eğitim') || t.includes('seda') || t.includes('okul') || t.includes('dijital'))
    return { Icon: GraduationCapIcon,  color: '#F59E0B', grad: 'linear-gradient(135deg,#F59E0B,#d97706)', shadow: 'rgba(245,158,11,0.35)' }
  if (t.includes('kıraat') || t.includes('kütüp') || t.includes('kitap'))
    return { Icon: BookOpenIcon,       color: '#8B5CF6', grad: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', shadow: 'rgba(139,92,246,0.35)' }
  if (t.includes('kampanya') || t.includes('indirim') || t.includes('fırsat'))
    return { Icon: TagIcon,            color: '#059669', grad: 'linear-gradient(135deg,#059669,#047857)', shadow: 'rgba(5,150,105,0.35)' }
  if (t.includes('etkinlik') || t.includes('program') || t.includes('festival'))
    return { Icon: CalendarDaysIcon,   color: '#1486C9', grad: 'linear-gradient(135deg,#1486C9,#0c6aaa)', shadow: 'rgba(20,134,201,0.35)' }
  if (t.includes('başvur') || t.includes('form') || t.includes('onay'))
    return { Icon: ClipboardListIcon,  color: '#0EA5E9', grad: 'linear-gradient(135deg,#0EA5E9,#0284C7)', shadow: 'rgba(14,165,233,0.35)' }
  return   { Icon: InfoIcon,           color: '#64748B', grad: 'linear-gradient(135deg,#64748B,#475569)', shadow: 'rgba(100,116,139,0.25)' }
}

const statusBgClass = (s: string) => {
  if (s === 'Onaylandı') return 'bg-success-soft text-success'
  if (s === 'Bekleme Listesi') return 'bg-warning-soft text-warning'
  if (s === 'İptal Edildi') return 'bg-danger-soft text-danger'
  if (s === 'İnceleniyor') return 'bg-info-soft text-info'
  return 'bg-surface-2 text-foreground-muted'
}

const getIcon = (n: CitizenNotification) => {
  const mod = moduleConfig(n)
  if (mod) return mod
  if (n.referenceType === 'event') return { Icon: CalendarDaysIcon, color: '#1486C9', grad: 'linear-gradient(135deg,#1486C9,#0ea5e9)', shadow: 'rgba(20,134,201,0.35)' }
  if (n.referenceType === 'travel') return { Icon: BusIcon, color: '#10B981', grad: 'linear-gradient(135deg,#10B981,#34d399)', shadow: 'rgba(16,185,129,0.35)' }
  if (n.referenceType === 'seda') return { Icon: GraduationCapIcon, color: '#F59E0B', grad: 'linear-gradient(135deg,#F59E0B,#fbbf24)', shadow: 'rgba(245,158,11,0.35)' }
  return typeConfig(n.title)
}

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Az önce'
  if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} sa önce`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d} gün önce`
  return formatDateTime(iso)
}

const groupByDay = (items: CitizenNotification[]) => {
  const map = new Map<string, CitizenNotification[]>()
  for (const n of items) {
    const day = localDayIso(n.createdAt)
    const list = map.get(day) ?? []
    list.push(n)
    map.set(day, list)
  }
  const today = todayIso()
  const yesterday = localDayIso(new Date(Date.now() - 86400000))
  return [...map.entries()].map(([day, ns]) => {
    const label = day === today ? 'Bugün' : day === yesterday ? 'Dün' : formatDate(day)
    return { label, items: ns }
  })
}

export const NotificationsPage = () => {
  const { unreadCount: contextUnread, refreshUnread } = useNotifications()
  const navigate = useNavigate()
  const [items, setItems]   = useState<CitizenNotification[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(false)
    notificationService.list({ scope: 'family', page: 1, limit: 50 })
      .then((r) => { if (active) setItems(r.items) })
      .catch(()  => {
        if (active) {
          setItems(null)
          setLoadError(true)
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refresh])

  useEffect(() => citizenRealtime.onNotification(() => setRefresh(x => x + 1)), [])

  const markRead = async (n: CitizenNotification) => {
    if (n.isRead) return
    try { await notificationService.markRead(n.id); setRefresh(x => x + 1); void refreshUnread() }
    catch { void 0 }
  }
  const markAll = async () => {
    try { await notificationService.markAllRead('family'); setRefresh(x => x + 1); void refreshUnread() }
    catch { void 0 }
  }

  const listUnread = (items ?? []).filter(n => !n.isRead).length
  const unreadCount = Math.max(contextUnread, listUnread)
  const groups      = groupByDay(items ?? [])

  return (
    <div className="flex h-full flex-col bg-surface-1">

      <ModuleHeader
        icon={BellIcon}
        title={unreadCount > 0 ? `Bildirimler (${unreadCount})` : 'Bildirimler'}
        subtitle="Siz ve ailenizin bildirimleri"
        gradient="linear-gradient(160deg,#0f172a 0%,#1e3a8a 55%,#1a56a0 100%)"
        actions={
          <>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAll()}
                className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm hover:bg-white/25 active:opacity-70 transition-colors"
              >
                <CheckCheckIcon className="h-3.5 w-3.5" />
                Tümünü oku
              </button>
            )}
            <button
              onClick={() => navigate('/bildirimler/tercihler')}
              aria-label="Bildirim tercihleri"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 active:opacity-70 transition-colors"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-8">
        {loading ? (
          <SkeletonRows rows={5} />
        ) : loadError ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[20px] border border-primary/10 bg-primary/10">
              <BellOffIcon className="h-9 w-9 text-primary/40" />
            </div>
            <div>
              <p className="font-bold text-foreground-strong">Bildirimler yüklenemedi</p>
              <p className="mt-1 text-sm text-foreground-muted">Bağlantınızı kontrol edip tekrar deneyin.</p>
            </div>
            <button
              onClick={() => setRefresh((x) => x + 1)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white active:opacity-80"
            >
              Tekrar Dene
            </button>
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[20px] border border-primary/10 bg-primary/10">
              <BellOffIcon className="h-9 w-9 text-primary/40" />
            </div>
            <div>
              <p className="font-bold text-foreground-strong">Bildirim yok</p>
              <p className="mt-1 text-sm text-foreground-muted">Başvuru ve etkinlik bildirimleriniz burada görünecek.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(({ label, items: gItems }) => (
              <section key={label}>
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-foreground-subtle">{label}</span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-semibold text-foreground-subtle">{gItems.length}</span>
                </div>

                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  {gItems.map((n) => {
                    const { Icon, color, grad, shadow } = getIcon(n)
                    return (
                      <button
                        key={n.id}
                        onClick={() => void markRead(n)}
                        className="relative w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors active:bg-surface-1"
                        style={{
                          background: n.isRead ? 'transparent' : `${color}06`,
                        }}
                      >
                        {!n.isRead && (
                          <div
                            className="absolute left-0 self-stretch"
                            style={{ width: 3, borderRadius: '0 2px 2px 0', background: color, top: 0, bottom: 0 }}
                          />
                        )}

                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center"
                          style={{
                            borderRadius: 10,
                            background: n.isRead ? 'hsl(var(--surface-2))' : grad,
                            boxShadow: n.isRead ? 'none' : `0 4px 12px ${shadow}`,
                          }}
                        >
                          <Icon className="h-[18px] w-[18px]" style={{ color: n.isRead ? '#94a3b8' : '#fff' }} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[13px] leading-snug ${n.isRead ? 'font-medium text-foreground-muted' : 'font-bold text-foreground-strong'}`}>
                              {n.title}
                            </p>
                            {!n.isRead
                              ? <span className="h-2 w-2 shrink-0 rounded-full mt-1.5" style={{ background: color }} />
                              : <CheckIcon className="h-3.5 w-3.5 shrink-0 text-foreground-subtle mt-0.5" />
                            }
                          </div>
                          <p className={`mt-0.5 text-[12px] leading-relaxed ${n.isRead ? 'text-foreground-subtle' : 'text-foreground-muted'}`}>
                            {n.body}
                          </p>
                          {(n.facilityName || n.statusInfo || n.sessionInfo) && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {n.facilityName && (
                                <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold bg-surface-2 text-foreground-muted">
                                  <BuildingIcon className="h-3 w-3" />
                                  {n.facilityName}
                                </span>
                              )}
                              {n.statusInfo && (
                                <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${statusBgClass(n.statusInfo)}`}>
                                  {n.statusInfo}
                                </span>
                              )}
                              {n.sessionInfo && (
                                <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-600">
                                  <ClockIcon className="h-3 w-3" />
                                  {n.sessionInfo}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {!n.isSelf && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
                                {n.personName}
                              </span>
                            )}
                            <span className="text-[10px] text-foreground-subtle font-medium">{relativeTime(n.createdAt)}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

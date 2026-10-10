import { useEffect, useState } from 'react'
import { Icon2D } from '@/components/Icon2D'
import { Link } from 'react-router-dom'
import {
  CalendarDaysIcon, BusIcon,
  ChevronRightIcon, ClipboardListIcon, CalendarCheckIcon,
  ClockIcon, Building2Icon,
  CalendarIcon, BellIcon, QrCodeIcon, ArrowLeftIcon, SunIcon,
  MapPinIcon, HistoryIcon, TrendingUpIcon,
  CheckCircle2Icon, AlertCircleIcon, UserRoundIcon,
} from 'lucide-react'
import { Badge, SkeletonRows } from '@/design-system'
import { formatDate, isPastDay } from '@/lib/utils'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import { useAuth } from '@/framework/auth/AuthContext'
import type { CitizenApplication } from '@/types/event.types'
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONE } from '@/types/event.types'
import type { CitizenTravelApplication } from '@/types/travel.types'
import { TRAVEL_STATUS_LABELS, TRAVEL_STATUS_TONE } from '@/types/travel.types'
import eventService from '@/services/event.service'
import travelService from '@/services/travel.service'
import planService from '@/services/plan.service'
import type { TodayPlanItem } from '@/services/plan.service'
import appMenuService, { type PublicSystemModule } from '@/services/appMenu.service'
import { DailyCheckIn } from './DailyCheckIn'

type AppType = 'event' | 'travel'

interface HomeAppItem {
  id: string; type: AppType; title: string; subtitle: string
  personName: string; isSelf: boolean; statusLabel: string
  statusTone: 'warning' | 'success' | 'danger' | 'info' | 'neutral'
  dateForSort: string
}

const isPastDate = isPastDay

const DynamicModuleIcon = ({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) => {
  const [Comp, setComp] = useState<React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null>(null)
  useEffect(() => {
    import('lucide-react').then((mod) => {
      const C = (mod as Record<string, unknown>)[name] as React.ComponentType<{ className?: string; style?: React.CSSProperties }> | undefined
      if (C) setComp(() => C)
    }).catch(() => {})
  }, [name])
  if (!Comp) return <span className={className} style={style}>●</span>
  return <Comp className={className} style={style} />
}

const PLAN_ICON: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  event: CalendarDaysIcon, travel: BusIcon, facility: Building2Icon,
}
const PLAN_COLOR: Record<string, string> = {
  event: '#1486C9', travel: '#10B981', facility: '#F59E0B',
}
const PLAN_LABEL: Record<string, string> = {
  event: 'Etkinlik', travel: 'Gezi', facility: 'Program',
}

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

const StatCard = ({
  label, value, sub, from, to,
  icon: Icon,
}: {
  label: string; value: string | number; sub: string
  from: string; to: string
  icon: React.ComponentType<{ className?: string }>
}) => (
  <div className="relative overflow-hidden rounded-2xl p-4 text-white"
    style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 8px 24px ${from}55` }}>
    <div className="pointer-events-none absolute -right-4 -bottom-4 h-20 w-20 rounded-full"
      style={{ background: 'rgba(255,255,255,0.1)' }} />
    <div className="pointer-events-none absolute -right-1 -top-6 h-14 w-14 rounded-full"
      style={{ background: 'rgba(255,255,255,0.07)' }} />
    <div className="flex items-start justify-between mb-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: 'rgba(255,255,255,0.2)' }}>
        <Icon className="h-4.5 w-4.5 text-white" />
      </div>
      <TrendingUpIcon className="h-4 w-4 text-white/50" />
    </div>
    <p className="text-2xl font-bold leading-none mb-1">{value}</p>
    <p className="text-sm font-medium text-white/90">{label}</p>
    <p className="text-xs text-white/70 mt-1">{sub}</p>
  </div>
)

const SectionTitle = ({
  label, accent, to: href,
}: { label: string; accent: string; to?: string }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <div className="h-1 w-4 rounded-full" style={{ background: accent }} />
      <p className="text-sm font-bold text-foreground-strong tracking-wide">{label}</p>
    </div>
    {href && (
      <Link to={href} className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: accent.includes('#') ? accent.split(',')[0].replace('linear-gradient(135deg,', '').trim() : '#1486C9' }}>
        Tümü <ChevronRightIcon className="h-3.5 w-3.5" />
      </Link>
    )}
  </div>
)

const EmptyState = ({ icon: Icon, title, sub }: { icon: React.ComponentType<{ className?: string }>; title: string; sub: string }) => (
  <div className="flex items-center gap-3 px-4 py-4">
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-2">
      <Icon className="h-5 w-5 text-foreground-subtle" />
    </div>
    <div>
      <p className="text-sm font-medium text-foreground-default">{title}</p>
      <p className="text-xs text-foreground-subtle">{sub}</p>
    </div>
  </div>
)

export const HomePage = () => {
  const { state, switchBack } = useAuth()
  const user = state.status === 'authenticated' ? state.user : undefined
  const impersonatedFrom = state.status === 'authenticated' ? state.impersonatedFrom : undefined
  const [homeApps, setHomeApps] = useState<HomeAppItem[] | null>(null)
  const [appsLoading, setAppsLoading] = useState(true)
  const [todayPlans, setTodayPlans] = useState<TodayPlanItem[] | null>(null)
  const [plansLoading, setPlansLoading] = useState(true)
  const [modules, setModules] = useState<PublicSystemModule[]>([])
  const [modulesLoading, setModulesLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.allSettled([
      eventService.applications({ scope: 'family', page: 1, limit: 20 }),
      travelService.applications({ scope: 'family', page: 1, limit: 20 }),
    ]).then(([ev, tr]) => {
      if (!active) return
      const evItems: HomeAppItem[] = (ev.status === 'fulfilled' ? ev.value.items : [])
        .filter((a: CitizenApplication) => !a.eventDeleted && !isPastDate(a.eventDate))
        .map((a: CitizenApplication) => ({
          id: a.id, type: 'event' as const, title: a.eventName,
          subtitle: a.sessionLabel ?? formatDate(a.eventDate),
          personName: a.personName, isSelf: a.isSelf,
          statusLabel: APPLICATION_STATUS_LABELS[a.status],
          statusTone: APPLICATION_STATUS_TONE[a.status], dateForSort: a.eventDate,
        }))
      const trItems: HomeAppItem[] = (tr.status === 'fulfilled' ? tr.value.items : [])
        .filter((a: CitizenTravelApplication) => !a.travelDeleted && !isPastDate(a.departureDate))
        .map((a: CitizenTravelApplication) => ({
          id: a.id, type: 'travel' as const, title: a.travelName,
          subtitle: `${a.destination} · ${formatDate(a.departureDate)}`,
          personName: a.personName, isSelf: a.isSelf,
          statusLabel: TRAVEL_STATUS_LABELS[a.status],
          statusTone: TRAVEL_STATUS_TONE[a.status], dateForSort: a.departureDate,
        }))
      const combined = [...evItems, ...trItems]
        .sort((a, b) => b.dateForSort.localeCompare(a.dateForSort)).slice(0, 5)
      if (active) { setHomeApps(combined); setAppsLoading(false) }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (state.status !== 'authenticated') { setPlansLoading(false); return }
    let active = true
    planService.todayPlans()
      .then((items) => { if (active) setTodayPlans(items) })
      .catch(() => { if (active) setTodayPlans([]) })
      .finally(() => { if (active) setPlansLoading(false) })
    return () => { active = false }
  }, [state.status])

  useEffect(() => {
    let active = true
    appMenuService.getSystemModules()
      .then((mods) => { if (active) setModules(mods.filter(m => m.isActive && m.citizenRoute)) })
      .catch(() => {})
      .finally(() => { if (active) setModulesLoading(false) })
    return () => { active = false }
  }, [])

  const approvedCount = homeApps?.filter(a => a.statusTone === 'success').length ?? 0
  const pendingCount  = homeApps?.filter(a => a.statusTone === 'warning').length ?? 0
  const totalCount    = homeApps?.length ?? 0

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-1">
      <DailyCheckIn />

      {user && (
        <div
          className="relative flex-shrink-0 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0c1445 0%, #0f2d6b 30%, #1251a3 65%, #1a7bc4 100%)', minHeight: 120 }}
        >
          <div className="pointer-events-none absolute top-0 left-0 h-full w-full"
            style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 60px, rgba(255,255,255,0.012) 60px, rgba(255,255,255,0.012) 61px)' }} />

          {impersonatedFrom && (
            <div className="relative flex items-center justify-between gap-3 px-5 py-2"
              style={{ background: 'rgba(251,191,36,0.14)', borderBottom: '1px solid rgba(251,191,36,0.2)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <Icon2D kind="eye" className="h-4 w-4 text-amber-200" />
                <p className="text-[11px] font-medium text-amber-200 truncate">
                  <span className="text-amber-300 font-medium">{user.fullName}</span> hesabındasınız
                </p>
              </div>
              <button type="button" onClick={() => void switchBack()}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
                style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.3)', color: '#fde68a' }}>
                <ArrowLeftIcon className="h-3 w-3" />Geri dön
              </button>
            </div>
          )}

          <div className="relative flex items-center justify-between gap-4 px-5 md:px-6 py-5">
            <Link to="/profil" className="group flex items-center gap-4 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden font-medium text-white text-lg transition-transform group-active:scale-95"
                  style={{
                    borderRadius: 18,
                    background: user.photoUrl ? undefined : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    border: '2.5px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
                  }}>
                  {user.photoUrl
                    ? <img src={user.photoUrl} alt="" className="h-full w-full object-cover" />
                    : getInitials(user.fullName)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white"
                  style={{ fontSize: 10, background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(4px)' }}><Icon2D kind="pencil" className="h-2.5 w-2.5" /></span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <SunIcon className="h-3 w-3 text-amber-300 flex-shrink-0" />
                  <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">{greeting()}</span>
                </div>
                <p className="text-[22px] md:text-[26px] font-medium text-white leading-none truncate"
                  style={{ letterSpacing: '-0.03em', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
                  {user.fullName.split(' ')[0]}
                  <span className="ml-2 text-white/40 text-[16px] md:text-[18px] font-medium">{user.fullName.split(' ').slice(1).join(' ')}</span>
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <CheckCircle2Icon className="h-2.5 w-2.5" /> {appsLoading ? '…' : `${homeApps?.filter(a => a.statusTone === 'success').length ?? 0} onaylı`}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <AlertCircleIcon className="h-2.5 w-2.5" /> {appsLoading ? '…' : `${homeApps?.filter(a => a.statusTone === 'warning').length ?? 0} beklemede`}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
                    <CalendarCheckIcon className="h-2.5 w-2.5" /> {plansLoading ? '…' : `${todayPlans?.length ?? 0} bugün`}
                  </span>
                </div>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white/60 group-hover:text-white/90 transition-colors">
                  <UserRoundIcon className="h-3 w-3" /> Profili Düzenle <ChevronRightIcon className="h-3 w-3" />
                </span>
              </div>
            </Link>

            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Link to="/bildirimler" className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <BellIcon className="h-4 w-4 text-white/80" />
                </Link>
                <Link to="/qr" className="flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <QrCodeIcon className="h-4 w-4 text-white/80" />
                </Link>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                {[
                  { label: 'Planlarım',    to: '/planlarim',    Icon: CalendarCheckIcon },
                  { label: 'Başvurularım', to: '/basvurularim', Icon: ClipboardListIcon },
                  { label: 'Geçmişim',     to: '/gecmisim',     Icon: HistoryIcon },
                ].map(({ label, to: href, Icon }) => (
                  <Link key={href} to={href}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-white/80 transition-all hover:bg-white/20"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}>
                    <Icon className="h-3 w-3" />{label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="sm:hidden flex gap-2 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {[
              { label: 'Planlarım',    to: '/planlarim',    Icon: CalendarCheckIcon },
              { label: 'Başvurularım', to: '/basvurularim', Icon: ClipboardListIcon },
              { label: 'Geçmişim',     to: '/gecmisim',     Icon: HistoryIcon },
              { label: 'Canlı Harita', to: '/canli-harita', Icon: MapPinIcon },
            ].map(({ label, to: href, Icon }) => (
              <Link key={href} to={href}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-white/80"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <Icon className="h-3 w-3" />{label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 pt-5 pb-10 space-y-6">

          {state.status === 'authenticated' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
              <StatCard label="Toplam Başvuru" value={appsLoading ? '–' : totalCount}
                sub="Yaklaşan etkinlik & gezi"
                from="#1486C9" to="#0c6aaa" icon={ClipboardListIcon} />
              <StatCard label="Onaylanan" value={appsLoading ? '–' : approvedCount}
                sub="Onaylandı ve hazır"
                from="#10B981" to="#059669" icon={CheckCircle2Icon} />
              <StatCard label="Bekleyen" value={appsLoading ? '–' : pendingCount}
                sub="Onay bekleniyor"
                from="#F59E0B" to="#d97706" icon={AlertCircleIcon} />
              <StatCard label="Bugünün Planı" value={plansLoading ? '–' : (todayPlans?.length ?? 0)}
                sub="Bugünkü etkinlik/program"
                from="#8B5CF6" to="#7C3AED" icon={CalendarCheckIcon} />
            </div>
          )}

          {/* Şartname 3.3.11 HIZLI ERİŞİM (4 Buton + Tümü) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1 w-4 rounded-full bg-blue-600" />
                <h2 className="text-sm font-bold text-foreground-strong tracking-wide">
                  Hızlı Erişim
                </h2>
              </div>
              <Link to="/cark" className="flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                Tümü <ChevronRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {/* 1. Nöbetçi Eczane (Şartname 3.3.11.3.1) */}
              <Link
                to="/nobetci-eczane"
                className="group flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border hover:border-red-500/40 shadow-sm transition-all text-center active:scale-95"
              >
                <div className="w-11 h-11 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-xl">💊</span>
                </div>
                <span className="text-[11px] font-bold text-foreground leading-tight">
                  Nöbetçi Eczane
                </span>
              </Link>

              {/* 2. İstek / Öneri / Şikayet (Şartname 3.3.11.3.2) */}
              <Link
                to="/formlarim"
                className="group flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border hover:border-blue-500/40 shadow-sm transition-all text-center active:scale-95"
              >
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-xl">💬</span>
                </div>
                <span className="text-[11px] font-bold text-foreground leading-tight">
                  İstek / Şikayet
                </span>
              </Link>

              {/* 3. Ödeme İşlemleri (Şartname 3.3.11.3.3) */}
              <Link
                to="/odeme"
                className="group flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border hover:border-emerald-500/40 shadow-sm transition-all text-center active:scale-95"
              >
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-xl">💳</span>
                </div>
                <span className="text-[11px] font-bold text-foreground leading-tight">
                  Ödeme İşlemleri
                </span>
              </Link>

              {/* 4. Başvurular - Randevular (Şartname 3.3.11.3.4) */}
              <Link
                to="/basvurularim"
                className="group flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-card border border-border hover:border-purple-500/40 shadow-sm transition-all text-center active:scale-95"
              >
                <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-xl">📋</span>
                </div>
                <span className="text-[11px] font-bold text-foreground leading-tight">
                  Başvuru & Randevu
                </span>
              </Link>
            </div>
          </section>

          {/* Şartname 3.3.33 YAPAY ZEKA VE KİŞİSELLEŞTİRİLMİŞ ÖNERİ KARTI */}
          <section>
            <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-blue-500/20 shadow-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-base">✨</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    Size Özel Akıllı Öneri
                  </span>
                </div>
                <p className="text-xs font-bold text-foreground mt-1">
                  Zuhuratbaba Mahallesi Yol Yenileme Çalışması ve Spor Kursu Ön Kayıtları Başladı!
                </p>
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  İşlem geçmişinize göre yüzme kursu başvurusu yapabilir veya emlak vergisi taksitinizi tek tıkla ödeyebilirsiniz.
                </p>
                <div className="flex gap-2 mt-2">
                  <Link
                    to="/hizmetler"
                    className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm"
                  >
                    Kursa Başvur
                  </Link>
                  <Link
                    to="/odeme"
                    className="px-3 py-1 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground text-[11px] font-bold border border-border"
                  >
                    Borç Sorgula
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-4 gap-6">

            <div className="lg:col-span-3 xl:col-span-3 space-y-6">

              <section>
                <SectionTitle label="Hizmetler" accent="linear-gradient(90deg, #6366F1, #8B5CF6)" />
                {modulesLoading ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-8">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 border border-border">
                        <div className="h-16 w-16 rounded-2xl bg-surface-1 animate-pulse sm:h-14 sm:w-14" />
                        <div className="h-2 w-12 rounded bg-surface-1 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8">
                    {modules.map((m) => (
                      <Link key={m.key} to={m.citizenRoute} className="group block">
                        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-center border border-border
                          shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97]
                          sm:gap-1.5 sm:p-3">
                          <div className="flex h-16 w-16 items-center justify-center sm:h-13 sm:w-13">
                            <DynamicModuleIcon name={m.icon} className="h-9 w-9 sm:h-7 sm:w-7" style={{ color: m.color }} />
                          </div>
                          {/* Hata raporu (docs/hata.md #2): uzun hizmet adları kartı büyütüp
                              ızgara hizasını bozuyordu; en fazla iki satır, fazlası "…". */}
                          <p className="line-clamp-2 break-words text-xs font-medium leading-tight text-foreground-strong sm:text-[10px]" title={m.label}>{m.label}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <Link to="/canli-harita" className="group block">
                  <div className="relative overflow-hidden rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
                    <div className="relative flex items-center gap-4">
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                        <MapPinIcon className="h-7 w-7 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-white leading-tight">Canlı Harita</p>
                        <p className="mt-0.5 text-xs text-white/70">Acil toplanma alanları, tesisler, etkinlikler ve kütüphaneler tek haritada</p>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-white/60 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              </section>

              <section>
                <SectionTitle label="Son Başvurular" accent="linear-gradient(90deg, #6366F1, #4F46E5)" to="/basvurularim" />
                <div className="overflow-hidden rounded-2xl bg-card border border-border shadow-sm">
                  {appsLoading ? (
                    <div className="px-4 py-3"><SkeletonRows rows={3} /></div>
                  ) : !homeApps || homeApps.length === 0 ? (
                    <EmptyState icon={ClipboardListIcon} title="Başvuru bulunamadı"
                      sub="Etkinlik ve gezi başvurularınız burada görünür." />
                  ) : (
                    <div className="divide-y divide-border">
                      {homeApps.map((a) => {
                        const color = a.type === 'event' ? '#1486C9' : '#10B981'
                        const typeLabel = a.type === 'event' ? 'Etkinlik' : 'Gezi'
                        return (
                          <div key={`${a.type}-${a.id}`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors">
                            <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-[11px] font-medium text-white rounded-xl"
                              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 4px 10px ${color}40` }}>
                              {a.type === 'event' ? 'E' : 'G'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className="text-[10px] font-medium rounded-full px-2 py-0.5"
                                  style={{ background: `${color}15`, color }}>{typeLabel}</span>
                                {!a.isSelf && (
                                  <span className="text-[10px] text-foreground-subtle bg-surface-2 rounded-full px-2 py-0.5">{a.personName}</span>
                                )}
                              </div>
                              <p className="text-[13px] font-medium text-foreground-strong truncate">{a.title}</p>
                              <p className="text-[11px] text-foreground-subtle">{a.subtitle}</p>
                            </div>
                            <Badge tone={a.statusTone}>{a.statusLabel}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>

            </div>

            <div className="lg:col-span-2 xl:col-span-1 space-y-6">

              <section>
                <SectionTitle label="Bugünün Planı" accent="linear-gradient(90deg, #1486C9, #0c6aaa)" to="/planlarim" />
                <div className="overflow-hidden rounded-2xl bg-card border border-border shadow-sm">
                  {plansLoading ? (
                    <div className="px-4 py-3"><SkeletonRows rows={2} /></div>
                  ) : !todayPlans || todayPlans.length === 0 ? (
                    <EmptyState icon={CalendarIcon} title="Bugün plan yok"
                      sub="Onaylı etkinlik veya program bulunmuyor." />
                  ) : (
                    <div className="divide-y divide-border">
                      {todayPlans.map((plan, i) => {
                        const Icon = PLAN_ICON[plan.type] ?? CalendarDaysIcon
                        const color = PLAN_COLOR[plan.type] ?? '#1486C9'
                        return (
                          <div key={i} className="flex items-center gap-3 px-4 py-3">
                            <div className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center"
                              style={{ background: `${color}18` }}>
                              <Icon className="h-4.5 w-4.5" style={{ color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-foreground-strong truncate">{plan.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {plan.time && (
                                  <span className="flex items-center gap-1 text-[11px] text-foreground-muted">
                                    <ClockIcon className="h-3 w-3" />{plan.time}
                                  </span>
                                )}
                                {plan.venueName && (
                                  <span className="flex items-center gap-1 text-[11px] text-foreground-muted truncate">
                                    <MapPinIcon className="h-3 w-3 shrink-0" />{plan.venueName}
                                  </span>
                                )}
                                <DistanceBadge
                                  distanceOnly
                                  className="text-[11px]"
                                  target={plan.latitude != null && plan.longitude != null ? { latitude: plan.latitude, longitude: plan.longitude } : null}
                                />
                              </div>
                            </div>
                            <span className="shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5"
                              style={{ background: `${color}15`, color }}>
                              {PLAN_LABEL[plan.type]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <SectionTitle label="Keşfet" accent="linear-gradient(90deg, #F97316, #EF4444)" />
                <div className="space-y-2">
                  {[
                    { to: '/yarisma',     label: 'Bilgi Yarışması', color: '#7C3AED' },
                    { to: '/carkim',      label: 'Hediye Çarkı',   color: '#F97316' },
                    { to: '/kampanyalar', label: 'Kampanyalar',    color: '#059669' },
                    { to: '/anketler',    label: 'Anketler',       color: '#0EA5E9' },
                    { to: '/formlarim',   label: 'İstek / Öneri / Şikayet', color: '#0369a1' },
                  ].map(({ to: href, label, color }) => (
                    <Link key={href} to={href} className="group flex items-center gap-3 rounded-xl bg-card border border-border
                      px-4 py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97]">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="flex-1 text-[13px] font-medium text-foreground-strong">{label}</span>
                      <ChevronRightIcon className="h-3.5 w-3.5 text-foreground-subtle group-hover:text-foreground-muted transition-colors" />
                    </Link>
                  ))}
                </div>
              </section>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

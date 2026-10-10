import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { SIDEBAR_BADGE_EVENT } from '@/lib/sidebarBadge'
import {
  HomeIcon, MenuIcon, LogOutIcon, ShieldIcon, UsersIcon, Building2Icon,
  ArmchairIcon, CalendarDaysIcon, DumbbellIcon, WavesIcon,
  TentTreeIcon, CompassIcon, FlaskConicalIcon, AccessibilityIcon, BookOpenIcon,
  MapPinnedIcon, MegaphoneIcon, SirenIcon, TrophyIcon,
  Disc3Icon, ClipboardListIcon, StoreIcon, SettingsIcon, StarIcon,
  RadioTowerIcon, BarChart3Icon, LayoutGridIcon, ChevronDownIcon, PillIcon,
  SmartphoneIcon, HeartHandshakeIcon, ScrollTextIcon,
  LandmarkIcon, HeartIcon, HeartPulseIcon, PawPrintIcon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { useHasFacilityScopeRestriction } from '@/framework/auth/useFacilityScopeRestriction'
import { api } from '@/services/api'
import { isPilotPath } from '@/lib/pilotRoutes'

interface NavItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  to: string
  permission?: string | string[]
  tone?: 'danger'
  badgeKey?: string
  superAdminOnly?: boolean
  pilotColor?: string
}

const NAV_ITEMS: NavItem[] = [
  { icon: HomeIcon, label: 'Dashboard', to: '/dashboard', pilotColor: 'text-blue-500' },
  { icon: BarChart3Icon, label: 'Raporlama & Analiz', to: '/reports', permission: 'reports.view', pilotColor: 'text-violet-500' },
  { icon: UsersIcon, label: 'Katılımcılar', to: '/participants', permission: 'participants.view', pilotColor: 'text-cyan-600' },
  { icon: Building2Icon, label: 'Hizmet Tesislerimiz', to: '/service-facilities', permission: 'service-facilities.view', pilotColor: 'text-amber-600' },
  { icon: ArmchairIcon, label: 'Salonlar', to: '/halls', permission: 'halls.view', pilotColor: 'text-amber-600' },
  { icon: CalendarDaysIcon, label: 'Etkinlik Programı', to: '/events', permission: 'events.view', pilotColor: 'text-blue-500' },
  { icon: MapPinnedIcon, label: 'Gezi Sistemi', to: '/travels', permission: 'travels.view', pilotColor: 'text-teal-500' },
  { icon: BookOpenIcon, label: 'Kütüphane', to: '/library', permission: ['library.view', 'library-mesai.view'], pilotColor: 'text-amber-600' },
  { icon: DumbbellIcon, label: 'Spor Salonu', to: '/sports', permission: 'sports.view', pilotColor: 'text-orange-500' },
  { icon: WavesIcon, label: 'Havuz', to: '/pool', permission: 'pool.view', pilotColor: 'text-cyan-500' },
  { icon: TentTreeIcon, label: 'Gençlik Kampı', to: '/youth-camp', permission: 'youth-camp.view', pilotColor: 'text-emerald-600' },
  { icon: CompassIcon, label: 'İzcilik Kampı', to: '/scout-camp', permission: 'scout-camp.view', pilotColor: 'text-lime-600' },
  { icon: FlaskConicalIcon, label: 'Bilim Merkezi', to: '/science-center', permission: 'science-center.view', pilotColor: 'text-violet-500' },
  { icon: AccessibilityIcon, label: 'Engelsiz Yaşam', to: '/accessible-life', permission: 'accessible-life.view', pilotColor: 'text-rose-500' },
  { icon: HeartHandshakeIcon, label: 'Kadın ve Aile', to: '/women-family', permission: 'women-family.view', pilotColor: 'text-rose-500' },
  { icon: MegaphoneIcon, label: 'Muhtarlık', to: '/muhtarlik', permission: 'muhtarlik.view', pilotColor: 'text-slate-500' },
  { icon: LandmarkIcon, label: 'E-Belediye & Tahsilat', to: '/e-belediye', pilotColor: 'text-emerald-600' },
  { icon: HeartIcon, label: 'Nikah İşlemleri', to: '/nikah', pilotColor: 'text-rose-500' },
  { icon: HeartPulseIcon, label: 'Sağlık İşleri', to: '/saglik', pilotColor: 'text-red-500' },
  { icon: PawPrintIcon, label: 'Veterinerlik & Pati Kart', to: '/veterinerlik', pilotColor: 'text-lime-600' },
  { icon: CompassIcon, label: 'İmar & Şehircilik', to: '/imar', pilotColor: 'text-slate-500' },
  { icon: SirenIcon, label: 'Acil Toplanma', to: '/emergency-areas', permission: 'emergency-areas.view', tone: 'danger' },
  { icon: PillIcon, label: 'Nöbetçi Eczaneler', to: '/duty-pharmacies', superAdminOnly: true },
  { icon: TrophyIcon, label: 'Bilgi Yarışması', to: '/quiz', permission: 'quiz.view', pilotColor: 'text-amber-500' },
  { icon: Disc3Icon, label: 'Hediye Çarkı', to: '/wheel', permission: 'wheel.view', badgeKey: 'wheel', pilotColor: 'text-pink-500' },
  { icon: ClipboardListIcon, label: 'Anketler', to: '/survey', permission: 'survey.view', pilotColor: 'text-teal-500' },
  { icon: MegaphoneIcon, label: 'Popup / Duyuru', to: '/popups', permission: 'popups.view', pilotColor: 'text-slate-500' },
  { icon: StoreIcon, label: 'Firma & Bakkart', to: '/companies', permission: 'companies.view', pilotColor: 'text-slate-500' },
  { icon: ShieldIcon, label: 'Yöneticiler', to: '/admin', permission: 'admins.view', pilotColor: 'text-slate-500' },
  { icon: RadioTowerIcon, label: 'Cihaz Canlı Takip', to: '/device-monitor', permission: 'device-monitor.view', pilotColor: 'text-slate-500' },
  { icon: SmartphoneIcon, label: 'Mobil Uygulama Ayarları', to: '/mobile-config', permission: 'mobile-config.view', pilotColor: 'text-slate-500' },
  { icon: StarIcon, label: 'Sadakat Sistemi', to: '/loyalty', permission: 'loyalty.view', pilotColor: 'text-amber-500' },
  { icon: ScrollTextIcon, label: 'Sistem Logları', to: '/logs', permission: 'logs.view', pilotColor: 'text-slate-500' },
  { icon: SettingsIcon, label: 'Ayarlar', to: '/settings', superAdminOnly: true },
]

const SERVICE_ROUTES = new Set([
  '/events', '/travels', '/library', '/sports', '/pool', '/youth-camp',
  '/science-center', '/accessible-life', '/scout-camp',
  '/women-family',
])
const FACILITY_ROUTES = new Set(['/service-facilities', '/halls'])
const TOP_ROUTES = new Set(['/dashboard', '/reports', '/participants'])

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const useBadgeCounts = (can: (p: string) => boolean) => {
  const [counts, setCounts] = useState<Record<string, number>>({})

  const refresh = useCallback(() => {
    if (!can('wheel.view')) return
    api.get<{ data: { pending: number } }>('/gift-requests/summary')
      .then(res => setCounts(prev => ({ ...prev, wheel: res.data.data?.pending ?? 0 })))
      .catch(() => {})
  }, [can])

  useEffect(() => {
    refresh()
    window.addEventListener(SIDEBAR_BADGE_EVENT, refresh)
    return () => window.removeEventListener(SIDEBAR_BADGE_EVENT, refresh)
  }, [refresh])

  return counts
}

export const useVisibleNavItems = () => {
  const { can, isSuperAdmin, isSurveyOnlyUser } = useAuth()
  const hasFacilityScopeRestriction = useHasFacilityScopeRestriction()
  return NAV_ITEMS.filter((item) => {
    if (isSurveyOnlyUser) return item.to === '/survey'
    if (item.superAdminOnly && !isSuperAdmin) return false
    if (hasFacilityScopeRestriction && FACILITY_ROUTES.has(item.to)) return false
    return !item.permission || (Array.isArray(item.permission) ? item.permission.some(can) : can(item.permission))
  })
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { can, logout } = useAuth()
  const location = useLocation()
  const pilot = isPilotPath(location.pathname)

  const visibleItems = useVisibleNavItems()
  const badgeCounts = useBadgeCounts(can)
  const serviceItems = visibleItems.filter((item) => SERVICE_ROUTES.has(item.to))
  const facilityItems = visibleItems.filter((item) => FACILITY_ROUTES.has(item.to))
  const topItems = visibleItems.filter((item) => TOP_ROUTES.has(item.to))
  const otherItems = visibleItems.filter((item) => !TOP_ROUTES.has(item.to) && !SERVICE_ROUTES.has(item.to) && !FACILITY_ROUTES.has(item.to))
  const serviceRouteActive = serviceItems.some((item) => location.pathname.startsWith(item.to))
  const facilityRouteActive = facilityItems.some((item) => location.pathname.startsWith(item.to))
  const [servicesOpen, setServicesOpen] = useState(serviceRouteActive)
  const [facilitiesOpen, setFacilitiesOpen] = useState(facilityRouteActive)

  useEffect(() => {
    if (serviceRouteActive) setServicesOpen(true)
  }, [serviceRouteActive])

  useEffect(() => {
    if (facilityRouteActive) setFacilitiesOpen(true)
  }, [facilityRouteActive])

  const renderNavItem = (item: NavItem, nested = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg transition-colors cursor-pointer group',
          nested ? 'py-2 pl-5 pr-3' : 'px-3 py-2.5',
          isActive
            ? 'bg-[hsl(var(--surface-0))] text-[hsl(var(--primary))]'
            : 'text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--surface-0))] hover:text-[hsl(var(--foreground-strong))]',
          item.tone === 'danger' && !isActive && 'hover:text-[hsl(var(--danger))]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              'w-4 h-4 flex-shrink-0 transition-colors',
              item.tone === 'danger'
                ? 'text-[hsl(var(--danger))]'
                : isActive
                  ? (pilot ? 'text-blue-600' : 'text-[hsl(var(--primary))]')
                  : (pilot && item.pilotColor
                    ? `${item.pilotColor} group-hover:opacity-80`
                    : 'text-[hsl(var(--foreground-subtle))] group-hover:text-[hsl(var(--primary))]')
            )}
          />
          {!collapsed && (
            <span className={cn('type-nav truncate text-[12px] font-medium transition-colors flex-1', isActive && cn(pilot ? 'text-blue-700' : 'text-[hsl(var(--primary))]', 'font-semibold'))}>
              {item.label}
            </span>
          )}
          {!collapsed && item.badgeKey && (badgeCounts[item.badgeKey] ?? 0) > 0 && (
            <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[hsl(var(--danger))] px-1 text-[9px] font-bold text-white flex-shrink-0">
              {badgeCounts[item.badgeKey] > 99 ? '99+' : badgeCounts[item.badgeKey]}
            </span>
          )}
          {isActive && !collapsed && !(item.badgeKey && (badgeCounts[item.badgeKey] ?? 0) > 0) && !pilot && (
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))] flex-shrink-0" />
          )}
        </>
      )}
    </NavLink>
  )

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-card border-r border-[hsl(var(--border))] shadow-[var(--shadow-sidebar)] transition-all duration-300 ease-in-out flex-shrink-0 z-10',
        collapsed ? 'w-[54px]' : pilot ? 'w-[245px]' : 'w-[196px]',
        pilot && 'sidebar-ui-pilot',
      )}
    >
      <div className="p-2 border-b border-[hsl(var(--border))]">
        <button
          type="button"
          aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          aria-expanded={!collapsed}
          onClick={onToggle}
          className="w-full p-2 flex justify-center rounded-lg text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--surface-0))] transition-colors"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {topItems.map((item) => renderNavItem(item))}

        {facilityItems.length > 0 && (
          <div className="py-0.5">
            <button
              type="button"
              onClick={() => setFacilitiesOpen((open) => !open)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[hsl(var(--foreground-muted))] transition-colors hover:bg-[hsl(var(--surface-0))]',
                facilityRouteActive && 'text-[hsl(var(--primary))]'
              )}
              title={collapsed ? 'Tesislerimiz' : undefined}
            >
              <Building2Icon className={cn('h-4 w-4 shrink-0', pilot && 'text-amber-600')} />
              {!collapsed && <span className="flex-1 text-left text-[12px] font-semibold">Tesislerimiz</span>}
              {!collapsed && <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', facilitiesOpen && 'rotate-180')} />}
            </button>
            {facilitiesOpen && (
              <div className={cn('mt-0.5 space-y-0.5 border-l border-border', collapsed ? 'ml-4 pl-0.5' : 'ml-4 pl-1')}>
                {facilityItems.map((item) => renderNavItem(item, true))}
              </div>
            )}
          </div>
        )}

        {serviceItems.length > 0 && (
          <div className="py-0.5">
            <button
              type="button"
              onClick={() => setServicesOpen((open) => !open)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[hsl(var(--foreground-muted))] transition-colors hover:bg-[hsl(var(--surface-0))]',
                serviceRouteActive && 'text-[hsl(var(--primary))]'
              )}
              title={collapsed ? 'Hizmetlerimiz' : undefined}
            >
              <LayoutGridIcon className={cn('h-4 w-4 shrink-0', pilot && 'text-teal-600')} />
              {!collapsed && <span className="flex-1 text-left text-[12px] font-semibold">Hizmetlerimiz</span>}
              {!collapsed && <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', servicesOpen && 'rotate-180')} />}
            </button>
            {servicesOpen && (
              <div className={cn('mt-0.5 space-y-0.5 border-l border-border', collapsed ? 'ml-4 pl-0.5' : 'ml-4 pl-1')}>
                {serviceItems.map((item) => renderNavItem(item, true))}
              </div>
            )}
          </div>
        )}

        {otherItems.map((item) => renderNavItem(item))}
      </nav>

      <div className="border-t border-[hsl(var(--border))] p-2">
        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[hsl(var(--foreground-muted))] hover:bg-danger-soft hover:text-[hsl(var(--danger))] transition-colors group'
          )}
        >
          <LogOutIcon className="w-4 h-4 flex-shrink-0 group-hover:text-[hsl(var(--danger))]" />
          {!collapsed && (
            <span className="type-nav text-[12px] font-medium truncate">Çıkış Yap</span>
          )}
        </button>
      </div>
    </aside>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SunIcon, MoonIcon, MonitorIcon, BellIcon, MailIcon, PanelRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme, type ThemeMode } from '@/framework/theme/ThemeContext'
import { useClock } from '@/framework/hooks/useClock'
import { useAuth } from '@/framework/auth/AuthContext'
import { UserMenu } from '@/framework/layout/UserMenu'
import { SubUsersIndicator } from '@/framework/layout/SubUsersIndicator'
import { HeaderMenuSearch } from '@/framework/layout/HeaderMenuSearch'
import { NotificationPanel } from '@/components/specialized/NotificationPanel/NotificationPanel'
import { teamService } from '@/services/team.service'
import { teamRealtime, type RealtimeNotification } from '@/services/teamRealtime'
import { refreshSidebarBadges } from '@/lib/sidebarBadge'
import { useSystemLogo } from '@/framework/branding/useSystemLogo'
import type { TeamNotification } from '@/types/team.types'

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const formatTurkishDate = (now: Date) =>
  `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()} ${DAYS[now.getDay()]}`

const pad = (n: number) => n.toString().padStart(2, '0')

const formatTime = (now: Date) =>
  `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

interface HeaderProps {
  userName?: string
  userRole?: string
  panelOpen?: boolean
  onTogglePanel?: () => void
  onOpenMessages?: () => void
}

const toTeamNotification = (n: RealtimeNotification): TeamNotification => ({
  id: n.id,
  title: n.title,
  body: n.body,
  type: n.referenceType ?? '',
  referenceType: n.referenceType,
  referenceId: n.referenceId,
  isRead: false,
  createdAt: n.createdAt,
})

const THEME_OPTIONS: { value: ThemeMode; icon: typeof SunIcon; label: string }[] = [
  { value: 'light', icon: SunIcon, label: 'Açık tema' },
  { value: 'dark', icon: MoonIcon, label: 'Koyu tema' },
  { value: 'system', icon: MonitorIcon, label: 'Sistem teması' },
]

export const Header = ({
  userName = 'Admin',
  userRole = 'Sistem Yöneticisi',
  panelOpen = false,
  onTogglePanel,
  onOpenMessages,
}: HeaderProps) => {
  const { mode, setMode } = useTheme()
  const { state } = useAuth()
  const now = useClock()
  const navigate = useNavigate()
  const logoUrl = useSystemLogo()
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<TeamNotification[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [messageCount, setMessageCount] = useState(0)

  const authUser = state.status === 'authenticated' ? state.user : undefined
  const displayName = authUser?.fullName ?? userName
  const displayRole = authUser?.roleName ?? userRole
  const roleColor = authUser?.roleColor

  useEffect(() => {
    let active = true
    teamService.getNotificationsUnreadCount()
      .then((c) => { if (active) setUnreadCount(c) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const refreshMessageCount = useCallback(async () => {
    try {
      const s = await teamService.getUnreadSummary()
      setMessageCount(s.total)
    } catch { /* sessiz */ }
  }, [])

  useEffect(() => {
    refreshMessageCount()
  }, [refreshMessageCount])

  useEffect(() => {
    teamRealtime.start()
    const off = teamRealtime.onMessage(() => refreshMessageCount())
    return () => { off(); teamRealtime.stop() }
  }, [refreshMessageCount])

  useEffect(() => {
    teamRealtime.start()
    const off = teamRealtime.onNotification((n) => {
      setNotifications((prev) => prev.some((x) => x.id === n.id) ? prev : [toTeamNotification(n), ...prev])
      setUnreadCount((c) => c + 1)
      refreshSidebarBadges()
    })
    return off
  }, [])

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true)
    try { setNotifications(await teamService.getNotifications()) }
    catch { /* sessiz */ }
    finally { setNotifLoading(false) }
  }, [])

  const toggleNotif = () => {
    setNotifOpen((v) => {
      const next = !v
      if (next) loadNotifications()
      return next
    })
  }

  const handleNotifClick = (n: TeamNotification) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x))
      setUnreadCount((c) => Math.max(0, c - 1))
      teamService.markNotificationRead(n.id).catch(() => undefined)
    }
    setNotifOpen(false)
    const reference = n.referenceType ?? n.type
    if (reference === 'gift-request' && n.referenceId) {
      navigate(`/wheel?tab=talepler&highlight=${n.referenceId}`)
    }
  }

  return (
    <header className="h-[56px] bg-card border-b border-[hsl(var(--border))] shadow-sm flex items-center justify-between gap-4 px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <img
          src={logoUrl}
          alt="Bakırköy Belediyesi Logo"
          className="h-[38px] w-auto max-w-[140px] object-contain flex-shrink-0"
        />
        <div className="hidden sm:block">
          <h1 className="text-[15px] font-bold tracking-tight text-foreground-strong leading-tight">Bakırköy Belediyesi</h1>
          <p className="text-[11px] font-semibold text-[hsl(var(--primary))] uppercase tracking-wider leading-tight">Yönetim Portalı</p>
        </div>
      </div>

      <HeaderMenuSearch />

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 type-clock">
          <span>{formatTurkishDate(now)}</span>
          <span className="type-clock-time">{formatTime(now)}</span>
        </div>

        {(false as boolean) && (
        <div className="flex items-center gap-0.5 bg-[hsl(var(--surface-2))] rounded-md p-0.5">
          {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              title={label}
              aria-label={label}
              aria-pressed={mode === value}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-sm transition-colors',
                mode === value
                  ? 'bg-[hsl(var(--surface-0))] text-[hsl(var(--primary))] shadow-sm'
                  : 'text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground-default))]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
        )}

        {onTogglePanel && (
          <button
            onClick={onTogglePanel}
            title={panelOpen ? 'Ekip panelini kapat' : 'Ekip panelini aç'}
            aria-label="Ekip paneli"
            aria-pressed={panelOpen}
            className={cn(
              'hidden lg:flex w-8 h-8 items-center justify-center rounded-md transition-colors',
              panelOpen
                ? 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]'
                : 'text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--foreground-default))]'
            )}
          >
            <PanelRightIcon className="w-4 h-4" />
          </button>
        )}

        {onOpenMessages && (
          <button
            type="button"
            onClick={() => { setNotifOpen(false); onOpenMessages() }}
            title="Mesajlar"
            aria-label="Mesajlar"
            className={cn(
              'relative w-8 h-8 flex items-center justify-center rounded-md transition-colors',
              'text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--foreground-default))]'
            )}
          >
            <MailIcon className="w-4 h-4" />
            {messageCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[hsl(var(--success))] text-white text-[10px] font-semibold rounded-full flex items-center justify-center px-1">
                {messageCount > 99 ? '99+' : messageCount}
              </span>
            )}
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            aria-label="Bildirimler"
            aria-expanded={notifOpen}
            onClick={toggleNotif}
            className={cn(
              'relative w-8 h-8 flex items-center justify-center rounded-md transition-colors',
              notifOpen
                ? 'bg-surface-2 text-foreground-default'
                : 'text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--foreground-default))]'
            )}
          >
            <BellIcon className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-[hsl(var(--danger))] text-white text-[10px] font-semibold rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            items={notifications}
            loading={notifLoading}
            onItemClick={handleNotifClick}
          />
        </div>

        <SubUsersIndicator />

        <div className="pl-2 border-l border-[hsl(var(--border))]">
          <UserMenu displayName={displayName} displayRole={displayRole} roleColor={roleColor} />
        </div>
      </div>
    </header>
  )
}

import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import './sidebar-pilot.css'
import { RightPanel, type PanelTool } from '@/components/specialized/RightPanel/RightPanel'
import { presenceService } from '@/services/presence.service'
import { useHasFacilityScopeRestriction } from '@/framework/auth/useFacilityScopeRestriction'
import { useHasSubordinates } from '@/framework/auth/useHasSubordinates'
import { isPilotPath } from '@/lib/pilotRoutes'

const HEARTBEAT_MS = 30000

export const MainLayout = () => {
  const { pathname } = useLocation()
  // Kullanıcı isteği (2026-10-01): pilot app shell (mobil üst menü, Ekibim dialogları) artık
  // tüm Hizmetlerimiz (FacilityModule) sayfalarında açık, sadece /sports'ta değil.
  const pilot = isPilotPath(pathname)
  const [compact, setCompact] = useState(() => window.innerWidth < 1280)
  const [mobileNav, setMobileNav] = useState(false)
  const [teamDialog, setTeamDialog] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1279px)')
    const update = () => setCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => { setMobileNav(false) }, [pathname])
  const [collapsed, setCollapsed] = useState(false)
  // Kullanıcı isteği (2026-10-07): sağ panel (Ekibim/Çevrimiçi) artık varsayılan
  // kapalı başlar; kurumsal panelin ilk izlenimi sade olsun, kullanıcı header'daki
  // panel butonuyla isteyince açar.
  const [activeTool, setActiveTool] = useState<PanelTool | null>(null)

  const hasFacilityScopeRestriction = useHasFacilityScopeRestriction()
  const hasSubordinates = useHasSubordinates()
  const showTeamPanel = !hasFacilityScopeRestriction || hasSubordinates

  useEffect(() => {
    const ping = () => {
      presenceService.heartbeat('web').catch(() => undefined)
    }
    ping()
    const id = setInterval(ping, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`flex h-screen flex-col overflow-hidden bg-[hsl(var(--surface-0))] ${pilot ? 'pilot-app-shell' : ''}`}>
      <Header
        panelOpen={activeTool !== null}
        onTogglePanel={showTeamPanel ? () => { if (pilot && compact) { setActiveTool('online'); setTeamDialog(true) } else setActiveTool((t) => (t ? null : 'online')) } : undefined}
        onOpenMessages={showTeamPanel ? () => { setActiveTool('online'); if (pilot && compact) setTeamDialog(true) } : undefined}
      />
      <div className={`flex flex-1 min-w-0 overflow-hidden ${pilot ? 'pilot-shell-body' : ''}`}>
        {!hasFacilityScopeRestriction && (
          <div className={pilot ? "hidden md:flex" : "contents"}><Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} /></div>
        )}
        <main className="flex-1 min-w-0 overflow-auto">
          {pilot && !hasFacilityScopeRestriction && <div className="pilot-mobile-nav-bar"><button type="button" onClick={() => setMobileNav(true)} aria-label="Ana menüyü aç"><Menu aria-hidden="true" /> Menü</button></div>}
          <Outlet />
        </main>
        {showTeamPanel && !(pilot && compact) && (
          <RightPanel active={activeTool} onActiveChange={setActiveTool} />
        )}
      </div>
      {pilot && <Dialog.Root open={mobileNav} onOpenChange={setMobileNav}><Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <Dialog.Content className="pilot-navigation-dialog" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Ana menü</Dialog.Title>
          <Dialog.Close className="pilot-overlay-close" aria-label="Menüyü kapat"><X aria-hidden="true" /></Dialog.Close>
          <Sidebar collapsed={false} onToggle={() => setMobileNav(false)} />
        </Dialog.Content>
      </Dialog.Portal></Dialog.Root>}
      {pilot && compact && <Dialog.Root open={teamDialog} onOpenChange={setTeamDialog}><Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <Dialog.Content className="pilot-team-dialog" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Ekibim</Dialog.Title>
          <Dialog.Close className="pilot-overlay-close" aria-label="Ekip panelini kapat"><X aria-hidden="true" /></Dialog.Close>
          <RightPanel active={activeTool} onActiveChange={(value) => { setActiveTool(value); if (!value) setTeamDialog(false) }} />
        </Dialog.Content>
      </Dialog.Portal></Dialog.Root>}
    </div>
  )
}


import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { UsersIcon, MegaphoneIcon, StickyNoteIcon, CheckSquareIcon, XIcon } from 'lucide-react'
import { IconButton } from '@/design-system'
import { cn } from '@/lib/utils'
import { teamService } from '@/services/team.service'
import { teamRealtime } from '@/services/teamRealtime'
import { useAuth } from '@/framework/auth/AuthContext'
import { isPilotPath } from '@/lib/pilotRoutes'
import { OnlineTab } from './OnlineTab'
import { BroadcastTab } from './BroadcastTab'
import { NotesTab } from './NotesTab'
import { TodosTab } from './TodosTab'
import { ChatView } from './ChatView'
import type { OnlinePerson } from '@/types/presence.types'

export type PanelTool = 'online' | 'broadcast' | 'notes' | 'todos'

const UNREAD_POLL_MS = 30000

// Kullanıcı isteği (2026-10-07): "sultanşehirden olan izler burda olmasın" — sağ panel
// araç ikonlarındaki rastgele mavi/amber/mor/zümrüt karışımı kaldırıldı, kurumsal tek
// mavi tonuna indirgendi.
const TOOLS: { key: PanelTool; label: string; icon: React.ComponentType<{ className?: string }>; superAdminOnly?: boolean; pilotColor?: string }[] = [
  { key: 'online', label: 'Çevrimiçi', icon: UsersIcon, pilotColor: 'text-[#0f4c81]' },
  { key: 'broadcast', label: 'Bildirim', icon: MegaphoneIcon, superAdminOnly: true, pilotColor: 'text-[#0f4c81]' },
  { key: 'notes', label: 'Notlar', icon: StickyNoteIcon, pilotColor: 'text-[#0f4c81]' },
  { key: 'todos', label: 'Görev', icon: CheckSquareIcon, pilotColor: 'text-[#0f4c81]' },
]

interface RightPanelProps {
  active: PanelTool | null
  onActiveChange: (tool: PanelTool | null) => void
}

export const RightPanel = ({ active, onActiveChange }: RightPanelProps) => {
  const { isSuperAdmin } = useAuth()
  const location = useLocation()
  // Kullanıcı isteği (2026-10-01): sultansehir-template görsel dilini tüm Hizmetlerimiz
  // (FacilityModule) sayfalarındayken sağ panele de uygula (bkz. Sidebar.tsx aynı desen).
  const pilot = isPilotPath(location.pathname)
  const visibleTools = useMemo(() => TOOLS.filter((t) => !t.superAdminOnly || isSuperAdmin), [isSuperAdmin])
  const [chatPerson, setChatPerson] = useState<OnlinePerson | null>(null)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({})

  const refreshUnread = useCallback(async () => {
    try {
      const s = await teamService.getUnreadSummary()
      setUnreadTotal(s.total)
      setUnreadBySender(Object.fromEntries(s.perSender.map((x) => [x.senderId, x.count])))
    } catch {
    }
  }, [])

  useEffect(() => {
    refreshUnread()
    teamRealtime.start()
    const off = teamRealtime.onMessage(() => refreshUnread())
    const id = setInterval(refreshUnread, UNREAD_POLL_MS)
    return () => {
      off()
      clearInterval(id)
      teamRealtime.stop()
    }
  }, [refreshUnread])

  const open = (key: PanelTool) => {
    setChatPerson(null)
    onActiveChange(active === key ? null : key)
  }

  const activeTool = visibleTools.find((t) => t.key === active)
  const badgeFor = useMemo(() => ({ online: unreadTotal, broadcast: 0, notes: 0, todos: 0 }) as Record<PanelTool, number>, [unreadTotal])

  if (visibleTools.length === 0) return null

  return (
    <div className={cn('hidden shrink-0 lg:flex', pilot && 'right-panel-ui-pilot')}>
      {activeTool && (
        <aside className="flex w-72 flex-col border-l border-border bg-surface-0">
          {(active !== 'online' || chatPerson) && (
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
              <div className="flex min-w-0 items-center gap-2">
                <activeTool.icon className="h-4 w-4 text-primary" />
                <span className="type-section truncate">{activeTool.label}</span>
              </div>
              <IconButton title="Kapat" onClick={() => onActiveChange(null)}>
                <XIcon className="h-4 w-4" />
              </IconButton>
            </div>
          )}

          <div className="min-h-0 flex-1">
            {active === 'online' &&
              (chatPerson ? (
                <ChatView person={chatPerson} onBack={() => setChatPerson(null)} onThreadRead={refreshUnread} />
              ) : (
                <OnlineTab
                  onMessage={setChatPerson}
                  onClose={() => onActiveChange(null)}
                  unreadBySender={unreadBySender}
                  colorful={pilot}
                />
              ))}
            {active === 'broadcast' && <BroadcastTab />}
            {active === 'notes' && <NotesTab />}
            {active === 'todos' && <TodosTab />}
          </div>
        </aside>
      )}

      <div className="flex w-11 flex-col items-center gap-1 border-l border-border bg-surface-1 py-2">
        {visibleTools.map((tool) => {
          const count = badgeFor[tool.key] ?? 0
          return (
            <button
              key={tool.key}
              type="button"
              onClick={() => open(tool.key)}
              title={count > 0 ? `${tool.label} · ${count} okunmamış` : tool.label}
              aria-label={tool.label}
              aria-pressed={active === tool.key}
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-field transition-colors',
                active === tool.key
                  ? 'bg-primary-soft text-primary'
                  : pilot && tool.pilotColor
                    ? `${tool.pilotColor} hover:bg-surface-2`
                    : 'text-foreground-muted hover:bg-surface-2 hover:text-foreground-default',
              )}
            >
              <tool.icon className="h-[18px] w-[18px]" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-semibold leading-none text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

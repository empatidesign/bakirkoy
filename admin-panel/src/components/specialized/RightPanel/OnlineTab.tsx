import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, MonitorIcon, SmartphoneIcon, AppleIcon, MessageSquareIcon, UsersIcon, XIcon, PencilIcon, MapPinIcon } from 'lucide-react'
import { Input, MultiSelect, Avatar, Badge, RoleBadge, IconButton, EmptyState, SkeletonRows } from '@/design-system'
import { cn } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import { presenceService } from '@/services/presence.service'
import type { OnlinePerson, PresenceDevice } from '@/types/presence.types'

const DeviceIcon = ({ device, online }: { device: PresenceDevice; online: boolean }) => {
  const cls = cn('h-3 w-3', online ? 'text-success' : 'text-foreground-subtle')
  if (device === 'ios') return <AppleIcon className={cls} />
  if (device === 'android') return <SmartphoneIcon className={cls} />
  return <MonitorIcon className={cls} />
}

const lastSeen = (seconds: number): string => {
  if (seconds < 60) return `${seconds} sn`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} dk`
  return `${Math.floor(m / 60)} sa`
}

interface OnlineTabProps {
  onMessage: (person: OnlinePerson) => void
  onClose?: () => void
  unreadBySender?: Record<string, number>
  // Kullanıcı isteği (2026-10-01): sultansehir-template'teki kişiye-özgü renkli
  // rozetleri sadece /sports pilot modda göster (bkz. Sidebar.tsx aynı desen).
  colorful?: boolean
}

export const OnlineTab = ({ onMessage, onClose, unreadBySender = {}, colorful = false }: OnlineTabProps) => {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canEdit = can('admins.edit')
  const openAdminEdit = (p: OnlinePerson) => {
    navigate(`/admin?tab=admins&edit=${p.id}`)
    onClose?.()
  }
  const [people, setPeople] = useState<OnlinePerson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])

  useEffect(() => {
    let active = true
    const load = async (showLoading: boolean) => {
      if (showLoading) setLoading(true)
      try {
        const data = await presenceService.getOnline()
        if (active) setPeople(data)
      } catch {
        if (active) setPeople([])
      } finally {
        if (active && showLoading) setLoading(false)
      }
    }
    load(true)
    const id = setInterval(() => load(false), 15000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, number>()
    people.forEach((p) => {
      const key = p.branchName || p.facilityName
      if (key) map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries())
  }, [people])

  const onlineCount = useMemo(() => people.filter((p) => p.online).length, [people])

  const groupOptions = useMemo(
    () => groups.map(([key, count]) => ({ value: key, label: `${key} (${count})` })),
    [groups],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return people.filter((p) => {
      if (selectedGroups.length > 0 && !selectedGroups.includes(p.branchName || p.facilityName || '')) return false
      if (!q) return true
      return (
        p.fullName.toLocaleLowerCase('tr-TR').includes(q) ||
        p.roleName.toLocaleLowerCase('tr-TR').includes(q) ||
        (p.facilityName ?? '').toLocaleLowerCase('tr-TR').includes(q) ||
        (p.branchName ?? '').toLocaleLowerCase('tr-TR').includes(q)
      )
    })
  }, [people, search, selectedGroups])

  const onlineUsers = filtered.filter((p) => p.online)
  const offlineUsers = filtered.filter((p) => !p.online)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-0 px-3">
        <UsersIcon className="h-4 w-4 shrink-0 text-primary" />
        <span className="type-section truncate">Ekibim</span>
        <span className="shrink-0 rounded-pill bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
          {onlineCount} içeride
        </span>
        <span className="shrink-0 text-[10px] text-foreground-subtle">{people.length} kişi</span>
        <div className="flex-1" />
        {onClose && (
          <IconButton title="Kapat" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </IconButton>
        )}
      </div>

      <div className="border-b border-border bg-card px-3 py-2.5 space-y-2">
        <Input
          iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          placeholder="İsim, rol, tesis veya grup ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="sm"
        />
        {groups.length > 0 && (
          <MultiSelect
            values={selectedGroups}
            onChange={setSelectedGroups}
            options={groupOptions}
            placeholder="Gruba göre filtrele…"
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-surface-1">
        {loading ? (
          <div className="p-3"><SkeletonRows rows={6} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={UsersIcon} title="Kullanıcı yok" description="Eşleşen kullanıcı bulunamadı." className="py-10" />
        ) : (
          <div className="py-1">
            {onlineUsers.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-success">
                  Giriş yaptı · {onlineUsers.length}
                </p>
                {onlineUsers.map((p, i) => (
                  <PersonRow key={p.id} p={p} onMessage={onMessage} index={i} unread={unreadBySender[p.id] ?? 0} canEdit={canEdit} onEdit={openAdminEdit} colorful={colorful} />
                ))}
              </>
            )}
            {offlineUsers.length > 0 && (
              <>
                <p className="px-3 pt-3 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-foreground-subtle">
                  Giriş yapmadı · {offlineUsers.length}
                </p>
                {offlineUsers.map((p, i) => (
                  <PersonRow key={p.id} p={p} onMessage={onMessage} index={i} unread={unreadBySender[p.id] ?? 0} canEdit={canEdit} onEdit={openAdminEdit} colorful={colorful} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const PersonRow = ({ p, onMessage, index, unread, canEdit, onEdit, colorful }: { p: OnlinePerson; onMessage: (p: OnlinePerson) => void; index: number; unread: number; canEdit: boolean; onEdit: (p: OnlinePerson) => void; colorful?: boolean }) => (
  <div
    className={cn(
      'group flex items-center gap-2.5 px-3 py-2 transition-colors',
      index % 2 === 0 ? 'bg-card' : 'bg-surface-0/60',
      'hover:bg-surface-1',
    )}
  >
    <div className="relative shrink-0">
      <Avatar name={p.fullName} size="sm" colorful={colorful} />
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
          p.online ? 'bg-emerald-500' : 'bg-foreground-subtle',
        )}
      />
    </div>

    <div className="min-w-0 flex-1">
      <div className={cn('text-[12px] font-semibold truncate leading-tight', p.online ? 'text-foreground-strong' : 'text-foreground-muted')}>
        {p.fullName}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <RoleBadge name={p.roleName} color={p.roleColor} />
        {(p.branchName || p.facilityName) && (
          <Badge tone="neutral" className="max-w-full">
            <MapPinIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{p.branchName ? `${p.facilityName ? `${p.facilityName} · ` : ''}${p.branchName}` : p.facilityName}</span>
          </Badge>
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[11px]">
        <DeviceIcon device={p.device} online={p.online} />
        {p.online ? (
          <span className="font-medium text-emerald-600">{lastSeen(p.lastSeenSeconds)} önce aktif</span>
        ) : (
          <span className="text-foreground-subtle">Giriş yapmadı</span>
        )}
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-0.5">
      {canEdit && (
        <IconButton
          title={`${p.fullName} kaydını düzenle`}
          onClick={() => onEdit(p)}
          className="opacity-0 group-hover:opacity-100"
        >
          <PencilIcon className="h-3.5 w-3.5" />
        </IconButton>
      )}
      <div className="relative shrink-0">
        <IconButton
          tone="primary"
          title={unread > 0 ? `Mesaj gönder · ${unread} okunmamış` : 'Mesaj gönder'}
          onClick={() => onMessage(p)}
          className={cn('shrink-0', unread > 0 ? '' : 'opacity-0 group-hover:opacity-100')}
        >
          <MessageSquareIcon className="h-3.5 w-3.5" />
        </IconButton>
        {unread > 0 && (
          <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>
    </div>
  </div>
)

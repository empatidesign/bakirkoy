import { useEffect, useState } from 'react'
import { UserIcon, GlobeIcon, SendIcon, BellIcon, AlertTriangleIcon, InfoIcon, ClockIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Textarea, Button, Select, SegmentedControl, ToggleRow, Badge, EmptyState, SkeletonRows } from '@/design-system'
import { teamService } from '@/services/team.service'
import { presenceService } from '@/services/presence.service'
import type { TeamMember, TeamNotification } from '@/types/team.types'

type Mode = 'person' | 'all'
type Kind = 'info' | 'warning'

const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Az önce'
  if (m < 60) return `${m}dk önce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}sa önce`
  return `${Math.floor(h / 24)}g önce`
}

export const BroadcastTab = () => {
  const [mode, setMode] = useState<Mode>('person')
  const [subordinates, setSubordinates] = useState<TeamMember[]>([])
  const [received, setReceived] = useState<TeamNotification[]>([])
  const [loading, setLoading] = useState(true)

  const [recipientId, setRecipientId] = useState('')
  const [kind, setKind] = useState<Kind>('info')
  const [message, setMessage] = useState('')
  const [alsoSms, setAlsoSms] = useState(false)
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [subs, notes] = await Promise.all([teamService.getSubordinates(), teamService.getNotifications()])
      setSubordinates(subs)
      setReceived(notes)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      if (mode === 'person') {
        if (!recipientId) return
        await teamService.sendNotification({ recipientId, title: '', message: message.trim(), kind, alsoSms })
        toast.success(kind === 'warning' ? 'Uyarı gönderildi.' : 'Bildirim gönderildi.')
      } else {
        const result = await presenceService.broadcast({ target: 'all', message: message.trim(), alsoSms })
        if (result.recipientCount === 0) {
          toast.warning('Şu anda çevrimiçi kullanıcı yok, bildirim gönderilmedi.')
          return
        }
        toast.success(`${result.recipientCount} çevrimiçi kullanıcıya gönderildi.`)
      }
      setMessage('')
    } finally {
      setSending(false)
    }
  }

  const markRead = async (id: string) => {
    await teamService.markNotificationRead(id)
    await load()
  }

  const canPerson = subordinates.length > 0
  const unreadCount = received.filter((n) => !n.isRead).length

  return (
    <div className="flex h-full flex-col">
      <div
        className="relative overflow-hidden border-b border-border"
        style={{ background: 'linear-gradient(135deg, #0a3a66 0%, #0f4c81 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 15% 50%, #ffffff40 0%, transparent 60%)' }}
        />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fff, transparent)' }}
        />
        <div className="relative px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              <BellIcon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Bildirim</p>
                {unreadCount > 0 && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.22)', color: '#e0e7ff', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    {unreadCount} yeni
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/65">Ekip bildirimleri ve duyurular</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-b border-border bg-surface-1 p-3">
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          columns={2}
          options={[
            { value: 'person', label: 'Kişiye', icon: UserIcon },
            { value: 'all', label: 'Tüm çevrimiçi', icon: GlobeIcon },
          ]}
        />

        {mode === 'person' ? (
          canPerson ? (
            <>
              <Select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
                <option value="">Kime gönderilecek?</option>
                {subordinates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.roleName})
                  </option>
                ))}
              </Select>
              <SegmentedControl
                value={kind}
                onChange={(v) => setKind(v as Kind)}
                columns={2}
                options={[
                  { value: 'info', label: 'Bilgilendirme', icon: InfoIcon },
                  { value: 'warning', label: 'Uyarı', icon: AlertTriangleIcon, tone: 'red' },
                ]}
              />
            </>
          ) : (
            <div
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
              style={{ background: '#eef3f8' }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#d7e3ef]">
                <InfoIcon className="h-3.5 w-3.5 text-[#0f4c81]" />
              </div>
              <p className="text-[12px] text-foreground-muted">Bildirim gönderebileceğiniz bir astınız bulunmuyor.</p>
            </div>
          )
        ) : null}

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Textarea
            rows={3}
            placeholder="Mesajınızı yazın…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="resize-none border-0 bg-transparent focus:ring-0"
          />
          {(mode === 'all' || canPerson) && (
            <div className="border-t border-border px-3 py-2">
              <ToggleRow label="SMS ile de gönder" checked={alsoSms} onChange={setAlsoSms} />
            </div>
          )}
        </div>

        <Button
          variant="primary"
          size="sm"
          isLoading={sending}
          disabled={!message.trim() || (mode === 'person' && (!canPerson || !recipientId))}
          onClick={send}
          className="w-full"
        >
          <SendIcon className="h-4 w-4" />
          Gönder
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="type-caption font-medium text-foreground-muted">Gelen bildirimler</p>
          {unreadCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="p-2">
          {loading ? (
            <SkeletonRows rows={3} />
          ) : received.length === 0 ? (
            <EmptyState
              icon={BellIcon}
              title="Bildirim yok"
              description="Size gönderilen bildirim/uyarı burada görünür."
              className="py-10"
            />
          ) : (
            <div className="space-y-1.5">
              {received.map((n) => {
                const isWarning = n.type === 'team-warning'
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.isRead && markRead(n.id)}
                    className="group w-full overflow-hidden rounded-lg border text-left transition-all hover:shadow-sm"
                    style={{
                      borderColor: n.isRead ? 'hsl(var(--border))' : isWarning ? '#fca5a520' : '#93c5fd30',
                      background: n.isRead
                        ? 'hsl(var(--surface-0))'
                        : isWarning
                        ? 'linear-gradient(135deg, #fff7ed, #fffbeb)'
                        : 'linear-gradient(135deg, #eff6ff, #f5f8ff)',
                    }}
                  >
                    <div className="flex items-start gap-2.5 px-3 py-2.5">
                      <div
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: isWarning ? '#fee2e240' : '#dbeafe40',
                        }}
                      >
                        {isWarning ? (
                          <AlertTriangleIcon className="h-3.5 w-3.5 text-orange-500" />
                        ) : (
                          <InfoIcon className="h-3.5 w-3.5 text-blue-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={isWarning ? 'danger' : 'info'} className="shrink-0">
                            {n.type === 'team-warning' ? 'Uyarı' : n.type === 'team-task' ? 'Görev' : n.type === 'team-note' ? 'Not' : 'Bilgi'}
                          </Badge>
                          {!n.isRead && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        </div>
                        {n.title && <p className="mt-1 type-body-strong truncate">{n.title}</p>}
                        <p className="mt-0.5 text-[12px] leading-relaxed text-foreground-muted break-words line-clamp-2">{n.body}</p>
                        {n.createdAt && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-foreground-subtle">
                            <ClockIcon className="h-3 w-3" />
                            {formatRelative(n.createdAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

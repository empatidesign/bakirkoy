import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MonitorIcon, SmartphoneIcon, ShieldIcon, LogOutIcon } from 'lucide-react'
import { Card, Button, Badge } from '@/design-system'
import { formatDate } from '@/lib/utils'
import authService from '@/services/auth.service'
import type { CitizenSession } from '@/types/auth.types'

export const ActiveSessionsPage = () => {
  const [sessions, setSessions] = useState<CitizenSession[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await authService.getSessions()
      setSessions(data)
    } catch {
      setSessions([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleRevoke = async (sessionId: string) => {
    if (revoking) return
    setRevoking(sessionId)
    try {
      await authService.revokeSession(sessionId)
      toast.success('Oturum sonlandırıldı.')
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId))
    } catch {
      toast.error('Oturum sonlandırılamadı. Lütfen tekrar deneyin.')
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeAll = async () => {
    if (revokingAll) return
    setRevokingAll(true)
    try {
      await authService.revokeAllSessions()
      toast.success('Diğer tüm oturumlar sonlandırıldı.')
      setSessions((prev) => prev.filter((s) => s.isCurrent))
    } catch {
      toast.error('Oturumlar sonlandırılamadı. Lütfen tekrar deneyin.')
    } finally {
      setRevokingAll(false)
    }
  }

  const others = sessions.filter((s) => !s.isCurrent)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface-0 px-6 py-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-card bg-gradient-to-br from-danger to-rose-700 shadow-sm">
          <ShieldIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-foreground-strong">Aktif Oturumlar</h1>
          <p className="mt-0.5 text-[11px] text-foreground-muted">Hesabınıza giriş yapılan cihazlar</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {loading ? (
          <Card padded>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-field bg-surface-2" />
              ))}
            </div>
          </Card>
        ) : loadError ? (
          <Card padded>
            <div className="space-y-3 py-2 text-center">
              <p className="type-caption">Oturum bilgileri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>Tekrar Dene</Button>
            </div>
          </Card>
        ) : sessions.length === 0 ? (
          <Card padded>
            <p className="type-caption text-center">Aktif oturum bulunamadı.</p>
          </Card>
        ) : (
          <>
            <Card padded>
              <p className="type-caption mb-3">
                Bu cihaz ve hesabınızla bağlantılı diğer cihazlar listelenmektedir. Tanımadığınız bir oturumu sonlandırabilirsiniz.
              </p>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <SessionRow
                    key={session.sessionId}
                    session={session}
                    revoking={revoking === session.sessionId}
                    onRevoke={() => void handleRevoke(session.sessionId)}
                  />
                ))}
              </div>
            </Card>

            {others.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                iconLeft={<LogOutIcon className="h-4 w-4" />}
                isLoading={revokingAll}
                onClick={() => void handleRevokeAll()}
              >
                Diğer Tüm Oturumları Sonlandır
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const formatIp = (ip: string | null): string => {
  if (!ip) return 'IP bilinmiyor'
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return 'Yerel ağ'
  if (ip.startsWith('::ffff:')) return ip.slice(7)
  return ip
}

const SessionRow = ({
  session,
  revoking,
  onRevoke,
}: {
  session: CitizenSession
  revoking: boolean
  onRevoke: () => void
}) => {
  const isMobile = session.deviceType === 'mobile'
  const Icon = isMobile ? SmartphoneIcon : MonitorIcon

  return (
    <div className="flex items-center gap-3 rounded-field border border-border p-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="type-body-strong truncate">{isMobile ? 'Mobil' : 'Web'}</p>
          {session.isCurrent && <Badge tone="success">Bu cihaz</Badge>}
        </div>
        <p className="type-caption truncate">
          {formatIp(session.ipAddress)} · {formatDate(session.createdAt)}
        </p>
      </div>
      {!session.isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<LogOutIcon className="h-4 w-4" />}
          isLoading={revoking}
          onClick={onRevoke}
          className="flex-shrink-0 text-danger hover:bg-danger-soft"
        />
      )}
    </div>
  )
}

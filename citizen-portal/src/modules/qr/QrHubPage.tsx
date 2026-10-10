import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCwIcon, ShieldCheckIcon, ScanLineIcon, CameraIcon, BuildingIcon, TagIcon, CheckCircle2Icon, Loader2Icon } from 'lucide-react'
import { QrCode } from '@/design-system/QrCode/QrCode'
import { QrScanner } from '@/components/specialized/QrScanner'
import identityService from '@/services/identity.service'
import { useAuth } from '@/framework/auth/AuthContext'
import type { CitizenIdentityQrDto, QrPassDto } from '@/types/identity.types'
import { api } from '@/services/api'
import { secondsUntil, deadlineFromNow } from '@/lib/countdown'

type Tab = 'show' | 'scan'

interface ActiveCampaign {
  id: string
  name: string
  discountType: string | number
  discountValue: number
  endDate: string
  description?: string
}

interface CompanyQrScanResult {
  companyId: string
  companyName: string
  logoUrl?: string
  activeCampaigns: ActiveCampaign[]
}

const formatDiscount = (type: string | number, value: number) =>
  type === 1 || type === 'Percentage' ? `%${value} indirim` : `${value.toLocaleString('tr-TR')}₺ indirim`

interface RedeemState { campaignId: string; loading: boolean; done: boolean }

export const QrHubPage = () => {
  const [tab, setTab] = useState<Tab>('show')
  const [qr, setQr] = useState<CitizenIdentityQrDto | null>(null)
  const [facilityPasses, setFacilityPasses] = useState<QrPassDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [scanned, setScanned] = useState<string | null>(null)
  const [companyResult, setCompanyResult] = useState<CompanyQrScanResult | null>(null)
  const [companyLoading, setCompanyLoading] = useState(false)
  const [scanError, setScanError] = useState(false)
  const [redeemState, setRedeemState] = useState<RedeemState | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** QR'ın geçerlilik bitiş anı; sayaç bundan türetilir (bkz. docs/hata.md #6.1). */
  const deadlineRef = useRef<number>(0)

  const { state } = useAuth()
  const user = state.status === 'authenticated' ? state.user : undefined

  const handleCompanyScan = useCallback(async (staticCode: string) => {
    setScanned(staticCode)
    setCompanyResult(null)
    setScanError(false)
    setCompanyLoading(true)
    try {
      const res = await api.post<{ data: CompanyQrScanResult }>('/qr/citizen/scan-company', { staticCode })
      setCompanyResult(res.data.data)
    } catch {
      setCompanyResult(null)
      setScanError(true)
    } finally {
      setCompanyLoading(false)
    }
  }, [])

  const handleRedeem = async (campaignId: string) => {
    if (!companyResult || !scanned) return
    setRedeemState({ campaignId, loading: true, done: false })
    try {
      await api.post('/qr/citizen/redeem', { staticCode: scanned, campaignId })
      setRedeemState({ campaignId, loading: false, done: true })
    } catch {
      setRedeemState(null)
    }
  }

  const clearTimers = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  // Hata raporu (docs/hata.md #6.1) ile aynı kök neden: "her tick'te 1 azalt" yaklaşımı,
  // tick gecikmelerini biriktirdiği için sayaç gerçek zamanın gerisinde kalıyordu. Kalan süre
  // artık bitiş anına göre yeniden hesaplanır.
  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    deadlineRef.current = deadlineFromNow(seconds)
    setSecondsLeft(seconds)
    countdownRef.current = setInterval(() => {
      const remaining = secondsUntil(deadlineRef.current)
      setSecondsLeft(remaining)
      if (remaining === 0 && countdownRef.current) clearInterval(countdownRef.current)
    }, 250)
  }

  const fetchQr = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await identityService.qrPasses()
      const identity = data.identity
      setQr({
        token: identity.token,
        rotationSeconds: identity.rotationSeconds,
        expiresAt: identity.expiresAt ?? new Date(Date.now() + identity.rotationSeconds * 1000).toISOString(),
        shortCode: identity.shortCode ?? '',
      })
      setFacilityPasses(data.passes)
      const expiresMs = identity.expiresAt ? new Date(identity.expiresAt).getTime() : Date.now() + identity.rotationSeconds * 1000
      const remaining = Math.max(1, Math.round((expiresMs - Date.now()) / 1000))
      startCountdown(remaining)
      refreshTimerRef.current = setTimeout(() => fetchQr(), remaining * 1000)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'show') {
      fetchQr()
    } else {
      clearTimers()
    }
    return clearTimers
  }, [tab, fetchQr])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || tab !== 'show') return
      const expiresMs = qr?.expiresAt ? new Date(qr.expiresAt).getTime() : 0
      if (!qr || expiresMs <= Date.now()) void fetchQr()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [tab, qr, fetchQr])

  const progressPct = qr ? (secondsLeft / qr.rotationSeconds) * 100 : 100
  const maskTckn = (raw?: string): string => {
    const t = (raw ?? '').trim()
    if (/^\d{11}$/.test(t)) return `${t.slice(0, 3)}••••••${t.slice(-2)}`
    return t
  }
  const maskedTckn = maskTckn(user?.tckn)

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--background))]">
      <div
        className="relative overflow-hidden px-5 py-5"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        }}
      >
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <ScanLineIcon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-black text-white leading-none md:text-[18px]" style={{ letterSpacing: '-0.02em' }}>QR İşlemleri</h1>
            <p className="mt-0.5 text-[10px] text-white/40">Kimlik QR'ınız veya kamera tarayıcı</p>
          </div>
        </div>

        <div className="relative mt-5 flex gap-1 rounded-2xl bg-white/10 p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setTab('show')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{
              background: tab === 'show' ? 'white' : 'transparent',
              color: tab === 'show' ? '#312e81' : 'rgba(255,255,255,0.7)',
            }}
          >
            <ShieldCheckIcon className="h-4 w-4" />
            QR Kodum
          </button>
          <button
            type="button"
            onClick={() => { setTab('scan'); setScanned(null) }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
            style={{
              background: tab === 'scan' ? 'white' : 'transparent',
              color: tab === 'scan' ? '#312e81' : 'rgba(255,255,255,0.7)',
            }}
          >
            <CameraIcon className="h-4 w-4" />
            QR Oku
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {tab === 'show' ? (
          <div className="flex flex-col items-center gap-5 p-5">
            <div className="w-full rounded-3xl bg-card shadow-lg overflow-hidden border border-border">
              <div className="flex flex-col items-center p-6 gap-4">
                <div
                  className="relative rounded-2xl border border-primary/20 bg-primary-soft p-4"
                >
                  {loading && !qr ? (
                    <div className="grid h-[216px] w-[216px] place-items-center">
                      <RefreshCwIcon className="h-7 w-7 animate-spin text-indigo-300" />
                    </div>
                  ) : error ? (
                    <div className="flex h-[216px] w-[216px] flex-col items-center justify-center gap-3">
                      <p className="text-sm text-danger text-center">QR kodu yüklenemedi.</p>
                      <button
                        type="button"
                        className="text-sm font-semibold text-primary underline"
                        onClick={fetchQr}
                      >
                        Tekrar dene
                      </button>
                    </div>
                  ) : qr ? (
                    <QrCode value={qr.token} size={216} />
                  ) : null}
                </div>

                {user && (
                  <div className="text-center">
                    <p className="text-base font-bold text-foreground-strong">{user.fullName}</p>
                    <p className="text-sm text-foreground-subtle mt-0.5 font-mono">{maskedTckn}</p>
                  </div>
                )}

                {qr && (
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-foreground-subtle">
                        <RefreshCwIcon className="h-3 w-3" />
                        <span>Otomatik yenileme</span>
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums ${secondsLeft < 10 ? 'text-danger' : 'text-primary'}`}
                      >
                        {secondsLeft}s
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-1">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${progressPct}%`,
                          background: secondsLeft < 10
                            ? 'linear-gradient(90deg, #ef4444, #f97316)'
                            : 'linear-gradient(90deg, #6366f1, #818cf8)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div
                className="flex items-center justify-center gap-2 border-t border-primary/15 bg-primary-soft py-3 px-6"
              >
                <ShieldCheckIcon className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs text-primary font-medium">
                  Bu kodu yetkili okuyucuya gösterin — size özeldir
                </p>
              </div>
            </div>

            {facilityPasses.length > 0 && (
              <div className="w-full space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <BuildingIcon className="h-4 w-4 text-indigo-400" />
                  <p className="text-sm font-semibold text-foreground-strong">Tesis Geçiş Kodlarım</p>
                </div>
                {facilityPasses.map((pass) => (
                  <div key={pass.referenceId ?? pass.token} className="w-full rounded-3xl bg-card shadow-sm border border-border overflow-hidden">
                    <div className="flex items-center gap-4 p-4">
                      <div className="rounded-2xl border border-primary/20 bg-primary-soft p-2.5 shrink-0">
                        <QrCode value={pass.token} size={96} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground-strong truncate">{pass.title}</p>
                        <p className="text-xs text-foreground-subtle mt-0.5 line-clamp-2">{pass.subtitle}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            {scanned && (companyLoading || companyResult) ? (
              companyLoading ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl bg-card p-8 shadow-lg border border-border">
                  <Loader2Icon className="h-8 w-8 animate-spin text-indigo-400" />
                  <p className="text-sm text-foreground-subtle">Firma bilgileri yükleniyor...</p>
                </div>
              ) : companyResult ? (
                <div className="rounded-3xl bg-card shadow-lg border border-border overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                      <BuildingIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground-strong">{companyResult.companyName}</p>
                      <p className="text-xs text-foreground-subtle">{companyResult.activeCampaigns.length} kampanya mevcut</p>
                    </div>
                  </div>
                  {companyResult.activeCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-6 text-center">
                      <TagIcon className="h-8 w-8 text-foreground-subtle" />
                      <p className="text-sm text-foreground-subtle">Bu firmada aktif kampanya yok.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {companyResult.activeCampaigns.map((c) => {
                        const isRedeeming = redeemState?.campaignId === c.id
                        const isDone = isRedeeming && redeemState?.done
                        return (
                          <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground-strong truncate">{c.name}</p>
                              <p className="text-xs text-green-600 font-medium">{formatDiscount(c.discountType, c.discountValue)}</p>
                              {c.description && <p className="text-xs text-foreground-subtle mt-0.5 line-clamp-1">{c.description}</p>}
                            </div>
                            {isDone ? (
                              <div className="flex items-center gap-1 text-green-600 shrink-0">
                                <CheckCircle2Icon className="h-4 w-4" />
                                <span className="text-xs font-medium">Kullanıldı</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!!redeemState}
                                onClick={() => { void handleRedeem(c.id) }}
                                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
                              >
                                {isRedeeming && redeemState?.loading ? <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> : 'Kullan'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="px-5 py-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => { setScanned(null); setCompanyResult(null); setRedeemState(null) }}
                      className="w-full rounded-2xl py-2.5 text-sm font-bold text-primary border border-primary/20 bg-primary-soft"
                    >
                      Tekrar Tara
                    </button>
                  </div>
                </div>
              ) : null
            ) : scanned && scanError ? (
              <div className="rounded-3xl bg-card shadow-lg border border-border overflow-hidden">
                <div className="flex flex-col items-center gap-3 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                    <CameraIcon className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-base font-bold text-foreground-strong">QR işlenemedi</p>
                  <p className="text-xs text-foreground-subtle text-center">
                    Bağlantı sorunu nedeniyle firma bilgileri alınamadı. Lütfen tekrar deneyin.
                  </p>
                  <button
                    type="button"
                    onClick={() => { const code = scanned; setScanned(null); setScanError(false); if (code) void handleCompanyScan(code) }}
                    className="mt-1 w-full rounded-2xl py-3 text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
                  >
                    Tekrar Dene
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScanned(null); setScanError(false) }}
                    className="w-full rounded-2xl py-3 text-sm font-bold text-foreground-muted bg-surface-1"
                  >
                    Yeni QR Tara
                  </button>
                </div>
              </div>
            ) : scanned ? (
              <div className="rounded-3xl bg-card shadow-lg border border-border overflow-hidden">
                <div className="flex flex-col items-center gap-3 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                    <ShieldCheckIcon className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-base font-bold text-foreground-strong">QR Tarandı</p>
                  <p className="text-xs text-foreground-subtle break-all text-center font-mono bg-surface-1 rounded-xl px-4 py-2 w-full">{scanned}</p>
                  <button type="button" onClick={() => setScanned(null)} className="mt-1 w-full rounded-2xl py-3 text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
                    Tekrar Tara
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-card shadow-lg border border-border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
                      <CameraIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground-strong">Firma QR Kodunu Tara</p>
                      <p className="text-xs text-foreground-subtle">Firmadaki QR kodu kamerayla okutun, kampanyaları görün</p>
                    </div>
                  </div>
                  <QrScanner onScan={handleCompanyScan} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

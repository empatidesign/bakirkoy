import { useEffect, useState, useCallback } from 'react'
import { QrCodeIcon, RefreshCwIcon, PrinterIcon, DownloadIcon } from 'lucide-react'
import { QrCode } from '@/design-system/QrCode/QrCode'
import { ModuleHeader, Button, EmptyState } from '@/design-system'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import companyMeService from '@/services/companyMe.service'

interface CompanyQrData {
  id: string
  staticCode: string
  isActive: boolean
  validUntil?: string
}

export const CompanyQrPage = () => {
  const { state } = useCompanyAuth()
  const company = state.status === 'authenticated' ? state.company : undefined
  const isApproved = company?.status === 'Approved'

  const [qrData, setQrData] = useState<CompanyQrData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!isApproved) return
    setLoading(true)
    setError(false)
    try {
      const data = await companyMeService.getMyQr()
      setQrData(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [isApproved])

  useEffect(() => { void load() }, [load])

  const qrValue = qrData?.staticCode ?? ''

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader icon={QrCodeIcon} title="Firma QR Kodum" subtitle="Bu QR'ı müşterilerin okutması için görünür bir yere koyun" gradient="linear-gradient(160deg, #7c2d12 0%, #c2410c 55%, #f97316 100%)" />

      <div className="flex-1 overflow-auto p-4">
        {!isApproved ? (
          <EmptyState icon={QrCodeIcon} title="QR kodu kullanılamıyor" description="Firmanız onaylandıktan sonra QR kodu oluşturabilirsiniz." />
        ) : loading ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <RefreshCwIcon className="h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-sm text-foreground-muted">QR kodu yükleniyor...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-danger">QR kodu yüklenemedi.</p>
            <Button variant="outline" size="sm" onClick={load}>Tekrar Dene</Button>
          </div>
        ) : qrData ? (
          <div className="flex flex-col items-center gap-5">
            <div className="w-full max-w-sm rounded-3xl bg-card shadow-lg border border-border overflow-hidden">
              <div className="flex flex-col items-center gap-4 p-6">
                <div className="rounded-2xl p-4" style={{ background: '#f8f9ff', border: '1px solid rgba(99,102,241,0.12)' }}>
                  <QrCode value={qrValue} size={220} />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground-strong">{company?.name}</p>
                  {qrData.validUntil && (
                    <p className="text-xs text-foreground-subtle mt-1">
                      Geçerlilik: {new Date(qrData.validUntil).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 border-t border-border px-5 py-3">
                <Button variant="outline" size="sm" className="flex-1" iconLeft={<PrinterIcon className="h-4 w-4" />}>
                  Yazdır
                </Button>
                <Button variant="outline" size="sm" className="flex-1" iconLeft={<DownloadIcon className="h-4 w-4" />}>
                  İndir
                </Button>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-1 p-4">
              <p className="text-xs font-semibold text-foreground-muted mb-2">Kullanım Talimatı</p>
              <ul className="space-y-1.5">
                {[
                  'Bu QR kodu kasa yanına veya vitrine yapıştırın',
                  'Müşteri kendi telefonuyla QR\'ı okutur',
                  'Sistem otomatik olarak kampanyalarınızı gösterir',
                  'Müşteri kampanyayı seçer ve onaylarsınız',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground-muted">
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary/10 text-center text-[10px] font-bold text-primary leading-4">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

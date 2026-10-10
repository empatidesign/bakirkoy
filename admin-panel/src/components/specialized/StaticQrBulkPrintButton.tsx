import { useState } from 'react'
import { toast } from 'sonner'
import { QrCodeIcon } from 'lucide-react'
import { Button, Tooltip } from '@/design-system'
import { labeledQrsOf, openPrintWindow, printLabeledQrs, type StaticQrInfo } from '@/lib/staticQrPrint'

interface Props {
  title: string
  loadTargets: () => Promise<{ id: string; name: string }[]>
  loadQr: (id: string) => Promise<StaticQrInfo>
  className?: string
  iconOnly?: boolean
}

export const StaticQrBulkPrintButton = ({ title, loadTargets, loadQr, className, iconOnly }: Props) => {
  const [loading, setLoading] = useState(false)

  const run = async () => {
    const win = openPrintWindow()
    if (!win) {
      toast.error('Yazdırma penceresi açılamadı. Tarayıcının açılır pencere iznini kontrol edin.')
      return
    }
    win.document.write('<p style="font-family:sans-serif;padding:24px">QR kodları hazırlanıyor…</p>')
    setLoading(true)
    try {
      const targets = await loadTargets()
      const infos = await Promise.all(targets.map((t) => loadQr(t.id).catch(() => null)))
      const qrs = targets.flatMap((t, i) => labeledQrsOf(t.name, infos[i]))
      if (!printLabeledQrs(qrs, title, win)) {
        toast.info('Sabit QR\'ı etkin kayıt bulunamadı.')
        return
      }
      const owners = new Set(qrs.map((q) => q.name)).size
      toast.success(`${owners} kayıt için ${qrs.length} QR yazdırmaya hazırlandı.`)
    } catch {
      win.close()
    } finally {
      setLoading(false)
    }
  }

  if (iconOnly) {
    return (
      <Tooltip label="QR'ları Toplu Yazdır">
        <Button variant="outline" size="md" className={className} isLoading={loading} onClick={run} aria-label="QR'ları Toplu Yazdır">
          {!loading && <QrCodeIcon className="h-4 w-4 text-gray-500" />}
        </Button>
      </Tooltip>
    )
  }

  return (
    <Button variant="outline" size="md" className={className} isLoading={loading} onClick={run}
      iconLeft={<QrCodeIcon className="h-4 w-4 text-gray-500" />}>
      QR'ları Toplu Yazdır
    </Button>
  )
}

import { useEffect, useRef, useState } from 'react'
import { PauseIcon, PlayIcon } from 'lucide-react'
import { Button, Modal, Progress, Badge } from '@/design-system'
import { api } from '@/services/api'
import participantService from '@/services/participant.service'
import type { Participant } from '@/types/participant.types'
import { GENDER_LABELS } from '@/types/participant.types'

// Kullanıcı isteği (2026-10-06): admin panelden NVİ bilgileri tek tek ya da toplu sorgulansın;
// her 3 saniyede bir kişi sorgulanır, ad soyad / cinsiyet / doğum tarihi / adres ve 18 yaş
// altı çocuklar getirilir (bkz. POST /participants/{id}/nvi-refresh). Toplu modda ya seçili
// satırlar ya da "NVİ'den hiç sorgulanmamış" tüm katılımcılar sırayla işlenir.
const INTERVAL_MS = 3000

type Mode = { kind: 'selected'; ids: string[] } | { kind: 'unsynced' }
interface LogRow { name: string; ok: boolean; detail: string }

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Sorgu başarısız'

export function ParticipantNviBulkModal({ mode, onClose, onDone }: { mode: Mode | null; onClose: () => void; onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [fail, setFail] = useState(0)
  const [log, setLog] = useState<LogRow[]>([])
  const stopRef = useRef(false)
  const processedRef = useRef(new Set<string>())

  useEffect(() => {
    if (!mode) return
    setDone(0); setFail(0); setLog([]); setRunning(false); stopRef.current = false; processedRef.current = new Set()
    if (mode.kind === 'selected') setTotal(mode.ids.length)
    else participantService.getList({ page: 1, limit: 1, nviSynced: false }).then((r) => setTotal(r.total))
  }, [mode])

  const nextIds = async (processed: Set<string>): Promise<string[]> => {
    if (!mode) return []
    if (mode.kind === 'selected') return mode.ids.filter((id) => !processed.has(id))
    // Sorgulanan kayıt LastNviSyncAt aldığı için listeden düşer; hatalı olanlar düşmediğinden
    // sayfayı onları atlayacak kadar büyük çekiyoruz.
    const res = await participantService.getList({ page: 1, limit: 100, nviSynced: false, sort: 'registeredAt', order: 'asc' })
    return res.items.map((p) => p.id).filter((id) => !processed.has(id))
  }

  const run = async () => {
    stopRef.current = false
    setRunning(true)
    const processed = processedRef.current
    try {
      while (!stopRef.current) {
        const ids = await nextIds(processed)
        if (ids.length === 0) break
        const id = ids[0]
        processed.add(id)
        try {
          const res = await api.post<{ data: Participant }>(`/participants/${id}/nvi-refresh`)
          const p = res.data.data
          setLog((l) => [{ name: p.fullName, ok: true, detail: [GENDER_LABELS[p.gender], p.neighborhood ?? p.district, `${p.childrenCount} çocuk`].filter(Boolean).join(' · ') }, ...l].slice(0, 200))
        } catch (e) {
          setFail((f) => f + 1)
          setLog((l) => [{ name: id.slice(0, 8), ok: false, detail: errorMessage(e) }, ...l].slice(0, 200))
        }
        setDone((d) => d + 1)
        await new Promise((r) => setTimeout(r, INTERVAL_MS))
      }
    } finally {
      setRunning(false)
      onDone()
    }
  }

  const close = () => { stopRef.current = true; onClose() }
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0

  return (
    <Modal
      open={!!mode}
      onClose={close}
      title="NVİ Toplu Sorgulama"
      subtitle={`Her ${INTERVAL_MS / 1000} saniyede bir kişi sorgulanır: ad soyad, cinsiyet, doğum tarihi, adres ve 18 yaş altı çocuklar`}
      width={640}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="type-caption">{done} / {total} işlendi · {fail} hata</span>
          {running
            ? <Button variant="outline" iconLeft={<PauseIcon className="h-4 w-4" />} onClick={() => { stopRef.current = true }}>Durdur</Button>
            : <Button iconLeft={<PlayIcon className="h-4 w-4" />} disabled={total === 0} onClick={() => void run()}>{done ? 'Devam Et' : 'Başlat'}</Button>}
        </div>
      }
    >
      <div className="space-y-3">
        <p className="type-body">
          {mode?.kind === 'selected' ? `${total} seçili katılımcı sorgulanacak.` : `NVİ'den hiç sorgulanmamış ${total.toLocaleString('tr-TR')} katılımcı sırayla sorgulanacak.`}
          {' '}Pencere açık kaldığı sürece işlem devam eder, Durdur ile istediğiniz an kesebilirsiniz.
        </p>
        <Progress value={pct} tone={fail ? 'warning' : 'primary'} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {log.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b border-border py-1 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="flex items-center gap-2">
                <span className="type-caption truncate">{r.detail}</span>
                <Badge tone={r.ok ? 'success' : 'danger'}>{r.ok ? 'Güncellendi' : 'Hata'}</Badge>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

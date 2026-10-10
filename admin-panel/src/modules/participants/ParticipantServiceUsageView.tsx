import { useEffect, useState } from 'react'
import { AwardIcon, CheckCircle2Icon, SaveIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Card, EmptyState, Badge, Button, Field, DatePicker, Switch, Textarea, Select } from '@/design-system'
import { formatDate } from '@/lib/utils'
import participantServiceUsageService from '@/services/participantServiceUsage.service'
import type { ParticipantServiceUsage } from '@/services/participantServiceUsage.service'

interface ModuleOption { module: string; label: string }

const SIMPLE_SERVICE_MODULES: ModuleOption[] = [
  { module: 'accessible-life', label: 'Engelsiz Yaşam' },
]

export const ParticipantServiceUsageView = ({ participantId }: { participantId: string }) => {
  const [module, setModule] = useState(SIMPLE_SERVICE_MODULES[0].module)
  const [usage, setUsage] = useState<ParticipantServiceUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [hasReceived, setHasReceived] = useState(false)
  const [firstDate, setFirstDate] = useState('')
  const [lastDate, setLastDate] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    participantServiceUsageService.get(participantId, module)
      .then((u) => {
        if (cancelled) return
        setUsage(u)
        setHasReceived(u?.hasReceivedService ?? false)
        setFirstDate(u?.firstServiceDate ? u.firstServiceDate.slice(0, 10) : '')
        setLastDate(u?.lastServiceDate ? u.lastServiceDate.slice(0, 10) : '')
        setNote(u?.note ?? '')
      })
      .catch(() => { if (!cancelled) setUsage(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [participantId, module])

  const save = async () => {
    setSaving(true)
    try {
      const saved = await participantServiceUsageService.set(participantId, module, {
        hasReceivedService: hasReceived,
        firstServiceDate: firstDate || null,
        lastServiceDate: lastDate || null,
        note: note.trim() || null,
      })
      setUsage(saved)
      toast.success('Kayıt güncellendi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padded className="space-y-4 py-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AwardIcon className="h-4 w-4 text-[#0f4c81]" />
          <p className="type-section">Hizmet Kullanım Kayıtları</p>
        </div>
        {SIMPLE_SERVICE_MODULES.length > 1 && (
          <Select value={module} onChange={(e) => setModule(e.target.value)} className="w-48">
            {SIMPLE_SERVICE_MODULES.map((m) => <option key={m.module} value={m.module}>{m.label}</option>)}
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-foreground-muted">
          <Loader2Icon className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-4 py-3">
            <div className="flex items-center gap-2">
              {hasReceived
                ? <CheckCircle2Icon className="h-4 w-4 text-success" />
                : <span className="h-4 w-4" />}
              <div>
                <p className="type-body-strong">
                  {SIMPLE_SERVICE_MODULES.find((m) => m.module === module)?.label} hizmeti daha önce alındı mı?
                </p>
                <p className="type-caption">Grup/seans oluşturulmadan tutulan basit kullanım kaydı.</p>
              </div>
            </div>
            <Switch checked={hasReceived} onCheckedChange={setHasReceived} />
          </div>

          {hasReceived && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="İlk Hizmet Tarihi">
                <DatePicker value={firstDate} onChange={setFirstDate} clearable />
              </Field>
              <Field label="Son Hizmet Tarihi">
                <DatePicker value={lastDate} onChange={setLastDate} clearable />
              </Field>
            </div>
          )}

          <Field label="Not">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Kullanım hakkı ile ilgili not ekleyin (opsiyonel)..." />
          </Field>

          {usage?.branchName && (
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">Son bilinen program: {usage.branchName}</Badge>
              {usage.facilityName && <Badge tone="neutral">{usage.facilityName}</Badge>}
            </div>
          )}

          {usage?.updatedAt && (
            <p className="type-caption text-foreground-muted">Son güncelleme: {formatDate(usage.updatedAt)}</p>
          )}

          <div className="flex justify-end">
            <Button variant="primary" size="sm" isLoading={saving} onClick={save}>
              <SaveIcon className="h-4 w-4" /> Kaydet
            </Button>
          </div>
        </div>
      )}

      {!loading && !hasReceived && !usage && (
        <EmptyState icon={AwardIcon} title="Kayıt bulunmuyor" description="Bu katılımcı için henüz hizmet kullanım kaydı oluşturulmadı." />
      )}
    </Card>
  )
}

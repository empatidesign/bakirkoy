import { useEffect, useState } from 'react'
import {
  GraduationCapIcon, PlusIcon, ClipboardListIcon, ClockIcon, BookOpenIcon, TrophyIcon, ChevronDownIcon, ChevronUpIcon,
} from 'lucide-react'
import {
  ModuleHeader, Card, Badge, Button, Modal, Field, Select,
  Textarea, EmptyState, SkeletonRows, Banner, DetailRow,
} from '@/design-system'
import { formatDate, maskTC, maskPhone } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import { toast } from 'sonner'
import sedaService from '@/services/seda.service'
import type {
  CitizenSedaInfoDto,
  CitizenSedaResultItemDto,
  CitizenSedaOptionsDto,
  SedaApplicationDto,
  CitizenSedaApplyRequest,
} from '@/types/seda.types'
import { SEDA_STATUS_LABELS, SEDA_STATUS_TONE } from '@/types/seda.types'
import type { PagedResult } from '@/types/common'

type SedaTab = 'info' | 'applications' | 'result'

const EMPTY_FORM: CitizenSedaApplyRequest = {
  schoolName: '',
  nextYearGrade: '',
  educationType: '',
  examCenterName: '',
  notes: '',
}

export const SedaPage = () => {
  const [tab, setTab] = useState<SedaTab>('info')

  const [info, setInfo] = useState<CitizenSedaInfoDto | null>(null)
  const [options, setOptions] = useState<CitizenSedaOptionsDto | null>(null)
  const [result, setResult] = useState<PagedResult<SedaApplicationDto> | null>(null)
  const [myResults, setMyResults] = useState<CitizenSedaResultItemDto[]>([])
  const [expandedYear, setExpandedYear] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [infoReloadKey, setInfoReloadKey] = useState(0)
  const [appsLoading, setAppsLoading] = useState(false)
  const [appsError, setAppsError] = useState(false)
  const [appsReloadKey, setAppsReloadKey] = useState(0)
  const [resultLoading, setResultLoading] = useState(false)
  const [resultError, setResultError] = useState(false)

  const { state: auth } = useAuth()
  const me = auth.status === 'authenticated' ? auth.user : null
  const [applyOpen, setApplyOpen] = useState(false)
  const [form, setForm] = useState<CitizenSedaApplyRequest>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.allSettled([sedaService.info(), sedaService.options()]).then(([infoRes, optRes]) => {
      if (!active) return
      if (infoRes.status === 'fulfilled') setInfo(infoRes.value)
      if (optRes.status === 'fulfilled') setOptions(optRes.value)
      setLoading(false)
    })
    return () => { active = false }
  }, [infoReloadKey])

  useEffect(() => {
    if (tab !== 'applications') return
    let active = true
    setAppsLoading(true)
    setAppsError(false)
    sedaService.myApplications().then((r) => {
      if (active) { setResult(r); setAppsLoading(false) }
    }).catch(() => {
      if (active) {
        setAppsError(true)
        setAppsLoading(false)
      }
    })
    return () => { active = false }
  }, [tab, appsReloadKey])

  useEffect(() => {
    if (tab !== 'result') return
    let active = true
    setResultLoading(true)
    setResultError(false)
    sedaService.myResults().then((r) => {
      if (active) { setMyResults(r); setResultLoading(false) }
    }).catch(() => {
      if (active) {
        setResultError(true)
        setResultLoading(false)
      }
    })
    return () => { active = false }
  }, [tab])

  const openApply = () => {
    setForm(EMPTY_FORM)
    if (options === null) setInfoReloadKey((k) => k + 1)
    setApplyOpen(true)
  }

  const handleSubmit = async () => {
    if (submitting) return
    if (!form.schoolName || !form.nextYearGrade || !form.educationType || !form.examCenterName) {
      toast.warning('Lütfen zorunlu alanları doldurunuz.')
      return
    }
    setSubmitting(true)
    try {
      const created = await sedaService.apply(form)
      setResult(prev => prev
        ? { ...prev, items: [created, ...prev.items], total: prev.total + 1 }
        : { items: [created], total: 1, page: 1, limit: 25, totalPages: 1 }
      )
      setApplyOpen(false)
      toast.success('Başvurunuz alındı.')
      setTab('applications')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Başvuru gönderilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={GraduationCapIcon}
        title="Eğitim Kurs"
        subtitle="Eğitim desteği başvurusu"
        gradient="linear-gradient(160deg, #1e3a5f 0%, #0369a1 55%, #0ea5e9 100%)"
        tabs={[
          { key: 'info', label: 'Başvur', icon: GraduationCapIcon },
          { key: 'applications', label: 'Başvurularım', icon: ClipboardListIcon },
          { key: 'result', label: 'Sonucum', icon: TrophyIcon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as SedaTab)}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'info' && (
          <div className="space-y-4">
            {loading ? (
              <Card padded><SkeletonRows rows={3} /></Card>
            ) : (
              <Card padded>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {info?.applicationsOpen ? (
                        <Badge tone="success">Başvuru Açık</Badge>
                      ) : (
                        <Badge tone="danger">Başvuru Kapalı</Badge>
                      )}
                      {info?.requireApproval && (
                        <Badge tone="warning">Onay Gerekli</Badge>
                      )}
                    </div>
                    {info?.activePeriod ? (
                      <div className="space-y-1">
                        <p className="type-body-strong">{info.activePeriod.name}</p>
                        <p className="type-caption text-foreground-muted">
                          {formatDate(info.activePeriod.startDate)} – {formatDate(info.activePeriod.endDate)}
                        </p>
                        <p className="type-caption text-foreground-muted">
                          {info.activePeriod.currentApplications} / {info.activePeriod.maxApplications} başvuru
                        </p>
                        {info.activePeriod.description && (
                          <p className="type-caption text-foreground-muted">{info.activePeriod.description}</p>
                        )}
                      </div>
                    ) : (
                      <p className="type-caption text-foreground-muted">Aktif dönem bulunmuyor.</p>
                    )}
                  </div>
                  {info?.applicationsOpen && (
                    <Button variant="primary" size="sm" iconLeft={<PlusIcon className="h-3.5 w-3.5" />} onClick={openApply}>
                      Başvur
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'applications' && (
          <div className="space-y-2">
            {appsLoading ? (
              <Card padded><SkeletonRows rows={3} /></Card>
            ) : appsError ? (
              <Card padded>
                <EmptyState
                  icon={ClipboardListIcon}
                  title="Başvurular yüklenemedi"
                  description="Bağlantınızı kontrol edip tekrar deneyin."
                />
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => setAppsReloadKey((k) => k + 1)}>
                    Tekrar Dene
                  </Button>
                </div>
              </Card>
            ) : !result || result.items.length === 0 ? (
              <Card padded>
                <EmptyState
                  icon={ClipboardListIcon}
                  title="Başvuru yok"
                  description="Henüz SEDA eğitim başvurusu yapmadınız."
                />
              </Card>
            ) : (
              result.items.map((a) => (
                <Card key={a.id} padded>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <BookOpenIcon className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                        <p className="type-body-strong truncate">
                          {a.studentName} {a.studentSurname}
                        </p>
                      </div>
                      <p className="type-caption text-foreground-muted">{a.schoolName} · {a.nextYearGrade}</p>
                      <p className="type-caption text-foreground-muted">
                        <ClockIcon className="mr-0.5 inline h-3 w-3" />
                        {formatDate(a.createdAt)} · {a.code}
                      </p>
                      {a.rejectionReason && (
                        <Banner variant="soft" tone="danger" className="mt-1.5">
                          {a.rejectionReason}
                        </Banner>
                      )}
                    </div>
                    <Badge tone={SEDA_STATUS_TONE[a.status]}>
                      {SEDA_STATUS_LABELS[a.status]}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'result' && (
          <div className="space-y-3">
            {resultLoading ? (
              <Card padded><SkeletonRows rows={3} /></Card>
            ) : resultError ? (
              <Card padded>
                <EmptyState
                  icon={TrophyIcon}
                  title="Sonuç yüklenemedi"
                  description="Bağlantınızı kontrol edip tekrar deneyin."
                />
              </Card>
            ) : myResults.length === 0 ? (
              <Card padded>
                <EmptyState
                  icon={TrophyIcon}
                  title="Henüz bir sonuç kaydınız yok"
                  description="TC kimlik numaranız veya kayıtlı telefon numaranızla eşleşen bir SEDA eğitim/sınav sonucu bulunamadı."
                />
              </Card>
            ) : (
              // Kullanıcı isteği (2026-08-12): "her eğitim öğretim yılı için gerekli olacak" —
              // tekil "aktif dönem" kartı yerine, TCKN veya telefon numarasıyla eşleşen TÜM
              // yılların listesi (her biri kendi kazandı/kazanmadı, puan, sıra, detay bilgisiyle).
              myResults.map((r) => {
                const key = `${r.academicYear}-${r.periodName ?? ''}`
                const isExpanded = expandedYear === key
                let extras: Record<string, string> = {}
                try { extras = JSON.parse(r.detailsJson || '{}') } catch { extras = {} }
                const extraEntries = Object.entries(extras)
                return (
                  <Card key={key} padded>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-card p-3 ${r.isWinner ? 'bg-success-soft text-success' : 'bg-surface-2 text-foreground-muted'}`}>
                          <TrophyIcon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Badge tone={r.isWinner ? 'success' : 'neutral'}>{r.isWinner ? 'Kazandınız' : 'Kazanamadınız'}</Badge>
                          <p className="mt-2 type-section">{r.periodName ?? r.academicYear}</p>
                          {r.matchedBy === 'phone' && (
                            <p className="type-caption text-foreground-muted">Telefon numaranızla eşleşti.</p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-card bg-surface-1 p-3">
                          <p className="type-caption text-foreground-muted">Puan</p>
                          <p className="type-kpi-value tabular-nums">{r.score ?? '—'}</p>
                        </div>
                        <div className="rounded-card bg-surface-1 p-3">
                          <p className="type-caption text-foreground-muted">Sıra</p>
                          <p className="type-kpi-value tabular-nums">{r.rank ?? '—'}</p>
                        </div>
                        <div className="rounded-card bg-surface-1 p-3">
                          <p className="type-caption text-foreground-muted">Sonuç</p>
                          <p className="type-body-strong">{r.resultNote || (r.isWinner ? 'Kazandı' : '—')}</p>
                        </div>
                      </div>
                      {extraEntries.length > 0 && (
                        <div>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-card border border-border px-3 py-2 text-left type-caption font-semibold text-foreground-muted"
                            onClick={() => setExpandedYear(isExpanded ? null : key)}
                          >
                            Detayları Göster
                            {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 rounded-card border border-border">
                              {extraEntries.map(([field, value]) => <DetailRow key={field} label={field}>{value}</DetailRow>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </div>

      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Eğitim Kurs Başvurusu"
        width={560}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setApplyOpen(false)} disabled={submitting}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
              Başvur
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <Banner variant="soft" tone="info">
            Kimlik ve iletişim bilgileriniz sistemde kayıtlı olduğu için tekrar istenmez;
            başvurunuza aşağıdaki bilgilerle otomatik eklenir.
          </Banner>

          {me && (
            <div className="rounded-card border border-border bg-surface-1 p-3">
              <p className="type-caption text-foreground-muted mb-1.5">Başvuru sahibi</p>
              <DetailRow label="Ad Soyad">{me.fullName}</DetailRow>
              <DetailRow label="T.C. Kimlik No">{maskTC(me.tckn)}</DetailRow>
              {me.phone && <DetailRow label="Telefon">{maskPhone(me.phone)}</DetailRow>}
            </div>
          )}

          {!loading && options === null && (
            <Banner variant="soft" tone="danger">
              Form seçenekleri yüklenemedi. Bağlantınızı kontrol edip{' '}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setInfoReloadKey((k) => k + 1)}
              >
                tekrar deneyin
              </button>
              .
            </Banner>
          )}

          <Field label="Okul" required>
            <Select
              value={form.schoolName}
              onChange={(e) => setForm(f => ({ ...f, schoolName: e.target.value }))}
              placeholder="Okul seçiniz"
            >
              {(options?.schools ?? []).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Gelecek Yıl Sınıfı" required>
              <Select
                value={form.nextYearGrade}
                onChange={(e) => setForm(f => ({ ...f, nextYearGrade: e.target.value }))}
                placeholder="Sınıf"
              >
                {(options?.grades ?? []).map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </Select>
            </Field>
            <Field label="Eğitim Türü" required>
              <Select
                value={form.educationType}
                onChange={(e) => setForm(f => ({ ...f, educationType: e.target.value }))}
                placeholder="Tür"
              >
                {(options?.educationTypes ?? []).map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Sınav Merkezi" required>
            <Select
              value={form.examCenterName}
              onChange={(e) => setForm(f => ({ ...f, examCenterName: e.target.value }))}
              placeholder="Merkez seçiniz"
            >
              {(options?.examCenters ?? []).map(ec => <option key={ec.value} value={ec.value}>{ec.label}</option>)}
            </Select>
          </Field>

          <Field label="Notlar">
            <Textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Eklemek istediğiniz bilgiler..."
              rows={2}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

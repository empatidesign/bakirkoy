import { useCallback, useEffect, useState } from 'react'
import {
  CreditCardIcon, CheckCircle2Icon, ClockIcon, XCircleIcon,
  WalletIcon, CalendarIcon, UserIcon, FileTextIcon, QrCodeIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  Badge, Select, FilterField, IconButton, Button, Modal, Field, Input, Textarea,
  FormSection, DetailRow, AdminFormShell,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import bakkartService from '@/services/bakkart.service'
import type {
  BakkartApplication, BakkartApplicationSummary, AdminCreateBakkartApplicationRequest,
  BakkartCardStats, BakkartTransaction,
} from '@/types/bakkart.types'
import {
  BAKKART_STATUS_LABELS, BAKKART_STATUS_TONE, BAKKART_STATUS_OPTIONS,
  BAKKART_CARD_TYPE_LABELS, BAKKART_CARD_TYPE_OPTIONS, BAKKART_DELIVERY_TYPE_LABELS,
  BAKKART_CARD_STATUS_LABELS, BAKKART_CARD_STATUS_TONE, BAKKART_TRANSACTION_TYPE_LABELS,
} from '@/types/bakkart.types'
import { maskTC } from '@/lib/utils'

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')
const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—')

type NoForm = AdminCreateBakkartApplicationRequest

const emptyForm = (): NoForm => ({ fullName: '', tckn: '', phone: '', district: 'Zuhuratbaba', cardType: 'Standard' })

export const BakkartBasvurulariTab = ({ embedded }: { embedded?: boolean } = {}) => {
  const { can } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [cardTypeFilter, setCardTypeFilter] = useState('')
  const [summary, setSummary] = useState<BakkartApplicationSummary | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const [rejectTarget, setRejectTarget] = useState<BakkartApplication | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const [adjustTarget, setAdjustTarget] = useState<BakkartApplication | null>(null)
  const [adjustBalance, setAdjustBalance] = useState('')
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [cardStats, setCardStats] = useState<BakkartCardStats | null>(null)
  const [cardTx, setCardTx] = useState<BakkartTransaction[]>([])

  const loadSummary = useCallback(() => {
    bakkartService.getSummary().then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])

  const hasActiveFilters = !!statusFilter || !!cardTypeFilter
  const extraParams: Record<string, string> = {}
  if (statusFilter) extraParams.status = statusFilter
  if (cardTypeFilter) extraParams.cardType = cardTypeFilter

  const approve = async (row: BakkartApplication) => {
    setApprovingId(row.id)
    try {
      await bakkartService.approve(row.id)
      toast.success(`Bakkart başvurusu onaylandı. ${row.fullName} için kart tanımlandı.`)
      setRefreshSignal((s) => s + 1)
      loadSummary()
    } catch {
      toast.error('Başvuru onaylanamadı.')
    } finally {
      setApprovingId(null)
    }
  }

  const openReject = (row: BakkartApplication) => {
    setRejectReason('')
    setRejectTarget(row)
  }

  const confirmReject = async () => {
    if (!rejectTarget || rejecting) return
    setRejecting(true)
    try {
      await bakkartService.reject(rejectTarget.id, { reason: rejectReason.trim() || undefined })
      toast.success('Bakkart başvurusu reddedildi.')
      setRejectTarget(null)
      setRefreshSignal((s) => s + 1)
      loadSummary()
    } catch {
      toast.error('Başvuru reddedilemedi.')
    } finally {
      setRejecting(false)
    }
  }

  const openAdjust = (row: BakkartApplication) => {
    setAdjustBalance('')
    setAdjustPoints('')
    setAdjustNote('')
    setCardStats(null)
    setCardTx([])
    setAdjustTarget(row)
    if (row.cardId) {
      bakkartService.getCardStats(row.cardId).then(setCardStats).catch(() => setCardStats(null))
      bakkartService.getCardTransactions(row.cardId).then(setCardTx).catch(() => setCardTx([]))
    }
  }

  const confirmAdjust = async () => {
    if (!adjustTarget?.cardId || adjusting) return
    const balanceDelta = adjustBalance.trim() ? Number(adjustBalance) : undefined
    const pointsDelta = adjustPoints.trim() ? Number(adjustPoints) : undefined
    if (balanceDelta === undefined && pointsDelta === undefined) {
      toast.error('Bakiye veya puan değişikliği girin.')
      return
    }
    setAdjusting(true)
    try {
      await bakkartService.adjustCard(adjustTarget.cardId, { balanceDelta, pointsDelta, note: adjustNote.trim() || undefined })
      toast.success('Bakkart bakiye/puan güncellendi.')
      setAdjustTarget(null)
      setRefreshSignal((s) => s + 1)
    } catch {
      toast.error('Güncelleme başarısız oldu.')
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <>
      <CrudListTemplate<BakkartApplication, NoForm>
        icon={CreditCardIcon}
        title="Bakkart Başvuruları"
        subtitle="Vatandaş portalından gelen Bakkart (Bakırköy Kent Kartı) başvurularını görüntüleyin, evrak takibini yapın ve kart tanımlayın"
        resourceName="Başvuru"
        listTitle="Başvuru Listesi"
        searchPlaceholder="Ad soyad, TC son 4 hane, telefon son 4 hane veya mahalle ara..."
        embedded={embedded}
        service={{
          getList: (p) => bakkartService.getList(p),
        }}
        rowKey={(r) => r.id}
        selectable={false}
        viewable
        drawerWidth={640}
        defaultSort={{ key: 'appliedAt', dir: 'desc' }}
        refreshSignal={refreshSignal}
        onMutated={loadSummary}
        extraParams={extraParams}
        filterColumns={2}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => { setStatusFilter(''); setCardTypeFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Onay Durumu">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                {BAKKART_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Kart Tipi">
              <Select value={cardTypeFilter} onChange={(e) => setCardTypeFilter(e.target.value)}>
                <option value="">Tüm Kart Tipleri</option>
                {BAKKART_CARD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
          </>
        )}
        stats={() => [
          { label: 'Toplam Başvuru', value: summary?.total ?? 0, icon: CreditCardIcon, accent: 'blue' },
          { label: 'Onay Bekleyen', value: summary?.pending ?? 0, icon: ClockIcon, accent: 'orange' },
          { label: 'Aktif Bakkart Sahibi', value: summary?.totalActiveCards ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Reddedilen', value: summary?.rejected ?? 0, icon: XCircleIcon, accent: 'violet' },
        ]}
        columns={[
          { key: 'trackingNo', header: 'Kart/Takip No', sortable: true, sortKey: 'trackingNo', cell: (r) => <span className="font-mono tabular-nums type-muted">{r.cardNo || r.trackingNo}</span> },
          {
            key: 'holder', header: 'Vatandaş Bilgisi',
            cell: (r) => (
              <div className="leading-tight">
                <span className="type-body-strong">{r.fullName}</span>
                <span className="block tabular-nums type-caption">TC: {maskTC(r.tckn)} • {r.phone}</span>
              </div>
            ),
          },
          { key: 'cardType', header: 'Kart Tipi', cell: (r) => <span className="type-muted">{BAKKART_CARD_TYPE_LABELS[r.cardType]}</span> },
          { key: 'district', header: 'Mahalle', sortable: true, sortKey: 'district', cell: (r) => <span className="type-muted">{r.district}</span> },
          {
            key: 'balance', header: 'Bakiye & Puan', align: 'right',
            cell: (r) => (
              <div className="leading-tight text-right">
                <span className="tabular-nums type-body-strong">{r.cardBalance != null ? `${r.cardBalance.toFixed(2)} ₺` : '—'}</span>
                <span className="block tabular-nums type-caption">{r.cardPoints != null ? `${r.cardPoints} Puan` : ''}</span>
              </div>
            ),
          },
          { key: 'applied', header: 'Başvuru Tarihi', sortable: true, sortKey: 'appliedAt', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.appliedAt)}</span> },
          { key: 'status', header: 'Durum', align: 'center', cell: (r) => <Badge tone={BAKKART_STATUS_TONE[r.status]}>{BAKKART_STATUS_LABELS[r.status]}</Badge> },
        ]}
        emptyForm={emptyForm()}
        toForm={() => emptyForm()}
        getFormErrors={(f) => [
          !f.fullName.trim() && 'Ad soyad zorunludur.',
          f.tckn.trim().length !== 11 && 'T.C. Kimlik Numarası 11 haneli olmalıdır.',
          !f.phone.trim() && 'Telefon numarası zorunludur.',
          !f.district.trim() && 'İkametgah mahallesi zorunludur.',
        ].filter(Boolean) as string[]}
        creatable={can('bakkart.create')}
        createButtonPlacement="header"
        renderForm={({ form, setForm }) => (
          <AdminFormShell icon={CreditCardIcon} title="Hızlı Kart Başvurusu" subtitle="Belediye santral/masa üzerinden vatandaş adına anında Bakkart tanımlayın" badge="Yeni Başvuru">
            <FormSection icon={UserIcon} title="Vatandaş Bilgileri" variant="card">
              <Field label="Ad Soyad" required>
                <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Ad Soyad" />
              </Field>
              <Field label="T.C. Kimlik No" required>
                <Input value={form.tckn} onChange={(e) => setForm((p) => ({ ...p, tckn: e.target.value.replace(/\D/g, '').slice(0, 11) }))} placeholder="11 haneli TCKN" maxLength={11} />
              </Field>
              <Field label="Telefon Numarası" required>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="05XX XXX XX XX" />
              </Field>
              <Field label="İkametgah Mahallesi" required>
                <Input value={form.district} onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))} placeholder="Mahalle" />
              </Field>
              <Field label="Kart Tipi" required>
                <Select value={form.cardType} onChange={(e) => setForm((p) => ({ ...p, cardType: e.target.value as NoForm['cardType'] }))}>
                  {BAKKART_CARD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
            </FormSection>
          </AdminFormShell>
        )}
        onCreate={can('bakkart.create') ? (f) => bakkartService.create(f).then(() => { loadSummary() }) : undefined}
        renderView={(row) => (
          <div className="space-y-4">
            <FormSection title="Vatandaş Bilgileri" icon={UserIcon} variant="card">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                <DetailRow label="Ad Soyad">{row.fullName}</DetailRow>
                <DetailRow label="T.C. Kimlik No">{maskTC(row.tckn)}</DetailRow>
                <DetailRow label="Telefon">{row.phone}</DetailRow>
                <DetailRow label="Mahalle">{row.district}</DetailRow>
              </div>
            </FormSection>
            <FormSection title="Kart Bilgileri" icon={CreditCardIcon} variant="card">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                <DetailRow label="Takip No">{row.trackingNo}</DetailRow>
                <DetailRow label="Kart No">{row.cardNo || '—'}</DetailRow>
                <DetailRow label="Kart Tipi">{BAKKART_CARD_TYPE_LABELS[row.cardType]}</DetailRow>
                <DetailRow label="Teslimat Tipi">{BAKKART_DELIVERY_TYPE_LABELS[row.deliveryType]}</DetailRow>
                <DetailRow label="Bakiye">{row.cardBalance != null ? `${row.cardBalance.toFixed(2)} ₺` : '—'}</DetailRow>
                <DetailRow label="Puan">{row.cardPoints != null ? `${row.cardPoints} Puan` : '—'}</DetailRow>
                <DetailRow label="Kart Durumu">{row.cardStatus ? <Badge tone={BAKKART_CARD_STATUS_TONE[row.cardStatus]}>{BAKKART_CARD_STATUS_LABELS[row.cardStatus]}</Badge> : '—'}</DetailRow>
                <DetailRow label="Başvuru Durumu"><Badge tone={BAKKART_STATUS_TONE[row.status]}>{BAKKART_STATUS_LABELS[row.status]}</Badge></DetailRow>
              </div>
            </FormSection>
            <FormSection title="Evrak / Belgeler" icon={FileTextIcon} variant="card">
              {row.documents.length === 0 ? (
                <p className="type-muted">Yüklenmiş evrak bulunmuyor.</p>
              ) : (
                <div className="space-y-1.5">
                  {row.documents.map((d, i) => (
                    <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 type-link">
                      <FileTextIcon className="h-3.5 w-3.5" /> {d.name}
                    </a>
                  ))}
                </div>
              )}
            </FormSection>
            <FormSection title="Başvuru Tarihleri" icon={CalendarIcon} variant="card">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                <DetailRow label="Başvuru Tarihi">{fmtDateTime(row.appliedAt)}</DetailRow>
                <DetailRow label="İnceleme Tarihi">{fmtDateTime(row.reviewedAt)}</DetailRow>
                <DetailRow label="İnceleyen">{row.reviewedBy || '—'}</DetailRow>
                {row.rejectReason && <DetailRow label="Red Gerekçesi">{row.rejectReason}</DetailRow>}
              </div>
            </FormSection>
          </div>
        )}
        canEdit={() => false}
        extraRowActions={(row) => (
          <>
            {row.status === 'Pending' && (
              <IconButton
                tone="success"
                title={can('bakkart.approve') ? 'Onayla' : 'Onaylama yetkiniz yok'}
                disabled={!can('bakkart.approve') || approvingId === row.id}
                onClick={() => approve(row)}
              >
                <CheckCircle2Icon className="h-4 w-4" />
              </IconButton>
            )}
            {row.status === 'Pending' && (
              <IconButton
                tone="danger"
                title={can('bakkart.approve') ? 'Reddet' : 'Reddetme yetkiniz yok'}
                disabled={!can('bakkart.approve')}
                onClick={() => openReject(row)}
              >
                <XCircleIcon className="h-4 w-4" />
              </IconButton>
            )}
            {row.status === 'Approved' && row.cardId && (
              <IconButton
                tone="primary"
                title={can('bakkart.edit') ? 'Bakiye / Puan İşlemi' : 'Düzenleme yetkiniz yok'}
                disabled={!can('bakkart.edit')}
                onClick={() => openAdjust(row)}
              >
                <WalletIcon className="h-4 w-4" />
              </IconButton>
            )}
          </>
        )}
      />

      <Modal
        open={!!rejectTarget}
        onClose={() => { if (!rejecting) setRejectTarget(null) }}
        title="Başvuruyu Reddet"
        width={480}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)} disabled={rejecting}>İptal</Button>
            <Button variant="danger" isLoading={rejecting} onClick={() => void confirmReject()}>Reddet</Button>
          </div>
        }
      >
        <div className="space-y-3 p-5">
          <p className="type-body text-foreground-muted">
            Gerekçe vatandaşa SMS/bildirim olarak iletilir. Boş bırakılırsa gerekçesiz red bildirimi gider.
          </p>
          <Field label="Red Gerekçesi">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Örn. İkametgah belgesi uyuşmuyor..."
              autoFocus
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!adjustTarget}
        onClose={() => { if (!adjusting) setAdjustTarget(null) }}
        title={adjustTarget ? `Bakkart Hesap Yönetimi — ${adjustTarget.fullName}` : ''}
        width={560}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdjustTarget(null)} disabled={adjusting}>Kapat</Button>
            <Button variant="primary" isLoading={adjusting} onClick={() => void confirmAdjust()}>Güncelle</Button>
          </div>
        }
      >
        <div className="space-y-4 p-5">
          {cardStats && (
            <FormSection title="Kart Özeti" icon={WalletIcon} variant="card">
              <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                <DetailRow label="Mevcut Bakiye"><span className="tabular-nums">{cardStats.currentBalance.toFixed(2)} ₺</span></DetailRow>
                <DetailRow label="Mevcut Puan"><span className="tabular-nums">{cardStats.currentPoints} Puan</span></DetailRow>
                <DetailRow label="Toplam Yüklenen"><span className="tabular-nums">{cardStats.totalLoaded.toFixed(2)} ₺</span></DetailRow>
                <DetailRow label="Toplam Kullanılan"><span className="tabular-nums">{cardStats.totalSpent.toFixed(2)} ₺</span></DetailRow>
                <DetailRow label="İşlem Sayısı"><span className="tabular-nums">{cardStats.transactionCount}</span></DetailRow>
                <DetailRow label="Son İşlem">{fmtDateTime(cardStats.lastTransactionAt)}</DetailRow>
              </div>
            </FormSection>
          )}

          <Field label="Bakiye Değişikliği (₺)" hint="Pozitif değer yükler, negatif değer düşer">
            <Input type="number" value={adjustBalance} onChange={(e) => setAdjustBalance(e.target.value)} placeholder="Örn: 250 veya -50" />
          </Field>
          <Field label="Puan Değişikliği" hint="Pozitif değer ekler, negatif değer düşer">
            <Input type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} placeholder="Örn: 50 veya -20" />
          </Field>
          <Field label="Not">
            <Textarea value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} rows={2} placeholder="İşlem gerekçesi (opsiyonel)" />
          </Field>

          {cardTx.length > 0 && (
            <div className="space-y-1.5">
              <p className="type-caption">Son İşlemler</p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-card border border-border">
                {cardTx.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-xs last:border-b-0">
                    <div className="flex items-center gap-1.5">
                      <QrCodeIcon className="h-3 w-3 text-foreground-subtle" />
                      <span>{BAKKART_TRANSACTION_TYPE_LABELS[t.type]}</span>
                    </div>
                    <div className="text-right tabular-nums">
                      {t.amountDelta !== 0 && <span>{t.amountDelta > 0 ? '+' : ''}{t.amountDelta.toFixed(2)} ₺ </span>}
                      {t.pointsDelta !== 0 && <span>{t.pointsDelta > 0 ? '+' : ''}{t.pointsDelta} Puan</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

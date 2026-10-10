import { useCallback, useEffect, useState } from 'react'
import { Icon2D } from '@/components/Icon2D'
import {
  ScanLineIcon, CheckCircle2Icon, TicketPercentIcon, UserIcon, RotateCcwIcon,
  LockIcon, ChevronRightIcon, CheckSquareIcon, SquareIcon, UserCircleIcon,
  CheckIcon, UsersRoundIcon,
} from 'lucide-react'
import {
  ModuleHeader, Card, Button, Field, Badge, EmptyState, SkeletonRows, Modal,
  PhoneInput, SegmentedControl, Avatar, Tabs, NumberInput,
} from '@/design-system'
import { QrScanner } from '@/components/specialized/QrScanner'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import companyMeService from '@/services/companyMe.service'
import { formatDiscount, type ActiveCampaignItem, type ScanCitizenResult, type RedemptionResult } from '@/types/companyCampaign.types'
import { CompanyCampaignUsagesTab } from './CompanyCampaignUsagesTab'

const ResultCard = ({ result, onAgain }: { result: RedemptionResult; onAgain: () => void }) => (
  <Card padded accent="primary">
    <div className="flex items-center gap-2 text-success mb-3">
      <CheckCircle2Icon className="h-6 w-6" />
      <p className="type-section">Kampanya kullandırıldı</p>
    </div>
    <div className="space-y-2 border-t border-border pt-3">
      <p className="type-body-strong flex items-center gap-1.5">
        <UserIcon className="h-4 w-4 text-foreground-muted" />
        {result.participantName}
      </p>
      {result.campaignName && (
        <p className="type-body flex items-center gap-1.5">
          <TicketPercentIcon className="h-4 w-4 text-foreground-muted" />
          {result.campaignName}
        </p>
      )}
      <p className="type-caption text-foreground-muted">
        İşlem kodu: <span className="font-mono font-medium">{result.redemptionCode}</span>
      </p>
    </div>
    <Button variant="outline" size="sm" className="mt-4 w-full" iconLeft={<RotateCcwIcon className="h-4 w-4" />} onClick={onAgain}>
      Yeni Kullandır
    </Button>
  </Card>
)

interface MultiOut { campaignName: string; ok: boolean; code?: string }
const MultiResultCard = ({ results, onAgain }: { results: MultiOut[]; onAgain: () => void }) => (
  <Card padded>
    <div className="flex items-center gap-2 text-success mb-3">
      <CheckCircle2Icon className="h-6 w-6" />
      <p className="type-section">Kullandırma tamamlandı</p>
    </div>
    <div className="space-y-2">
      {results.map((r, i) => (
        <div key={i} className="flex items-center gap-2 rounded-card bg-surface-1 px-3 py-2">
          {r.ok
            ? <CheckCircle2Icon className="h-4 w-4 text-success shrink-0" />
            : <div className="h-4 w-4 rounded-full bg-danger/10 shrink-0 flex items-center justify-center">
                <Icon2D kind="close" className="h-2.5 w-2.5 text-danger" />
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="type-caption font-medium truncate">{r.campaignName}</p>
            {r.ok && r.code && <p className="type-caption text-foreground-muted font-mono">{r.code}</p>}
          </div>
          <Badge tone={r.ok ? 'success' : 'danger'}>{r.ok ? 'Başarılı' : 'Başarısız'}</Badge>
        </div>
      ))}
    </div>
    <Button variant="outline" size="sm" className="mt-4 w-full" iconLeft={<RotateCcwIcon className="h-4 w-4" />} onClick={onAgain}>
      Yeni Kullandır
    </Button>
  </Card>
)

interface ScanPickerModalProps {
  open: boolean
  scan: ScanCitizenResult
  onConfirm: (campaignIds: string[], orderAmount?: number) => void
  onClose: () => void
  loading: boolean
}

const ScanPickerModal = ({ open, scan, onConfirm, onClose, loading }: ScanPickerModalProps) => {
  const [selected, setSelected] = useState<string[]>([])
  const [orderAmount, setOrderAmount] = useState(0)

  useEffect(() => {
    if (open) { setSelected([]); setOrderAmount(0) }
  }, [open])

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const hasCampaigns = scan.activeCampaigns.length > 0

  const requiredMin = scan.activeCampaigns
    .filter((c) => selected.includes(c.id))
    .reduce((max, c) => Math.max(max, c.minOrderAmount ?? 0), 0)
  const needsOrderAmount = requiredMin > 0
  const orderAmountValid = !needsOrderAmount || orderAmount >= requiredMin

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Kampanya Kullandır"
      width={440}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button
            variant="primary"
            className="flex-1"
            isLoading={loading}
            disabled={!hasCampaigns || selected.length === 0 || !orderAmountValid}
            onClick={() => onConfirm(selected, needsOrderAmount ? orderAmount : undefined)}
          >
            Kullandır ({selected.length})
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-3 rounded-card bg-surface-1 px-4 py-3">
          <Avatar name={scan.fullName} src={scan.photoUrl ?? undefined} size="md" />
          <div>
            <p className="type-body-strong">{scan.fullName}</p>
            <p className="type-caption text-foreground-muted">Üye vatandaş</p>
          </div>
        </div>

        {!hasCampaigns ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <TicketPercentIcon className="h-8 w-8 text-foreground-subtle" />
            <p className="type-body text-foreground-muted">Bu müşteri için aktif kampanya bulunmuyor.</p>
          </div>
        ) : (
          <>
            <p className="type-caption text-foreground-muted">
              Kampanya seçin. Birden fazla seçebilirsiniz.
            </p>
            <div className="space-y-2">
              {scan.activeCampaigns.map((c: ActiveCampaignItem) => {
                const isSelected = selected.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className="w-full flex items-center gap-3 rounded-card border px-3 py-3 text-left transition-colors"
                    style={{
                      borderColor: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                      backgroundColor: isSelected ? 'hsl(var(--primary)/0.05)' : 'hsl(var(--surface-0))',
                    }}
                  >
                    {isSelected
                      ? <CheckSquareIcon className="h-5 w-5 shrink-0 text-primary" />
                      : <SquareIcon className="h-5 w-5 shrink-0 text-foreground-muted" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="type-body-strong truncate">{c.name}</p>
                      <p className="type-caption text-foreground-muted">
                        {formatDiscount(c.discountType, c.discountValue)}
                        {c.description && ` · ${c.description}`}
                      </p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-foreground-subtle shrink-0" />
                  </button>
                )
              })}
            </div>

            {needsOrderAmount && (
              <Field
                label="Sepet Tutarı (₺)"
                required
                error={!orderAmountValid ? `Bu kampanya en az ${requiredMin.toLocaleString('tr-TR')} ₺ alışverişte geçerli.` : undefined}
              >
                <NumberInput value={orderAmount} onChange={setOrderAmount} min={0} suffix="₺" />
              </Field>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

type IdKind = 'tckn' | 'phone'

interface ManualPickerCampaign {
  id: string
  name: string
  discountType: string
  discountValue: number
  minOrderAmount?: number | null
}

interface ManualPickerModalProps {
  open: boolean
  campaigns: ManualPickerCampaign[]
  participantLabel: string
  onConfirm: (ids: string[], orderAmount?: number) => void
  onClose: () => void
  loading: boolean
}

const ManualPickerModal = ({ open, campaigns, participantLabel, onConfirm, onClose, loading }: ManualPickerModalProps) => {
  const [selected, setSelected] = useState<string[]>([])
  const [orderAmount, setOrderAmount] = useState(0)

  useEffect(() => {
    if (open) { setSelected([]); setOrderAmount(0) }
  }, [open])

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const requiredMin = campaigns
    .filter((c) => selected.includes(c.id))
    .reduce((max, c) => Math.max(max, c.minOrderAmount ?? 0), 0)
  const needsOrderAmount = requiredMin > 0
  const orderAmountValid = !needsOrderAmount || orderAmount >= requiredMin

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={500}
      header={
        <div className="-mx-6 -my-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-violet-900 px-6 py-5 text-white">
          <div className="flex items-center gap-3 pr-10">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10">
              <TicketPercentIcon className="h-5 w-5 text-violet-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Kampanya Seçin</h3>
              <p className="mt-0.5 text-xs text-violet-200">Uygulanacak kampanyaları belirleyin</p>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground-strong">{selected.length} kampanya seçildi</p>
            <p className="text-[11px] text-foreground-muted">Seçiminizi onaylayarak işlemi tamamlayın.</p>
          </div>
          <Button variant="outline" className="sm:min-w-24" onClick={onClose}>İptal</Button>
          <Button
            variant="primary"
            className="sm:min-w-36"
            isLoading={loading}
            disabled={selected.length === 0 || !orderAmountValid}
            onClick={() => onConfirm(selected, needsOrderAmount ? orderAmount : undefined)}
          >
            Kullandır ({selected.length})
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
            <UserCircleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Vatandaş bilgisi</p>
            <p className="truncate text-sm font-bold text-foreground-strong">{participantLabel}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground-strong">Uygun kampanyalar</p>
            <p className="text-xs text-foreground-muted">Birden fazla kampanya seçebilirsiniz.</p>
          </div>
          {campaigns.length > 1 && (
            <button
              type="button"
              onClick={() => setSelected(selected.length === campaigns.length ? [] : campaigns.map((campaign) => campaign.id))}
              className="text-xs font-bold text-primary hover:underline"
            >
              {selected.length === campaigns.length ? 'Seçimi temizle' : 'Tümünü seç'}
            </button>
          )}
        </div>
        <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
          {campaigns.map((c) => {
            const isSelected = selected.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`group flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary-soft shadow-sm ring-1 ring-primary/10'
                    : 'border-border bg-white hover:border-primary/40 hover:bg-surface-1'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-violet-50 text-violet-600'}`}>
                  <TicketPercentIcon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="type-body-strong truncate">{c.name}</p>
                  <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${isSelected ? 'bg-white text-primary' : 'bg-emerald-50 text-emerald-700'}`}>
                    {formatDiscount(c.discountType as 'percentage' | 'fixed', c.discountValue)}
                  </p>
                </div>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-primary bg-primary text-white' : 'border-border bg-white text-transparent'}`}>
                  <CheckIcon className="h-4 w-4" strokeWidth={3} />
                </span>
              </button>
            )
          })}
        </div>

        {needsOrderAmount && (
          <Field
            label="Sepet Tutarı (₺)"
            required
            error={!orderAmountValid ? `Bu kampanya en az ${requiredMin.toLocaleString('tr-TR')} ₺ alışverişte geçerli.` : undefined}
          >
            <NumberInput value={orderAmount} onChange={setOrderAmount} min={0} suffix="₺" />
          </Field>
        )}
      </div>
    </Modal>
  )
}
type Mode = 'manual' | 'qr'

export const CompanyRedeemPageBody = ({ isApproved }: { isApproved: boolean }) => {
  const [mainTab, setMainTab] = useState<'redeem' | 'usages'>('redeem')
  const [mode, setMode] = useState<Mode>('manual')
  const [scanNonce, setScanNonce] = useState(0)

  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanCitizenResult | null>(null)
  const [pickerLoading, setPickerLoading] = useState(false)

  const [campaigns, setCampaigns] = useState<ManualPickerCampaign[] | null>(null)
  const [idKind] = useState<IdKind>('phone')
  const [tckn, setTckn] = useState('')
  const [phone, setPhone] = useState('')
  const [manualPickerOpen, setManualPickerOpen] = useState(false)
  const [manualPickerLoading, setManualPickerLoading] = useState(false)

  const [result, setResult] = useState<RedemptionResult | null>(null)
  const [multiResults, setMultiResults] = useState<MultiOut[] | null>(null)

  useEffect(() => {
    if (!isApproved) { setCampaigns([]); return }
    let active = true
    companyMeService.redeemableCampaigns()
      .then((r) => {
        if (active) setCampaigns(
          r.items
            .filter((c) => c.status === 'Active')
            .map((c) => ({ id: c.id, name: c.name, discountType: c.discountType, discountValue: c.discountValue, minOrderAmount: c.minOrderAmount }))
        )
      })
      .catch(() => { if (active) setCampaigns([]) })
    return () => { active = false }
  }, [isApproved])

  const handleQr = useCallback(async (token: string) => {
    if (!token || scanning) return
    setScanning(true)
    try {
      const scan = await companyMeService.scanCitizenQr(token)
      setScanResult(scan)
    } catch {
      setScanNonce((n) => n + 1)
    } finally {
      setScanning(false)
    }
  }, [scanning])

  const submitQrRedeem = async (campaignIds: string[], orderAmount?: number) => {
    if (!scanResult) return
    setPickerLoading(true)
    if (campaignIds.length === 1) {
      try {
        const res = await companyMeService.redeemAfterScan(scanResult.participantId, campaignIds[0], orderAmount)
        setResult(res)
        setScanResult(null)
      } catch {
        void 0
      } finally {
        setPickerLoading(false)
      }
    } else {
      const outcomes: MultiOut[] = []
      for (const cid of campaignIds) {
        const camp = scanResult.activeCampaigns.find((c) => c.id === cid)
        try {
          const res = await companyMeService.redeemAfterScan(scanResult.participantId, cid, orderAmount)
          outcomes.push({ campaignName: camp?.name ?? cid, ok: true, code: res.redemptionCode })
        } catch {
          outcomes.push({ campaignName: camp?.name ?? cid, ok: false })
        }
      }
      setPickerLoading(false)
      setScanResult(null)
      setMultiResults(outcomes)
    }
  }

  const idValid = idKind === 'tckn' ? tckn.length === 11 : phone.length === 11
  const identifier = idKind === 'tckn' ? { tckn } : { phone }

  const submitManualMulti = async (campaignIds: string[], orderAmount?: number) => {
    setManualPickerLoading(true)
    const outcomes: MultiOut[] = []
    for (const cid of campaignIds) {
      const camp = campaigns?.find((c) => c.id === cid)
      try {
        const res = await companyMeService.redeemManual(cid, identifier, orderAmount)
        outcomes.push({ campaignName: camp?.name ?? cid, ok: true, code: res.campaignName })
      } catch {
        outcomes.push({ campaignName: camp?.name ?? cid, ok: false })
      }
    }
    setManualPickerLoading(false)
    setManualPickerOpen(false)
    setTckn(''); setPhone('')
    if (outcomes.length === 1) {
      if (outcomes[0].ok) {
        setMultiResults(outcomes)
      } else {
        setMultiResults(outcomes)
      }
    } else {
      setMultiResults(outcomes)
    }
  }

  const reset = () => {
    setResult(null)
    setMultiResults(null)
    setScanResult(null)
    setScanNonce((n) => n + 1)
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader icon={ScanLineIcon} title="Kullandır" subtitle="QR okutun veya TC/telefon ile kampanya kullandırın" gradient="linear-gradient(160deg, #7c2d12 0%, #c2410c 55%, #f97316 100%)" />

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {isApproved && !result && !multiResults && (
          <Tabs
            value={mainTab}
            onValueChange={(v) => setMainTab(v as 'redeem' | 'usages')}
            tabs={[
              { key: 'redeem', label: 'Kullandır', icon: ScanLineIcon },
              { key: 'usages', label: 'Kullananlar', icon: UsersRoundIcon },
            ]}
          />
        )}

        {!isApproved ? (
          <EmptyState icon={LockIcon} title="Kullandırma yapılamıyor" description="Firmanız onaylandıktan sonra kampanya kullandırabilirsiniz." />
        ) : result ? (
          <ResultCard result={result} onAgain={reset} />
        ) : multiResults ? (
          <MultiResultCard results={multiResults} onAgain={reset} />
        ) : mainTab === 'usages' ? (
          <CompanyCampaignUsagesTab campaigns={campaigns ?? []} />
        ) : (
          <>
            <SegmentedControl
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { value: 'manual', label: 'TC / Telefon', icon: UserIcon },
                { value: 'qr', label: 'QR Okut', icon: ScanLineIcon },
              ]}
            />

            {mode === 'qr' ? (
              <div className="space-y-3">
                <QrScanner key={scanNonce} onScan={handleQr} />
                <p className="type-caption text-center text-foreground-muted">
                  {scanning ? 'Tanınıyor…' : 'Vatandaşın kişisel QR kodunu kameraya gösterin.'}
                </p>
                <Card padded className="!py-3">
                  <p className="type-caption text-foreground-muted mb-2">Kamera çalışmıyorsa QR içeriğini yazın:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="QR içeriği (nxr_...)"
                      className="flex-1 rounded-card border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value.trim()
                          if (v) { void handleQr(v); (e.target as HTMLInputElement).value = '' }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={scanning}
                      onClick={(e) => {
                        const inp = (e.currentTarget.previousSibling as HTMLInputElement)
                        if (inp?.value.trim()) { void handleQr(inp.value.trim()); inp.value = '' }
                      }}
                    >
                      Gönder
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              <Card padded>
                <div className="space-y-4">
                  <Field label="Müşteri Telefonu" required hint="Sisteme kayıtlı vatandaş">
                    <PhoneInput value={phone} onChange={setPhone} />
                  </Field>

                  {campaigns === null ? (
                    <SkeletonRows rows={2} />
                  ) : campaigns.length === 0 ? (
                    <p className="type-caption text-foreground-muted">Aktif kampanyanız yok.</p>
                  ) : (
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={!idValid}
                      onClick={() => setManualPickerOpen(true)}
                      iconLeft={<TicketPercentIcon className="h-4 w-4" />}
                    >
                      Kampanya Seç ve Kullandır
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {scanResult && (
        <ScanPickerModal
          open={!!scanResult}
          scan={scanResult}
          onConfirm={(ids, orderAmount) => void submitQrRedeem(ids, orderAmount)}
          onClose={() => { setScanResult(null); setScanNonce((n) => n + 1) }}
          loading={pickerLoading}
        />
      )}

      {campaigns && campaigns.length > 0 && (
        <ManualPickerModal
          open={manualPickerOpen}
          campaigns={campaigns}
          participantLabel={idKind === 'tckn' ? `TC: ${tckn}` : `Tel: ${phone}`}
          onConfirm={(ids, orderAmount) => void submitManualMulti(ids, orderAmount)}
          onClose={() => setManualPickerOpen(false)}
          loading={manualPickerLoading}
        />
      )}
    </div>
  )
}

export const CompanyRedeemPage = () => {
  const { state } = useCompanyAuth()
  const company = state.status === 'authenticated' ? state.company : undefined
  const isApproved = company?.status === 'Approved'
  return <CompanyRedeemPageBody isApproved={isApproved} />
}


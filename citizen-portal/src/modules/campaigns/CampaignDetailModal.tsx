import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TagIcon, BuildingIcon, CalendarDaysIcon, PackageIcon, InfoIcon, QrCodeIcon, ChevronRightIcon } from 'lucide-react'
import { Modal, Badge, Button, SkeletonRows, Avatar } from '@/design-system'
import { QrCode } from '@/design-system/QrCode/QrCode'
import { formatDate } from '@/lib/utils'
import type { CitizenCampaign, CitizenCampaignRedeem } from '@/types/campaign.types'
import type { CampaignStatus, CampaignCategory } from '@/types/companyCampaign.types'
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_TONE, CAMPAIGN_CATEGORY_LABELS } from '@/types/companyCampaign.types'
import campaignService from '@/services/campaign.service'

type Props = {
  campaignId: string | null
  onClose: () => void
  readOnly?: boolean
  thresholdDays?: number
}

const isPercentType = (type: string): boolean => {
  const t = type.toLowerCase()
  return t === 'percent' || t === 'percentage'
}

const formatDiscount = (type: string, value: number): string =>
  isPercentType(type) ? `%${value} indirim` : `${value.toLocaleString('tr-TR')}₺ indirim`

const getDaysLeft = (endDate: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const lastDayLabel = (daysLeft: number): string => {
  if (daysLeft <= 0) return 'Son gün!'
  return `Son ${daysLeft} gün!`
}

export const CampaignDetailModal = ({ campaignId, onClose, readOnly = false, thresholdDays = 1 }: Props) => {
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<CitizenCampaign | null>(null)
  const [loading, setLoading] = useState(false)
  const [redeem, setRedeem] = useState<CitizenCampaignRedeem | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!campaignId) { setCampaign(null); setRedeem(null); return }
    let active = true
    setLoading(true)
    setRedeem(null)
    campaignService.detail(campaignId)
      .then((c) => { if (active) setCampaign(c) })
      .catch(() => { if (active) setCampaign(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [campaignId])

  useEffect(() => {
    if (!redeem || !campaignId) return
    refreshTimer.current = setInterval(() => {
      campaignService.redeem(campaignId)
        .then((r) => setRedeem(r))
        .catch(() => void 0)
    }, redeem.rotationSeconds * 1000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [redeem, campaignId])

  const handleRedeem = () => {
    if (!campaignId) return
    setRedeeming(true)
    campaignService.redeem(campaignId)
      .then((r) => setRedeem(r))
      .catch(() => void 0)
      .finally(() => setRedeeming(false))
  }

  const handleClose = () => {
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    setRedeem(null)
    onClose()
  }

  const campaignDaysLeft = campaign ? getDaysLeft(campaign.endDate) : 999
  const showCampaignUrgency =
    !!campaign &&
    !campaign.isExhausted &&
    campaign.myUsageCount < campaign.perUserLimit &&
    campaignDaysLeft >= 0 &&
    campaignDaysLeft <= thresholdDays
  const urgencyBg = showCampaignUrgency
    ? campaignDaysLeft <= 1
      ? 'bg-[hsl(var(--danger)/0.05)]'
      : campaignDaysLeft <= 2
      ? 'bg-orange-500/[0.05]'
      : 'bg-[hsl(var(--warning)/0.05)]'
    : ''

  return (
    <>
    <style>{`@keyframes marquee-x{from{transform:translateX(0)}to{transform:translateX(-25%)}}.marquee-scroll{animation:marquee-x 8s linear infinite;display:inline-block;white-space:nowrap;}`}</style>
    <Modal
      open={!!campaignId}
      onClose={handleClose}
      title={campaign?.name ?? 'Kampanya Detayı'}
      subtitle={campaign?.companyName}
      width={440}
    >
      <div className={`p-6 ${urgencyBg}`}>
        {loading ? (
          <SkeletonRows rows={5} />
        ) : !campaign ? (
          <p className="type-muted">Kampanya yüklenemedi.</p>
        ) : redeem ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="type-section">{redeem.campaignName}</p>
              <Badge tone="primary">{formatDiscount(campaign.discountType, campaign.discountValue)}</Badge>
            </div>

            <div className="flex flex-col items-center gap-2">
              <QrCode value={redeem.token} size={216} />
              <Badge tone="info">Kalan kullanım: {redeem.remainingUses}</Badge>
            </div>

            <div className="flex items-start gap-2 rounded-card bg-surface-1 p-3">
              <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-muted" />
              <p className="type-caption">İndirimden yararlanmak için bu kodu firma yetkilisine okutun. Kod size özeldir ve güvenliğiniz için belirli aralıklarla yenilenir.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="-mx-6 -mt-6 mb-4 overflow-hidden rounded-t-panel">
              {campaign.imageUrl ? (
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
                  <img src={campaign.imageUrl} alt={campaign.name} className="h-full w-full object-cover" />
                  <span className="absolute left-3 top-3 rounded-lg bg-black/45 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
                    {CAMPAIGN_CATEGORY_LABELS[campaign.category as CampaignCategory] ?? 'Diğer'}
                  </span>
                </div>
              ) : (
                <div className="relative w-full overflow-hidden bg-gradient-to-br from-[hsl(var(--surface-1))] to-[hsl(var(--surface-2))]" style={{ aspectRatio: '4 / 3' }}>
                  <span className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 text-9xl font-black leading-none text-[hsl(var(--border))] select-none">
                    {isPercentType(campaign.discountType) ? '%' : '₺'}
                  </span>
                  <span className="absolute left-3 top-3 rounded-lg bg-black/10 px-2 py-1 text-[11px] font-semibold text-[hsl(var(--foreground-muted))]">
                    {CAMPAIGN_CATEGORY_LABELS[campaign.category as CampaignCategory] ?? 'Diğer'}
                  </span>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <div className="flex items-center gap-2">
                      <TagIcon className="h-6 w-6 text-[hsl(var(--primary))]" />
                      <span className="text-3xl font-bold text-[hsl(var(--foreground-strong))]">
                        {isPercentType(campaign.discountType) ? `%${campaign.discountValue}` : `${campaign.discountValue.toLocaleString('tr-TR')}₺`}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[hsl(var(--foreground-muted))]">indirim fırsatı</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-card bg-surface-1 p-4">
              <TagIcon className="h-8 w-8 flex-shrink-0 text-primary" />
              <div>
                <p className="type-caption">İndirim</p>
                <p className="text-lg font-bold text-primary">{formatDiscount(campaign.discountType, campaign.discountValue)}</p>
              </div>
            </div>

            <div className="space-y-3">
              {readOnly ? (
                <div className="flex items-center gap-2">
                  <BuildingIcon className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                  <span className="type-caption">Firma</span>
                  <div className="ml-auto flex items-center gap-2">
                    {campaign.companyLogo && (
                      <Avatar name={campaign.companyName} src={campaign.companyLogo} size="sm" />
                    )}
                    <span className="type-body-strong">{campaign.companyName}</span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { onClose(); navigate(`/kampanyalar/firma/${campaign.companyId}`) }}
                  className="flex w-full items-center gap-2 rounded-lg -mx-1 px-1 py-1 text-left transition-colors hover:bg-surface-2"
                >
                  <BuildingIcon className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                  <span className="type-caption">Firma</span>
                  <div className="ml-auto flex items-center gap-2">
                    {campaign.companyLogo && (
                      <Avatar name={campaign.companyName} src={campaign.companyLogo} size="sm" />
                    )}
                    <span className="type-body-strong">{campaign.companyName}</span>
                    <ChevronRightIcon className="h-4 w-4 text-foreground-subtle" />
                  </div>
                </button>
              )}

              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                <span className="type-caption">Geçerlilik</span>
                <span className="type-body ml-auto">{formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}</span>
              </div>

              {showCampaignUrgency && (() => {
                const style = campaignDaysLeft <= 1
                  ? { marquee: 'bg-[hsl(var(--danger)/0.12)]', text: 'text-[hsl(var(--danger))]' }
                  : campaignDaysLeft <= 2
                  ? { marquee: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' }
                  : { marquee: 'bg-[hsl(var(--warning)/0.12)]', text: 'text-[hsl(var(--warning))]' }
                const mt = `${lastDayLabel(campaignDaysLeft)} Bu kampanya yakında sona eriyor.`
                return (
                  <div className={`overflow-hidden rounded-sm py-1 ${style.marquee}`}>
                    <span className={`marquee-scroll text-xs font-semibold ${style.text}`}>
                      {mt}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{mt}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{mt}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{mt}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    </span>
                  </div>
                )
              })()}

              {campaign.minOrderAmount != null && (
                <div className="flex items-center gap-2">
                  <PackageIcon className="h-4 w-4 flex-shrink-0 text-foreground-muted" />
                  <span className="type-caption">Min. Harcama</span>
                  <span className="type-body ml-auto">{campaign.minOrderAmount.toLocaleString('tr-TR')}₺</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="type-caption">Durum</span>
                <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status as CampaignStatus] ?? 'neutral'} className="ml-auto">{CAMPAIGN_STATUS_LABELS[campaign.status as CampaignStatus] ?? campaign.status}</Badge>
              </div>
            </div>

            {campaign.serviceCategory && (
              <div className="rounded-card bg-surface-1 p-3">
                <p className="type-caption mb-2">Hizmet Kategorisi</p>
                <Badge color={campaign.serviceCategory.color}>{campaign.serviceCategory.name}</Badge>
              </div>
            )}

            {campaign.description && (
              <div className="rounded-card bg-surface-1 p-3">
                <p className="type-caption mb-1">Açıklama</p>
                <p className="type-body">{campaign.description}</p>
              </div>
            )}

            {(campaign.products?.length ?? 0) > 0 && (
              <div>
                <p className="type-caption mb-2">Kampanyaya Dahil Ürünler</p>
                <div className="grid grid-cols-2 gap-2">
                  {campaign.products.map((p, idx) => (
                    <div key={p.id ?? idx} className="overflow-hidden rounded-card border border-border bg-surface-0">
                      <div className="w-full overflow-hidden bg-surface-2" style={{ aspectRatio: '4 / 3' }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-foreground-muted">
                            <PackageIcon className="h-6 w-6" />
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="type-body-strong truncate text-[13px]">{p.name}</p>
                        {p.price != null && p.price > 0 && (
                          <p className="text-[13px] font-bold text-primary">{p.price.toLocaleString('tr-TR')} ₺</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!readOnly && campaign.isExhausted ? (
              <div className="flex items-center justify-center gap-2 rounded-card bg-danger/10 px-4 py-3">
                <span className="type-body-strong text-danger">Kampanya kullanım hakkı dolmuştur</span>
              </div>
            ) : !readOnly && campaign.myUsageCount >= campaign.perUserLimit ? (
              <div className="flex items-center justify-center gap-2 rounded-card bg-success/10 px-4 py-3">
                <svg className="h-4 w-4 flex-shrink-0 text-success" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <span className="type-body-strong text-success">Bu kampanyayı kullandınız</span>
              </div>
            ) : !readOnly ? (
              <Button
                variant="primary"
                className="w-full"
                iconLeft={<QrCodeIcon className="h-4 w-4" />}
                isLoading={redeeming}
                onClick={handleRedeem}
              >
                Kampanyayı Kullan
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
    </>
  )
}

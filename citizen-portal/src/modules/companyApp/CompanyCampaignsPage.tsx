import { useCallback, useEffect, useState } from 'react'
import {
  TicketPercentIcon, PlusIcon, PencilIcon, Trash2Icon, LockIcon,
  PowerIcon, PowerOffIcon, CalendarRangeIcon, UsersRoundIcon, WalletIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { ModuleHeader, Card, Badge, Button, EmptyState, SkeletonRows, ConfirmModal, Tabs } from '@/design-system'
import { formatDate } from '@/lib/utils'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import companyMeService from '@/services/companyMe.service'
import type { Campaign } from '@/types/companyCampaign.types'
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_TONE, CAMPAIGN_CATEGORY_LABELS, formatDiscount } from '@/types/companyCampaign.types'
import type { CompanyStatus } from '@/types/companyAuth.types'
import { CompanyStatusBanner } from './CompanyStatusBanner'
import { CompanyCampaignDrawer } from './CompanyCampaignDrawer'
import { CompanyCampaignUsagesTab } from './CompanyCampaignUsagesTab'

interface CompanyCampaignsPageBodyProps {
  isApproved: boolean
  statusBanner?: { status: CompanyStatus; rejectReason?: string | null }
  onCampaignsChanged?: () => void
}

export const CompanyCampaignsPageBody = ({ isApproved, statusBanner, onCampaignsChanged }: CompanyCampaignsPageBodyProps) => {
  const [tab, setTab] = useState<'campaigns' | 'usages'>('campaigns')

  const [items, setItems] = useState<Campaign[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [toRemove, setToRemove] = useState<Campaign | null>(null)
  const [removing, setRemoving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)


  const load = useCallback(async () => {
    if (!isApproved) { setItems([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await companyMeService.campaigns({ page: 1, limit: 100, sort: 'createdat', order: 'desc' })
      setItems(res.items)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [isApproved])

  useEffect(() => { void load() }, [load])

  const openCreate = () => { setEditing(null); setDrawerOpen(true) }
  const openEdit = (c: Campaign) => { setEditing(c); setDrawerOpen(true) }

  const handleSaved = () => { void load(); onCampaignsChanged?.() }

  const toggle = async (c: Campaign) => {
    setTogglingId(c.id)
    try {
      await companyMeService.toggleCampaign(c.id)
      await load()
    } catch {
      void 0
    } finally {
      setTogglingId(null)
    }
  }

  const confirmRemove = async () => {
    if (!toRemove) return
    setRemoving(true)
    try {
      await companyMeService.deleteCampaign(toRemove.id)
      toast.success('Kampanya silindi.')
      setToRemove(null)
      await load()
      onCampaignsChanged?.()
    } catch {
      void 0
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={TicketPercentIcon}
        title="Kampanyalar"
        subtitle="İndirim kampanyalarınızı yönetin"
        gradient="linear-gradient(160deg, #1e293b 0%, #3730a3 55%, #4f46e5 100%)"
        actions={isApproved && tab === 'campaigns' ? (
          <Button
            variant="outline"
            size="sm"
            iconLeft={<PlusIcon className="h-4 w-4" />}
            onClick={openCreate}
            className="border-white/40 bg-white text-indigo-700 shadow-sm hover:bg-indigo-50"
          >
            Yeni Kampanya
          </Button>
        ) : undefined}
      />

      <div className="flex-1 overflow-auto p-4">
        {statusBanner && <CompanyStatusBanner status={statusBanner.status} rejectReason={statusBanner.rejectReason} />}

        {isApproved && (
          <Tabs
            className="mb-4 -mx-4 -mt-1 rounded-none px-4 sm:mx-0 sm:rounded-lg sm:px-1"
            value={tab}
            onValueChange={(v) => setTab(v as 'campaigns' | 'usages')}
            tabs={[
              { key: 'campaigns', label: 'Kampanyalar', icon: TicketPercentIcon, count: items?.length },
              { key: 'usages', label: 'Kampanya Kullananlar', icon: UsersRoundIcon },
            ]}
          />
        )}

        {!isApproved ? (
          <EmptyState
            icon={LockIcon}
            title="Kampanya oluşturulamıyor"
            description="Firmanız onaylandıktan sonra kampanya oluşturabilir ve yönetebilirsiniz."
          />
        ) : tab === 'usages' ? (
          <CompanyCampaignUsagesTab campaigns={items ?? []} />
        ) : loading ? (
          <SkeletonRows rows={3} />
        ) : !items || items.length === 0 ? (
          <EmptyState
            icon={TicketPercentIcon}
            title="Henüz kampanya yok"
            description="İlk indirim kampanyanızı oluşturarak vatandaşlara sunun."
          />
        ) : (
          <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {items.map((c) => (
              <Card key={c.id} className="overflow-hidden !p-0">
                <div className="relative h-32 w-full overflow-hidden sm:h-36">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
                    >
                      <TicketPercentIcon className="h-10 w-10 text-white/40" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[13px] font-black leading-none text-[#ea580c] shadow-card backdrop-blur">
                      {formatDiscount(c.discountType, c.discountValue)}
                    </span>
                    <span className="rounded-lg bg-black/45 px-2 py-1 text-[10px] font-semibold leading-none text-white backdrop-blur">
                      {CAMPAIGN_CATEGORY_LABELS[c.category] ?? 'Diğer'}
                    </span>
                  </div>
                  <div className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-1">
                    <Badge tone={CAMPAIGN_STATUS_TONE[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</Badge>
                    {c.isExhausted && <Badge tone="danger">Tükendi</Badge>}
                  </div>
                  <p className="absolute inset-x-3 bottom-2 truncate text-[15px] font-bold text-white drop-shadow">{c.name}</p>
                </div>

                <div className="p-4">
                {(c.products?.length ?? 0) > 0 && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {c.products.slice(0, 4).map((p, idx) => (
                        <div
                          key={p.id ?? idx}
                          className="h-7 w-7 overflow-hidden rounded-lg border-2 border-surface-0 bg-surface-2"
                          title={p.name}
                        >
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                            : <span className="flex h-full w-full items-center justify-center text-[10px] text-foreground-muted">{p.name.slice(0, 2)}</span>}
                        </div>
                      ))}
                    </div>
                    <span className="type-caption">{c.products.length} ürün</span>
                  </div>
                )}

                {c.serviceCategory && (
                  <div className="mb-3">
                    <Badge color={c.serviceCategory.color}>{c.serviceCategory.name}</Badge>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <span className="type-caption inline-flex items-center gap-1.5">
                    <UsersRoundIcon className="h-3.5 w-3.5 flex-shrink-0" /> Kişi başı {c.perUserLimit} kez
                  </span>
                  <span className="type-caption inline-flex items-center gap-1.5">
                    <WalletIcon className="h-3.5 w-3.5 flex-shrink-0" /> {c.minOrderAmount && c.minOrderAmount > 0 ? `Min. Harcama ${c.minOrderAmount.toLocaleString('tr-TR')} ₺` : 'Alt limit yok'}
                  </span>
                  <span className="type-caption inline-flex items-center gap-1.5">
                    <CalendarRangeIcon className="h-3.5 w-3.5 flex-shrink-0" /> {formatDate(c.startDate)} – {formatDate(c.endDate)}
                  </span>
                  <span className="type-caption inline-flex items-center gap-1.5">
                    <TicketPercentIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    {c.usageCount} / {c.totalUsageLimit != null ? c.totalUsageLimit.toLocaleString('tr-TR') : 'Sınırsız'} kullanım
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    variant={c.status === 'Active' ? 'danger' : 'outline'}
                    size="sm"
                    isLoading={togglingId === c.id}
                    className={c.status !== 'Active' ? 'border-[hsl(var(--success))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-soft))]' : undefined}
                    iconLeft={c.status === 'Active' ? <PowerOffIcon className="h-3.5 w-3.5" /> : <PowerIcon className="h-3.5 w-3.5" />}
                    onClick={() => void toggle(c)}
                  >
                    {c.status === 'Active' ? 'Pasife Al' : 'Aktifleştir'}
                  </Button>
                  <Button variant="outline" size="sm" iconLeft={<PencilIcon className="h-3.5 w-3.5" />} onClick={() => openEdit(c)}>
                    Düzenle
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => setToRemove(c)}>
                    Sil
                  </Button>
                </div>
                </div>
              </Card>
            ))}
          </div>
          </>
        )}
      </div>

      <CompanyCampaignDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} campaign={editing} onSaved={handleSaved} />

      <ConfirmModal
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => void confirmRemove()}
        title="Kampanyayı sil"
        description={toRemove ? `"${toRemove.name}" kampanyasını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.` : ''}
        confirmLabel="Sil"
        tone="danger"
        icon={Trash2Icon}
        loading={removing}
      />
    </div>
  )
}

export const CompanyCampaignsPage = () => {
  const { state, refreshCompany } = useCompanyAuth()
  const company = state.status === 'authenticated' ? state.company : undefined
  const isApproved = company?.status === 'Approved'
  return (
    <CompanyCampaignsPageBody
      isApproved={isApproved}
      statusBanner={company ? { status: company.status, rejectReason: company.rejectReason } : undefined}
      onCampaignsChanged={() => void refreshCompany().catch(() => undefined)}
    />
  )
}

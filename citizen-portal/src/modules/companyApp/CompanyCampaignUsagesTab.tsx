import { useCallback, useEffect, useState } from 'react'
import { UsersRoundIcon, TicketPercentIcon, CalendarDaysIcon } from 'lucide-react'
import { Card, EmptyState, SkeletonRows, Select, Pagination, StatCard } from '@/design-system'
import { formatDate } from '@/lib/utils'
import companyMeService from '@/services/companyMe.service'
import type { CompanyCampaignUsage } from '@/types/companyCampaign.types'

interface UsageCampaignRef {
  id: string
  name: string
}

const DATE_RANGE_OPTIONS = [
  { value: '', label: 'Tüm Zamanlar' },
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Son 7 Gün' },
  { value: 'month', label: 'Son 30 Gün' },
]

export const CompanyCampaignUsagesTab = ({ campaigns }: { campaigns: UsageCampaignRef[] }) => {
  const [items, setItems] = useState<CompanyCampaignUsage[] | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [campaignId, setCampaignId] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [loading, setLoading] = useState(true)

  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await companyMeService.campaignUsages({ page, limit, campaignId: campaignId || undefined, dateRange: dateRange || undefined })
      setItems(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch {
      setItems([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [page, campaignId, dateRange])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(1) }, [campaignId, dateRange])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Toplam Kullanım" value={total} icon={TicketPercentIcon} accent="orange" />
        <StatCard
          label="Görüntülenen Kampanya"
          value={campaignId ? 1 : campaigns.length}
          icon={UsersRoundIcon}
          accent="blue"
        />
        <StatCard label="Sayfa" value={`${page} / ${Math.max(totalPages, 1)}`} icon={CalendarDaysIcon} accent="violet" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-56">
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="Tüm Kampanyalar">
            <option value="">Tüm Kampanyalar</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            {DATE_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden !p-0">
        {loading ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : !items || items.length === 0 ? (
          <EmptyState
            icon={UsersRoundIcon}
            title="Henüz kampanya kullanımı yok"
            description="Kampanyalarınızı kullanan vatandaşlar burada listelenecek."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                    <th className="px-4 py-3">Kullanan</th>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">Kampanya</th>
                    <th className="px-4 py-3">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-1">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-foreground-strong">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-[11px] font-bold text-orange-700">
                            {u.maskedUserName.replace(/\*/g, '').slice(0, 1).toUpperCase() || '?'}
                          </span>
                          {u.maskedUserName}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground-muted">{u.maskedUserPhone || '—'}</td>
                      <td className="px-4 py-3 text-foreground-default">{u.campaignName}</td>
                      <td className="px-4 py-3 text-foreground-muted">{formatDate(u.usedAt)} {new Date(u.usedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="border-t border-border p-3">
                <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

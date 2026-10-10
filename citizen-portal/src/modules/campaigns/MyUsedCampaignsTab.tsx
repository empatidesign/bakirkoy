import { useEffect, useState } from 'react'
import { TagIcon, CheckCircle2Icon, CalendarIcon } from 'lucide-react'
import { SkeletonRows, Avatar } from '@/design-system'
import { formatDateTime } from '@/lib/utils'
import type { CitizenCampaignUsage } from '@/types/campaign.types'
import campaignService from '@/services/campaign.service'
import { CampaignDetailModal } from './CampaignDetailModal'

const formatDiscount = (type: string, value: number): string => {
  if (type === 'Percent' || type === 'percent') return `%${value}`
  if (type === 'Amount' || type === 'amount') return `${value.toLocaleString('tr-TR')}₺`
  return `${value.toLocaleString('tr-TR')}`
}

export const MyUsedCampaignsTab = () => {
  const [items, setItems] = useState<CitizenCampaignUsage[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    campaignService.myUsages()
      .then((r) => { if (active) setItems(r) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {loading ? (
        <div className="p-4"><SkeletonRows rows={4} /></div>
      ) : !items || items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center px-6">
          <TagIcon className="h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-400">Henüz kampanya kullanmadınız</p>
          <p className="text-xs text-gray-300">Kullandığınız kampanyalar burada görünecek.</p>
        </div>
      ) : (
        <div className="p-4 pb-8 space-y-3">
          {items.map((u) => (
            <button
              key={u.usageId}
              type="button"
              onClick={() => setSelectedId(u.campaignId)}
              className="w-full text-left bg-white rounded-xl overflow-hidden hover:shadow-md transition-all active:scale-[0.99]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)' }}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-black text-white leading-none">
                    {formatDiscount(u.discountType, u.discountValue)}
                  </span>
                  <span className="text-[11px] font-semibold text-white/70">indirim</span>
                </div>
                <span className="flex items-center gap-1 bg-white/20 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white">
                  <CheckCircle2Icon className="h-3 w-3" />
                  Kullanıldı
                </span>
              </div>

              <div className="px-4 pt-3 pb-3">
                <p className="text-[14px] font-bold text-gray-900 leading-snug">{u.campaignName}</p>

                <div className="flex items-center gap-1.5 mt-1.5">
                  {u.companyLogo && <Avatar name={u.companyName} src={u.companyLogo} size="xs" />}
                  <p className="text-[12px] text-gray-500 truncate">{u.companyName}</p>
                </div>

                <div className="flex items-center gap-1 mt-2">
                  <CalendarIcon className="h-3 w-3 text-gray-400" />
                  <span className="text-[11px] text-gray-400">
                    Kullanım: {formatDateTime(u.usedAt)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <CampaignDetailModal campaignId={selectedId} onClose={() => setSelectedId(null)} readOnly />
    </div>
  )
}

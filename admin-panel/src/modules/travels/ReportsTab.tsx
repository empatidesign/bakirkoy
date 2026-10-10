import { useEffect, useState } from 'react'
import {
  BarChart3Icon, MapPinnedIcon, CheckCircle2Icon, Users2Icon, PercentIcon, TagIcon,
} from 'lucide-react'
import { StatCard, Card, EmptyState, SectionToolbar, Skeleton } from '@/design-system'
import { DonutChart } from '@/design-system/charts'
import travelService from '@/services/travel.service'
import travelCategoryService from '@/services/travelCategory.service'
import type { TravelSummary } from '@/types/travel.types'

type CategorySummary = { total: number; active: number; passive: number }

export const ReportsTab = () => {
  const [summary, setSummary] = useState<TravelSummary | null>(null)
  const [category, setCategory] = useState<CategorySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    Promise.all([
      travelService.getSummary({}),
      travelCategoryService.getList({ page: 1, limit: 200 }),
    ])
      .then(([s, cats]) => {
        if (!active) return
        setSummary(s)
        const activeCount = cats.items.filter((c) => c.isActive).length
        setCategory({ total: cats.total, active: activeCount, passive: cats.total - activeCount })
      })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const occupancy = summary && summary.totalCapacity > 0
    ? Math.round((summary.totalRegistered / summary.totalCapacity) * 100)
    : 0
  const freeCapacity = summary ? Math.max(summary.totalCapacity - summary.totalRegistered, 0) : 0

  if (error) {
    return (
      <>
        <SectionToolbar icon={BarChart3Icon} title="Raporlar" subtitle="Gezi ve katılım özeti" />
        <Card className="py-4">
          <EmptyState icon={BarChart3Icon} title="Rapor verisi yüklenemedi" description="Lütfen daha sonra tekrar deneyin." />
        </Card>
      </>
    )
  }

  return (
    <>
      <SectionToolbar icon={BarChart3Icon} title="Raporlar" subtitle="Gezi ve katılım özeti" />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Toplam Gezi" value={summary?.total ?? 0} icon={MapPinnedIcon} accent="blue" loading={loading} />
          <StatCard label="Aktif Gezi" value={summary?.active ?? 0} icon={CheckCircle2Icon} accent="green" loading={loading} />
          <StatCard label="Toplam Kayıt" value={summary?.totalRegistered ?? 0} icon={Users2Icon} accent="violet" loading={loading} hint={summary ? `${summary.totalCapacity} kapasite` : undefined} />
          <StatCard label="Doluluk" value={`%${occupancy}`} icon={PercentIcon} accent="orange" loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card padded>
            <p className="type-section mb-3">Kapasite Doluluğu</p>
            {loading ? (
              <Skeleton className="h-60 w-full" />
            ) : (
              <DonutChart
                data={[
                  { label: 'Kayıtlı', value: summary?.totalRegistered ?? 0 },
                  { label: 'Boş', value: freeCapacity },
                ]}
                centerLabel="doluluk"
                centerValue={`%${occupancy}`}
              />
            )}
          </Card>

          <Card padded>
            <p className="type-section mb-3">Gezi Durumu</p>
            {loading ? (
              <Skeleton className="h-60 w-full" />
            ) : (
              <DonutChart
                data={[
                  { label: 'Aktif', value: summary?.active ?? 0 },
                  { label: 'Pasif', value: summary?.passive ?? 0 },
                ]}
                centerLabel="gezi"
                centerValue={summary?.total ?? 0}
              />
            )}
          </Card>
        </div>

        <Card padded>
          <div className="mb-3 flex items-center gap-2">
            <TagIcon className="h-4 w-4 text-primary" />
            <p className="type-section">Kategoriler</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Toplam Kategori" value={category?.total ?? 0} icon={TagIcon} accent="neutral" size="compact" loading={loading} />
            <StatCard label="Aktif" value={category?.active ?? 0} icon={CheckCircle2Icon} accent="green" size="compact" loading={loading} />
            <StatCard label="Pasif" value={category?.passive ?? 0} icon={TagIcon} accent="neutral" size="compact" loading={loading} />
          </div>
        </Card>
      </div>
    </>
  )
}

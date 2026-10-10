import { useEffect, useState } from 'react'
import {
  HistoryIcon,
  CalendarDaysIcon,
  MapPinIcon,
  BuildingIcon,
  ArmchairIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  StarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BusIcon,
  CalendarCheckIcon,
  MinusCircleIcon,
} from 'lucide-react'
import { Button, EmptyState, ModuleHeader, SkeletonRows } from '@/design-system'
import { formatDate, formatTime } from '@/lib/utils'
import type { HistoryItemDto } from '@/types/history.types'
import historyService from '@/services/history.service'
import { ReviewSection } from '@/modules/reviews/ReviewSection'

type TypeFilter = '' | 'event' | 'travel'


function getTypeStyle(type: 'event' | 'travel') {
  if (type === 'travel')
    return { grad: 'linear-gradient(135deg,#10b981,#059669)', color: '#10b981', glow: 'rgba(16,185,129,0.5)' }
  return { grad: 'linear-gradient(135deg,#6366f1,#4338ca)', color: '#6366f1', glow: 'rgba(99,102,241,0.5)' }
}

function DateBadge({ date, type }: { date: string; type: 'event' | 'travel' }) {
  const d = new Date(date)
  const day = d.getDate()
  const month = d.toLocaleString('tr-TR', { month: 'short' }).replace('.', '').toUpperCase()
  const { grad, glow } = getTypeStyle(type)
  return (
    <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl text-white"
      style={{ background: grad, boxShadow: `0 0 0 2px ${glow}, 0 4px 10px ${glow}` }}>
      <span className="text-[16px] font-black leading-none">{day}</span>
      <span className="text-[8px] font-bold tracking-widest opacity-80">{month}</span>
    </div>
  )
}

function AttendanceBadge({ checkedIn, status }: { checkedIn: boolean; status: string }) {
  if (checkedIn) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
        style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
        <CheckCircle2Icon className="h-3 w-3" />
        Katıldı
      </span>
    )
  }
  if (status === 'approved' || status === 'Approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        <MinusCircleIcon className="h-3 w-3" />
        Katılmadı
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
      <XCircleIcon className="h-3 w-3" />
      {status === 'pending' || status === 'Pending' ? 'Bekliyor' : 'İptal'}
    </span>
  )
}

function ReviewBadge({ hasReviewed, canReview, onReview }: { hasReviewed: boolean; canReview: boolean; onReview: () => void }) {
  if (hasReviewed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
        <StarIcon className="h-3 w-3 fill-amber-500 text-amber-500" />
        Puanlandı
      </span>
    )
  }
  if (canReview) {
    return (
      <button type="button" onClick={onReview}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-85 active:scale-95"
        style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
        <StarIcon className="h-3 w-3" />
        Değerlendir
      </button>
    )
  }
  return (
    <span className="text-[11px] text-gray-300">—</span>
  )
}

function HistoryRow({ item, isLast }: { item: HistoryItemDto; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)

  const startFmt = formatDate(item.startDate)
  const endFmt = formatDate(item.endDate)
  const startTime = formatTime(item.startDate)
  const endTime = formatTime(item.endDate)
  const sameDay = startFmt === endFmt
  const TypeIcon = item.type === 'travel' ? BusIcon : CalendarCheckIcon

  return (
    <div className={!isLast ? 'border-b border-gray-100' : ''}>
      <div className="flex items-center gap-0 hover:bg-gray-50/60 transition-colors">

        <div className="flex w-14 flex-shrink-0 items-center justify-center py-3.5 pl-4">
          <DateBadge date={item.startDate} type={item.type} />
        </div>

        <div className="min-w-0 flex-1 py-3.5 pl-3 pr-4">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <TypeIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: getTypeStyle(item.type).color }} />
            <span className="text-[13px] font-semibold text-gray-900 leading-snug">{item.title}</span>
            {item.categoryName && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white flex-shrink-0"
                style={{ background: item.categoryColor || getTypeStyle(item.type).color }}>
                {item.categoryName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {item.facilityName && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <MapPinIcon className="h-3 w-3" />{item.facilityName}
              </span>
            )}
            {item.hallName && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <BuildingIcon className="h-3 w-3" />{item.hallName}
              </span>
            )}
            {item.seatNumber && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <ArmchairIcon className="h-3 w-3" />
                {item.reservationType === 'row' ? 'Sıra' : 'Koltuk'} {item.seatNumber}
              </span>
            )}
            {item.location && !item.facilityName && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <MapPinIcon className="h-3 w-3" />{item.location}
              </span>
            )}
          </div>
        </div>

        <div className="hidden w-36 flex-shrink-0 py-3.5 pr-4 sm:block">
          <p className="text-[12px] font-medium text-gray-700 flex items-center gap-1">
            <CalendarDaysIcon className="h-3 w-3 text-gray-400" />
            {sameDay ? startFmt : `${startFmt}`}
          </p>
          {sameDay && startTime && (
            <p className="mt-0.5 text-[11px] text-gray-400 flex items-center gap-1">
              <ClockIcon className="h-3 w-3" />{startTime}–{endTime}
            </p>
          )}
          {!sameDay && (
            <p className="mt-0.5 text-[11px] text-gray-400">→ {endFmt}</p>
          )}
        </div>

        <div className="hidden w-28 flex-shrink-0 items-center py-3.5 pr-4 md:flex">
          <AttendanceBadge checkedIn={item.checkedIn} status={item.status} />
        </div>

        <div className="hidden w-28 flex-shrink-0 items-center py-3.5 pr-4 lg:flex">
          <ReviewBadge
            hasReviewed={item.hasReviewed}
            canReview={item.canReview}
            onReview={() => setExpanded(v => !v)}
          />
        </div>

        <div className="flex w-10 flex-shrink-0 items-center justify-center py-3.5 pr-2">
          <button type="button" onClick={() => setExpanded(v => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            {expanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-5 py-4">
          <div className="flex flex-wrap gap-3 mb-4 sm:hidden">
            <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
              <CalendarDaysIcon className="h-3.5 w-3.5 text-gray-400" />
              {sameDay ? startFmt : `${startFmt} — ${endFmt}`}
              {sameDay && startTime && ` · ${startTime}–${endTime}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4 md:hidden">
            <AttendanceBadge checkedIn={item.checkedIn} status={item.status} />
            <ReviewBadge
              hasReviewed={item.hasReviewed}
              canReview={item.canReview}
              onReview={() => {}}
            />
          </div>

          {item.canReview && !item.hasReviewed && (
            <div className="mt-2">
              <p className="mb-2 text-[12px] font-semibold text-gray-700">Değerlendirmenizi yazın</p>
              <ReviewSection type={item.type} id={item.sourceId} />
            </div>
          )}
          {item.hasReviewed && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-[12px] text-amber-700 flex items-center gap-1.5">
                <StarIcon className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                Bu etkinliği/geziyi zaten değerlendirdiniz.
              </p>
            </div>
          )}
          {!item.canReview && !item.hasReviewed && (
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
              <p className="text-[12px] text-gray-400 flex items-center gap-1.5">
                <CalendarCheckIcon className="h-3.5 w-3.5" />
                Değerlendirme yapabilmek için etkinliğe katılmış olmanız gerekir.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const HistoryPage = () => {
  const [items, setItems] = useState<HistoryItemDto[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('')
  const LIMIT = 20

  useEffect(() => {
    let active = true
    setLoading(true)
    setItems(null)
    setPage(1)
    historyService
      .getHistory({ page: 1, limit: LIMIT, type: typeFilter || undefined })
      .then((r) => {
        if (!active) return
        setItems(r.items)
        setHasMore(r.items.length < r.total)
      })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [typeFilter])

  const loadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const r = await historyService.getHistory({ page: nextPage, limit: LIMIT, type: typeFilter || undefined })
      setItems(prev => [...(prev ?? []), ...r.items])
      setPage(nextPage)
      setHasMore((items?.length ?? 0) + r.items.length < r.total)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">

      <ModuleHeader
        icon={HistoryIcon}
        title="Geçmişim"
        subtitle="Katıldığınız etkinlik ve geziler"
        gradient="linear-gradient(150deg,#1e1b4b 0%,#312e81 45%,#4338ca 100%)"
        tabs={[
          { key: '', label: 'Tümü', icon: HistoryIcon },
          { key: 'event', label: 'Etkinlikler', icon: CalendarDaysIcon },
          { key: 'travel', label: 'Geziler', icon: BusIcon },
        ]}
        value={typeFilter}
        onValueChange={(k) => setTypeFilter(k as TypeFilter)}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 md:px-6 lg:px-10">
          {loading ? (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <SkeletonRows rows={6} />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <EmptyState icon={HistoryIcon} title="Geçmiş yok"
                description="Tamamlanan etkinlik ve gezileriniz burada listelenir." />
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center gap-0 border-b border-gray-100 bg-gray-50 px-0">
                  <div className="w-14 flex-shrink-0 py-2.5 pl-4 pr-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tarih</span>
                  </div>
                  <div className="flex-1 py-2.5 pl-3 pr-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Etkinlik / Gezi</span>
                  </div>
                  <div className="hidden w-36 flex-shrink-0 py-2.5 pr-4 sm:block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tarih & Saat</span>
                  </div>
                  <div className="hidden w-28 flex-shrink-0 py-2.5 pr-4 md:block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Katılım</span>
                  </div>
                  <div className="hidden w-28 flex-shrink-0 py-2.5 pr-4 lg:block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Değerlendirme</span>
                  </div>
                  <div className="w-10 flex-shrink-0" />
                </div>

                {items.map((item, idx) => (
                  <HistoryRow key={item.applicationId} item={item} isLast={idx === items.length - 1} />
                ))}
              </div>

              {hasMore && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="w-full" isLoading={loadingMore} onClick={loadMore}>
                    Daha Fazla Göster
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

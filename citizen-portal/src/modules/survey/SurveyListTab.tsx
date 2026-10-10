import { useEffect, useMemo, useState } from 'react'
import {
  ClipboardListIcon, CheckCircle2Icon, ClockIcon, ChevronRightIcon, ClipboardCheckIcon,
  SearchIcon, XIcon, SlidersHorizontalIcon, CheckIcon, CalendarClockIcon,
  CalendarDaysIcon, BusIcon, BuildingIcon, DoorOpenIcon, LayersIcon,
} from 'lucide-react'
import { EmptyState, SkeletonRows } from '@/design-system'
import type { CitizenSurvey } from '@/types/survey.types'
import surveyService from '@/services/survey.service'
import { SurveyFormModal } from './SurveyFormModal'
import { localDayIso, formatDate } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'

type SurveyTab = 'pending' | 'done'

type Props = {
  tab?: SurveyTab
  onResponded?: () => void
}

// Kullanıcı isteği (2026-08-14): anket listesi hepsi aynı boyutta "kare" kartlar hâlinde,
// karışık duruyordu (kaynak — Etkinlik/Kütüphane/Gezi/Tesis/Genel — ayrımı yoktu, tarih
// aralığına göre filtre yoktu). Events DiscoverTab'daki (etkinlik keşif) yerleşik desenle
// tutarlı hâle getirildi: kaynak türüne göre renkli rozet + filtre çipleri, tarih aralığı
// filtresi, arama, kategori filtresi. Kart tasarımı korunuyor (mobil-öncelikli, dokunma
// hedefleri büyük) ama artık kaynak türü ve tarih bilgisi görünür, filtrelenebilir.
const SOURCE_CONFIG: Record<string, { label: string; icon: typeof CalendarDaysIcon; color: string }> = {
  Event: { label: 'Etkinlik', icon: CalendarDaysIcon, color: '#6366F1' },
  Travel: { label: 'Gezi', icon: BusIcon, color: '#10B981' },
  Library: { label: 'Kütüphane', icon: DoorOpenIcon, color: '#8B5CF6' },
  Facility: { label: 'Tesis', icon: BuildingIcon, color: '#F59E0B' },
}
const GENERAL_SOURCE = { label: 'Genel', icon: LayersIcon, color: '#64748B' }

function sourceInfo(s: CitizenSurvey) {
  return (s.sourceType && SOURCE_CONFIG[s.sourceType]) || GENERAL_SOURCE
}

export const SurveyListTab = ({ tab = 'pending', onResponded }: Props) => {
  const { state } = useAuth()
  const userId = state.status === 'authenticated' ? state.user.id : null
  const [items, setItems] = useState<CitizenSurvey[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const load = () => {
    setLoading(true)
    setLoadError(false)
    surveyService.list({ page: 1, limit: 50 })
      .then((r) => setItems(r.items))
      .catch(() => {
        setItems(null)
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [userId])
  // Hata bulgusu (2026-08-16): bağımlılık dizisi [] idi — veli çocuk hesabına
  // geçtiğinde (/anketler sayfasından ayrılmadan) bu sekme yeniden mount
  // olmuyor, bu yüzden anketler bir daha hiç yeniden çekilmiyordu ve veli
  // hesabına ait liste ekranda kalmaya devam ediyordu. userId (aktif
  // participant) değiştiğinde tekrar `load()` tetiklenir; "load" fonksiyonu
  // stabildir (dış closure'a bağımlı değil, her render'da yeniden tanımlanır
  // ama identity değişimi burada anlamlı bir bağımlılık değildir).

  const handleClose = (submitted?: boolean) => {
    setSelectedId(null)
    if (submitted) {
      load()
      onResponded?.()
    }
  }

  const baseList = useMemo(() => {
    if (!items) return []
    return items.filter((s) => (tab === 'pending' ? !s.alreadyResponded : s.alreadyResponded))
  }, [items, tab])

  const sourceGroups = useMemo(() => {
    const seen = new Map<string, number>()
    for (const s of baseList) {
      const key = s.sourceType && SOURCE_CONFIG[s.sourceType] ? s.sourceType : 'Genel'
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    return [...seen.entries()].map(([key, count]) => ({
      key,
      count,
      ...(key === 'Genel' ? GENERAL_SOURCE : SOURCE_CONFIG[key]),
    }))
  }, [baseList])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const cats: string[] = []
    for (const s of baseList) {
      if (s.category && !seen.has(s.category)) {
        seen.add(s.category)
        cats.push(s.category)
      }
    }
    return cats.sort((a, b) => a.localeCompare(b, 'tr'))
  }, [baseList])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return baseList.filter((s) => {
      if (activeSource) {
        const key = s.sourceType && SOURCE_CONFIG[s.sourceType] ? s.sourceType : 'Genel'
        if (key !== activeSource) return false
      }
      if (activeCategory && s.category !== activeCategory) return false
      if (q && !s.title.toLocaleLowerCase('tr').includes(q) && !s.description.toLocaleLowerCase('tr').includes(q)) return false
      if (dateFrom || dateTo) {
        const ref = s.startDate ?? s.endDate
        if (!ref) return false
        const iso = localDayIso(ref)
        if (dateFrom && iso < dateFrom) return false
        if (dateTo && iso > dateTo) return false
      }
      return true
    })
  }, [baseList, activeSource, activeCategory, search, dateFrom, dateTo])

  // Kullanıcı isteği (2026-09-01): anketler tek düz liste hâlinde art arda geliyordu.
  // Artık kategoriye göre (Etkinlik, Kütüphane, Belediye Hizmetleri, müdürlük adı…)
  // başlıklı bölümler hâlinde gruplanıyor. Kategori boşsa kaynak türü (Etkinlik/Gezi/
  // Kütüphane/Tesis/Genel) başlık olarak kullanılır, yani her anket bir grubun içine düşer.
  const groups = useMemo(() => {
    const map = new Map<string, CitizenSurvey[]>()
    for (const s of filtered) {
      const key = s.category?.trim() || sourceInfo(s).label
      const bucket = map.get(key)
      if (bucket) bucket.push(s)
      else map.set(key, [s])
    }
    return [...map.entries()]
      .map(([key, list]) => ({ key, list }))
      .sort((a, b) => {
        if (a.key === 'Genel') return 1
        if (b.key === 'Genel') return -1
        return a.key.localeCompare(b.key, 'tr')
      })
  }, [filtered])

  const activeFilterCount = (activeSource ? 1 : 0) + (activeCategory ? 1 : 0) + ((dateFrom || dateTo) ? 1 : 0)
  const clearFilters = () => { setActiveSource(null); setActiveCategory(null); setDateFrom(''); setDateTo('') }

  const dateRangeLabel = (s: CitizenSurvey) => {
    if (!s.startDate && !s.endDate) return null
    if (s.startDate && s.endDate) return `${formatDate(s.startDate)} – ${formatDate(s.endDate)}`
    return formatDate((s.startDate ?? s.endDate)!)
  }

  return (
    <div className="w-full space-y-4 p-3 sm:p-4 md:p-6 xl:p-8">
      {!loading && !loadError && baseList.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
              <input
                type="text"
                placeholder="Anket ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-field border border-border bg-surface-0 pl-9 pr-8 py-2.5 text-sm text-foreground-default placeholder:text-foreground-subtle outline-none focus:border-primary transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-surface-2 transition-colors"
                >
                  <XIcon className="h-3 w-3 text-foreground-subtle" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-field px-3.5 py-2.5 text-sm font-semibold border transition-colors"
              style={activeFilterCount > 0
                ? { background: 'hsl(var(--primary))', color: 'white', borderColor: 'hsl(var(--primary))' }
                : { background: 'hsl(var(--surface-0))', color: 'hsl(var(--foreground-default))', borderColor: 'hsl(var(--border))' }}
            >
              <SlidersHorizontalIcon className="h-4 w-4" />
              Filtrele
              {activeFilterCount > 0 && (
                <span className="ml-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-white/25 px-1 text-[10px] font-bold">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {sourceGroups.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setActiveSource(null)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                style={activeSource === null
                  ? { background: 'hsl(var(--foreground-default))', color: 'white' }
                  : { background: 'hsl(var(--surface-1))', color: 'hsl(var(--foreground-muted))' }}
              >
                Tümü ({baseList.length})
              </button>
              {sourceGroups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActiveSource(activeSource === g.key ? null : g.key)}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={activeSource === g.key
                    ? { background: g.color, color: 'white' }
                    : { background: `${g.color}15`, color: g.color }}
                >
                  <g.icon className="h-3.5 w-3.5" />
                  {g.label} ({g.count})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : loadError ? (
        <EmptyState
          icon={ClipboardListIcon}
          title="Anketler yüklenemedi"
          description="Bağlantınızı kontrol edip tekrar deneyin."
          action={<button type="button" className="type-caption font-semibold text-primary" onClick={load}>Tekrar Dene</button>}
        />
      ) : baseList.length === 0 ? (
        <EmptyState
          icon={tab === 'pending' ? ClipboardCheckIcon : CheckCircle2Icon}
          title={tab === 'pending' ? 'Yanıtlanacak anket yok' : 'Henüz tamamlanan anket yok'}
          description={
            tab === 'pending'
              ? 'Tüm anketleri yanıtladınız. Yeni anketler burada görünecek.'
              : 'Yanıtladığınız anketler burada listelenir.'
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="Sonuç bulunamadı"
          description="Filtre veya arama kriterlerini değiştirin."
          action={<button type="button" className="type-caption font-semibold text-primary" onClick={clearFilters}>Filtreleri Temizle</button>}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="type-section">{g.key}</h3>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 type-caption font-semibold">{g.list.length}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2 2xl:grid-cols-3">
          {g.list.map((s) => {
            const src = sourceInfo(s)
            const rangeLabel = dateRangeLabel(s)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="group h-full w-full text-left"
              >
                <div className={`flex h-full items-start gap-4 rounded-card bg-surface-0 border p-4 shadow-card
                  hover:shadow-panel hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]
                  ${tab === 'done' ? 'border-success/20' : 'border-border'}`}>
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-card shadow-sm"
                    style={{ background: tab === 'done' ? 'hsl(var(--success))' : src.color, color: 'white' }}
                  >
                    {tab === 'done' ? <CheckCircle2Icon className="h-6 w-6" /> : <src.icon className="h-6 w-6" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="type-body-strong">{s.title}</p>
                      {s.isAnonymous && (
                        <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 type-caption font-medium">Anonim</span>
                      )}
                      {s.isRequired && !s.alreadyResponded && (
                        <span className="inline-flex items-center rounded-full bg-danger/10 text-danger px-2 py-0.5 type-caption font-semibold">Zorunlu</span>
                      )}
                    </div>
                    {s.description && (
                      <p className="type-caption line-clamp-2 mb-2">{s.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 type-caption font-semibold"
                        style={{ background: `${src.color}15`, color: src.color }}
                      >
                        <src.icon className="h-3 w-3" />{src.label}
                      </span>
                      {/* kategori grup başlığında gösteriliyor, kartta tekrar edilmiyor */}
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 type-caption font-medium">
                        <ClipboardListIcon className="h-3 w-3" />{s.questionCount} soru
                      </span>
                      {s.estimatedDuration > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 type-caption font-medium">
                          <ClockIcon className="h-3 w-3" />{s.estimatedDuration} dk
                        </span>
                      )}
                      {rangeLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 type-caption font-medium">
                          <CalendarClockIcon className="h-3 w-3" />{rangeLabel}
                        </span>
                      )}
                      {tab === 'done' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 type-caption font-bold text-success">
                          <CheckCircle2Icon className="h-3 w-3" />Tamamlandı
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-foreground-subtle group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
                </div>
              </button>
            )
          })}
              </div>
            </section>
          ))}
        </div>
      )}

      {filterSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setFilterSheetOpen(false)}>
          <div className="max-h-[85vh] rounded-t-lg bg-surface-0 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
              <p className="type-section">Filtrele</p>
              <button type="button" onClick={() => setFilterSheetOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 hover:bg-surface-1">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {sourceGroups.length > 1 && (
                <div>
                  <p className="mb-2 type-caption font-bold uppercase tracking-wide">Kaynak</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveSource(null)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={activeSource === null
                        ? { background: 'hsl(var(--foreground-default))', color: 'white' }
                        : { background: 'hsl(var(--surface-1))', color: 'hsl(var(--foreground-muted))' }}
                    >
                      Tümü
                    </button>
                    {sourceGroups.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setActiveSource(activeSource === g.key ? null : g.key)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                        style={activeSource === g.key
                          ? { background: g.color, color: 'white' }
                          : { background: `${g.color}15`, color: g.color }}
                      >
                        {activeSource === g.key && <CheckIcon className="h-3 w-3" />}
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {categories.length > 0 && (
                <div>
                  <p className="mb-2 type-caption font-bold uppercase tracking-wide">Kategori</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(null)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={activeCategory === null
                        ? { background: 'hsl(var(--foreground-default))', color: 'white' }
                        : { background: 'hsl(var(--surface-1))', color: 'hsl(var(--foreground-muted))' }}
                    >
                      Tümü
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                        style={activeCategory === cat
                          ? { background: 'hsl(var(--primary))', color: 'white' }
                          : { background: 'hsl(var(--surface-1))', color: 'hsl(var(--foreground-muted))' }}
                      >
                        {activeCategory === cat && <CheckIcon className="h-3 w-3" />}
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 type-caption font-bold uppercase tracking-wide">Tarih Aralığı</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-foreground-subtle">Başlangıç</span>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-field border border-border bg-surface-1 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-surface-0"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-foreground-subtle">Bitiş</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-field border border-border bg-surface-1 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-surface-0"
                    />
                  </label>
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => { setDateFrom(''); setDateTo('') }}
                    className="mt-1.5 text-[12px] font-semibold text-primary"
                  >
                    Tarih filtresini temizle
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 border-t border-border px-5 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={clearFilters}
                className="flex-1 rounded-field border border-border py-2.5 text-sm font-semibold text-foreground-muted"
              >
                Sıfırla
              </button>
              <button
                type="button"
                onClick={() => setFilterSheetOpen(false)}
                className="flex-1 rounded-field py-2.5 text-sm font-bold text-white"
                style={{ background: 'hsl(var(--primary))' }}
              >
                {filtered.length} anketi göster
              </button>
            </div>
          </div>
        </div>
      )}

      <SurveyFormModal
        surveyId={selectedId}
        isRequired={items?.find((i) => i.id === selectedId)?.isRequired}
        onClose={handleClose}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2Icon, SearchIcon, MapPinIcon, ImageOffIcon, AlertTriangleIcon } from 'lucide-react'
import type { PublicServiceFacility } from '@/types/public.types'
import publicService from '@/services/public.service'

const FacilityCard = ({ f, onClick }: { f: PublicServiceFacility; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full overflow-hidden rounded-lg border border-border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
  >
    {f.primaryImageUrl ? (
      <div className="w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
        <img src={f.primaryImageUrl} alt="" className="h-full w-full object-cover" />
      </div>
    ) : (
      <div className="flex w-full items-center justify-center bg-primary-soft" style={{ aspectRatio: '16 / 9' }}>
        <ImageOffIcon className="h-8 w-8 text-primary/40" />
      </div>
    )}
    <div className="space-y-1.5 p-3.5">
      <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">{f.type}</span>
      <p className="text-[15px] font-bold leading-snug text-foreground">{f.name}</p>
      {(f.district || f.address) && (
        <p className="flex items-center gap-1 text-[12px] text-foreground/55">
          <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{[f.district, f.address].filter(Boolean).join(' · ')}</span>
        </p>
      )}
      {f.services.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {f.services.slice(0, 3).map((s, i) => (
            <span key={i} className="rounded-full bg-surface-1 px-2 py-0.5 text-[10.5px] font-medium text-foreground/55">{s.name}</span>
          ))}
          {f.services.length > 3 && <span className="text-[10.5px] text-foreground/35">+{f.services.length - 3}</span>}
        </div>
      )}
    </div>
  </button>
)

export const FacilitiesListPage = () => {
  const navigate = useNavigate()
  const [facilities, setFacilities] = useState<PublicServiceFacility[] | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadFailed(false)
    const handle = setTimeout(() => {
      publicService.getFacilities({ page: 1, limit: 60, search: search.trim() || undefined })
        .then((list) => { if (active) setFacilities(list) })
        .catch(() => { if (active) { setFacilities([]); setLoadFailed(true) } })
        .finally(() => { if (active) setLoading(false) })
    }, search ? 300 : 0)
    return () => { active = false; clearTimeout(handle) }
  }, [search])

  return (
    <div>
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="font-display text-2xl font-black text-foreground">Hizmet Tesisleri</h1>
          <p className="mt-1 text-[13.5px] text-foreground/55">Belediyeye ait tüm hizmet tesislerini, adres ve çalışma saatlerini görüntüleyin.</p>

          <div className="relative mt-4 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tesis ara…"
              className="w-full rounded-lg border border-border bg-surface-1 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:bg-white"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading && facilities === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-lg bg-surface-2" />)}
          </div>
        ) : facilities && facilities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-soft">
              {loadFailed ? <AlertTriangleIcon className="h-8 w-8 text-primary/60" /> : <Building2Icon className="h-8 w-8 text-primary/60" />}
            </div>
            <p className="font-bold text-foreground/70">{loadFailed ? 'Tesisler yüklenemedi' : 'Tesis bulunamadı'}</p>
            <p className="text-sm text-foreground/40">{loadFailed ? 'Bağlantınızı kontrol edip tekrar deneyin.' : 'Farklı bir arama deneyin.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(facilities ?? []).map((f) => (
              <FacilityCard key={f.id} f={f} onClick={() => navigate(`/tesisler/${f.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { PhoneIcon, NavigationIcon, MapPinIcon, ClockIcon, AlertTriangleIcon } from 'lucide-react'
import { EmptyState, SkeletonRows } from '@/design-system'
import { DistanceBadge } from '@/components/specialized/DistanceBadge'
import { formatPhone } from '@/lib/utils'
import type { CitizenDutyPharmacy } from '@/types/duty-pharmacy.types'

type Props = {
  pharmacies: CitizenDutyPharmacy[] | null
  loading: boolean
}

const callHref = (phone: string) => `tel:0${phone}`

export const DutyPharmacyListTab = ({ pharmacies, loading }: Props) => {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <SkeletonRows rows={4} />
      </div>
    )
  }

  if (!pharmacies || pharmacies.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={ClockIcon}
          title="Nöbetçi eczane bulunamadı"
          description="Bugünkü nöbetçi eczane listesi henüz güncellenmedi. Lütfen daha sonra tekrar deneyin."
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {/* Gösterilen liste bugüne ait değilse uyar. Backend, senkron bir gece
          çalışmazsa "en son tarihli" listeyi döndürür ve bunu isStale ile
          bildirir; liste gizlenmez (nöbet gece yarısını aşar) ama vatandaş
          kapalı bir eczaneye gitmeden önce bilmelidir.
          Bkz. uçtan uca test 2026-09-21, bulgu J1. */}
      {pharmacies[0]?.isStale && (
        <div className="flex items-start gap-2 rounded-card border border-amber-300 bg-amber-50 px-3.5 py-3">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <p className="type-caption font-semibold text-amber-900">
            Bu liste{' '}
            {new Date(pharmacies[0].dutyDate).toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}{' '}
            tarihine ait, güncel olmayabilir. Yola çıkmadan önce eczaneyi telefonla aramanızı öneririz.
          </p>
        </div>
      )}
      {pharmacies[0]?.syncedAt && (
        <p className="type-caption text-foreground-muted">
          Son güncelleme: {new Date(pharmacies[0].syncedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {pharmacies.map((p) => (
        <div
          key={p.id}
          className="w-full items-start rounded-card border border-border bg-surface-0 p-3.5 shadow-card"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="type-body-strong">{p.name}</p>
              {p.neighborhood && (
                <p className="type-caption mt-0.5 inline-flex items-center gap-1">
                  <MapPinIcon className="h-3 w-3" /> {p.neighborhood}
                </p>
              )}
              {p.directions && <p className="type-caption mt-0.5">{p.directions}</p>}
              {p.address && <p className="type-caption mt-0.5 line-clamp-2">{p.address}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {p.dutyEndTime === '18:00' && (
                <span className="type-caption rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger">
                  Saat 18:00'e kadar hizmet verecek
                </span>
              )}
              <DistanceBadge
                target={p.latitude != null && p.longitude != null ? { latitude: p.latitude, longitude: p.longitude } : null}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {p.phone && (
                <a
                  href={callHref(p.phone)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success transition-colors hover:bg-success/20"
                >
                  <PhoneIcon className="h-3.5 w-3.5" /> {formatPhone(p.phone)}
                </a>
              )}
              {p.latitude != null && p.longitude != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  <NavigationIcon className="h-3.5 w-3.5" /> Konuma Git
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

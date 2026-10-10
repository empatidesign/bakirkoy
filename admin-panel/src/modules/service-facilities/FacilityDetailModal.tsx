import { useEffect, useState } from 'react'
import { REPORTS_MODULE_LABELS } from '@/types/reports.types'
import {
  ClockIcon, MapPinIcon, PhoneIcon, MailIcon, GlobeIcon, ShieldIcon, LayersIcon, AlertTriangleIcon,
} from 'lucide-react'
import {
  Modal, Badge, EmptyState, SkeletonRows, DetailRow, FormSection,
} from '@/design-system'
import { MapPicker } from '@/components/specialized/MapPicker'
import { ImageGallery } from '@/components/specialized/ImageGallery'
import { FacilityServicesView } from './FacilityServicesView'
import serviceFacilityService from '@/services/serviceFacility.service'
import type { ServiceFacility } from '@/types/serviceFacility.types'
import {
  FACILITY_STATUS_LABELS,
  LOCATION_TYPE_LABELS,
  OUTDOOR_CATEGORY_LABELS, PARKING_TYPE_LABELS,
} from '@/types/serviceFacility.types'

const ChipList = ({ items, empty }: { items: string[]; empty: string }) =>
  items.length ? (
    <div className="flex flex-wrap gap-1.5">{items.map((i) => <Badge key={i} tone="neutral">{i}</Badge>)}</div>
  ) : (
    <p className="type-caption">{empty}</p>
  )

export const FacilityDetailModal = ({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) => {
  const [facility, setFacility] = useState<ServiceFacility | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await serviceFacilityService.getById(id)
        if (active) setFacility(data)
      } catch {
        if (active) setFacility(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [id, open])

  const social = facility ? [facility.website, facility.facebook, facility.instagram, facility.twitter].filter(Boolean) as string[] : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={860}
      className="max-w-[96vw] overflow-hidden"
    >
      {facility && (
        <div className="relative overflow-hidden ds-hero">
          <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          <div className="absolute -bottom-6 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          <div className="absolute left-0 bottom-0 h-24 w-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
          <div className="relative px-8 py-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <span className="flex h-20 w-20 items-center justify-center rounded-lg text-2xl font-bold text-white shadow-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))', border: '3px solid rgba(255,255,255,0.35)' }}>
                    {facility.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: facility.status === 'Active' ? '#22c55e' : '#94a3b8' }} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{facility.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{FACILITY_STATUS_LABELS[facility.status]}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{LOCATION_TYPE_LABELS[facility.locationType]}</span>
                    {facility.type && <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{REPORTS_MODULE_LABELS[facility.type] ?? facility.type}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1.5 text-[13px] text-white/70">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15">
                        <MapPinIcon className="h-3 w-3 text-white" />
                      </div>
                      {[facility.district, facility.city].filter(Boolean).join(' · ') || facility.address || 'Konum belirtilmemiş'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="relative grid grid-cols-3 gap-px border-t border-white/20">
            <div className="bg-black/20 px-6 py-3 text-center">
              <p className="text-lg font-bold text-white tabular-nums">{facility.serviceCount}</p>
              <p className="text-[11px] text-white/60">Hizmet</p>
            </div>
            <div className="bg-black/20 px-6 py-3 text-center">
              <p className="text-lg font-bold text-white tabular-nums">{facility.capacity ?? '—'}</p>
              <p className="text-[11px] text-white/60">Kapasite</p>
            </div>
            <div className="bg-black/20 px-6 py-3 text-center">
              <p className="text-lg font-bold text-white tabular-nums">{facility.facilities?.length ?? 0}</p>
              <p className="text-[11px] text-white/60">İmkan</p>
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="p-6"><SkeletonRows rows={6} /></div>
      ) : !facility ? (
        <div className="p-6">
          <EmptyState icon={AlertTriangleIcon} title="Tesis bulunamadı" description="Kayıt getirilemedi. Lütfen tekrar deneyin." />
        </div>
      ) : (
        <div className="grid max-h-[70vh] grid-cols-1 gap-[15px] overflow-auto bg-surface-2 p-5 md:grid-cols-2">
              <FormSection variant="card" title="Konum">
                <DetailRow icon={MapPinIcon} label="Adres" layout="inline">{facility.address || '—'}</DetailRow>
                <DetailRow label="İlçe / İl" layout="inline">{[facility.district, facility.city].filter(Boolean).join(' · ') || '—'}</DetailRow>
                {facility.locationType === 'Outdoor' && (
                  <>
                    <DetailRow label="Kategori" layout="inline">{facility.outdoorCategory ? OUTDOOR_CATEGORY_LABELS[facility.outdoorCategory] : '—'}</DetailRow>
                    <DetailRow label="Alan" layout="inline">{facility.areaSizeM2 ? `${facility.areaSizeM2.toLocaleString('tr-TR')} m²` : '—'}</DetailRow>
                  </>
                )}
                <div className="mt-[15px]"><MapPicker value={{ latitude: facility.latitude, longitude: facility.longitude }} readOnly height={200} /></div>
              </FormSection>

              <FormSection variant="card" title="Yönetici & İletişim">
                <DetailRow icon={ShieldIcon} label="Sorumlu" layout="inline">{facility.manager || '—'}</DetailRow>
                <DetailRow icon={PhoneIcon} label="Telefon" layout="inline">{facility.managerPhone || '—'}</DetailRow>
                <DetailRow icon={PhoneIcon} label="Acil Telefon" layout="inline">{facility.emergencyPhone || '—'}</DetailRow>
                <DetailRow icon={MailIcon} label="E-posta" layout="inline">{facility.managerEmail || '—'}</DetailRow>
                {social.length > 0 && <DetailRow icon={GlobeIcon} label="Web / Sosyal" layout="inline"><span className="break-all">{social.join(' · ')}</span></DetailRow>}
                <p className="mb-2 mt-[15px] type-section">Çalışma Saatleri</p>
                <DetailRow icon={ClockIcon} label="Hafta İçi" layout="inline">{`${facility.weekdayOpen} - ${facility.weekdayClose}`}</DetailRow>
                <DetailRow icon={ClockIcon} label="Hafta Sonu" layout="inline">{`${facility.weekendOpen} - ${facility.weekendClose}`}</DetailRow>
                {facility.capacity ? <DetailRow label="Kapasite" layout="inline">{`${facility.capacity.toLocaleString('tr-TR')} kişi`}</DetailRow> : null}
              </FormSection>

              <FormSection variant="card" title={`Sunulan Hizmetler (${facility.serviceCount})`} icon={LayersIcon} className="md:col-span-2">
                <FacilityServicesView facility={facility} />
              </FormSection>

              <FormSection variant="card" title="İmkanlar">
                <ChipList items={facility.facilities ?? []} empty="İmkan belirtilmemiş." />
                <p className="mb-2 mt-[15px] type-section">Erişilebilirlik</p>
                <ChipList items={facility.accessibilityFeatures ?? []} empty="Erişilebilirlik özelliği belirtilmemiş." />
                <p className="mb-2 mt-[15px] type-section">Otopark</p>
                {/* Kapasite 0 ise tesiste otopark yok demektir; kapasite/tür satırları gösterilmez. */}
                {facility.parkingCapacity > 0 ? (
                  <>
                    <DetailRow label="Kapasite" layout="inline">{`${facility.parkingCapacity.toLocaleString('tr-TR')} araç`}</DetailRow>
                    <DetailRow label="Tür" layout="inline">{PARKING_TYPE_LABELS[facility.parkingType] || '—'}</DetailRow>
                  </>
                ) : (
                  <DetailRow label="Durum" layout="inline">Yok</DetailRow>
                )}
              </FormSection>

              <FormSection variant="card" title="Galeri">
                <ImageGallery value={facility.images ?? []} readOnly />
              </FormSection>

              {facility.about && (
                <FormSection variant="card" title="Hakkında" className="md:col-span-2">
                  <p className="type-body whitespace-pre-line text-foreground-default">{facility.about}</p>
                </FormSection>
              )}
            </div>
        )}
    </Modal>
  )
}

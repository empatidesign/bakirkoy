import { useEffect, useState } from 'react'
import {
  SirenIcon, MapPinIcon, PhoneIcon, MailIcon, ShieldIcon, UsersIcon, MaximizeIcon, AlertTriangleIcon,
} from 'lucide-react'
import {
  Modal, Card, Badge, EmptyState, SkeletonRows, DetailRow,
} from '@/design-system'
import { MapPicker } from '@/components/specialized/MapPicker'
import emergencyAreaService from '@/services/emergencyArea.service'
import type { EmergencyArea } from '@/types/emergencyArea.types'
import {
  EMERGENCY_STATUS_LABELS, enabledEquipment,
} from '@/types/emergencyArea.types'

export const EmergencyAreaDetailModal = ({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) => {
  const [area, setArea] = useState<EmergencyArea | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await emergencyAreaService.getById(id)
        if (active) setArea(data)
      } catch {
        if (active) setArea(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [id, open])

  const equipment = area ? enabledEquipment(area.equipment) : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={820}
      className="tone-danger max-w-[96vw] overflow-hidden"
      header={area ? (
        <div className="relative overflow-hidden -mx-6 -mt-5 mb-0 pb-0 ds-hero">
          <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          <div className="absolute -bottom-6 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
          <div className="absolute left-0 bottom-0 h-24 w-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
          <div className="relative px-8 py-7">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <span className="flex h-20 w-20 items-center justify-center rounded-lg shadow-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))', border: '3px solid rgba(255,255,255,0.35)' }}>
                  <SirenIcon className="h-9 w-9 text-white" />
                </span>
                <span className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: area.status === 'Active' ? '#22c55e' : '#94a3b8' }} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{area.name}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{EMERGENCY_STATUS_LABELS[area.status]}</span>
                  {area.neighborhood && <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-white/20 text-white">{area.neighborhood}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : undefined}
    >
      {loading ? (
        <div className="p-6"><SkeletonRows rows={6} /></div>
      ) : !area ? (
        <div className="p-6">
          <EmptyState icon={AlertTriangleIcon} title="Alan bulunamadı" description="Kayıt getirilemedi. Lütfen tekrar deneyin." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Card padded>
            <p className="mb-2 type-section">Konum & Kapasite</p>
            <DetailRow icon={MapPinIcon} label="Mahalle" layout="inline">{area.neighborhood || '—'}</DetailRow>
            <DetailRow icon={MapPinIcon} label="Adres" layout="inline">{area.address || '—'}</DetailRow>
            <DetailRow icon={UsersIcon} label="Kapasite" layout="inline">{area.capacity ? `${area.capacity.toLocaleString('tr-TR')} kişi` : '—'}</DetailRow>
            <DetailRow icon={MaximizeIcon} label="Alan" layout="inline">{area.areaSizeM2 ? `${area.areaSizeM2.toLocaleString('tr-TR')} m²` : '—'}</DetailRow>
            <div className="mt-3"><MapPicker value={{ latitude: area.latitude, longitude: area.longitude }} readOnly height={200} /></div>
          </Card>

          <Card padded>
            <p className="mb-2 type-section">Sorumlu & İletişim</p>
            <DetailRow icon={ShieldIcon} label="Sorumlu" layout="inline">{area.manager || '—'}</DetailRow>
            <DetailRow icon={PhoneIcon} label="Telefon" layout="inline">{area.managerPhone || '—'}</DetailRow>
            <DetailRow icon={PhoneIcon} label="Acil Telefon" layout="inline">{area.emergencyPhone || '—'}</DetailRow>
            <DetailRow icon={MailIcon} label="E-posta" layout="inline">{area.managerEmail || '—'}</DetailRow>
          </Card>

          <Card padded className="md:col-span-2">
            <p className="mb-2 type-section">Donanım / Olanaklar</p>
            {equipment.length ? (
              <div className="flex flex-wrap gap-1.5">
                {equipment.map((m) => (
                  <Badge key={m.key} color={m.color}>
                    <m.icon className="mr-1 h-3 w-3" />
                    {m.label}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="type-caption">Donanım bilgisi girilmemiş.</p>
            )}
          </Card>

          {area.description && (
            <Card padded className="md:col-span-2">
              <p className="mb-2 type-section">Açıklama</p>
              <p className="type-body whitespace-pre-line text-foreground-default">{area.description}</p>
            </Card>
          )}
        </div>
      )}
    </Modal>
  )
}

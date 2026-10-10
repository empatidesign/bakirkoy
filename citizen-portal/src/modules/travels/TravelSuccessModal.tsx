import { createPortal } from 'react-dom'
import {
  CheckCircle2Icon, MapPinIcon, CalendarDaysIcon, ArmchairIcon,
  BusIcon, ClockIcon, XIcon, UserIcon,
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

interface PassengerResult {
  name: string
  isSelf: boolean
  seatNumber?: string | null
  busName?: string | null
  plateNumber?: string | null
}

interface TravelSuccessData {
  travelName: string
  categoryName: string
  categoryColor: string
  destination: string
  departureDate: string
  guideName?: string | null
  cancellationDeadlineHours: number
  passengers: PassengerResult[]
}

interface Props {
  data: TravelSuccessData | null
  onClose: () => void
}

export const TravelSuccessModal = ({ data, onClose }: Props) => {
  if (!data) return null

  const { travelName, categoryName, categoryColor, destination, departureDate,
    guideName, cancellationDeadlineHours, passengers } = data

  const cancelDeadline = cancellationDeadlineHours > 0
    ? new Date(new Date(departureDate).getTime() - cancellationDeadlineHours * 3600000)
    : null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: 'blur(8px)' }} />

      <div
        className="relative z-10 w-full bg-white overflow-hidden flex flex-col"
        style={{
          maxWidth: 400,
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex flex-col items-center pt-8 pb-6 px-6 text-center"
          style={{ background: `linear-gradient(160deg, ${categoryColor}cc 0%, ${categoryColor} 100%)` }}
        >
          <button type="button" onClick={onClose}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors">
            <XIcon className="h-4 w-4" />
          </button>

          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg"
            style={{ boxShadow: `0 8px 24px ${categoryColor}50` }}>
            <CheckCircle2Icon className="h-9 w-9" style={{ color: categoryColor }} />
          </div>

          <p className="text-[13px] font-semibold text-white/70 uppercase tracking-widest mb-1">Başvuru Alındı</p>
          <p className="text-[20px] font-extrabold text-white leading-tight">{travelName}</p>
          <span className="mt-2 inline-block text-[11px] font-bold text-white/70 uppercase tracking-wide px-3 py-1 rounded-full bg-white/15">
            {categoryName}
          </span>
        </div>

        <div className="px-5 py-4 space-y-3">

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
              <MapPinIcon className="h-4 w-4 flex-shrink-0" style={{ color: categoryColor }} />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-medium">Destinasyon</p>
                <p className="text-[13px] font-bold text-gray-900 truncate">{destination}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
              <CalendarDaysIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />
              <div>
                <p className="text-[10px] text-gray-400 font-medium">Kalkış</p>
                <p className="text-[13px] font-bold text-gray-900">{formatDate(departureDate)}</p>
              </div>
            </div>
            {guideName && (
              <div className="col-span-2 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                <UserIcon className="h-4 w-4 flex-shrink-0 text-purple-500" />
                <div>
                  <p className="text-[10px] text-gray-400 font-medium">Rehber</p>
                  <p className="text-[13px] font-bold text-gray-900">{guideName}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {passengers.length === 1 ? 'Yolcu' : `${passengers.length} Yolcu`}
            </p>
            <div className="space-y-1.5">
              {passengers.map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold text-white"
                    style={{ background: p.isSelf ? categoryColor : '#6366f1' }}
                  >
                    {p.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-gray-900">
                      {p.name}{p.isSelf && <span className="text-gray-400 font-normal"> (Ben)</span>}
                    </p>
                    {(p.seatNumber || p.busName) && (
                      <div className="flex items-center gap-3 mt-0.5">
                        {p.seatNumber && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-500">
                            <ArmchairIcon className="h-3 w-3" /> Koltuk {p.seatNumber}
                          </span>
                        )}
                        {p.busName && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-500">
                            <BusIcon className="h-3 w-3" /> {p.busName}{p.plateNumber ? ` · ${p.plateNumber}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {cancelDeadline && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
              <ClockIcon className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] font-semibold text-amber-800">İptal son tarihi</p>
                <p className="text-[12px] text-amber-700 mt-0.5">
                  {formatDateTime(cancelDeadline)} tarihine kadar iptal edebilirsiniz.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-3.5 text-[14px] font-bold text-white transition-all"
            style={{
              background: `linear-gradient(135deg, ${categoryColor} 0%, ${categoryColor}cc 100%)`,
              boxShadow: `0 4px 14px ${categoryColor}50`,
            }}
          >
            Harika, teşekkürler!
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

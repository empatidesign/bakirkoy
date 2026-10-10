import { createPortal } from 'react-dom'
import { useMemo } from 'react'
import { XIcon, CircleDotIcon, UserIcon } from 'lucide-react'
import type { CitizenTravelSeatOccupant } from '@/types/travel.types'
import { getBusTemplate, generateBusSeatPositions, getAdjacentLabels, type BusSeatPosition } from './busSeatModel'

interface Props {
  open: boolean
  onClose: () => void
  busName: string
  templateId: string
  seatStates: Record<string, { status?: string } | string | null>
  occupants: CitizenTravelSeatOccupant[]
  taken: string[]
  value: string | null
  personGender?: 'male' | 'female'
  personLabel?: string
  driverName?: string | null
  guideName?: string | null
  /** Kullanıcı isteği (2026-08-07, senaryo 2): misafir yalnızca bu koltuk etiketlerinden birini
   * seçebilir (rezervasyondaki yetişkin yolcuların hemen yanındaki boş koltuklar). undefined/boş
   * ise kısıt uygulanmaz (normal yolcular için). */
  allowedLabels?: Set<string>
  onSelect: (label: string) => void
}

const TAKEN_STATUSES = new Set(['occupied', 'reserved', 'blocked', 'locked', 'driver', 'guide'])

export const TravelSeatPicker = ({
  open, onClose, busName, templateId, seatStates, occupants,
  taken, value, personGender, personLabel, driverName, guideName, allowedLabels, onSelect,
}: Props) => {
  const template = useMemo(() => getBusTemplate(templateId), [templateId])
  const positions = useMemo(() => generateBusSeatPositions(template), [template])

  const genderByLabel = useMemo(() => {
    const m: Record<string, string> = {}
    for (const o of occupants) m[o.seatNumber] = o.gender
    return m
  }, [occupants])

  // Kullanıcı isteği (2026-08-04): refakatçi koltuğunun kim tarafından dolu olduğu artık isimle
  // görünebiliyor (backend CompanionName'i occupants içinde döndürüyor) — tooltip'te gösteriyoruz.
  const companionNameByLabel = useMemo(() => {
    const m: Record<string, string> = {}
    for (const o of occupants) if (o.companionName) m[o.seatNumber] = o.companionName
    return m
  }, [occupants])

  const blockingGenderByLabel = useMemo(() => {
    const m: Record<string, string> = {}
    for (const o of occupants) if (!o.isOwnAccount && !o.isSameFamily) m[o.seatNumber] = o.gender
    return m
  }, [occupants])

  const forbidden = useMemo(() => {
    const set = new Set<string>()
    if (personGender !== 'male' && personGender !== 'female') return set
    for (const p of positions) {
      if (p.zone === 'driver' || p.zone === 'guide') continue
      const blocked = getAdjacentLabels(template, p.label).some((adj) => {
        const g = blockingGenderByLabel[adj]
        return (g === 'male' || g === 'female') && g !== personGender
      })
      if (blocked) set.add(p.label)
    }
    return set
  }, [positions, template, blockingGenderByLabel, personGender])

  const getSeatState = (p: BusSeatPosition): 'selected' | 'taken-male' | 'taken-female' | 'taken' | 'forbidden' | 'not-allowed' | 'free' => {
    if (value === p.label) return 'selected'
    const sv = seatStates[p.id]
    const raw = (typeof sv === 'string' ? sv : sv?.status ?? '').toLowerCase()
    if (TAKEN_STATUSES.has(raw) || taken.includes(p.label)) {
      const g = genderByLabel[p.label]
      if (g === 'male') return 'taken-male'
      if (g === 'female') return 'taken-female'
      return 'taken'
    }
    if (forbidden.has(p.label)) return 'forbidden'
    if (allowedLabels && allowedLabels.size > 0 && !allowedLabels.has(p.label)) return 'not-allowed'
    return 'free'
  }

  const cell = (p: BusSeatPosition) => {
    if (p.zone === 'driver' || p.zone === 'guide') {
      const name = p.zone === 'driver' ? driverName : guideName
      const isDriver = p.zone === 'driver'
      return (
        <div key={p.id}
          className="flex flex-col items-center gap-1"
          title={name ?? (isDriver ? 'Şoför' : 'Rehber')}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 text-white">
            {isDriver
              ? <CircleDotIcon className="h-5.5 w-5.5" />
              : <UserIcon className="h-5 w-5" />
            }
          </div>
          {name && <span className="text-[10px] text-gray-400 max-w-[52px] truncate text-center">{name}</span>}
          {!name && <span className="text-[10px] text-gray-400">{isDriver ? 'Şoför' : 'Rehber'}</span>}
        </div>
      )
    }

    const rawStatus = ((): string => {
      const sv = seatStates[p.id]
      return (typeof sv === 'string' ? sv : sv?.status ?? '').toLowerCase()
    })()
    if (rawStatus === 'hidden') {
      return <div key={p.id} className="h-12 w-12" aria-hidden="true" />
    }

    const state = getSeatState(p)
    const disabled = state !== 'free'

    // Kullanıcı isteği (2026-09-23): dolu koltuklar artık cinsiyet ikonuyla (♂/♀) işaretleniyor
    // ve tıklanamıyor; boş koltuklar yeşil, seçili koltuk belirgin mavi renkte gösteriliyor —
    // önceki sürümde dolu/boş ayrımı yalnızca renk tonuyla yapılıyordu, ikon yoktu.
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      selected:     { bg: '#2563eb',   color: '#fff',     border: '#1d4ed8' },
      'taken-male': { bg: '#dbeafe',   color: '#1d4ed8',  border: '#93c5fd' },
      'taken-female':{ bg: '#fce7f3',  color: '#be185d',  border: '#f9a8d4' },
      taken:        { bg: '#f3f4f6',   color: '#9ca3af',  border: '#e5e7eb' },
      forbidden:    { bg: '#fef2f2',   color: '#ef4444',  border: '#fca5a5' },
      'not-allowed':{ bg: '#f9fafb',   color: '#d1d5db',  border: '#e5e7eb' },
      free:         { bg: '#dcfce7',   color: '#15803d',  border: '#86efac' },
    }
    const s = styles[state]
    const genderIcon = state === 'taken-male' ? '♂' : state === 'taken-female' ? '♀' : null

    return (
      <button
        key={p.id}
        type="button"
        disabled={disabled}
        title={
          state === 'forbidden' ? 'Yan koltukta farklı cinsiyet — oturulamaz' :
          state === 'not-allowed' ? 'Misafir yalnızca yanınızdaki koltuğa oturabilir' :
          companionNameByLabel[p.label] ? `Refakatçi: ${companionNameByLabel[p.label]}` :
          state === 'taken-male' ? 'Dolu — Erkek yolcu' :
          state === 'taken-female' ? 'Dolu — Kadın yolcu' :
          state === 'taken' ? 'Dolu' :
          state === 'free' ? 'Boş — seçmek için tıklayın' : undefined
        }
        onClick={() => onSelect(p.label)}
        className="flex flex-col items-center gap-0.5 transition-all active:scale-95 touch-manipulation"
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-lg text-[13.5px] font-bold transition-all"
          style={{
            background: s.bg,
            color: s.color,
            border: `1.5px solid ${s.border}`,
            boxShadow: state === 'selected' ? '0 0 0 3px #2563eb30' : undefined,
          }}
        >
          {genderIcon ? <span className="text-[17px] leading-none">{genderIcon}</span> : p.label}
          {state === 'selected' && (
            <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-blue-600 flex items-center justify-center">
              <svg viewBox="0 0 8 8" fill="white" className="h-2.5 w-2.5">
                <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>
      </button>
    )
  }

  const driver = positions.filter((p) => p.zone === 'driver')
  const guide = positions.filter((p) => p.zone === 'guide')
  const back = positions.filter((p) => p.zone === 'back')

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/55" style={{ backdropFilter: 'blur(6px)' }} />

      <div
        className="relative z-10 flex flex-col bg-white overflow-hidden"
        style={{
          width: '100%',
          maxWidth: 540,
          maxHeight: '90vh',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[16px] font-bold text-gray-900">{busName} — Koltuk Seç</p>
            {personLabel && (
              <p className="text-[13px] text-gray-500 mt-0.5">
                <span className="font-semibold text-gray-700">{personLabel}</span>
                {personGender === 'male' ? ' · Erkek' : personGender === 'female' ? ' · Kadın' : ''} için
              </p>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-gray-100 px-5 py-3 bg-gray-50">
          {[
            { bg: '#dcfce7',  border: '#86efac', label: 'Boş' },
            { bg: '#dbeafe',  border: '#93c5fd', label: 'Dolu ♂' },
            { bg: '#fce7f3',  border: '#f9a8d4', label: 'Dolu ♀' },
            { bg: '#fef2f2',  border: '#fca5a5', label: 'Oturulamaz' },
            { bg: '#2563eb',  border: '#1d4ed8', label: 'Seçili' },
          ].map(({ bg, border, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-[12px] text-gray-600 font-medium">
              <span className="h-4.5 w-4.5 rounded-md flex-shrink-0" style={{ background: bg, border: `1.5px solid ${border}` }} />
              {label}
            </span>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
          <div
            className="mx-auto rounded-2xl border border-gray-200 overflow-hidden"
            style={{
              width: 'fit-content',
              background: '#f9fafb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div
              className="flex items-end justify-between gap-2 px-5 pt-5 pb-3.5 border-b border-dashed border-gray-300"
              style={{ background: '#f1f5f9' }}
            >
              <div className="flex gap-2.5">
                {driver.map(cell)}
                {guide.map(cell)}
              </div>
              <div className="flex flex-col items-center pb-1">
                <div className="h-9 w-7 rounded-t-full border-2 border-gray-400 border-b-0 flex items-end justify-center pb-1">
                  <div className="h-3 w-0.5 bg-gray-400 rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Kapı</span>
              </div>
            </div>

            <div className="px-5 py-4 space-y-2.5">
              {Array.from({ length: template.rows }, (_, idx) => {
                const r = idx + 1
                const left = positions.filter((p) => p.row === r && p.zone === 'left')
                const right = positions.filter((p) => p.row === r && p.zone === 'right')
                return (
                  <div key={r} className="flex items-center gap-2">
                    <span className="w-4 text-right text-[11px] font-medium text-gray-400 flex-shrink-0">{r}</span>
                    <div className="flex gap-2">{left.map(cell)}</div>
                    <div className="w-5 flex-shrink-0" />
                    <div className="flex gap-2">{right.map(cell)}</div>
                  </div>
                )
              })}
            </div>

            {back.length > 0 && (
              <div className="border-t border-dashed border-gray-300 px-5 pt-3.5 pb-5" style={{ background: '#f1f5f9' }}>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Arka</span>
                <div className="flex gap-2">{back.map(cell)}</div>
              </div>
            )}
          </div>

          {personGender && (
            <p className="mt-4 text-center text-[12px] text-gray-400 leading-relaxed max-w-sm mx-auto">
              Farklı cinsiyetten bir yolcunun yanına oturulamaz. Kırmızı koltuklar bu nedenle seçilemez.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

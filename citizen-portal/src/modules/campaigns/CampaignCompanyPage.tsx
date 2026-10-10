import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeftIcon, MapPinIcon, PhoneIcon, TagIcon, GlobeIcon, FacebookIcon, InstagramIcon, TwitterIcon, LinkedinIcon, NavigationIcon } from 'lucide-react'
import { Avatar, SkeletonRows } from '@/design-system'
import campaignService from '@/services/campaign.service'
import type { CitizenDirectoryCompany } from '@/types/campaign.types'
import { formatPhone, safeExternalUrl } from '@/lib/utils'
import { getCurrentPosition } from '@/lib/geolocation'
import { formatDistanceKm, directionsUrl } from '@/lib/distance'
import { CampaignListTab } from './CampaignListTab'

const SOCIAL_PLATFORMS = [
  { key: 'facebook' as const, Icon: FacebookIcon, color: 'text-[#1877F2]', bg: 'bg-[#1877F2]/10' },
  { key: 'instagram' as const, Icon: InstagramIcon, color: 'text-[#E4405F]', bg: 'bg-[#E4405F]/10' },
  { key: 'twitter' as const, Icon: TwitterIcon, color: 'text-[#0F1419]', bg: 'bg-[#0F1419]/10' },
  { key: 'linkedin' as const, Icon: LinkedinIcon, color: 'text-[#0A66C2]', bg: 'bg-[#0A66C2]/10' },
]

function extractHandle(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/^\/+|\/+$/g, '')
    if (!path) return u.hostname.replace(/^www\./, '')
    const first = path.split('/')[0]
    return `@${decodeURIComponent(first)}`
  } catch {
    return url
  }
}

const formatDistance = formatDistanceKm

export const CampaignCompanyPage = () => {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const [company, setCompany] = useState<CitizenDirectoryCompany | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return
    let active = true
    setLoading(true)
    const resolveCoords = async (): Promise<{ lat: number; lng: number } | undefined> => {
      try {
        if (!('permissions' in navigator)) return undefined
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        if (status.state !== 'granted') return undefined
      } catch {
        return undefined
      }
      const res = await getCurrentPosition()
      return res.ok ? { lat: res.position.latitude, lng: res.position.longitude } : undefined
    }

    resolveCoords().then((coords) => campaignService.directoryCompany(companyId, coords))
      .then((c) => { if (active) setCompany(c) })
      .catch(() => { if (active) setCompany(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [companyId])

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="relative overflow-hidden px-5 pb-6 pt-12"
        style={{ background: 'linear-gradient(160deg, #1e293b 0%, #3730a3 55%, #4f46e5 100%)' }}>
        <button type="button" onClick={() => navigate(-1)}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25">
          <ChevronLeftIcon className="h-5 w-5 text-white" />
        </button>

        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-16 w-16 flex-shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/20 backdrop-blur">
            {company?.logo
              ? <Avatar name={company.name} src={company.logo} size="lg" />
              : <TagIcon className="h-7 w-7 text-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-black text-white drop-shadow-sm">{company?.name ?? 'Firma'}</p>
            {company?.serviceCategory && (
              <span className="mt-1 inline-flex items-center rounded-full bg-white/25 px-2.5 py-0.5 text-[12px] font-medium text-white backdrop-blur">
                {company.serviceCategory.name}
              </span>
            )}
          </div>
        </div>

        {(company?.address || company?.phone || company?.website) && (
          <div className="mt-3 space-y-1">
            {(company.address || company.district) && (
              <p className="flex items-center gap-1.5 text-[12px] text-white/85">
                <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">{[company.district, company.address].filter(Boolean).join(' · ')}</span>
                {typeof company.distanceKm === 'number' && (
                  <span className="ml-1 inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                    <NavigationIcon className="h-3 w-3" /> {formatDistance(company.distanceKm)}
                  </span>
                )}
              </p>
            )}
            {company.phone && (
              <p className="flex items-center gap-1.5 text-[12px] text-white/85">
                <PhoneIcon className="h-3.5 w-3.5 flex-shrink-0" /> {formatPhone(company.phone)}
              </p>
            )}
            {safeExternalUrl(company.website) && (
              <a href={safeExternalUrl(company.website)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] text-white/85 hover:text-white">
                <GlobeIcon className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">{company.website}</span>
              </a>
            )}
          </div>
        )}

        {(company?.serviceDescription || company?.description) && (
          <p className="mt-3 text-[13px] leading-relaxed text-white/90 line-clamp-3">
            {company.serviceDescription ?? company.description}
          </p>
        )}

        {company?.socialMedia && SOCIAL_PLATFORMS.some(({ key }) => company.socialMedia?.[key]) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIAL_PLATFORMS.map(({ key, Icon }) => {
              const url = safeExternalUrl(company.socialMedia?.[key])
              if (!url) return null
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1.5 text-[12px] font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="max-w-[140px] truncate">{extractHandle(url)}</span>
                </a>
              )
            })}
          </div>
        )}
      </div>

      {company?.latitude != null && company?.longitude != null && (
        <a
          href={directionsUrl({ latitude: company.latitude!, longitude: company.longitude! }, company.googlePlaceId)}
          target="_blank" rel="noopener noreferrer"
          className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50"
        >
          <MapPinIcon className="h-4 w-4" /> Haritada Göster / Yol Tarifi Al
        </a>
      )}

      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-4 pb-1 text-[13px] font-bold text-gray-500">
          {company ? `${company.activeCampaignCount} aktif kampanya` : 'Kampanyalar'}
        </p>
        {loading ? (
          <div className="p-4"><SkeletonRows rows={3} /></div>
        ) : companyId ? (
          <CampaignListTab companyId={companyId} />
        ) : null}
      </div>
    </div>
  )
}

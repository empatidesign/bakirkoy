import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon, BookmarkIcon } from 'lucide-react'
import { CampaignListTab } from './CampaignListTab'

export const SavedCampaignsPage = () => {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="relative flex items-center gap-3 px-5 pb-5 pt-12"
        style={{ background: 'linear-gradient(160deg, #1e293b 0%, #3730a3 55%, #4f46e5 100%)' }}>
        <button type="button" onClick={() => navigate(-1)}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25">
          <ChevronLeftIcon className="h-5 w-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <BookmarkIcon className="h-5 w-5 text-white" fill="#fff" />
          <h1 className="text-[20px] font-black text-white drop-shadow-sm">Kaydettiklerim</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <CampaignListTab initialOnlySaved />
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { LibraryAnalyticsPanel, type LiveTileKey } from './LibraryAnalyticsPanel'
import { FacilityBreakdownModal } from './FacilityBreakdownModal'
import libraryService from '@/services/library.service'
import type { Library } from '@/types/library.types'
import type { SelectOption } from '@/types/common'

export const LibraryReportsTab = ({ onSelectLibrary }: { onSelectLibrary?: (id: string) => void } = {}) => {
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('')
  const [libraryOptions, setLibraryOptions] = useState<SelectOption[]>([])
  const [libraries, setLibraries] = useState<Library[]>([])
  const [breakdownKey, setBreakdownKey] = useState<LiveTileKey | null>(null)

  useEffect(() => {
    libraryService.getOptions()
      .then(setLibraryOptions)
      .catch(() => setLibraryOptions([]))

    libraryService.getList({ page: 1, limit: 200 })
      .then((res) => setLibraries(res.items))
      .catch(() => setLibraries([]))
  }, [])

  return (
    <div className="space-y-4">
      <LibraryAnalyticsPanel
        key={selectedLibraryId || 'all'}
        libraryId={selectedLibraryId || undefined}
        onLibraryChange={setSelectedLibraryId}
        libraryOptions={libraryOptions}
        showTopLibraries={!selectedLibraryId}
        onLiveTileClick={setBreakdownKey}
      />

      <FacilityBreakdownModal
        open={breakdownKey !== null}
        onClose={() => setBreakdownKey(null)}
        breakdownKey={breakdownKey}
        libraries={libraries}
        onSelect={onSelectLibrary}
      />
    </div>
  )
}

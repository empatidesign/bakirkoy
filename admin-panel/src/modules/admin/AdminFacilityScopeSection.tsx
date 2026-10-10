import { useEffect, useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import { MultiSelect, Banner } from '@/design-system'
import { api } from '@/services/api'

interface FacilityOption {
  id: string
  name: string
  district?: string
  isActive: boolean
}

interface AdminFacilityScopeSectionProps {
  facilityModule: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export const AdminFacilityScopeSection = ({ facilityModule, selectedIds, onChange }: AdminFacilityScopeSectionProps) => {
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.get<{ data: FacilityOption[] }>(`/${facilityModule}/facilities/options`)
      .then((res) => { if (active) setFacilities(res.data.data) })
      .catch(() => { if (active) setFacilities([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [facilityModule])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 type-muted">
        <Loader2Icon className="h-4 w-4 animate-spin" /> Tesisler yükleniyor...
      </div>
    )
  }

  if (facilities.length === 0) {
    return <Banner tone="neutral" variant="soft">Bu modülde henüz tesis tanımlı değil.</Banner>
  }

  return (
    <div className="space-y-2">
      <MultiSelect
        values={selectedIds}
        onChange={onChange}
        options={facilities.map((f) => ({
          value: f.id,
          label: f.district ? `${f.name} (${f.district})` : f.name,
        }))}
        placeholder="Görebileceği tesisleri seçin..."
        emptyText="Tesis bulunamadı"
        selectedSummary={`${selectedIds.length} tesis seçildi`}
      />
      <p className="type-caption text-foreground-muted">
        {selectedIds.length === 0
          ? 'Hiçbir tesis seçilmedi — bu yönetici hiçbir tesisi göremeyecek.'
          : `${selectedIds.length} / ${facilities.length} tesis seçili — yalnızca bu tesislerin grup/seans/başvuru/kayıt verilerini görebilecek.`}
      </p>
    </div>
  )
}

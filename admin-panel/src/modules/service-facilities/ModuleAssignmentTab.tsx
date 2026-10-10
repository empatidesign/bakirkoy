import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2Icon, LayersIcon, CheckCircle2Icon } from 'lucide-react'
import { Button, Badge, CheckboxRow, FormSection, EmptyState } from '@/design-system'
import serviceFacilityService from '@/services/serviceFacility.service'
import type { ServiceFacilityModuleUsage } from '@/types/serviceFacility.types'
import { FACILITY_MODULES } from '@/templates/FacilityTemplate/moduleConfig'

const CONFIG_BY_ROUTE_ID = Object.fromEntries(
  Object.values(FACILITY_MODULES).map((c) => [c.routeId, c]),
)

interface Props {
  serviceFacilityId: string
  onAssigned?: () => void
}

export const ModuleAssignmentTab = ({ serviceFacilityId, onAssigned }: Props) => {
  const [usage, setUsage] = useState<ServiceFacilityModuleUsage[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    serviceFacilityService.getModuleUsage(serviceFacilityId)
      .then((data) => { setUsage(data); setSelected(new Set()) })
      .catch(() => setUsage([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [serviceFacilityId])

  const toggle = (module: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(module)) next.delete(module)
      else next.add(module)
      return next
    })
  }

  const submit = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const result = await serviceFacilityService.assignModules(serviceFacilityId, Array.from(selected))
      if (result.assigned > 0) {
        toast.success(`${result.assigned} modüle atandı.`)
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} modülde atama başarısız oldu.`)
      }
      if (result.assigned === 0 && result.failed.length === 0) {
        toast.info('Seçilen modüller zaten atanmış.')
      }
      load()
      onAssigned?.()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 py-8 type-muted"><Loader2Icon className="h-4 w-4 animate-spin" /> Modül kullanım durumu yükleniyor...</div>
  }

  if (!usage || usage.length === 0) {
    return <EmptyState icon={LayersIcon} title="Modül bulunamadı" description="Atanabilecek bir program modülü bulunamadı." />
  }

  const assignedCount = usage.filter((u) => u.assigned).length

  return (
    <div className="space-y-[15px]">
      <FormSection
        title="Modül Ataması"
        icon={LayersIcon}
        subtitle="Bu hizmet tesisinin hangi program modüllerinde kullanılacağını seçin. İşaretlenen her modülde bu tesis adıyla otomatik bir kayıt oluşturulur."
        variant="card"
      >
        <div className="space-y-2">
          {usage.map((u) => {
            const config = CONFIG_BY_ROUTE_ID[u.module]
            const label = config?.terminology.facilitySingular ?? u.module
            const moduleLabel = config?.pageTitle ?? u.module
            if (u.assigned) {
              return (
                <div key={u.module} className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-2 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2Icon className="h-4 w-4 shrink-0 text-success" />
                    <div>
                      <p className="type-body-strong">{moduleLabel}</p>
                      <p className="type-caption">{label}: {u.facilityName}</p>
                    </div>
                  </div>
                  <Badge tone={u.facilityIsActive ? 'success' : 'neutral'}>{u.facilityIsActive ? 'Aktif' : 'Pasif'}</Badge>
                </div>
              )
            }
            return (
              <CheckboxRow
                key={u.module}
                label={moduleLabel}
                description={`Seçilirse "${label}" olarak eklenecek.`}
                checked={selected.has(u.module)}
                onChange={() => toggle(u.module)}
              />
            )
          })}
        </div>
      </FormSection>

      <div className="flex items-center justify-between gap-3">
        <p className="type-caption">{assignedCount} / {usage.length} modülde zaten kullanılıyor.</p>
        <Button variant="primary" onClick={submit} isLoading={saving} disabled={selected.size === 0}>
          Seçilen Modüllere Ata ({selected.size})
        </Button>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Building2Icon, LayersIcon, SearchIcon } from 'lucide-react'
import { Button, CheckboxRow, FormSection, EmptyState, Input } from '@/design-system'
import hallService from '@/services/hall.service'
import serviceFacilityService from '@/services/serviceFacility.service'
import type { FacilityOption } from '@/types/hall.types'
import { FACILITY_MODULES } from '@/templates/FacilityTemplate/moduleConfig'

const MODULES = Object.values(FACILITY_MODULES)

const toggleIn = (set: Set<string>, key: string) => {
  const next = new Set(set)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export const BulkModuleAssignView = () => {
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [search, setSearch] = useState('')
  const [facilityIds, setFacilityIds] = useState<Set<string>>(new Set())
  const [modules, setModules] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    hallService.getFacilityOptions().then(setFacilities).catch(() => setFacilities([]))
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return q ? facilities.filter((f) => f.label.toLocaleLowerCase('tr-TR').includes(q)) : facilities
  }, [facilities, search])

  const selectAllVisible = () => setFacilityIds((prev) => new Set([...prev, ...visible.map((f) => f.value)]))

  const submit = async () => {
    setSaving(true)
    let assigned = 0
    let failed = 0
    try {
      for (const id of facilityIds) {
        try {
          const result = await serviceFacilityService.assignModules(id, Array.from(modules))
          assigned += result.assigned
          failed += result.failed.length
        } catch {
          failed += modules.size
        }
      }
      if (assigned > 0) toast.success(`${assigned} atama yapıldı.`)
      if (failed > 0) toast.error(`${failed} atama başarısız oldu.`)
      if (assigned === 0 && failed === 0) toast.info('Seçilen tesisler bu modüllere zaten atanmış.')
      setFacilityIds(new Set())
      setModules(new Set())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-[15px]">
      <div className="grid gap-[15px] lg:grid-cols-2">
        <FormSection title={`Hizmet Tesisleri (${facilityIds.size} seçili)`} icon={Building2Icon} subtitle="Atama yapılacak tesisleri seçin." variant="card">
          <div className="flex items-center gap-2">
            <Input iconLeft={<SearchIcon className="h-4 w-4" />} placeholder="Tesis ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="outline" onClick={selectAllVisible} disabled={visible.length === 0}>Tümünü Seç</Button>
            <Button variant="ghost" onClick={() => setFacilityIds(new Set())} disabled={facilityIds.size === 0}>Temizle</Button>
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={Building2Icon} title="Tesis bulunamadı" description="Aramanıza uygun hizmet tesisi yok." />
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-auto">
              {visible.map((f) => (
                <CheckboxRow
                  key={f.value}
                  label={f.label}
                  description={f.locationType === 'Outdoor' ? 'Açık Alan' : 'Kapalı Tesis'}
                  checked={facilityIds.has(f.value)}
                  onChange={() => setFacilityIds((prev) => toggleIn(prev, f.value))}
                />
              ))}
            </div>
          )}
        </FormSection>

        <FormSection title={`Modüller (${modules.size} seçili)`} icon={LayersIcon} subtitle="Seçilen her tesis, işaretlenen her modülde aynı adla otomatik eklenir." variant="card">
          <div className="space-y-2">
            {MODULES.map((c) => (
              <CheckboxRow
                key={c.routeId}
                label={c.pageTitle}
                description={`"${c.terminology.facilitySingular}" olarak eklenir.`}
                checked={modules.has(c.routeId)}
                onChange={() => setModules((prev) => toggleIn(prev, c.routeId))}
              />
            ))}
          </div>
        </FormSection>
      </div>

      <div className="flex items-center justify-end gap-3">
        <p className="type-caption">Zaten atanmış tesis-modül çiftleri atlanır.</p>
        <Button variant="primary" onClick={submit} isLoading={saving} disabled={facilityIds.size === 0 || modules.size === 0}>
          Kaydet ({facilityIds.size} tesis × {modules.size} modül)
        </Button>
      </div>
    </div>
  )
}

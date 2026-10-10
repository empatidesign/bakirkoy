import { useEffect, useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import { MultiSelect, Banner, Switch, Label } from '@/design-system'
import libraryService from '@/services/library.service'

interface AdminLibraryDoorAccessSectionProps {
  hasDoorAccess: boolean
  onHasDoorAccessChange: (value: boolean) => void
  libraryIds: string[]
  onLibraryIdsChange: (ids: string[]) => void
}

// Kullanıcı isteği (2026-08-05): "Kütüphane Görevlisi" (library-mesai.door-access yetkili)
// bir rol seçilince, kütüphane personel formundaki gibi kapı erişimi anahtarı + hangi
// kütüphanelerde çalışabileceğini seçebileceği bir liste burada da görünsün — kayıt
// AdminUser oluşturmanın yanında ayrıca bir LibraryStaffMembers kaydı da oluşturur
// (kaynak: AdminUserId), aksi halde rol atanmış olsa bile kapı cihazları çalışmaz.
export const AdminLibraryDoorAccessSection = ({
  hasDoorAccess, onHasDoorAccessChange, libraryIds, onLibraryIdsChange,
}: AdminLibraryDoorAccessSectionProps) => {
  const [libraries, setLibraries] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    libraryService.getOptions()
      .then((opts) => { if (active) setLibraries(opts.map((o) => ({ value: o.value, label: o.district ? `${o.label} (${o.district})` : o.label }))) })
      .catch(() => { if (active) setLibraries([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Kapı Erişimi</Label>
          <p className="type-caption text-foreground-muted">Açıksa bu yönetici kendi QR/kartıyla kütüphane kapı cihazlarında giriş/çıkış yapabilir.</p>
        </div>
        <Switch
          checked={hasDoorAccess}
          onCheckedChange={onHasDoorAccessChange}
          className="h-6 w-11 shrink-0 rounded-[10px] [&>span]:h-5 [&>span]:w-5 [&>span]:rounded-[8px] aria-checked:[&>span]:translate-x-5"
        />
      </div>

      {hasDoorAccess && (
        loading ? (
          <div className="flex items-center gap-2 py-3 type-muted">
            <Loader2Icon className="h-4 w-4 animate-spin" /> Kütüphaneler yükleniyor...
          </div>
        ) : libraries.length === 0 ? (
          <Banner tone="neutral" variant="soft">Sistemde henüz kütüphane tanımlı değil.</Banner>
        ) : (
          <div className="space-y-2">
            <MultiSelect
              values={libraryIds}
              onChange={onLibraryIdsChange}
              options={libraries}
              placeholder="Çalışabileceği kütüphaneleri seçin..."
              emptyText="Kütüphane bulunamadı"
              selectedSummary={`${libraryIds.length} kütüphane seçildi`}
            />
            <p className="type-caption text-foreground-muted">
              {libraryIds.length === 0
                ? 'Devam etmek için en az bir kütüphane seçin — backend en az bir kütüphane şartı arar, boş bırakılırsa kayıt oluşturulamaz.'
                : `${libraryIds.length} / ${libraries.length} kütüphane seçili — mesai kayıtları bu kütüphanelerde tutulur. Kapı erişimi (HasDoorAccess) açık olduğu için, seçilmemiş kütüphanelerin kapı cihazlarında da giriş/çıkış yapabilir.`}
            </p>
            {libraryIds.length === 0 && (
              <p className="type-caption text-danger">En az bir kütüphane seçmeden kaydedemezsiniz.</p>
            )}
          </div>
        )
      )}
    </div>
  )
}

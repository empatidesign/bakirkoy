import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UsersIcon, ChevronRightIcon, InfoIcon, UserPlusIcon, CheckIcon } from 'lucide-react'
import { ModuleHeader, EmptyState, Avatar, Badge, PressableCard, SkeletonRows, Button, Modal, Checkbox } from '@/design-system'
import { GENDER_LABELS } from '@/types/auth.types'
import { maskTC } from '@/lib/utils'
import type { CitizenChild, CitizenFamilyNviPreview } from '@/types/family.types'
import familyService from '@/services/family.service'
import { ChildDetailModal } from './ChildDetailModal'

export const FamilyPage = () => {
  const [children, setChildren] = useState<CitizenChild[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<CitizenChild | null>(null)

  const [nviOpen, setNviOpen] = useState(false)
  const [nviLoading, setNviLoading] = useState(false)
  const [nviPreview, setNviPreview] = useState<CitizenFamilyNviPreview | null>(null)
  const [checkedTckns, setCheckedTckns] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  const loadChildren = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await familyService.getChildren()
      setChildren(data)
    } catch {
      setChildren(null)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadChildren()
  }, [])

  const openNviModal = async () => {
    setNviOpen(true)
    setNviLoading(true)
    setNviPreview(null)
    setCheckedTckns(new Set())
    try {
      const preview = await familyService.previewFromNvi()
      setNviPreview(preview)
      setCheckedTckns(new Set(preview.children.filter((c) => !c.alreadyAdded).map((c) => c.tckn)))
    } catch {
      toast.error('Nüfus kayıtlarından aile üyeleri alınamadı.')
      setNviOpen(false)
    } finally {
      setNviLoading(false)
    }
  }

  const toggleChild = (tckn: string) => {
    setCheckedTckns((prev) => {
      const next = new Set(prev)
      if (next.has(tckn)) next.delete(tckn)
      else next.add(tckn)
      return next
    })
  }

  const confirmNvi = async () => {
    if (checkedTckns.size === 0) {
      toast.error('En az bir kişi seçmelisiniz.')
      return
    }
    setConfirming(true)
    try {
      const result = await familyService.confirmFromNvi(Array.from(checkedTckns))
      toast.success(
        result.newlyAdded > 0
          ? `${result.newlyAdded} aile üyesi eklendi.`
          : 'Seçilen üyeler zaten kayıtlıydı.',
      )
      setNviOpen(false)
      await loadChildren()
    } catch {
      toast.error('Aile üyeleri eklenemedi.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={UsersIcon}
        title="Ailem"
        subtitle="Çocuk hesaplarınız"
        gradient="linear-gradient(160deg, #134e4a 0%, #0f766e 55%, #14b8a6 100%)"
        actions={
          <button
            onClick={() => void openNviModal()}
            className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm hover:bg-white/25 active:opacity-70 transition-colors"
          >
            <UserPlusIcon className="h-3.5 w-3.5" />
            NVI'den Ekle
          </button>
        }
      />
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : loadError ? (
          <EmptyState
            icon={UsersIcon}
            title="Aile bilgileri yüklenemedi"
            description="Bağlantınızı kontrol edip tekrar deneyin."
            action={
              <Button variant="outline" size="sm" onClick={() => void loadChildren()}>
                Tekrar Dene
              </Button>
            }
          />
        ) : !children || children.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Kayıtlı çocuk yok"
            description="18 yaş altı çocuklarınız kaydınıza otomatik bağlanır. Nüfus kayıtlarından da ekleyebilirsiniz."
            action={
              <Button variant="primary" size="sm" iconLeft={<UserPlusIcon className="h-4 w-4" />} onClick={() => void openNviModal()}>
                NVI'den Ekle
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-card border border-border bg-surface-0 p-3">
              <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <p className="type-caption">Bir çocuğa dokunarak bilgilerini görüntüleyebilir veya hesabına geçiş yapabilirsiniz.</p>
            </div>
            {children.map((child) => (
              <PressableCard key={child.id} onClick={() => setSelected(child)}>
                <Avatar name={child.fullName} src={child.photoUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="type-body-strong truncate">{child.fullName}</p>
                    <Badge tone="info">{child.age} yaş</Badge>
                    <Badge tone="neutral">{GENDER_LABELS[child.gender]}</Badge>
                  </div>
                  <p className="type-caption mt-0.5">{maskTC(child.tckn)}</p>
                </div>
                <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-foreground-subtle" />
              </PressableCard>
            ))}
          </>
        )}
      </div>
      <ChildDetailModal child={selected} onClose={() => setSelected(null)} />

      <Modal
        open={nviOpen}
        onClose={() => setNviOpen(false)}
        title="Nüfus Kayıtlarından Aile Üyesi Ekle"
        subtitle={nviPreview ? nviPreview.fullName : undefined}
        width={440}
        bodyClassName="p-5"
        footer={
          nviPreview && nviPreview.children.length > 0 ? (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setNviOpen(false)}>Vazgeç</Button>
              <Button
                variant="primary"
                className="flex-1"
                isLoading={confirming}
                disabled={checkedTckns.size === 0}
                onClick={() => void confirmNvi()}
              >
                Seçilenleri Ekle ({checkedTckns.size})
              </Button>
            </div>
          ) : undefined
        }
      >
        {nviLoading ? (
          <SkeletonRows rows={3} />
        ) : !nviPreview || nviPreview.children.length === 0 ? (
          <EmptyState icon={UsersIcon} title="Kayıt bulunamadı" description="Nüfus kayıtlarınıza bağlı yeni bir aile üyesi bulunamadı." />
        ) : (
          <div className="space-y-3">
            {nviPreview.children.map((child) => (
              <label
                key={child.tckn}
                className="flex items-center gap-3 rounded-card border border-border p-3"
                style={child.alreadyAdded ? { opacity: 0.55 } : undefined}
              >
                <Checkbox
                  checked={checkedTckns.has(child.tckn)}
                  disabled={child.alreadyAdded}
                  onCheckedChange={() => toggleChild(child.tckn)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="type-body-strong truncate">{child.fullName}</p>
                    {child.alreadyAdded && (
                      <Badge tone="success">
                        <CheckIcon className="mr-0.5 inline h-3 w-3" /> Kayıtlı
                      </Badge>
                    )}
                  </div>
                  <p className="type-caption mt-0.5">{maskTC(child.tckn)}</p>
                </div>
              </label>
            ))}
            <p className="type-caption block pt-1 text-foreground-subtle">
              Zaten eklenmiş üyeler otomatik işaretli değildir.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

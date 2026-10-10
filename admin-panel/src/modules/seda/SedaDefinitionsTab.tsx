import { useCallback, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { BookOpenIcon, GraduationCapIcon, Users2Icon, MapPinIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { FormSection, Button, Input, Field, Modal, ConfirmModal, RemovableTag, SkeletonRows } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import sedaService from '@/services/seda.service'
import { SEDA_DEFINITION_META, SEDA_DEFINITION_ORDER } from '@/types/seda.types'
import type { SedaDefinition, SedaDefinitionType } from '@/types/seda.types'

const DEFINITION_ICONS: Record<SedaDefinitionType, ComponentType<{ className?: string }>> = {
  subject: BookOpenIcon,
  'education-type': GraduationCapIcon,
  grade: Users2Icon,
  'exam-center': MapPinIcon,
}

const emptyItems = (): Record<SedaDefinitionType, SedaDefinition[]> => ({
  subject: [], 'education-type': [], grade: [], 'exam-center': [],
})

export const SedaDefinitionsTab = () => {
  const { can } = useAuth()
  const [items, setItems] = useState<Record<SedaDefinitionType, SedaDefinition[]>>(emptyItems())
  const [loading, setLoading] = useState(true)
  const [addType, setAddType] = useState<SedaDefinitionType | null>(null)
  const [addName, setAddName] = useState('')
  const [saving, setSaving] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<SedaDefinition | null>(null)
  const [removing, setRemoving] = useState(false)

  const loadType = useCallback((type: SedaDefinitionType) =>
    sedaService.getDefinitions(type, { page: 1, limit: 200 })
      .then((r) => setItems((prev) => ({ ...prev, [type]: r.items })))
      .catch(() => undefined), [])

  useEffect(() => {
    Promise.all(SEDA_DEFINITION_ORDER.map((t) => loadType(t))).finally(() => setLoading(false))
  }, [loadType])

  const openAdd = (type: SedaDefinitionType) => { setAddType(type); setAddName('') }
  const closeAdd = () => { setAddType(null); setAddName('') }

  const submitAdd = async () => {
    if (!addType || !addName.trim() || saving) return
    setSaving(true)
    try {
      await sedaService.createDefinition(addType, { name: addName.trim() })
      toast.success('Kayıt eklendi.')
      await loadType(addType)
      closeAdd()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Kayıt eklenemedi.')
    } finally {
      setSaving(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget || removing) return
    setRemoving(true)
    try {
      await sedaService.deleteDefinition(removeTarget.id)
      toast.success('Kayıt silindi.')
      await loadType(removeTarget.type)
      setRemoveTarget(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Kayıt silinemedi.')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) return <SkeletonRows rows={8} />

  return (
    <div className="space-y-4">
      {SEDA_DEFINITION_ORDER.map((type) => {
        const meta = SEDA_DEFINITION_META[type]
        const list = items[type]
        return (
          <FormSection
            key={type}
            variant="card"
            icon={DEFINITION_ICONS[type]}
            title={meta.title}
            subtitle={meta.description}
            action={
              <Button
                variant="primary"
                size="sm"
                iconLeft={<PlusIcon className="h-4 w-4" />}
                disabled={!can('seda.create')}
                title={can('seda.create') ? undefined : 'Ekleme yetkiniz yok'}
                onClick={() => openAdd(type)}
              >
                Ekle
              </Button>
            }
          >
            {list.length === 0 ? (
              <p className="type-muted">Henüz kayıt yok. “Ekle” ile yeni {meta.resource.toLocaleLowerCase('tr')} ekleyin.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((d) => (
                  <RemovableTag key={d.id} label={d.name} disabled={!can('seda.delete')} onRemove={() => setRemoveTarget(d)} />
                ))}
              </div>
            )}
          </FormSection>
        )
      })}

      <Modal
        open={addType !== null}
        onClose={closeAdd}
        title={addType ? `${SEDA_DEFINITION_META[addType].resource} Ekle` : ''}
        width={440}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={closeAdd}>İptal</Button>
            <Button variant="primary" className="flex-1" isLoading={saving} disabled={!addName.trim()} onClick={submitAdd}>Kaydet</Button>
          </div>
        }
      >
        <div className="p-6">
          <Field label={addType ? SEDA_DEFINITION_META[addType].resource : 'Ad'} required>
            <Input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && addName.trim()) submitAdd() }}
              placeholder={addType ? `${SEDA_DEFINITION_META[addType].resource} adı` : ''}
              autoFocus
            />
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Kaydı Sil"
        description={removeTarget ? `"${removeTarget.name}" silinecek. Bu işlem geri alınamaz.` : ''}
        tone="danger"
        loading={removing}
      />
    </div>
  )
}

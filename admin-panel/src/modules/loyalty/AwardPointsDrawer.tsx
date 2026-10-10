import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SearchIcon, UserIcon, CoinsIcon } from 'lucide-react'
import { Drawer, Button, Field, Input, NumberInput, Textarea } from '@/design-system'
import loyaltyService from '@/services/loyalty.service'
import participantService from '@/services/participant.service'
import type { Participant } from '@/types/participant.types'

interface AwardPointsDrawerProps {
  open: boolean
  onClose: () => void
  onAwarded?: () => void
}

/**
 * Yönetici tarafından serbest miktarda, gerekçeli manuel sadakat puanı verme.
 * Önceden bu özellik hiç yazılmamıştı (backend endpoint'i vardı ama admin panelde
 * hiçbir UI'dan çağrılmıyordu — bkz. docs/SADAKAT-LOYALTY-ADMIN-GRANT-CANLI-TEST-
 * RAPORU-2026-07-29.md, P0 bulgusu). Backend artık miktar+gerekçe zorunlu kılıyor
 * ve audit log tutuyor.
 */
export const AwardPointsDrawer = ({ open, onClose, onAwarded }: AwardPointsDrawerProps) => {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Participant[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Participant | null>(null)
  const [points, setPoints] = useState(10)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch(''); setResults([]); setSelected(null); setPoints(10); setDescription('')
    }
  }, [open])

  useEffect(() => {
    if (!search.trim() || selected) { setResults([]); return }
    const t = setTimeout(() => {
      setSearching(true)
      participantService.getList({ search: search.trim(), page: 1, limit: 8 })
        .then((res) => setResults(res.items))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search, selected])

  const canSave = !!selected && points > 0 && description.trim().length > 0 && !saving

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const tx = await loyaltyService.awardPoints({
        participantId: selected.id,
        points,
        description: description.trim(),
      })
      toast.success(`${selected.fullName} adlı vatandaşa ${tx.points} puan verildi. Yeni bakiye: ${tx.balanceAfter} puan.`)
      onAwarded?.()
      onClose()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Puan verilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Manuel Puan Ver"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" className="flex-1" isLoading={saving} disabled={!canSave} onClick={() => void save()}>
            Puanı Ver
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-1">
        <Field label="Vatandaş">
          {selected ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-1 px-3 py-2">
              <span className="inline-flex items-center gap-2 type-body-strong">
                <UserIcon className="h-4 w-4 text-primary" />
                {selected.fullName}
              </span>
              <button
                type="button"
                className="type-caption text-primary hover:underline"
                onClick={() => { setSelected(null); setSearch('') }}
              >
                Değiştir
              </button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Ad, TC veya telefon ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
              />
              {searching && <p className="type-caption text-foreground-muted mt-1">Aranıyor...</p>}
              {results.length > 0 && (
                <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelected(p); setResults([]) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-1 transition-colors"
                    >
                      <UserIcon className="h-4 w-4 text-foreground-muted shrink-0" />
                      <span className="type-body">{p.fullName}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Field>

        <Field label="Verilecek Puan">
          <NumberInput value={points} onChange={setPoints} min={1} suffix="puan" />
        </Field>

        <Field label="Gerekçe" hint="Zorunlu — denetim kaydında (audit log) kim, ne zaman, ne kadar ve neden puan verdiği kalıcı olarak tutulur.">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Örn: Etkinlikte gösterdiği örnek davranış nedeniyle ödül puanı"
          />
        </Field>

        {selected && points > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            <CoinsIcon className="h-4 w-4 shrink-0" />
            <span className="type-caption">
              <span className="font-semibold">{selected.fullName}</span> adlı vatandaşa <span className="font-semibold">+{points} puan</span> verilecek.
            </span>
          </div>
        )}
      </div>
    </Drawer>
  )
}

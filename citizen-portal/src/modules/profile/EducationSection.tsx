import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  GraduationCapIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  SearchIcon,
} from 'lucide-react'
import { Button, Modal } from '@/design-system'
import { ConfirmModal } from '@/design-system/Modal/Modal'
import educationService, {
  type EducationHistoryDto,
  type EducationInstitutionOption,
  type SaveEducationHistoryRequest,
} from '@/services/education.service'

const LEVEL_OPTIONS = [
  { value: 'Ilkokul', label: 'İlkokul' },
  { value: 'Ortaokul', label: 'Ortaokul' },
  { value: 'Lise', label: 'Lise' },
  { value: 'Onlisans', label: 'Ön Lisans' },
  { value: 'Lisans', label: 'Lisans' },
  { value: 'YuksekLisans', label: 'Yüksek Lisans' },
  { value: 'Doktora', label: 'Doktora' },
]

const HIGHER_LEVELS = new Set(['Onlisans', 'Lisans', 'YuksekLisans', 'Doktora'])
const INSTITUTION_TYPE_MAP: Record<string, string[]> = {
  Ilkokul: ['Ilkokul'],
  Ortaokul: ['Ortaokul'],
  Lise: ['Lise'],
  Onlisans: ['Universite', 'MeslekYuksekokulu'],
  Lisans: ['Universite', 'MeslekYuksekokulu'],
  YuksekLisans: ['Universite'],
  Doktora: ['Universite'],
}

const currentYear = new Date().getFullYear()

const emptyForm = (): SaveEducationHistoryRequest => ({
  institutionId: null,
  level: '',
  startYear: 2010,
  endYear: null,
  isGraduated: false,
})


interface ComboboxProps {
  options: EducationInstitutionOption[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder?: string
}

const InstitutionCombobox = ({ options, value, onChange, placeholder = '— Kurum seçilmedi —' }: ComboboxProps) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value) ?? null

  const filtered = search.trim()
    ? options.filter((o) => {
        const q = search.toLowerCase()
        return (
          o.name.toLowerCase().includes(q) ||
          (o.faculty ?? '').toLowerCase().includes(q) ||
          (o.department ?? '').toLowerCase().includes(q)
        )
      })
    : options

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleOpen = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropH = 280
    const showAbove = spaceBelow < dropH + 8 && rect.top > dropH + 8
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      zIndex: 9999,
    })
    setOpen(true)
    setSearch('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const institutionLabel = (o: EducationInstitutionOption) =>
    [o.name, o.faculty, o.department].filter(Boolean).join(' › ')

  const select = (id: string | null) => {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-sm text-left transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-400"
        style={{ height: 48, borderRadius: 12 }}
      >
        <span className={selected ? 'text-foreground-strong truncate' : 'text-foreground-subtle truncate'}>
          {selected ? institutionLabel(selected) : placeholder}
        </span>
        <ChevronDownIcon className="h-4 w-4 text-foreground-subtle shrink-0" />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          style={{ ...dropdownStyle, maxHeight: 280 }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <SearchIcon className="h-4 w-4 text-foreground-subtle shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kurum ara..."
              className="flex-1 text-sm outline-none placeholder:text-foreground-subtle"
            />
          </div>
          <ul className="overflow-y-auto" style={{ maxHeight: 224 }}>
            <li>
              <button
                type="button"
                onClick={() => select(null)}
                className="w-full px-4 py-2.5 text-left text-sm text-foreground-subtle hover:bg-indigo-50 transition-colors"
              >
                — Kurum seçilmedi —
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-foreground-subtle text-center">Sonuç bulunamadı</li>
            ) : (
              filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => select(o.id)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-indigo-50 ${o.id === value ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-foreground-strong'}`}
                  >
                    {institutionLabel(o)}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}


interface Props {
  onChanged?: () => void
}

export const EducationSection = ({ onChanged }: Props) => {
  const [histories, setHistories] = useState<EducationHistoryDto[]>([])
  const [options, setOptions] = useState<EducationInstitutionOption[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<SaveEducationHistoryRequest>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EducationHistoryDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadOptions = async () => {
    setLoadingOptions(true)
    try {
      const o = await educationService.getInstitutionOptions()
      setOptions(o)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Kurumlar yüklenemedi.')
      console.error('[EducationSection] Kurumlar yüklenemedi:', msg)
      toast.error(msg)
    } finally {
      setLoadingOptions(false)
    }
  }

  const load = async () => {
    try {
      const h = await educationService.getHistories()
      setHistories(h)
    } catch (err) {
      console.error('[EducationSection] Geçmiş yüklenemedi:', err)
      toast.error('Eğitim verileri yüklenirken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void loadOptions()
  }, [])

  const filteredOptions = form.level
    ? options.filter((o) => {
        const allowed = INSTITUTION_TYPE_MAP[form.level]
        return allowed ? allowed.includes(o.type) : true
      })
    : options

  const openAdd = () => {
    setEditId(null)
    setForm(emptyForm())
    setOpen(true)
    if (options.length === 0) void loadOptions()
  }

  const openEdit = (h: EducationHistoryDto) => {
    setEditId(h.id)
    setForm({
      institutionId: h.institutionId ?? null,
      level: h.level,
      startYear: h.startYear,
      endYear: h.endYear ?? null,
      isGraduated: h.isGraduated,
    })
    setOpen(true)
    if (options.length === 0) void loadOptions()
  }

  const handleLevelChange = (lvl: string) => {
    setForm((f) => ({ ...f, level: lvl, institutionId: null }))
  }

  const save = async () => {
    if (!form.level || !form.startYear) return
    setSaving(true)
    try {
      if (editId) {
        await educationService.update(editId, form)
        toast.success('Eğitim kaydı güncellendi.')
      } else {
        await educationService.create(form)
        toast.success('Eğitim kaydı eklendi.')
      }
      setOpen(false)
      await load()
      onChanged?.()
    } catch (err) {
      console.error('[EducationSection] Kayıt hatası:', err)
      toast.error('Kayıt sırasında bir hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await educationService.remove(deleteTarget.id)
      toast.success('Eğitim kaydı silindi.')
      setDeleteTarget(null)
      await load()
      onChanged?.()
    } catch (err) {
      console.error('[EducationSection] Silme hatası:', err)
      toast.error('Silme işlemi sırasında bir hata oluştu.')
    } finally {
      setDeleting(false)
    }
  }

  const isHigher = HIGHER_LEVELS.has(form.level)


  return (
    <div
      className="mx-4 mt-4 overflow-hidden bg-card shadow-sm"
      style={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-foreground-subtle">Eğitim Bilgileri</p>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 active:bg-indigo-100 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Ekle
        </button>
      </div>

      <div className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-surface-1 animate-pulse" />
            ))}
          </div>
        ) : histories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
              <BookOpenIcon className="h-5 w-5 text-indigo-300" />
            </div>
            <p className="text-sm text-foreground-subtle">Eğitim bilgisi eklenmemiş.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {histories.map((h) => (
              <div
                key={h.id}
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.08)' }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                  <GraduationCapIcon className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground-strong">{h.levelLabel}</span>
                    {h.isGraduated && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                        <CheckCircle2Icon className="h-3 w-3" /> Mezun
                      </span>
                    )}
                  </div>
                  {h.institutionName && (
                    <p className="text-xs text-foreground-muted mt-0.5 truncate">
                      {[h.institutionName, h.faculty, h.department].filter(Boolean).join(' › ')}
                    </p>
                  )}
                  <p className="text-xs text-foreground-subtle mt-0.5">
                    {h.startYear} – {h.endYear ?? 'devam ediyor'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(h)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 active:bg-surface-2"
                  >
                    <PencilIcon className="h-3.5 w-3.5 text-foreground-muted" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(h)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 active:bg-red-100"
                  >
                    <Trash2Icon className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? 'Eğitim Kaydını Düzenle' : 'Yeni Eğitim Kaydı'}
        width={440}
        className="min-h-[35rem]"
        bodyClassName="px-5 py-4"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              isLoading={saving}
              disabled={!form.level || !form.startYear}
              onClick={() => void save()}
            >
              Kaydet
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground-muted">
              Eğitim Seviyesi <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground-strong focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 appearance-none"
              style={{ height: 42 }}
              value={form.level || ''}
              onChange={(e) => handleLevelChange(e.target.value)}
            >
              <option value="">Seviye seçin</option>
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {form.level !== '' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold text-foreground-muted">
                  Kurum <span className="text-foreground-subtle font-normal">(opsiyonel)</span>
                </label>
                {!loadingOptions && options.length === 0 && (
                  <button
                    type="button"
                    onClick={() => void loadOptions()}
                    className="text-[10px] font-semibold text-indigo-500 underline"
                  >
                    Yeniden yükle
                  </button>
                )}
              </div>
              <p className="mb-1.5 text-[11px] text-foreground-subtle">
                {isHigher
                  ? 'Üniversite veya meslek yüksekokulu'
                  : 'Bakırköy ilçesindeki kurumlar'}
              </p>
              {loadingOptions ? (
                <div className="flex h-[42px] items-center justify-center rounded-xl border border-border bg-surface-1 text-xs text-foreground-subtle">
                  Kurumlar yükleniyor…
                </div>
              ) : (
                <InstitutionCombobox
                  options={filteredOptions}
                  value={form.institutionId ?? null}
                  onChange={(id) => setForm((f) => ({ ...f, institutionId: id }))}
                />
              )}
            </div>
          )}

          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground-muted">
                  Başlangıç Yılı <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground-strong focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  style={{ height: 42 }}
                  min={1950}
                  max={currentYear}
                  value={form.startYear}
                  onChange={(e) => setForm((f) => ({ ...f, startYear: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground-muted">Bitiş Yılı</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground-strong focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                  style={{ height: 42 }}
                  min={1950}
                  max={currentYear + 8}
                  value={form.endYear ?? ''}
                  placeholder={`${currentYear}`}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endYear: e.target.value ? Number(e.target.value) : null }))
                  }
                />
                <p className="mt-1 text-[11px] text-foreground-subtle">Boş = devam ediyor</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-1 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-foreground-strong">Mezun</p>
              <p className="text-xs text-foreground-subtle">Bu kurumdan mezun oldum</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isGraduated}
              onClick={() => setForm((f) => ({ ...f, isGraduated: !f.isGraduated }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                form.isGraduated ? 'bg-indigo-600' : 'bg-surface-2'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform ${
                  form.isGraduated ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void doDelete()}
        title="Eğitim Kaydı Silinsin mi?"
        description={`"${deleteTarget?.levelLabel ?? ''}" kaydı kalıcı olarak silinecek. Emin misiniz?`}
        confirmLabel="Sil"
        cancelLabel="İptal"
        tone="danger"
        icon={Trash2Icon}
        loading={deleting}
      />
    </div>
  )
}

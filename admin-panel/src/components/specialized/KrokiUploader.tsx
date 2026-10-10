import { useRef, useState } from 'react'
import { ImagePlusIcon, Loader2Icon, RefreshCwIcon, XIcon } from 'lucide-react'
import { Button, IconButton, Badge } from '@/design-system'
import { cn } from '@/lib/utils'

interface KrokiUploaderProps {
  value?: string | null
  onChange: (url: string | null) => void
  onUpload: (file: File) => Promise<{ url: string }>
  label?: string
  compact?: boolean
  readOnly?: boolean
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_KB = 8192

export const KrokiUploader = ({ value, onChange, onUpload, label, compact, readOnly }: KrokiUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setError(null)
    if (!ACCEPTED.includes(file.type)) { setError('Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.'); return }
    if (file.size > MAX_KB * 1024) { setError('Görsel 8 MB sınırını aşıyor.'); return }
    setUploading(true)
    try {
      const { url } = await onUpload(file)
      onChange(url)
    } catch {
      setError('Yükleme başarısız oldu. Lütfen tekrar deneyin.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const box = compact ? 'h-28' : 'h-44'

  return (
    <div className="space-y-1.5">
      {label && <p className="type-label">{label}</p>}

      {value ? (
        <div className={cn('group relative overflow-hidden rounded-card border border-border bg-surface-1', box)}>
          <img src={value} alt={label ?? 'Kroki'} className="h-full w-full object-contain" />
          <span className="absolute left-2 top-2"><Badge tone="success">Kroki yüklü</Badge></span>
          {!readOnly && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-0/70 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}><RefreshCwIcon className="h-4 w-4" /> Değiştir</Button>
              <IconButton tone="danger" title="Krokiyi kaldır" onClick={() => onChange(null)}><XIcon className="h-4 w-4" /></IconButton>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={readOnly || uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { if (!readOnly) e.preventDefault() }}
          onDrop={(e) => { if (readOnly) return; e.preventDefault(); pick(e.dataTransfer.files) }}
          className={cn('flex w-full flex-col items-center justify-center gap-1 rounded-card border border-dashed border-border bg-surface-1 text-foreground-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-60', box)}
        >
          {uploading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : <ImagePlusIcon className="h-5 w-5" />}
          <span className="type-body-strong">Kroki / yer planı yükle</span>
          <span className="type-caption">JPG, PNG, WEBP · sürükle-bırak</span>
        </button>
      )}

      {error && <p className="type-caption text-[hsl(var(--danger))]">{error}</p>}

      <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={(e) => pick(e.target.files)} />
    </div>
  )
}

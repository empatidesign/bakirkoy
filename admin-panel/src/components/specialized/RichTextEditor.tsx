import { useEffect, useRef } from 'react'
import {
  BoldIcon, ItalicIcon, UnderlineIcon, ListIcon, ListOrderedIcon,
  AlignLeftIcon, AlignCenterIcon, AlignRightIcon, RemoveFormattingIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

interface RichTextEditorProps {
  value: string
  onChange?: (html: string) => void
  placeholder?: string
  readOnly?: boolean
}

interface ToolItem {
  icon: React.ComponentType<{ className?: string }>
  command: string
  arg?: string
  title: string
}

const TOOLS: ToolItem[][] = [
  [
    { icon: BoldIcon, command: 'bold', title: 'Kalın' },
    { icon: ItalicIcon, command: 'italic', title: 'İtalik' },
    { icon: UnderlineIcon, command: 'underline', title: 'Altı çizili' },
  ],
  [
    { icon: ListIcon, command: 'insertUnorderedList', title: 'Madde işaretli liste' },
    { icon: ListOrderedIcon, command: 'insertOrderedList', title: 'Numaralı liste' },
  ],
  [
    { icon: AlignLeftIcon, command: 'justifyLeft', title: 'Sola hizala' },
    { icon: AlignCenterIcon, command: 'justifyCenter', title: 'Ortala' },
    { icon: AlignRightIcon, command: 'justifyRight', title: 'Sağa hizala' },
  ],
  [
    { icon: RemoveFormattingIcon, command: 'removeFormat', title: 'Biçimi temizle' },
  ],
]

export const RichTextEditor = ({ value, onChange, placeholder, readOnly }: RichTextEditorProps) => {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== value && document.activeElement !== el) {
      // 2026-07-30 denetiminde tespit edildi: düzenlenebilir modda `value`
      // sanitize edilmeden doğrudan innerHTML'e yazılıyordu (salt-okunur moddaki
      // satır 66 zaten sanitizeHtml kullanıyordu). Eğer bu değer backend'den veya
      // başka bir admin tarafından kaydedilmiş kötü amaçlı HTML/script içeriyorsa,
      // editör açılışında stored XSS tetiklenebiliyordu.
      el.innerHTML = sanitizeHtml(value)
    }
  }, [value])

  const emit = () => onChange?.(ref.current?.innerHTML ?? '')

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Yapıştırılan HTML sanitize edilmeden DOM'a girmesin (ör. panoya başka bir
    // uygulamadan kopyalanmış <script>/onerror gibi aktif içerik) — düz metin
    // olarak yapıştır, tarayıcının varsayılan (temizlenmemiş) HTML yapıştırmasını engelle.
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const run = (item: ToolItem) => {
    if (readOnly) return
    ref.current?.focus()
    document.execCommand(item.command, false, item.arg)
    emit()
  }

  if (readOnly) {
    return (
      <div
        className="prose-reset min-h-[80px] rounded-card border border-border bg-surface-1 px-3 py-2 type-body"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(value || '<span class="type-caption">Açıklama girilmemiş.</span>') }}
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface-1">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-2 px-2 py-1.5">
        {TOOLS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <span className="mx-1 h-4 w-px bg-border" />}
            {group.map((item) => (
              <button
                key={item.command}
                type="button"
                title={item.title}
                onMouseDown={(e) => { e.preventDefault(); run(item) }}
                className="flex h-7 w-7 items-center justify-center rounded-field text-foreground-muted transition-colors hover:bg-surface-0 hover:text-foreground-strong"
              >
                <item.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        ))}
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onPaste={handlePaste}
        data-placeholder={placeholder ?? 'Etkinlik açıklamasını yazın...'}
        className={cn(
          'min-h-[140px] px-3 py-2 type-body outline-none',
          'empty:before:type-caption empty:before:content-[attr(data-placeholder)]',
        )}
      />
    </div>
  )
}

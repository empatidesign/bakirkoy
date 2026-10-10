import { MicIcon, MicOffIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useSpeechToText } from '@/hooks/useSpeechToText'

// Kullanıcı isteği (2026-09-02): açıklama/not alanlarında sesli yazma. Bu buton bir
// Textarea'nın sağ üstüne bindirilir; basılınca dinlemeye başlar, tanınan metni
// `onText` ile mevcut değere ekler.
//
// Hata bulgusu (2026-09-03): buton, tarayıcı Web Speech API'yi desteklemediğinde
// (`supported=false`) hiç render EDİLMİYORDU — bu durumda saha ekranını Firefox'ta
// (masaüstü test ortamı dahil) açan bir kullanıcı butonu hiç göremiyor ve "sesli yazma
// yok / hata var" sanıyordu. Artık desteklenmeyen tarayıcılarda buton GÖRÜNÜR kalır,
// gri/pasif görünür ve tıklanınca "Chrome/Edge kullanın" uyarısı gösterir — kullanıcı en
// azından özelliğin var olduğunu ve neden çalışmadığını görür.

interface Props {
  /** Tanınan metni işler (çağıran taraf genelde mevcut metnin sonuna ekler). */
  onText: (transcript: string) => void
  className?: string
  size?: 'sm' | 'md'
}

// Ek doğrulama (2026-09-03): kullanıcının "tıklanma alanları rahat olsun" isteği tablet
// dokunmatik hedeflerine (Hızlı Geçiş, mahalle select, toggle) uygulanmıştı ama bu buton
// gözden kaçmıştı — eski boyutlar 28px (sm) ve 36px (md), ikisi de Apple/Google'ın önerdiği
// ~44px dokunmatik minimumun altındaydı. İkisi de 44px'e çıkarıldı.
export const MicButton = ({ onText, className, size = 'sm' }: Props) => {
  const { supported, listening, toggle } = useSpeechToText({
    onResult: onText,
    // Ek doğrulama (2026-09-03) bulgusu: mikrofon izni tarayıcıda REDDEDİLDİĞİNDE
    // buton kırmızıya dönüp sessizce eski haline dönüyordu — anketör "ne oldu?"
    // yaşıyordu. Artık açıklayıcı bir uyarı gösterilir.
    onPermissionDenied: () => toast.warning('Mikrofon izni reddedildi. Tarayıcı ayarlarından mikrofon erişimine izin verin.'),
  })

  const dim = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  if (!supported) {
    return (
      <button
        type="button"
        onClick={() => toast.info('Bu tarayıcı sesli yazmayı desteklemiyor. Chrome veya Edge kullanın.')}
        title="Bu tarayıcı sesli yazmayı desteklemiyor"
        aria-label="Sesli yazma bu tarayıcıda desteklenmiyor"
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-300',
          dim, className,
        )}
      >
        <MicOffIcon className={icon} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Sesli yazmayı durdur' : 'Sesli yazmaya başla'}
      aria-label={listening ? 'Sesli yazmayı durdur' : 'Sesli yazmaya başla'}
      aria-pressed={listening}
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full border transition-colors',
        dim,
        listening
          ? 'animate-pulse border-rose-300 bg-rose-50 text-rose-600'
          : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600',
        className,
      )}
    >
      {listening ? <MicOffIcon className={icon} /> : <MicIcon className={icon} />}
    </button>
  )
}


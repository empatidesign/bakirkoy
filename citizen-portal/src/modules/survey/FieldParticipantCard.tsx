import { UserIcon, MapPinIcon, IdCardIcon, UserXIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Kullanıcı isteği (2026-09-01, docs/ankettema/02.png): saha formunun en üstünde
// "Katılımcı Bilgileri (İsteğe Bağlı)" kartı bulunur — Ad Soyad, Telefon, Mahalle ve
// iki kimlik anahtarı (Anonim Katılım / T.C. Kimlik).
//
// KVKK notu: ad-soyad ve telefon anket YANITINA yazılmaz. Yalnızca (a) vatandaş adına
// talep/öneri/şikâyet kaydı açılırken ve (b) anket linkini SMS ile gönderirken kullanılır;
// bu yüzden alanlar isteğe bağlıdır ve boş bırakılabilir.
//
// Ayrı dosya olmasının sebebi: FieldSurveyRunner üzerinde eşzamanlı başka düzenlemeler
// yapılıyor; kart bağımsız bir bileşen olarak korunur.

interface Props {
  name: string
  onNameChange: (v: string) => void
  phone: string
  onPhoneChange: (v: string) => void
  neighborhood: string
  /** 'tckn' | 'anonymous' */
  identityMode: string
  onSelectAnonymous: () => void
  onSelectTckn: () => void
}

const Toggle = ({ on }: { on: boolean }) => (
  <span className={cn('relative h-5 w-9 flex-shrink-0 rounded-full transition-colors', on ? 'bg-emerald-500' : 'bg-slate-300')}>
    <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all', on ? 'left-[18px]' : 'left-0.5')} />
  </span>
)

export const FieldParticipantCard = ({
  name, onNameChange, phone, onPhoneChange,
  neighborhood,
  identityMode, onSelectAnonymous, onSelectTckn,
}: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <UserIcon className="h-5 w-5 text-slate-500" />
      <h3 className="text-[15px] font-bold text-slate-900">Katılımcı Bilgileri</h3>
      <span className="text-xs font-semibold text-slate-400">(İsteğe Bağlı)</span>
    </div>

    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_minmax(200px,auto)]">
      {/* Kullanıcı isteği (2026-09-03): "isimsiz anonim yapıldığında burada ilk baştaki
          ad soyad tc'si alanı kaldır" — anonim katılımda kimlik toplanmadığı için ad-soyad
          ve telefon alanları hiç GÖSTERİLMEZ (yalnızca T.C. kimlikli modda görünür). Anonim
          modda bu alanlar hem gereksiz hem de KVKK açısından yanıltıcıydı. */}
      {identityMode === 'anonymous' ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <UserXIcon className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">
            Anonim katılım: kişisel bilgi (ad-soyad, telefon, T.C.) alınmaz.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <span className="w-20 flex-shrink-0 text-xs font-bold text-slate-600">Ad Soyad</span>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Örn: Ahmet Yılmaz"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 flex-shrink-0 text-xs font-bold text-slate-600">Telefon</span>
            <input
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value.replace(/[^\d ]/g, ''))}
              inputMode="tel"
              maxLength={14}
              placeholder="05xx xxx xx xx"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
          <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
          Mahalle
        </div>
        <div className="flex min-h-11 items-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-black text-indigo-800">
          {neighborhood || 'Mahalle seçilmedi'}
        </div>
      </div>

      <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
        <button
          type="button"
          role="switch"
          aria-checked={identityMode === 'anonymous'}
          aria-label="Anonim Katılım"
          onClick={onSelectAnonymous}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1.5 text-left transition-colors active:bg-slate-100"
        >
          <UserXIcon className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <span className="flex-1 text-xs font-bold text-slate-700">Anonim Katılım</span>
          <Toggle on={identityMode === 'anonymous'} />
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={identityMode === 'tckn'}
          aria-label="T.C. Kimlikli"
          onClick={onSelectTckn}
          title="T.C. kimlikli katılım için kimlik adımına dön"
          className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-1.5 text-left transition-colors active:bg-slate-100"
        >
          <IdCardIcon className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <span className="flex-1 text-xs font-bold text-slate-700">T.C. Kimlikli</span>
          <Toggle on={identityMode === 'tckn'} />
        </button>
      </div>
    </div>
  </section>
)

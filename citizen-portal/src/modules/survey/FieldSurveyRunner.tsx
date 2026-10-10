import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon, CheckCircle2Icon,
  IdCardIcon, UserXIcon, AlertTriangleIcon, LoaderIcon,
  PlusCircleIcon, ListIcon, ShieldCheckIcon, MoreVerticalIcon,
  SaveIcon, WifiOffIcon, WifiIcon, CheckCheckIcon, XIcon, BuildingIcon,
  MenuIcon, CheckIcon, ChevronDownIcon, ClipboardListIcon, MapPinIcon,
  ClockIcon, MessageSquarePlusIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Input, Select, SkeletonRows } from '@/design-system'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils'
import type { CitizenSurveyQuestion } from '@/types/survey.types'
import type { FieldTaskDetail, FieldRespondentLookup, FieldResponseSummary } from '@/types/fieldSurvey.types'
import fieldSurveyService, { FieldOfflineQueuedError, FieldOfflinePersistFailedError } from '@/services/fieldSurvey.service'
import submissionService from '@/services/submission.service'
import { apiTarget } from '@/services/api'
import { subscribeFieldOfflineQueue } from '@/lib/fieldOfflineQueue'
import { injectAnimStyles } from './questionWidget'
import { FieldQuestionCard } from './FieldQuestionCard'
import { FieldParticipantCard } from './FieldParticipantCard'
import { FieldQuickActionsModal } from './FieldQuickActionsModal'

// Kullanıcı isteği (2026-09-01): saha görevlisi ekranı — önce görüşülen vatandaşın kimlik
// modu seçilir (T.C. kimlikli veya isimsiz/anonim), sonra her soru TAM EKRAN büyük bir
// kartta tek tek sorulur (tablet/telefon ile sahada tek elle kullanılabilsin diye büyük
// dokunma hedefleri, otomatik ilerleme). Soru bileşenleri vatandaş anket modalıyla ortak
// (questionWidget.tsx), yalnızca size="lg".

type Phase = 'identity' | 'questions' | 'done'

// 06.png üst barındaki 3 adımlı gösterge.
const STEPS = ['Giriş', 'Anket', 'Teşekkürler'] as const
const PHASE_INDEX: Record<Phase, number> = { identity: 0, questions: 1, done: 2 }
type IdentityMode = 'tckn' | 'anonymous'

// Kota ve mahalle/yaş analizleri bu bantlara göre hesaplanıyor; backend'deki
// SurveyPlatformService.AgeBands ile birebir aynı olmalıdır.
const AGE_GROUPS = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const

// Kullanıcı isteği (2026-09-01): "üstteki başlık ve sayfada sağ ve sola göre
// ayarlanmalı." Ölçümde üç ayrı hiza vardı: üst bar 20px, içerik kartı 32px,
// ortadaki buton yatay tablette 142px içeride başlıyordu. Artık üst bar, başlık
// şeridi, içerik kartı ve aksiyon barı aynı genişlik sınırını ve aynı yatay
// boşluğu kullanır; kenarlar her ekran boyutunda hizalı kalır.
//
// Hata bulgusu (2026-09-02): "1180px" SABİT bir tavandı — 1920px genişliğindeki bir
// saha tabletinde ekranın %38'i boş kalıyordu (ölçüldü: pencere 1920px, kabuk 1180px).
// Kullanıcı isteği (2026-09-02): "ekran boyutuna otomatik genişleyecek". Artık genişlik
// viewport'a oranla büyür (w-[92vw]) ve yalnızca ÇOK geniş masaüstü ekranlarda satır
// uzunluğu okunabilir kalsın diye 1600px'de tavanlanır (1180px'den kasıtlı olarak
// büyük — saha tableti asıl hedef, 1180px eski bir kısıtlamaydı).
const SHELL_WIDTH = 'mx-auto w-[92vw] max-w-[1600px]'
const SHELL_PADDING = 'px-4 sm:px-6'

const GENDERS: { value: string; label: string }[] = [
  { value: 'female', label: 'Kadın' },
  { value: 'male', label: 'Erkek' },
  { value: 'other', label: 'Belirtmek istemiyor' },
]

const isTcknValid = (raw: string) => {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11 || d[0] === '0') return false
  const n = d.split('').map(Number)
  const odd = n[0] + n[2] + n[4] + n[6] + n[8]
  const even = n[1] + n[3] + n[5] + n[7]
  let d10 = (odd * 7 - even) % 10
  if (d10 < 0) d10 += 10
  const d11 = n.slice(0, 10).reduce((a, b) => a + b, 0) % 10
  return d10 === n[9] && d11 === n[10]
}

/** Yarım kalan formun cihazda saklandığı anahtar (görev bazlı). */
const draftKey = (taskId: string) => `nexora_field_draft_${taskId}`

interface FieldDraft {
  answers: Record<string, string>
  identityMode: IdentityMode
  tckn: string
  respondentName?: string
  respondentPhone?: string
  neighborhood: string
  ageGroup: string | null
  gender: string | null
  localUuid: string
  savedAt: string
  /**
   * Hata düzeltmesi (2026-09-02): "Yarım kalan kayıt geri yüklendi." bildirimi her görev
   * açılışında yeniden düşüyordu. Sebep: taslak yalnızca anket gönderilince siliniyor;
   * anketör formu göndermeden çıkarsa (X / Görevlerime dön) taslak diskte kalıyor ve
   * göreve her girişte geri yükleme bildirimi tekrar tetikleniyordu (React StrictMode'da
   * ayrıca iki kez). Bu bayrak sayesinde aynı taslak için bildirim yalnızca bir kez
   * gösterilir; geri yükleme sessizce çalışmaya devam eder.
   */
  restoreNotified?: boolean
}

const newLocalUuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

type Props = {
  taskId: string
  onExit: () => void
}

const NeighborhoodPicker = ({ value, options, onChange }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) => (
  <div className="grid max-h-[36dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4" data-testid="neighborhood-cards">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          'flex min-h-[64px] items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left text-sm font-black transition-all active:scale-[0.98]',
          value === option.value
            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50',
        )}
      >
        <MapPinIcon className="h-5 w-5 flex-shrink-0" />
        <span>{option.label}</span>
      </button>
    ))}
    {value && !options.some((option) => option.value === value) && (
      <button type="button" aria-pressed className="flex min-h-[64px] items-center gap-2 rounded-2xl border-2 border-indigo-600 bg-indigo-600 px-3 py-3 text-left text-sm font-black text-white shadow-md">
        <MapPinIcon className="h-5 w-5 flex-shrink-0" />
        <span>{value}</span>
      </button>
    )}
  </div>
)

const TASK_DETAIL_CACHE_PREFIX = 'field_task_detail_'

/** Son başarılı anket detayı (30 gün): saha görevleri haftalarca sürebilir. */
const cacheTaskDetail = (taskId: string, detail: FieldTaskDetail): void => {
  try {
    localStorage.setItem(TASK_DETAIL_CACHE_PREFIX + taskId, JSON.stringify({ at: Date.now(), detail }))
  } catch { /* kota dolu olabilir, anketi bozmasın */ }
}

const readCachedTaskDetail = (taskId: string): FieldTaskDetail | null => {
  try {
    const raw = localStorage.getItem(TASK_DETAIL_CACHE_PREFIX + taskId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; detail?: FieldTaskDetail }
    if (!parsed?.detail) return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > 30 * 24 * 60 * 60 * 1000) return null
    return parsed.detail
  } catch { return null }
}

export const FieldSurveyRunner = ({ taskId, onExit }: Props) => {
  const [detail, setDetail] = useState<FieldTaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('identity')
  const [identityMode, setIdentityMode] = useState<IdentityMode>('tckn')
  const [tckn, setTckn] = useState('')
  const [lookup, setLookup] = useState<FieldRespondentLookup | null>(null)
  const [looking, setLooking] = useState(false)
  const [nviBirthDate, setNviBirthDate] = useState('')
  const [nviVerified, setNviVerified] = useState(false)
  const [neighborhood, setNeighborhood] = useState('')
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<{ value: string; label: string }[]>([])
  const [ageGroup, setAgeGroup] = useState<string | null>(null)
  const [gender, setGender] = useState<string | null>(null)
  const [showQuickActions, setShowQuickActions] = useState(false)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  // Kullanıcı isteği (2026-09-01, 02.png): üst barda "Otomatik Kaydedildi hh:mm:ss" ve
  // "Offline Mod" rozetleri. Taslak, cihazda localStorage'a yazılır; bağlantı koptuğunda
  // anketör verisinin güvende olduğunu görür.
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  // Kullanıcı isteği (2026-09-01, docs/ankettema/02.png): "Katılımcı Bilgileri (İsteğe Bağlı)"
  // kartı — ad soyad ve telefon isteğe bağlıdır; yalnızca vatandaş adına talep/şikâyet
  // oluşturulurken veya SMS ile anket linki gönderilirken kullanılır. Anket yanıtına
  // kişisel veri olarak yazılmaz (KVKK: amaçla sınırlılık).
  const [respondentName, setRespondentName] = useState('')
  const [respondentPhone, setRespondentPhone] = useState('')
  // Hata düzeltmesi (2026-09-02): "Kaydediliyor..." yalnızca gerçekten bekleyen bir
  // taslak yazımı varken gösterilir (cevap değişti, 1,2 sn'lik debounce bekliyor).
  const [draftPending, setDraftPending] = useState(false)
  // Kullanıcı isteği (2026-09-01, docs/ankettema/02.png): sorular TEK SAYFADA, kartlar hâlinde.
  // 06.png'deki tek-soru (odak) düzeni de korunur; anketör tablette ikisi arasında geçebilir.
  // Tercih cihazda saklanır.
  const [layout, setLayout] = useState<'page' | 'focus'>(() => {
    try { return localStorage.getItem('nexora_field_layout') === 'focus' ? 'focus' : 'page' }
    catch { return 'page' }
  })
  const toggleLayout = () => {
    setLayout((prev) => {
      const next = prev === 'page' ? 'focus' : 'page'
      try { localStorage.setItem('nexora_field_layout', next) } catch { /* yok say */ }
      return next
    })
  }
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  // Kullanıcı isteği (2026-09-02): son gönderim ağ hatası yüzünden cihazda kuyruğa
  // alındıysa (bkz. fieldOfflineQueue.ts), tamamlanma ekranında bunu ayrıca belirtir.
  const [queuedOffline, setQueuedOffline] = useState(false)
  // Bekleyen (henüz sunucuya gönderilememiş) offline kayıt sayısı — üst bardaki rozette
  // gösterilir, anketör sahada kaç kaydın "beklemede" olduğunu görebilsin.
  const [pendingCount, setPendingCount] = useState(0)
  useEffect(() => subscribeFieldOfflineQueue(setPendingCount), [])
  // 06.png: sol hamburger menü ve sağ üst saat/tarih göstergesi.
  const [showMenu, setShowMenu] = useState(false)
  // 06.png: sorular tek tek gösterilir; aktif soru indeksi.
  const [step, setStep] = useState(0)
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const [recent, setRecent] = useState<FieldResponseSummary[] | null>(null)

  const startedAt = useRef<number>(Date.now())
  const localUuid = useRef<string>(newLocalUuid())
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coords = useRef<{ lat: number; lng: number } | null>(null)
  // Taslak geri yükleme bildirimi bu görev için gösterildi mi (bkz. FieldDraft.restoreNotified).
  const restoreNotifiedRef = useRef(false)

  useEffect(() => { injectAnimStyles() }, [])

  /**
   * Kullanıcı isteği (2026-09-03): "internet bağlantısı kapalı olsa da çalışması
   * gerekiyordu." Cihazda ölçüldü: görev listesi çevrimdışı açılıyordu ama
   * ankete girilince "Görev bilgileri yüklenemedi" çıkıyor ve anketör soru
   * ekranına hiç ulaşamıyordu. Soru seti sunucudan geldiği için, sahaya
   * çıkmadan önce bir kez açılan anketin detayı cihazda saklanır.
   */
  const loadDetail = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    fieldSurveyService.taskDetail(taskId)
      .then((d) => {
        setDetail(d)
        cacheTaskDetail(taskId, d)
        setNeighborhood((prev) => prev || (d.task.neighborhood === 'Tüm Mahalleler' ? '' : d.task.neighborhood))
      })
      .catch((err) => {
        // Sunucudan yanıt geldiyse (4xx/5xx) gerçek hatadır; sadece ağ yokken
        // önbellekten aç, aksi halde anketör eski/yanlış soru setiyle çalışır.
        const isOffline = (err as { response?: unknown })?.response === undefined
        const cached = isOffline ? readCachedTaskDetail(taskId) : null
        if (cached) {
          setDetail(cached)
          setNeighborhood((prev) => prev || (cached.task.neighborhood === 'Tüm Mahalleler' ? '' : cached.task.neighborhood))
          toast.info('Çevrimdışısınız. Anket cihazdaki kayıttan açıldı; yanıtlar bağlantı gelince gönderilecek.')
          return
        }
        setLoadError('Görev bilgileri yüklenemedi.')
      })
      .finally(() => setLoading(false))
  }, [taskId])

  useEffect(() => { loadDetail() }, [loadDetail])

  // Kullanıcı isteği (2026-09-01, 02.png): "Kaydet ve Çık" ile yarıda bırakılan form,
  // göreve tekrar girildiğinde kaldığı yerden açılır (offline çalışmada veri kaybı olmasın).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(taskId))
      if (!raw) return
      const d = JSON.parse(raw) as FieldDraft
      if (!d?.answers) return
      // Hata düzeltmesi (2026-09-02): tek bir cevap bile içermeyen taslak "geri yüklendi"
      // denip hiçbir şey göstermiyordu (kullanıcıya boş/askıda ekran hissi veriyordu).
      // Böyle bir taslak anlamsızdır; temizlenir ve bildirim gösterilmez.
      if (!Object.values(d.answers).some((v) => (v ?? '').trim() !== '')) {
        localStorage.removeItem(draftKey(taskId))
        return
      }
      // Hata düzeltmesi (2026-09-02): taslak yalnızca anket gönderilince siliniyordu.
      // Anketör formu göndermeden çıkarsa taslak süresiz kalıyor ve günler sonra bile
      // "yarım kalan kayıt" olarak geri yükleniyordu — bu, başka bir vatandaşla yapılan
      // görüşmenin üzerine eski cevapların gelmesi riskini taşır. 24 saatten eski taslak
      // artık geçersiz sayılır ve sessizce temizlenir.
      const savedMs = d.savedAt ? Date.parse(d.savedAt) : NaN
      if (Number.isFinite(savedMs) && Date.now() - savedMs > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(draftKey(taskId))
        return
      }
      setAnswers(d.answers)
      setIdentityMode(d.identityMode ?? 'tckn')
      setTckn(d.tckn ?? '')
      if (d.neighborhood) setNeighborhood(d.neighborhood)
      setAgeGroup(d.ageGroup ?? null)
      setGender(d.gender ?? null)
      setRespondentName(d.respondentName ?? '')
      setRespondentPhone(d.respondentPhone ?? '')
      if (d.localUuid) localUuid.current = d.localUuid
      if (d.savedAt) setSavedAt(new Date(d.savedAt))
      // Hata düzeltmesi (2026-09-02): taslak geri yüklendiğinde ekran kimlik adımında
      // kalıyordu; anketör "geri yüklendi" bildirimini görüyor ama cevaplarını
      // göremiyordu (form boş görünüyordu). Cevap içeren bir taslak varsa doğrudan
      // soru adımına dönülür ve süre sayacı yeniden başlatılır.
      const hasAnswer = Object.values(d.answers).some((v) => (v ?? '').trim() !== '')
      if (hasAnswer) {
        startedAt.current = Date.now()
        setPhase('questions')
      }

      // Bildirim yalnızca taslak İLK kez geri yüklendiğinde gösterilir. Aksi hâlde anketör
      // aynı göreve her girdiğinde (ve StrictMode'da her mount'ta iki kez) aynı uyarıyı
      // görüyordu. Cevaplar ve "Otomatik Kaydedildi" rozeti zaten ekranda görünür durumda.
      restoreNotifiedRef.current = true
      if (!d.restoreNotified) {
        toast.info('Yarım kalan kayıt geri yüklendi.')
        try {
          localStorage.setItem(draftKey(taskId), JSON.stringify({ ...d, restoreNotified: true }))
        } catch { /* kota dolu olabilir, bildirim yine de gösterildi */ }
      }
    } catch {
      // Bozuk taslak sessizce yok sayılır.
    }
  }, [taskId])

  useEffect(() => {
    submissionService.options()
      .then((options) => setNeighborhoodOptions(options.neighborhoods))
      .catch(() => setNeighborhoodOptions([]))
  }, [])

  // Konum zorunluysa (Survey.RequireLocation) ekran açılır açılmaz izin isteyip arka planda tutar.
  useEffect(() => {
    if (!detail?.task.requireLocation || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => { coords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude } },
      () => { coords.current = null },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [detail?.task.requireLocation])

  useEffect(() => () => { if (autoTimer.current) clearTimeout(autoTimer.current) }, [])

  // Ölçüm bulgusu (2026-09-03, tablette uçak modunda): navigator.onLine ağ tamamen
  // kapalıyken bile true dönüyordu (WebView "bir arayüz var" demeyi yeterli sayıyor),
  // bu yüzden anketöre çevrimdışı rozeti hiç gösterilmiyordu. Tek doğru ölçüt
  // SUNUCUYA ULAŞILABİLİYOR MU sorusudur; sağlık ucu kısa aralıkla yoklanır.
  useEffect(() => {
    let cancelled = false
    const setIfChanged = (v: boolean) => { if (!cancelled) setOnline(v) }

    const probe = async () => {
      // navigator.onLine false ise kesinlikle çevrimdışıdır; true ise doğrulanmalı.
      if (typeof navigator !== 'undefined' && !navigator.onLine) return setIfChanged(false)
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 4000)
        await fetch(`${apiTarget.baseUrl}/health`, { method: 'GET', cache: 'no-store', signal: ctrl.signal })
        clearTimeout(timer)
        setIfChanged(true)
      } catch {
        setIfChanged(false)
      }
    }

    void probe()
    const timer = setInterval(() => void probe(), 20_000)
    const on = () => void probe()
    const off = () => setIfChanged(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const questions = useMemo(
    () => (detail ? [...detail.questions].sort((a, b) => a.order - b.order) : []),
    [detail],
  )
  const total = questions.length
  const answeredCount = questions.filter((q) => (answers[q.id] ?? '').trim() !== '').length
  /** 02.png'deki yüzde göstergesi: cevaplanan soru oranı. */
  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0
  const phaseIndex = PHASE_INDEX[phase]
  const current = questions[Math.min(step, Math.max(total - 1, 0))]
  const isFirstQ = step === 0
  const isLastQ = step >= total - 1

  // Kullanıcı isteği (2026-09-01): anketör görüşülen kişinin AD SOYADINI GÖRMEZ; her kayda
  // görev bazlı sıra numarası verilir (ör. SG-4F2A-0007). Gerçek kimlik yalnızca admin
  // tarafındadır; bu numara ekranda ve son kayıtlar listesinde referans olarak kullanılır.
  const participantNo = useMemo(() => {
    const taskShort = taskId.replace(/-/g, '').slice(0, 4).toUpperCase()
    const seq = (detail?.task.completedCount ?? 0) + 1
    return `SG-${taskShort}-${String(seq).padStart(4, '0')}`
  }, [taskId, detail?.task.completedCount])


  const resetForNext = () => {
    clearDraft()
    restoreNotifiedRef.current = false
    setSavedAt(null)
    setAnswers({})
    setTckn('')
    setLookup(null)
    setIdentityMode('tckn')
    setNviBirthDate('')
    setNviVerified(false)
    setAgeGroup(null)
    setGender(null)
    setRespondentName('')
    setRespondentPhone('')
    setQueuedOffline(false)
    localUuid.current = newLocalUuid()
    startedAt.current = Date.now()
    setPhase('identity')
  }

  // Kullanıcı isteği (2026-09-01): TC kimlikli katılımda TC + doğum tarihi ZORUNLU; tek
  // "Kimliği Doğrula" adımında hem yerel kayıt hem NVI sorgulanır. Mahalle, yaş grubu ve
  // cinsiyet sorgudan otomatik doldurulur (anketör elle adres/kişisel bilgi girmez).
  const verifyIdentity = async () => {
    if (!isTcknValid(tckn)) {
      toast.error('Geçerli bir T.C. kimlik numarası girin.')
      return
    }
    if (!nviBirthDate) {
      toast.error('Doğum tarihi zorunludur.')
      return
    }
    setLooking(true)
    setNviVerified(false)
    let local: FieldRespondentLookup | null = null
    try {
      local = await fieldSurveyService.lookup(taskId, tckn)
      setLookup(local)
      if (local.neighborhood) setNeighborhood(local.neighborhood)
      if (local.ageGroup) setAgeGroup(local.ageGroup)
      if (local.gender) setGender(local.gender)
      if (local.alreadyResponded) toast.warning('Bu kişi bu ankete daha önce yanıt vermiş.')
    } catch {
      local = {
        tckn: tckn.replace(/\D/g, ''), isRegistered: false, fullName: null,
        neighborhood: null, ageGroup: null, gender: null, alreadyResponded: false,
      }
      setLookup(local)
    }

    try {
      const r = await fieldSurveyService.nviLookup(taskId, tckn, nviBirthDate)
      if (r.verified) {
        setNviVerified(true)
        if (r.ageGroup) setAgeGroup(r.ageGroup)
        if (r.gender) setGender(r.gender)
        if (r.neighborhood && !local?.neighborhood) setNeighborhood(r.neighborhood)
        toast.success('Kimlik doğrulandı.')
      } else {
        toast.error(r.errorMessage || 'NVI doğrulaması başarısız. T.C. ve doğum tarihini kontrol edin.')
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'NVI sorgusu yapılamadı.')
    } finally {
      setLooking(false)
    }
  }

  /**
   * Hata düzeltmesi (2026-09-02): kimlik adımında eksik alan uyarısı veriliyordu ama alan
   * ekranın görünmeyen kısmında kalabildiği için anketör neyi doldurması gerektiğini
   * bulamıyordu. Uyarıyla birlikte ilgili alana kaydırılır ve kısa süre vurgulanır.
   */
  const focusIdentityField = (field: 'neighborhood' | 'ageGroup' | 'gender' | 'tckn' | 'birthDate') => {
    const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-rose-400', 'rounded-xl')
    setTimeout(() => el.classList.remove('ring-2', 'ring-rose-400', 'rounded-xl'), 2000)
  }

  const beginQuestions = () => {
    if (identityMode === 'tckn') {
      if (!isTcknValid(tckn)) {
        toast.error('Geçerli bir T.C. kimlik numarası girin.')
        return
      }
      if (!nviBirthDate) {
        toast.error('Doğum tarihi zorunludur.')
        return
      }
      if (!lookup) {
        toast.error('Önce "Kimliği Doğrula" ile kişiyi sorgulayın.')
        return
      }
    }
    if (!neighborhood) {
      toast.error('Görüşmenin yapıldığı mahalleyi seçin.')
      focusIdentityField('neighborhood')
      return
    }
    // Kullanıcı isteği (2026-09-01): anonim katılımda yaş ve cinsiyet seçilmeli.
    // Kimlik sorulmadığı için bu iki alan başka yerden türetilemez, kota ve
    // demografi analizleri ise onlara dayanıyor.
    if (identityMode === 'anonymous') {
      if (!ageGroup) {
        toast.error('Yaş grubunu seçin.')
        focusIdentityField('ageGroup')
        return
      }
      if (!gender) {
        toast.error('Cinsiyet seçin.')
        focusIdentityField('gender')
        return
      }
    }
    startedAt.current = Date.now()
    setPhase('questions')
  }

  const persistDraft = useCallback(() => {
    const now = new Date()
    const draft: FieldDraft = {
      answers, identityMode, tckn, neighborhood, ageGroup, gender,
      respondentName, respondentPhone,
      localUuid: localUuid.current, savedAt: now.toISOString(),
      // Bir kez gösterilen geri yükleme bildirimi otomatik kayıtla geri gelmemeli.
      restoreNotified: restoreNotifiedRef.current,
    }
    try {
      localStorage.setItem(draftKey(taskId), JSON.stringify(draft))
      setSavedAt(now)
      setDraftPending(false)
    } catch {
      // Depolama kotası dolmuşsa kayıt sessizce atlanır; form yine de gönderilebilir.
    }
  }, [answers, identityMode, tckn, neighborhood, ageGroup, gender, respondentName, respondentPhone, taskId])

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey(taskId)) } catch { /* yok say */ }
  }, [taskId])

  // Otomatik kaydet: cevap değiştikten 1,2 sn sonra taslak yazılır (02.png'deki rozet).
  // Hata düzeltmesi (2026-09-02): boş formda bekleyen yazım yokken "Kaydediliyor..."
  // gösterilmesin diye, yalnızca en az bir cevap varken bekleme durumu işaretlenir.
  useEffect(() => {
    if (phase !== 'questions') return
    const hasAnswer = Object.values(answers).some((v) => (v ?? '').trim() !== '')
    if (!hasAnswer) return
    setDraftPending(true)
    const t = setTimeout(persistDraft, 1200)
    return () => clearTimeout(t)
  }, [answers, phase, persistDraft])

  const saveDraftAndExit = () => {
    persistDraft()
    toast.success('Kayıt cihazınıza kaydedildi. Görevden devam edebilirsiniz.')
    onExit()
  }

  // Kullanıcı isteği (2026-09-01, 02.png): tüm sorular tek sayfada olduğu için otomatik
  // "sonraki soruya geç" davranışı kaldırıldı; anketör formu görüp sırayla doldurur.
  const setAnswer = (q: CitizenSurveyQuestion, value: string) => {
    setAnswers((prev) => ({ ...prev, [q.id]: value }))
  }

  const submit = async () => {
    if (!detail || submitting) return

    const missing = questions.find((q) => q.required && (answers[q.id] ?? '').trim() === '')
    if (missing) {
      toast.error('Zorunlu sorular cevaplanmadı.')
      // Tek sayfa düzeninde eksik soru ekranın dışında kalmış olabilir; oraya kaydırılır.
      const el = document.getElementById(`fq-${missing.id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('fq-flash')
      setTimeout(() => el?.classList.remove('fq-flash'), 1400)
      return
    }
    if (detail.task.requireLocation && !coords.current) {
      toast.error('Bu anket konum bilgisi gerektiriyor. Konum iznini açıp tekrar deneyin.')
      return
    }

    setSubmitting(true)
    try {
      const result = await fieldSurveyService.submit(taskId, {
        tckn: identityMode === 'anonymous' ? null : tckn.replace(/\D/g, ''),
        isAnonymousRespondent: identityMode === 'anonymous',
        answers: Object.entries(answers)
          .filter(([, v]) => v.trim() !== '')
          .map(([questionId, answer]) => ({ questionId, answer })),
        neighborhood: neighborhood || null,
        ageGroup,
        gender,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)),
        latitude: coords.current?.lat ?? null,
        longitude: coords.current?.lng ?? null,
        localUuid: localUuid.current,
      })
      setDetail((d) => (d ? {
        ...d,
        task: { ...d.task, completedCount: result.completedCount, todayCount: result.todayCount },
      } : d))
      setPhase('done')
      setQueuedOffline(false)
      setRecent(null)
      clearDraft()
      setSavedAt(null)
      setDraftPending(false)
      toast.success('Anket kaydedildi.')
    } catch (e) {
      // Kullanıcı isteği (2026-09-02): "internet yoksa verileri cache'e yazsın, internet
      // geldiğinde otomatik senkronize etsin." Ağ hatasında fieldSurvey.service kaydı zaten
      // localStorage kuyruğuna yazdı (bkz. fieldOfflineQueue.ts) — anketör için bu bir hata
      // değil, "cihazda güvende" durumudur; tamamlanma ekranına geçilir, taslak temizlenir
      // (aksi hâlde hem taslak hem kuyruk aynı kaydı tutar) ve bağlantı gelince otomatik
      // gönderileceği belirtilir.
      if (e instanceof FieldOfflineQueuedError) {
        setPhase('done')
        setQueuedOffline(true)
        setRecent(null)
        clearDraft()
        setSavedAt(null)
        setDraftPending(false)
        toast.warning('İnternet yok: kayıt cihazınıza kaydedildi, bağlantı gelince otomatik gönderilecek.')
        return
      }
      // Düzeltme (2026-09-05, denetim bulgusu): cihaza yazma da başarısız oldu (depolama
      // dolu/private mod). Taslak KASITLI OLARAK temizlenmez ve "kaydedildi" ekranına
      // geçilmez — anketör tekrar denesin diye cevaplar formda kalır.
      if (e instanceof FieldOfflinePersistFailedError) {
        toast.error(e.message)
        return
      }
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Anket kaydedilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleRecent = async () => {
    const next = !showRecent
    setShowRecent(next)
    if (next && recent === null) {
      try { setRecent(await fieldSurveyService.responses(taskId, 20)) }
      catch { setRecent([]) }
    }
  }

  if (loading) {
    return (
      <div className="field-survey-shell flex h-[100dvh] flex-col overflow-hidden bg-slate-100/70 p-6">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6"><SkeletonRows rows={6} /></div>
      </div>
    )
  }

  if (loadError || !detail) {
    return (
      <div className="field-survey-shell flex h-[100dvh] flex-col items-center justify-center gap-4 overflow-hidden bg-slate-100/70 p-6 text-center">
        <AlertTriangleIcon className="h-10 w-10 text-amber-500" />
        <p className="text-base font-black text-slate-900">{loadError ?? 'Görev bulunamadı.'}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Görevlerime dön
          </button>
          <button
            type="button"
            onClick={loadDetail}
            className="rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-indigo-700"
          >
            Tekrar dene
          </button>
        </div>
      </div>
    )
  }

  const task = detail.task
  const dailyLeft = task.dailyTarget > 0 ? Math.max(0, task.dailyTarget - task.todayCount) : null

  return (
    // Kullanıcı isteği (2026-09-01, docs/ankettema/02.png): tablet saha ekranı — beyaz üst bar
    // (kapat butonu, belediye logosu, anket başlığı, otomatik kayıt + offline rozetleri),
    // altında "Soru X / Y" ilerleme şeridi, tek sayfa soru kartları ve sabit aksiyon barı.
    <div className="field-survey-shell flex h-[100dvh] select-none flex-col overflow-hidden bg-slate-50">
      {/* 06.png üst barı: mor gradient, hamburger, marka, 3 adımlı stepper, offline rozeti */}
      <header className={cn('relative flex-shrink-0 bg-gradient-to-r from-[#3b1e8f] via-[#4c2bb0] to-[#6d3fd6] py-2.5 text-white shadow-lg', SHELL_PADDING)}>
        <div className={cn(SHELL_WIDTH, 'flex items-center gap-3')}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-white/15"
            aria-label="Menü"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <BuildingIcon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-black tracking-tight">BAKIRKÖY BELEDİYESİ</div>
              <div className="text-[10px] font-semibold text-white/70">Akıllı Anket Sistemi</div>
            </div>
          </div>

          {/* Adım göstergesi: Giriş → Anket → Teşekkürler */}
          <div className="mx-auto hidden items-center gap-1 md:flex">
            {STEPS.map((label, i) => {
              const state = i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'todo'
              return (
                <div key={label} className="flex items-center gap-1">
                  <div className="flex flex-col items-center gap-1 px-2">
                    <span className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-black transition-all',
                      state === 'active' ? 'border-white bg-white text-[#4c2bb0] shadow-md'
                        : state === 'done' ? 'border-white/70 bg-white/20 text-white'
                        : 'border-white/30 text-white/50',
                    )}>
                      {state === 'done' ? <CheckIcon className="h-3.5 w-3.5 stroke-[3]" /> : i + 1}
                    </span>
                    <span className={cn(
                      'text-[10px] font-bold',
                      state === 'todo' ? 'text-white/50' : 'text-white',
                    )}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span className={cn('h-px w-8 flex-shrink-0', i < phaseIndex ? 'bg-white/70' : 'bg-white/25')} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            {/* Kullanıcı isteği (2026-09-02): "internet yoksa cache'e yazsın" — bekleyen
                (henüz gönderilememiş) kayıt varsa anketör bunu üst bardan görsün. */}
            {pendingCount > 0 && (
              <span
                title={`${pendingCount} kayıt bağlantı bekliyor, internet gelince otomatik gönderilecek`}
                className="hidden items-center gap-1.5 rounded-xl bg-amber-400/20 px-2.5 py-1.5 text-[11px] font-black text-amber-200 sm:flex"
              >
                <SaveIcon className="h-3.5 w-3.5" /> {pendingCount} bekleyen
              </span>
            )}
            <div className="hidden items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 lg:flex">
              {online
                ? <WifiIcon className="h-4 w-4 text-emerald-300" />
                : <WifiOffIcon className="h-4 w-4 text-amber-300" />}
              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-wide">
                  {online ? 'ÇEVRİMİÇİ' : 'ÇEVRİMDIŞI'}
                </div>
                <div className="text-[10px] font-semibold text-white/70">
                  {/* Hata düzeltmesi (2026-09-02): `savedAt` boşken ekranda kalıcı olarak
                      "Kaydediliyor..." yazıyordu. Henüz kaydedilecek bir şey yokken (kimlik
                      adımı, boş form) bu yazı "sürekli yükleniyor" izlenimi veriyordu.
                      Artık yalnızca gerçekten bekleyen bir taslak varken gösterilir. */}
                  {savedAt
                    ? `Kaydedildi ${savedAt.toLocaleTimeString('tr-TR')}`
                    : draftPending ? 'Kaydediliyor...' : 'Otomatik kayıt açık'}
                </div>
              </div>
              <ChevronDownIcon className="h-3.5 w-3.5 text-white/60" />
            </div>

            <div className="hidden items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-bold sm:flex">
              <ClockIcon className="h-3.5 w-3.5 text-white/70" />
              {clock.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              <span className="text-white/60">
                {clock.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>

            <button
              type="button"
              onClick={onExit}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-white/15"
              aria-label="Görevlerime dön"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Hamburger menü paneli */}
        {showMenu && (
          <>
            <button
              type="button"
              aria-label="Menüyü kapat"
              className="fixed inset-0 z-30 cursor-default bg-black/20"
              onClick={() => setShowMenu(false)}
            />
            <nav className="absolute left-3 top-full z-40 mt-1 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-2xl">
              {[
                { icon: ClipboardListIcon, label: 'Görevlerime dön', desc: 'Atanmış anket listesi', onClick: onExit },
                { icon: SaveIcon, label: 'Kaydet ve çık', desc: 'Taslağı sakla, listeye dön', onClick: saveDraftAndExit },
                { icon: MoreVerticalIcon, label: 'Hızlı işlemler', desc: 'Talep / öneri / şikayet, SMS', onClick: () => setShowQuickActions(true) },
                { icon: ListIcon, label: 'Son kayıtlar', desc: 'Bu görevde toplananlar', onClick: toggleRecent },
              ].map(({ icon: Icon, label, desc, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setShowMenu(false); onClick() }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{label}</span>
                    <span className="block truncate text-[11px] font-semibold text-slate-500">{desc}</span>
                  </span>
                </button>
              ))}
              <div className="mt-1 border-t border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <MapPinIcon className="h-3.5 w-3.5 text-violet-600" />
                  {task.neighborhood} · Bugün {task.todayCount}
                  {dailyLeft !== null ? ` (${dailyLeft} kaldı)` : ''}
                </span>
              </div>
            </nav>
          </>
        )}
      </header>

      {/* Anket başlığı şeridi (06.png: "Anket: ... [Detay]") */}
      <div className={cn('flex-shrink-0 border-b border-slate-200 bg-white py-2', SHELL_PADDING)}>
        <div className={cn(SHELL_WIDTH, 'flex items-center gap-2')}>
          <span className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5">
            <CheckCheckIcon className="h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span className="truncate text-xs font-bold text-slate-800">
              Anket: {task.surveyTitle}
            </span>
          </span>
          <span className="hidden rounded-lg bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-700 sm:inline">
            {task.surveyCategory || 'Saha Anketi'}
          </span>
          <span className="ml-auto hidden items-center gap-1.5 text-[11px] font-bold text-slate-500 md:flex">
            <MapPinIcon className="h-3.5 w-3.5 text-violet-600" />
            {task.neighborhood}
          </span>
        </div>
      </div>

      <FieldQuickActionsModal
        open={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        fieldTaskId={taskId}
        neighborhood={neighborhood || task.neighborhood}
        prefillTckn={identityMode === 'tckn' ? tckn : null}
        prefillPhone={respondentPhone || null}
        prefillName={respondentName || null}
        prefillBirthDate={identityMode === 'tckn' ? nviBirthDate || null : null}
      />

      {showRecent && (
        <section className="max-h-[38vh] flex-shrink-0 overflow-y-auto border-b border-border bg-white px-4 py-4 sm:px-8">
          <div className="mx-auto w-full max-w-[1100px]">
            <p className="type-body-strong mb-2">Bu görevde toplanan son kayıtlar</p>
            {recent === null ? (
              <SkeletonRows rows={3} />
            ) : recent.length === 0 ? (
              <p className="type-muted">Henüz kayıt yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left type-caption text-foreground-subtle">
                      <th className="py-2 pr-3">Katılımcı No</th>
                      <th className="py-2 pr-3">Mahalle</th>
                      <th className="py-2 pr-3">Yaş</th>
                      <th className="py-2 pr-3">Cinsiyet</th>
                      <th className="py-2 pr-3">Süre</th>
                      <th className="py-2">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, i) => (
                      <tr key={r.id} className="border-b border-border/60 last:border-0">
                        {/* Anketör TC/ad görmez: yalnızca görev bazlı katılımcı numarası. */}
                        <td className="py-2 pr-3 font-mono font-bold text-violet-700">
                          {`SG-${taskId.replace(/-/g, '').slice(0, 4).toUpperCase()}-${String(recent.length - i).padStart(4, '0')}`}
                        </td>
                        <td className="py-2 pr-3">{r.neighborhood ?? '—'}</td>
                        <td className="py-2 pr-3">{r.ageGroup ?? '—'}</td>
                        <td className="py-2 pr-3">
                          {r.gender === 'male' ? 'Erkek' : r.gender === 'female' ? 'Kadın' : '—'}
                        </td>
                        <td className="py-2 pr-3">{r.durationSeconds ? `${r.durationSeconds} sn` : '—'}</td>
                        <td className="py-2">{formatDateTime(r.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <main className={cn(
        'flex min-h-0 flex-1 justify-center overflow-x-clip py-4',
        SHELL_PADDING,
        phase === 'done' ? 'items-start overflow-y-auto' : 'items-stretch overflow-hidden',
      )}>
        {phase === 'identity' && (
          /* Kullanıcı isteği (2026-09-01): "görüşülen kişi" ekranı da TAM EKRAN — başlık ve
             "Ankete başla" butonu sabit kalır, yalnızca form alanı kendi içinde kayar. */
          <div className={cn(SHELL_WIDTH, 'flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm')}>
            <div className={cn('flex w-full flex-shrink-0 items-center gap-3 border-b border-slate-100 py-4', SHELL_PADDING)}>
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#4c2bb0] text-white shadow-sm">
                <IdCardIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black tracking-tight text-slate-900">Görüşülen kişi</h2>
                <p className="truncate text-xs font-semibold text-slate-500">T.C. kimlikli katılım veya isimsiz/anonim katılım seçin.</p>
              </div>
              <span className="ml-auto hidden flex-shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700 sm:inline">
                {participantNo}
              </span>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-4 sm:px-7">
              <div className="w-full">

            {/* Kullanıcı isteği (2026-09-01): "ilk giriş t isimsiz bilgi girişi iki seenekten
                sonra ilgili alanlara göre anket soruları başlaması lazım" — TC-kimlikli veya
                isimsiz/anonim iki büyük seçenek.
                Kullanıcı isteği (2026-09-04): "görüşülen kişi sayfasında dikey ekranda tasarımını
                ekranda daha büyük olacak şekilde tıklama gösterim alanları yap" — dikey (portrait)
                tablet/telefonda bu iki kart tek başına ekranın yarısını kaplayacak kadar dar ve
                düşük kalıyordu; portrait: varyantıyla dolgu, ikon ve yazı boyutu, minimum yükseklik
                büyütüldü ki dokunma alanı gözle görülür şekilde genişlesin. */}
            <div className="grid grid-cols-2 gap-3 portrait:gap-4">
              <button
                type="button"
                onClick={() => { setIdentityMode('tckn') }}
                className={cn(
                  'flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-5 text-center transition-colors portrait:min-h-[180px] portrait:gap-3 portrait:rounded-3xl portrait:p-6',
                  identityMode === 'tckn' ? 'border-indigo-600 bg-indigo-50/80 shadow-md ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50',
                )}
              >
                <IdCardIcon className={cn('h-7 w-7 portrait:h-11 portrait:w-11', identityMode === 'tckn' ? 'text-indigo-600' : 'text-slate-400')} />
                <span className="text-sm font-black text-slate-900 portrait:text-lg">T.C. Kimlikli Katılım</span>
                <span className="text-[11px] font-semibold text-slate-500 portrait:text-sm">TC kimlik numarası ile devam edilir.</span>
              </button>
              <button
                type="button"
                onClick={() => { setIdentityMode('anonymous'); setLookup(null) }}
                className={cn(
                  'flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-5 text-center transition-colors portrait:min-h-[180px] portrait:gap-3 portrait:rounded-3xl portrait:p-6',
                  identityMode === 'anonymous' ? 'border-indigo-600 bg-indigo-50/80 shadow-md ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50',
                )}
              >
                <UserXIcon className={cn('h-7 w-7 portrait:h-11 portrait:w-11', identityMode === 'anonymous' ? 'text-indigo-600' : 'text-slate-400')} />
                <span className="text-sm font-black text-slate-900 portrait:text-lg">İsimsiz / Anonim Katılım</span>
                <span className="text-[11px] font-semibold text-slate-500 portrait:text-sm">Kimlik bilgisi istenmeden doğrudan başlanır.</span>
              </button>
            </div>

            {identityMode === 'tckn' ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700">
                    T.C. Kimlik Numarası <span className="text-rose-600">*</span>
                  </label>
                  <Input
                    value={tckn}
                    sanitize="digits"
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="11 haneli T.C. kimlik no"
                    onChange={(e) => { setTckn(e.target.value); setLookup(null); setNviVerified(false) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') verifyIdentity() }}
                    className="text-xl tracking-[0.18em]"
                  />
                  {tckn.length === 11 && !isTcknValid(tckn) && (
                    <p className="mt-1.5 text-[11px] font-bold text-rose-600">Bu T.C. kimlik numarası doğrulanamadı.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black text-slate-700">
                    Doğum Tarihi <span className="text-rose-600">*</span>
                  </label>
                  <Input
                    type="date"
                    value={nviBirthDate}
                    onChange={(e) => { setNviBirthDate(e.target.value); setNviVerified(false) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') verifyIdentity() }}
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={verifyIdentity}
                    disabled={looking || !isTcknValid(tckn) || !nviBirthDate}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
                  >
                    {looking ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <ShieldCheckIcon className="h-4 w-4" />}
                    Kimliği Doğrula
                  </button>
                </div>

                {/* Kullanıcı isteği (2026-09-01): adres/kişisel alanlar GÖRÜNMEZ; mahalle,
                    yaş grubu ve cinsiyet doğrulamadan otomatik gelir ve salt-okunur gösterilir. */}
                {lookup && (
                  <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={lookup.isRegistered ? 'success' : 'neutral'}>
                        {lookup.isRegistered ? 'Sistemde kayıtlı' : 'Kayıtsız vatandaş'}
                      </Badge>
                      {nviVerified && (
                        <Badge tone="success"><ShieldCheckIcon className="mr-1 h-3 w-3" />NVI Doğrulandı</Badge>
                      )}
                      {lookup.alreadyResponded && <Badge tone="warning">Daha önce yanıtladı</Badge>}
                      {/* Kullanıcı isteği (2026-09-01): anketör AD SOYAD GÖRMEZ — kayda
                          görev bazlı bir katılımcı numarası verilir; gerçek kimlik yalnızca
                          admin panelde görüntülenir. */}
                      <span className="ml-auto rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">
                        Katılımcı No: {participantNo}
                      </span>
                    </div>

                    {/* Hata düzeltmesi (2026-09-02, kullanıcı: "anket başlatılamıyor"):
                        bu üç alan yalnızca SALT-OKUNUR gösteriliyordu. Sorgudan mahalle
                        boş dönerse (kayıtsız vatandaş, mahallesiz kayıt) anketör alanı
                        hiçbir yerden dolduramıyor, "Ankete başla" ise "mahalleyi seçin"
                        deyip engelliyordu — anket hiç başlatılamıyordu. Alanlar artık
                        sorgudan otomatik dolar ama gerektiğinde elle düzeltilebilir. */}
                    <div className="mt-3 space-y-3">
                      <div data-field="neighborhood">
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Mahalle <span className="text-rose-500">*</span>
                        </label>
                        <NeighborhoodPicker value={neighborhood} options={neighborhoodOptions} onChange={setNeighborhood} />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div data-field="ageGroup">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Yaş Grubu
                          </label>
                          <Select value={ageGroup ?? ''} onChange={(e) => setAgeGroup(e.target.value || null)}>
                            <option value="">Seçin</option>
                            {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                          </Select>
                        </div>
                        <div data-field="gender">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Cinsiyet
                          </label>
                          <Select value={gender ?? ''} onChange={(e) => setGender(e.target.value || null)}>
                            <option value="">Seçin</option>
                            {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                          </Select>
                        </div>
                      </div>
                    </div>

                    {detail.isAnonymous && (
                      <p className="mt-2.5 text-[11px] font-semibold text-slate-500">
                        Bu anket anonimdir: kimlik bilgisi kayda açık şekilde yazılmaz, yalnızca mükerrer
                        yanıtı engellemek için şifrelenmiş olarak saklanır.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Kullanıcı isteği (2026-09-01): "isim anonimde yaş ve cinsiyet seçilmeli."
                 Kimlik sorulmadığında yaş ve cinsiyet başka hiçbir yerden türetilemez;
                 oysa kota takibi ve mahalle/demografi analizleri bu iki alana dayanıyor.
                 Bu yüzden anonim katılımda üçü de (mahalle, yaş grubu, cinsiyet) zorunludur. */
              <div className="mt-5 space-y-5">
                <div data-field="neighborhood">
                  <label className="mb-1.5 block text-xs font-black text-slate-700">
                    Mahalle <span className="text-rose-500">*</span>
                  </label>
                  <NeighborhoodPicker value={neighborhood} options={neighborhoodOptions} onChange={setNeighborhood} />
                </div>

                <div data-field="ageGroup">
                  <label className="mb-2 block text-xs font-black text-slate-700">
                    Yaş Grubu <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="anon-age-groups">
                    {AGE_GROUPS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setAgeGroup(ageGroup === g ? null : g)}
                        className={cn(
                          'min-h-[52px] rounded-xl border-2 text-sm font-black transition-all active:scale-[0.98]',
                          ageGroup === g
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-slate-50',
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div data-field="gender">
                  <label className="mb-2 block text-xs font-black text-slate-700">
                    Cinsiyet <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2" data-testid="anon-genders">
                    {GENDERS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGender(gender === g.value ? null : g.value)}
                        className={cn(
                          'min-h-[52px] rounded-xl border-2 px-2 text-sm font-black transition-all active:scale-[0.98]',
                          gender === g.value
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-slate-50',
                        )}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

              </div>
            </div>

            <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 sm:px-7">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4c2bb0] to-[#7c3aed] px-6 py-3.5 text-base font-black text-white shadow-md transition-all hover:from-[#3b1e8f] hover:to-[#6d28d9] active:scale-[0.99] disabled:opacity-40"
                onClick={beginQuestions}
                // Hata düzeltmesi (2026-09-02, kullanıcı bildirdi: "aktif anket başlatılamıyor"):
                // buton, eksik alan varken TAMAMEN kapalıydı; anketör neden başlatamadığını
                // göremiyordu (özellikle mahalle/yaş/cinsiyet ekranın altında kalıyordu).
                // Artık buton her zaman tıklanabilir; beginQuestions eksik alanı toast ile
                // söyler ve ilgili alana odaklanır.
                disabled={submitting}
              >
                Ankete başla ({total} soru)
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {phase === 'questions' && current && (
          /* Kullanıcı isteği (2026-09-02): "hızlı geçiş soru numaraları üste olacak".
             Önceden HIZLI GEÇİŞ sağda dikey dar bir panel olarak duruyordu (06.png
             birebir); artık ilerleme şeridinin hemen altında, yatay ve tam genişlikte
             bir şerit — tüm soru numaraları tek bakışta görünür, saha tabletinde daha
             az kaydırma gerektirir. Sol/sağ sütun yapısı kaldırıldığı için "Önceki /
             Sonraki" barındaki panel-genişliği telafi marjı da (md:-mr-[88px]) gerek
             kalmadığı için kaldırıldı. */
          <div className={cn(SHELL_WIDTH, 'flex h-full min-h-0 flex-col gap-3')}>
            {/* İlerleme şeridi */}
            <div className="flex flex-shrink-0 items-center gap-3 px-1 pb-1">
              <button
                type="button"
                onClick={() => setPhase('identity')}
                className="flex min-h-11 flex-shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 active:scale-95"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Bilgileri değiştir
              </button>
              <span className="text-[11px] font-bold text-slate-500">İlerleme</span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#4c2bb0] to-[#8b5cf6] transition-[width] duration-300"
                  style={{
                    width: `${Math.max(
                      layout === 'page'
                        ? progressPercent
                        : Math.round(((step + 1) / Math.max(total, 1)) * 100),
                      3,
                    )}%`,
                  }}
                />
              </div>
              <span className="flex-shrink-0 text-xs font-bold text-slate-500">
                {layout === 'page' ? answeredCount : step + 1} / {total}
              </span>
              <span className="flex-shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                {layout === 'page' ? `%${progressPercent}` : `${answeredCount} cevaplandı`}
              </span>
              {/* Görünüm anahtarı: tüm sorular tek sayfada (02.png) ↔ tek soru odaklı (06.png) */}
              <button
                type="button"
                onClick={toggleLayout}
                title={layout === 'page' ? 'Tek soru görünümüne geç' : 'Tüm soruları tek sayfada göster'}
                className="flex min-h-[38px] flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors active:scale-95 hover:bg-slate-50"
              >
                {layout === 'page' ? <ListIcon className="h-4 w-4" /> : <ClipboardListIcon className="h-4 w-4" />}
                {layout === 'page' ? 'Tek soru' : 'Tüm sorular'}
              </button>
            </div>

            {/* HIZLI GEÇİŞ — üstte yatay şerit (kullanıcı isteği 2026-09-02).
                Kullanıcı isteği (2026-09-03): "tablet ekranına uyumlu tıklanma alanları
                olsun" — 36px butonlar dokunmatikte parmak ucuyla isabet ettirmesi zor
                geliyordu; Apple/Google'ın önerdiği ~44px dokunmatik minimuma çıkarıldı. */}
            <div className="flex flex-shrink-0 items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Hızlı Geçiş
              </span>
              <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
                {questions.map((q, i) => {
                  const isAnswered = (answers[q.id] ?? '').trim() !== ''
                  const isCurrent = layout === 'focus' && i === step
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        if (layout === 'page') {
                          // Tek sayfa modunda adım yoktur; ilgili soru kartına kaydırılır.
                          document.getElementById(`fq-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        } else {
                          setStep(i)
                        }
                      }}
                      title={q.question}
                      className={cn(
                        'flex h-11 w-11 flex-shrink-0 items-center justify-center gap-1 rounded-full text-sm font-black transition-all active:scale-95',
                        isCurrent
                          ? 'bg-[#4c2bb0] text-white shadow-md'
                          : isAnswered
                            ? 'border border-emerald-200 bg-white text-slate-700 hover:bg-emerald-50'
                            : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      {isAnswered && !isCurrent ? <CheckCircle2Icon className="h-5 w-5 text-emerald-500" /> : <span>{i + 1}</span>}
                    </button>
                  )
                })}
              </div>
              <span className="ml-auto hidden flex-shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700 sm:inline">
                {participantNo}
              </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">

              {layout === 'page' ? (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-1">
                  {/* Hata düzeltmesi (2026-09-02): "Katılımcı Bilgileri (İsteğe Bağlı)" kartı
                      (ad-soyad, telefon — yalnızca vatandaş adına talep/şikâyet açılırken
                      veya SMS ile anket linki gönderilirken kullanılır) bir önceki üst bar
                      refactor'ünde yanlışlıkla kaldırılmıştı: respondentName/respondentPhone
                      state'i hâlâ vardı (taslağa kaydediliyor, Hızlı İşlemler formuna
                      ön-dolduruluyordu) ama ekranda hiçbir giriş alanı yoktu — anketör bu
                      bilgiyi asla giremiyordu. Kart tek sayfa görünümünde geri eklendi. */}
                  <FieldParticipantCard
                    name={respondentName}
                    onNameChange={setRespondentName}
                    phone={respondentPhone}
                    onPhoneChange={setRespondentPhone}
                    neighborhood={neighborhood}
                    identityMode={identityMode}
                    onSelectAnonymous={() => {
                      setIdentityMode('anonymous')
                      setLookup(null)
                      setRespondentName('')
                      setRespondentPhone('')
                    }}
                    onSelectTckn={() => setPhase('identity')}
                  />

                  {questions.map((q, i) => (
                    <FieldQuestionCard
                      key={q.id}
                      question={q}
                      index={i}
                      answer={answers[q.id] ?? ''}
                      onChange={(v) => setAnswer(q, v)}
                    />
                  ))}
                </div>
              ) : (
              /* Odak (06.png): tek soru kartı */
              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-[#4c2bb0] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                    {step + 1}. SORU
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {task.surveyCategory || 'SAHA ANKETİ'}
                  </span>
                  {current.required && (
                    <span className="ml-auto rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-600">
                      Zorunlu
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-black leading-snug tracking-tight text-slate-900 sm:text-2xl">
                  {current.question}
                </h2>
                {current.description && (
                  <p className="mt-1.5 text-sm font-medium text-slate-500">{current.description}</p>
                )}

                <div className="mt-5">
                  <FieldQuestionCard
                    key={current.id}
                    question={current}
                    index={step}
                    answer={answers[current.id] ?? ''}
                    onChange={(v) => setAnswer(current, v)}
                    bare
                  />
                </div>
              </div>
              )}

              {/* Alt aksiyon barı: Önceki | Sonraki.
                  Kullanıcı isteği (2026-09-01): "ortadaki butonlar ... sağa ve sola göre
                  ayarlanmalı." — sağdaki dikey Hızlı Geçiş paneli barı sola kaydırdığı için
                  negatif marjla telafi ediliyordu.
                  Kullanıcı isteği (2026-09-02): "hızlı geçiş soru numaraları üste olacak" —
                  panel artık üstte yatay bir şerit olduğundan sağ sütun kalmadı; telafi
                  marjı gerek kalmadığı için kaldırıldı, bar kabuğun tam genişliğinde
                  simetrik kalır. */}
              <div className="mt-3 flex flex-shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => ((layout === 'page' || isFirstQ) ? setPhase('identity') : setStep((v) => v - 1))}
                  className="flex w-[116px] flex-shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Önceki
                </button>

                {(layout === 'page' || isLastQ) ? (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4c2bb0] to-[#7c3aed] px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:from-[#3b1e8f] hover:to-[#6d28d9] active:scale-[0.99] disabled:opacity-50"
                  >
                    {submitting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <CheckCircle2Icon className="h-4 w-4" />}
                    Anketi Tamamla
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep((v) => Math.min(v + 1, total - 1))}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4c2bb0] to-[#7c3aed] px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:from-[#3b1e8f] hover:to-[#6d28d9] active:scale-[0.99]"
                  >
                    Sonraki
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                )}

                {/* Erişilebilirlik düzeltmesi (2026-09-02): düğmenin görünen metni yalnızca
                    "Kaydet" olduğu için ekran okuyucular ve otomatik testler işlevi
                    ("kaydet ve çık") anlayamıyordu; açık bir erişilebilir ad verilir. */}
                <button
                  type="button"
                  onClick={saveDraftAndExit}
                  title="Kaydet ve çık"
                  aria-label="Kaydet ve çık"
                  className="hidden w-[116px] flex-shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95 sm:flex"
                >
                  <SaveIcon className="h-4 w-4" />
                  <span className="text-xs">Kaydet</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
            <div className={cn(
              'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border',
              queuedOffline ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50',
            )}>
              {queuedOffline
                ? <WifiOffIcon className="h-9 w-9 text-amber-600" />
                : <CheckCircle2Icon className="h-9 w-9 text-emerald-600" />}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              {queuedOffline ? 'Kayıt cihazınıza kaydedildi' : 'Anket kaydedildi'}
            </h2>
            {/* Kullanıcı isteği (2026-09-02): "internet yoksa cache'e yazsın, internet
                geldiğinde otomatik senkronize etsin." Offline kuyruğa alınan kayıtta
                toplam/bugün sayaçları sunucudan gelmediği (kayıt henüz sunucuya
                ulaşmadığı) için sayı vermek yerine ne olacağı açıkça anlatılır. */}
            {queuedOffline ? (
              <p className="mt-2 text-sm font-semibold text-slate-500">
                İnternet bağlantısı yok. Yanıtlarınız cihazınızda güvende; bağlantı gelince
                otomatik olarak sunucuya gönderilecek. Görevlerime dön ekranında bekleyen
                kayıt sayısını görebilirsiniz.
              </p>
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Bu görevde toplam <b className="text-slate-800">{task.completedCount}</b>, bugün <b className="text-slate-800">{task.todayCount}</b> kayıt topladınız
                {task.targetCount > 0 ? ` (hedef ${task.targetCount}).` : '.'}
              </p>
            )}
            {!queuedOffline && dailyLeft !== null && (
              <p className="mt-1 text-xs font-bold text-slate-400">Bugün kalan hedef: {dailyLeft}</p>
            )}

            {/* Kullanıcı isteği (2026-09-02): "anket sonunda talep formu olacak" —
                ulakBELL'deki gibi anketin hemen ardından vatandaşın somut bir talebi/
                şikayeti varsa kaydedilebilsin. TC/doğum tarihi form başındaki gibi
                İSTEĞE BAĞLIDIR: kişi vermek istemezse Ad/TC boş bırakılıp anonim
                kaydedilir; bu kayıt yalnızca "Talepler" bölümünde kalır, yönetici
                elle "İlet" demedikçe Ulakbel'e OTOMATİK gönderilmez (bkz.
                CitizenSubmissionService.ForwardAsync — ayrı, manuel bir işlemdir). */}
            {!queuedOffline && (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-left">
                <p className="text-sm font-black text-slate-800">Görüşülen kişinin bir talebi, önerisi veya şikayeti var mı?</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  İsteğe bağlıdır. T.C./doğum tarihi vermek istemezse anonim kaydedilir; kayıt yalnızca
                  Talepler bölümünde görünür, ilgili müdürlüğe otomatik iletilmez.
                </p>
                <button
                  type="button"
                  onClick={() => setShowQuickActions(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-teal-600 bg-teal-50 px-5 py-3 text-sm font-black text-teal-800 transition-all hover:bg-teal-100 active:scale-95"
                >
                  <MessageSquarePlusIcon className="h-4 w-4" /> Talep / Öneri / Şikayet Ekle
                </button>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={resetForNext}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-black text-white shadow-md transition-all hover:from-indigo-700 hover:to-purple-700 active:scale-95"
              >
                <PlusCircleIcon className="h-5 w-5" /> Yeni anket doldur
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
              >
                Görevlerime dön
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { UsersIcon, MapPinIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import { useHasFacilityScopeRestriction } from '@/framework/auth/useFacilityScopeRestriction'
import { FACILITY_MODULES } from '@/templates/FacilityTemplate/moduleConfig'
import adminService from '@/services/admin.service'
import type { AdminUser } from '@/types/admin.types'

// Kullanıcı isteği (2026-08-03): spor salonu, millet kütüphanesi, etkinlik istemi vb. gibi bir
// modülün GENEL/ANA yöneticisi (o modülde facility-scope kısıtlaması OLMAYAN, yani tüm tesisleri
// görebilen bir kullanıcı — SuperAdmin veya tam yetkili bir rol) giriş yaptığında, sağ üstteki
// kullanıcı ikonunun yanında VARSAYILAN KAPALI küçük bir gösterge/panel gösterir. Açıldığında,
// o modül(ler)de facility-scope'lu (belirli tesislere atanmış) ALT yönetici hesaplarının listesini
// gösterir (isim, rol adı, atandığı tesis sayısı).
//
// Şimdilik yalnızca facility-template 7 modül (moduleConfig.ts FACILITY_MODULES) için tanımlı —
// bunlar AdminScope/ScopeNode ile aynı ortak mantığı (RefModuleKey = routeId) kullanıyor. Kütüphane
// ve etkinlik modülleri farklı scope mantığına sahip olduğu için bu ilk sürüme dahil edilmedi
// (kolayca genişletilebilir: aşağıdaki FACILITY_TEMPLATE_MODULE_KEYS listesine eklenmesi yeterli).
//
// NOT (2026-08-03, incelendi — SCOPABLE_MODULES'e genişletme YAPILMADI): Dashboard.tsx artık
// tüm 12 scope'lanabilir modülü (scopableModules.ts) kapsayacak şekilde genelleştirildi, ama bu
// component'i aynı listeye genişletmek backend'de gerçek bir fayda sağlamıyor — çünkü admin
// listesi endpoint'i (GET /admins?facilityModule=...) `facilityScopeModule` alanını backend'deki
// FacilityModuleRegistry.Prefix sözlüğünden (api/src/Nexora.Application/Features/Facilities/
// FacilityModuleRegistry.cs) türetiyor ve bu sözlük hâlâ sadece 7 facility-template modülü
// (sports/pool/youth-camp/scout-camp/science-center/kasif/accessible-life) tanıyor —
// travels/library/events/emergency-areas/halls için DetectFromRoleKey her zaman null döner,
// yani o modüllerde "genel yönetici" olan bir kullanıcı için subUsers listesi backend'den asla
// dolu gelmeyecek (sessizce boş kalır, yanlış davranışa yol açmaz ama işlevsizdir). Bu yüzden
// FACILITY_TEMPLATE_MODULE_KEYS bilinçli olarak SCOPABLE_MODULE_KEYS'e genişletilmedi — backend
// FacilityModuleRegistry.Prefix genişletilmeden bu değişiklik anlamsız olurdu (ayrı bir backend
// işi gerektirir, bu görevin kapsamı dışında).
const FACILITY_TEMPLATE_MODULE_KEYS = Object.values(FACILITY_MODULES).map((cfg) => cfg.routeId)

const moduleLabel = (moduleKey: string): string => {
  const cfg = Object.values(FACILITY_MODULES).find((m) => m.routeId === moduleKey)
  return cfg?.terminology.facilityManagementTitle ?? moduleKey
}

export const SubUsersIndicator = () => {
  const { can, isSuperAdmin, getFacilityScope, state } = useAuth()
  // EK GÜVENLİK KATMANI (2026-08-03): "Normal kullanıcı" (facility-scope'lu, ör. Gamze MOL
  // gibi belirli tesis(ler)e atanmış bir alt yönetici) için bu gösterge KESİNLİKLE
  // görünmemeli. candidateModules hesaplaması zaten bunu dolaylı olarak sağlıyor (aşağıya
  // bakın: bir modülde scope'u olan kullanıcı o modül için "genel yönetici" sayılmıyor) —
  // ama olası bir hibrit rol edge-case'ine (ör. hem "sports" modülünde scope'lu HEM
  // "library.view" gibi başka bir izinle admins.view alan garip bir kombinasyon) karşı,
  // kullanıcının KENDİSİ herhangi bir scope'lanabilir modülde (SCOPABLE_MODULE_KEYS —
  // useFacilityScopeRestriction.ts) facility-scope kısıtlamasına sahipse component'i en
  // baştan tamamen devre dışı bırakıyoruz. Bu, candidateModules mantığından bağımsız,
  // en basit ve en güvenli garanti katmanıdır.
  const isFacilityScopeRestricted = useHasFacilityScopeRestriction()
  const [open, setOpen] = useState(false)
  const [subUsers, setSubUsers] = useState<AdminUser[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isAuthenticated = state.status === 'authenticated'
  // "admins" izin modülü scopable=true işaretli ama gerçek bir scope ataması yapılmıyor —
  // GET /admins zaten "admins.view" iznini zorunlu kılıyor (AdminEndpoints), bu yüzden bu paneli
  // sadece o izne sahip (tipik olarak SuperAdmin) kullanıcılar için etkinleştiriyoruz; aksi halde
  // istek her zaman 403 ile başarısız olur.
  const canListAdmins = isAuthenticated && !isFacilityScopeRestricted && (isSuperAdmin || can('admins.view'))

  // Kullanıcının GENEL yönetici olduğu (izni var ama bu modülde scope kısıtlaması yok) facility
  // modülleri.
  const candidateModules = !canListAdmins
    ? []
    : FACILITY_TEMPLATE_MODULE_KEYS.filter((moduleKey) => {
        const hasView = isSuperAdmin || can(`${moduleKey}.view`)
        if (!hasView) return false
        return getFacilityScope(moduleKey) === null
      })

  useEffect(() => {
    if (candidateModules.length === 0) {
      setSubUsers([])
      setLoaded(true)
      return
    }
    let active = true
    setLoaded(false)
    Promise.all(candidateModules.map((m) => adminService.getSubUsersByFacilityModule(m)))
      .then((lists) => {
        if (!active) return
        const merged = lists.flat()
        const dedup = Array.from(new Map(merged.map((u) => [u.id, u])).values())
        setSubUsers(dedup)
      })
      .catch(() => { if (active) setSubUsers([]) })
      .finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateModules.join(',')])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Genel yöneticilik yoksa veya henüz hiç alt kullanıcı yoksa gösterge tamamen gizli kalır.
  // (canListAdmins zaten isFacilityScopeRestricted'i kapsıyor; burada tekrar kontrol etmek
  // ekstra güvenlik için zararsız ve niyeti kod okuyana açıkça gösteriyor.)
  //
  // Senaryo simülasyonu (kod incelemesiyle, 2026-08-03):
  // (a) SuperAdmin → isFacilityScopeRestricted=false (getFacilityScope her zaman null döner,
  //     AuthContext.tsx satır 110), canListAdmins=true, candidateModules = scope'u olmayan +
  //     view izni olan TÜM facility-template modüller → görünür (alt kullanıcı varsa).
  // (b) Facility-scope'suz "sports.view" izinli Admin rolü (ör. genel Spor Salonu Yöneticisi,
  //     hiçbir modülde AdminScope kaydı yok) → isFacilityScopeRestricted=false, canListAdmins
  //     = can('admins.view') değerine bağlı (bu rolde admins.view YOKSA hâlâ false → gizli;
  //     admins.view VARSA true) → candidateModules=['sports'] (getFacilityScope('sports')===
  //     null && can('sports.view')) → o modülde scope'lu alt kullanıcı varsa görünür.
  // (c) Gamze MOL benzeri facility-scope'lu kullanıcı (ör. "sports" modülünde belirli tesis(ler)e
  //     atanmış) → getFacilityScope('sports') bir refIds dizisi döner (null DEĞİL) →
  //     useHasFacilityScopeRestriction() true → isFacilityScopeRestricted=true →
  //     canListAdmins=false (kısa devre) → KESİNLİKLE görünmez. Ayrıca candidateModules
  //     filtresi de bağımsız olarak bu kullanıcıyı sports için eler (scope var).
  // (d) Hiçbir özel izni olmayan normal Staff/ReadOnly rolü (admins.view yok, hiçbir modülde
  //     scope yok) → isFacilityScopeRestricted=false ama canListAdmins = isSuperAdmin(false) ||
  //     can('admins.view')(false) = false → KESİNLİKLE görünmez.
  if (!canListAdmins || isFacilityScopeRestricted || candidateModules.length === 0) return null
  if (loaded && subUsers.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Alt Kullanıcılar"
        aria-label="Alt Kullanıcılar"
        aria-pressed={open}
        className={cn(
          'relative flex items-center gap-1.5 h-8 px-2 rounded-md transition-colors',
          open
            ? 'bg-surface-2 text-foreground-default'
            : 'text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--foreground-default))]'
        )}
      >
        <UsersIcon className="w-4 h-4" />
        {loaded && subUsers.length > 0 && (
          <span className="hidden sm:inline type-caption font-semibold">{subUsers.length}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-card border border-border bg-card shadow-pop z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <UsersIcon className="h-4 w-4 text-foreground-muted shrink-0" />
            <span className="type-body-strong">Alt Kullanıcılar</span>
            <span className="ml-auto type-caption text-foreground-muted">{subUsers.length}</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {subUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-semibold"
                  style={{ backgroundColor: u.roleColor ?? 'hsl(var(--primary))' }}
                >
                  {u.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="type-body-strong truncate">{u.fullName}</p>
                  <p className="type-caption text-foreground-muted truncate">
                    {u.roleName || moduleLabel(u.facilityScopeModule ?? '')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 type-caption text-foreground-muted">
                  <MapPinIcon className="h-3 w-3" />
                  {u.facilityScopeIds?.length ?? 0} tesis
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

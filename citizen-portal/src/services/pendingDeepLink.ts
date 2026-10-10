// Kullanıcı isteği (2026-08-02): Etkinlik Takvimi public API'sini kullanan dış siteler
// (sultangazi.bel.tr vb.) "Başvur" tıklandığında vatandaşı /etkinlikler?eventId=<id> gibi
// bir derin bağlantıya yönlendirir. Vatandaş henüz giriş yapmamışsa PublicRoutes bu isteği
// query string'i DÜŞÜREREK /login'e yönlendiriyordu (App.tsx satır 97, RedirectKeepQuery
// kullanılmayan tek "*" route) — böylece ilgili etkinlik kimliği kaybolup vatandaş girişten
// sonra genel listeye düşüyordu. Bu servis, pendingQr.ts ile aynı desende, kayıp olmaması
// gereken derin bağlantı hedefini oturum boyunca (sessionStorage) saklar; DiscoverTab
// girişten sonra bunu okuyup ilgili etkinliği otomatik açar.
const KEY = 'pending_deep_link'

export const pendingDeepLink = {
  set(path: string): void {
    sessionStorage.setItem(KEY, path)
  },
  take(): string | null {
    const v = sessionStorage.getItem(KEY)
    if (v) sessionStorage.removeItem(KEY)
    return v
  },
}

import { AlertTriangleIcon, CheckCircle2Icon, CircleIcon, ClockIcon, CodeIcon } from 'lucide-react'
import { PageHeader } from '@/design-system/PageHeader'
import { Badge } from '@/design-system'

type NoteStatus = 'done' | 'pending' | 'partial'

interface DevNote {
  id: string
  category: string
  title: string
  description: string
  status: NoteStatus
  backendDone: boolean
  frontendDone: boolean
  endpoints?: string[]
  files?: string[]
}

const NOTES: DevNote[] = [
  {
    id: 'travel-guest-lookup-cleanup-scenarios-2026-07-27',
    category: 'Gezi (Travel) Modülü — Misafir Doğrulama Hatası, Test Verisi Temizliği ve Senaryo Matrisi (27.07.2026, 3. tur)',
    title: 'Doğru TC girilmesine rağmen "kontrol edin" hatası + ~550 test kaydı temizliği + 9 yeni senaryo seferi ile uçtan uca doğrulama',
    description:
      'Kullanıcının bildirdiği güncel bug ve devamındaki temizlik/doğrulama talebi tamamlandı: ' +
      '(1) "Yanımdaki misafirin TC\'sini doğru girmeme rağmen doğum tarihini/TC numarasını kontrol edin hatası veriyor" — kök neden: misafir kimlik formu, VATANDAŞ KAYIT akışı için tasarlanmış /auth/citizen/nvi-lookup uç noktasını çağırıyordu. Bu uç nokta, girilen TC zaten sistemde kayıtlı bir vatandaşa aitse (çok normal bir durum — misafir aile dışından biri ama Nexora\'ya kayıtlı olabilir) kasıtlı olarak ALREADY_REGISTERED hatası fırlatıyor, ve frontend bunu genel "kontrol edin" mesajına düşürüyordu. Yeni bir POST /api/v1/me/travels/guest-lookup uç noktası eklendi — aynı NVI doğrulamasını yapıyor ama "zaten kayıtlı" kontrolü YOK, sadece isim/cinsiyet/doğum tarihi doğrulanıyor. Frontend artık gerçek backend hata mesajını da gösteriyor (önceden hep aynı sabit metin basılıyordu). ' +
      '(2) Veritabanında önceki oturumlardan (benim değil, geçmiş E2E/Playwright koşularından) kalan ~550 test kaydı temizlendi: Travels 659→21, TravelRoutes 658→20, TravelCategories 489→5, TravelBuses 3→2(+bu oturumda eklenen 6 yeni). "E2E ", "MOB ", "SCENARIO-TEST", "[TEST]", "Audit ", "RemGezi", "Kapsamlı" önekli kayıtlar (ve bağlı applications/passengers/otobüs atamaları/attendances) silindi. BURSA/EDİRNE/ÇANAKKALE/Kurumsal Gezi/Seyahat/Geçmiş Geziler gibi binlerce gerçek şekilli kayıt içeren büyük seed verisine DOKUNULMADI. ' +
      '(3) 9 yeni "[SENARYO]" önekli gerçek sefer, admin API üzerinden (UI\'nin kullandığı aynı uç noktalarla) oluşturuldu — her biri modülün farklı bir alternatifini/kısıt kombinasyonunu kapsıyor: yaş kısıtı+düşük kontenjan (yedek liste tetikler), kadına özel+kontenjan-bazlı araç+genel limitten muaf, erkeğe özel+tamamen araçsız, ilçe dışı sakinlere özel+koltuk haritalı minibüs, refakatçi yasak (maxCompanions=0)+büyük otobüs, dar yaş aralığı (6-16 çocuk)+veli onayı+belge zorunlu, iptal süresi sınırsız (0 saat)+misafir akışı, çift otobüslü (araç seçim ekranı), kayıt tarihi henüz açılmamış sefer. ' +
      '(4) Bir "demo veli" hesabı (TC 65908267238, 4 çocuklu — 8/12/16/20 yaş, karışık cinsiyet) + 2 yardımcı demo hesap (kadın Sultangazi sakini, erkek ilçe-dışı sakin) oluşturulup gerçek giriş/OTP akışıyla login olundu, ardından GERÇEK HTTP çağrılarıyla (mock değil) 16 ayrı senaryo tek tek doğrulandı: kendi-tek-başlı, kendi+yetişkin çocuk, kontenjan dolunca yedek listeye düşme, kadına-özel+muaf sefer, erkeğe-özel+çoklu yolcu, ilçe-dışı-sakin uygunluk (Sultangazi sakini reddedilir, ilçe dışı sakin kabul edilir) + koltuk seçimi, refakatçi limiti aşımı reddi, tek-kişi-koltuklu geçerli başvuru, sadece-çocuklarla başvuru (belge durumu "pending" set ediliyor doğrulandı), yeni guest-lookup ile misafir ekleme (zaten kayıtlı TC ile bile başarılı), çift otobüsten belirli aracı seçme, kayıt-henüz-açılmamış reddi, mükerrer-başvuru reddi, yaş-sınırı-dışı reddi, koltuk-çakışması reddi, onaylı başvuru iptali (aynı gruptaki diğer kişiyi etkilemeden, koltuğun serbest kalması). Hepsi beklenen sonucu verdi — modül canlı test sonrası tamamen çalışır ve temiz veri durumunda. Tam senaryo matrisi ve her testin gerçek API yanıtı docs/travel-scenario-matrix-2026-07-27.md dosyasına yazıldı.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'api/src/Nexora.Api/Endpoints/Me/MeTravelEndpoints.cs ✓ — POST /guest-lookup eklendi',
      'api/src/Nexora.Application/Features/ParticipantTravels/Dtos/CitizenTravelRequests.cs ✓ — CitizenTravelGuestLookupRequest',
      'api/src/Nexora.Application/Features/ParticipantTravels/IParticipantTravelService.cs ✓',
      'api/src/Nexora.Infrastructure/Services/ParticipantTravelService.cs ✓ — GuestLookupAsync() (ALREADY_REGISTERED kontrolü yok)',
      'citizen-portal/src/services/travel.service.ts ✓ — guestLookup()',
      'citizen-portal/src/modules/travels/TravelDetailModal.tsx ✓ — authService.nviLookup yerine travelService.guestLookup, gerçek hata mesajı gösterimi',
      'docs/travel-scenario-matrix-2026-07-27.md ✓ (yeni) — 9 senaryo sefer + 16 doğrulanmış test akışı, tam sonuç tablosu',
      'DB temizliği: Travels/TravelRoutes/TravelCategories/TravelBuses tablolarında ~550 test kaydı silindi (psql, elle, yedeklenmeden — sadece isim önekiyle filtrelenen kesin test kayıtları)',
      'api/tests — 190/190 yeşil (regresyon yok)',
    ],
  },
  {
    id: 'travel-modal-cancel-scroll-seatpicker-2026-07-27',
    category: 'Gezi (Travel) Modülü — Detay Modalı Canlı Test Bulguları (27.07.2026, 2. tur)',
    title: 'Onaylı başvuruda İptal butonu görünmüyordu + modal aşağı kaymıyordu + koltuk seçici küçüktü + misafir formu her zaman açıktı',
    description:
      'Bir önceki modal güncellemesinden hemen sonra canlı testte bulunan 4 ayrı bug: ' +
      '(1) "Başvurularım" listesinde onaylanmış bir başvuruya tıklanınca İptal Et butonu hiç görünmüyordu. Kök neden: TravelApplicationsTab.tsx içindeki isCancelable() fonksiyonu `status !== "rejected" && status !== "approved"` şeklinde tanımlıydı — yani "approved" durumu KASITLI OLARAK iptal edilemez sayılıyordu, tam da kullanıcının test ettiği durum. Bu, aynı dosyadaki FacilityApplicationsTab.tsx\'in kullandığı doğru desenle de çelişiyordu (orada sunucudan gelen canCancel alanı kullanılıyor). Backend zaten onaylı başvuruların iptaline izin veriyor (sadece "rejected" ve süre-dolmuş durumlarını reddediyor), yani sorun sadece frontend\'deki yanlış filtredeydi. isCancelable artık `status !== "rejected" && status !== "cancelled"` — iptal edilebilirlik asıl olarak süre kontrolüyle (canCancelNow) sınırlanıyor, statüyle değil. ' +
      '(2) Modal içeriği uzun olduğunda ekran aşağı kaymıyordu ("ekran aşağı doğru kaymıyor"). Kök neden: scroll container\'ı flex-1 overflow-y-auto olarak tanımlıydı ama min-h-0 eksikti — flex item\'ların varsayılan min-height:auto davranışı yüzünden container içeriği kadar büyüyüp taşıyordu, dış overflow-hidden de fazlasını kırpıyordu, hiç scroll olmuyordu. TravelDetailModal.tsx ve TravelSeatPicker.tsx\'teki scroll container\'larına min-h-0 eklendi (design-system Modal.tsx zaten doğru yapıyordu, bu iki custom modal aynı deseni kaçırmıştı). ' +
      '(3) Koltuk seçici (TravelSeatPicker) çok küçük açılıyordu. Modal genişliği 440px→540px, koltuk hücreleri 40px→48px, yazı boyutları ve boşluklar orantılı büyütüldü — dokunma hedefleri artık daha rahat. ' +
      '(4) Onaylı bir başvuruya tekrar bakarken misafir ekleme formundaki T.C. Kimlik No / Doğum Tarihi alanları her zaman açık görünüyordu, sanki hâlâ doldurulması gereken zorunlu alanlarmış gibi — kafa karıştırıcıydı. Artık "Yanınızda misafir" bölümü + Ekle butonuna tıklanana kadar kapalı duruyor, formu görmek isteyen açıyor. Ayrıca onaylı başvurusu olan bir gezide "Kimler için başvuruyorsunuz?" altındaki metin "Grubunuza yeni bir kişi eklemek için..." şeklinde değişiyor (önceden her zaman "Başvuru için seçmeniz gerekir" yazıyordu, onaylanmış birine yanlış geliyordu). Bu değişiklikle "onaydan sonra gruba yeni kişi ekleme" akışı da fiilen açılmış oldu: applicants listesi zaten henüz başvurmamış aile üyelerini gösteriyor, seçip mevcut maxGroupSize sınırına kadar yeni bir rezervasyon (ek kişi) oluşturulabiliyor — ayrı bir "post-approval ekle" endpoint\'ine gerek kalmadı, mevcut ReserveAsync zaten kişi bazlı çalışıyor.',
    status: 'done',
    backendDone: false,
    frontendDone: true,
    files: [
      'citizen-portal/src/modules/travels/TravelApplicationsTab.tsx ✓ — isCancelable() düzeltildi',
      'citizen-portal/src/modules/travels/TravelDetailModal.tsx ✓ — min-h-0 scroll fix, misafir formu collapsible, metin netleştirme',
      'citizen-portal/src/modules/travels/TravelSeatPicker.tsx ✓ — boyutlar büyütüldü, min-h-0 scroll fix',
    ],
  },
  {
    id: 'travel-exempt-reminder-noshow-companion-2026-07-27',
    category: 'Gezi (Travel) Modülü — Katılım Kuralları & Bildirimler (27.07.2026)',
    title: 'Sefer bazlı katılım muafiyeti, kalkış hatırlatması, no-show engeli, refakatçi sınırı, modal iyileştirmesi',
    description:
      'Kullanıcının canlı testte bulduğu talepler üzerine 5 madde tamamlandı: ' +
      '(1) "Başvurularım" içinde onaylı bir başvuruya tıklandığında büyük modalda hem detay hem İPTAL SEÇENEĞİ görünüyor artık — önceden modal sadece yeni başvuru akışı için tasarlıydı, mevcut başvuru durumu hiç gösterilmiyordu. Modaldaki küçük yazılar (9-13px) bir kademe büyütüldü (10-14.5px). ' +
      '(2) Yeni sefer oluştururken "İptal Süresi" artık ayarlardaki (Gezi Ayarları > İptal Süresi, gün) değerden otomatik hesaplanıyor (gün×24 saat) — önceden sabit 72 saatti. ' +
      '(3) Refakatçi/çocuk sayısı sınırı (Route > Kısıtlar > Maksimum Refakatçi) artık VATANDAŞIN kendi rezervasyon akışında da uygulanıyor — önceden sadece admin\'in oluşturduğu başvurularda kontrol ediliyordu, vatandaş sınırsız aile üyesi/çocuk seçebiliyordu. ' +
      '(4) Genel katılım sınırının (örn. "yılda 1 gezi") YANINDA, artık her sefer için ayrı bir "Genel katılım sınırından muaf" anahtarı var (Sefer formu > Katılım Sınırı) — açıksa o sefere, kullanıcının o dönemki hakkı dolu olsa bile ayrıca katılabilir; bu sefere yapılan başvuru da diğer gezilerin dönem sayımına dahil edilmez. ' +
      '(5) Gezi kalkışına ~25 saat (Gezi Ayarları\'ndan saat olarak değiştirilebilir) kalan seferler için onaylı/yedekteki katılımcılara otomatik hatırlatma bildirimi (in-app + SMS) gönderiliyor — yeni Hangfire job, 15 dakikada bir çalışıyor, sefer başına tek seferlik (idempotent). ' +
      '(6) "Kayıtlı olup katılmayan (no-show) bir sonraki geziye başvuramasın mı?" sorusu artık ayarlarda açık/kapalı bir anahtar (Gezi Ayarları > No-show Sonraki Geziyi Engelle, varsayılan KAPALI) — açılırsa, katılımcının en yakın geçmiş seferinde yoklamada "devamsız" işaretlenmişse yeni başvurusu reddedilir ve gezi detayında ilgili kişi önceden "uygun değil" gösterilir.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'api/src/Nexora.Domain/Entities/Travels/Travel.cs ✓ — ExemptFromParticipationLimit alanı (yeni migration)',
      'api/src/Nexora.Domain/Common/TravelParticipationLimitRules.cs ✓ (yeni)',
      'api/src/Nexora.Domain/Common/TravelRestrictionRules.cs ✓ — MaxCompanions() eklendi',
      'api/src/Nexora.Infrastructure/Services/Scheduled/TravelDepartureReminderJob.cs ✓ (yeni, Hangfire)',
      'api/src/Nexora.Infrastructure/Services/ParticipantTravelService.cs ✓ — EnsureNoRecentNoShowAsync, refakatçi sınırı, exempt kontrolü',
      'api/src/Nexora.Infrastructure/Services/TravelApplicationService.cs, TravelService.cs, TravelSettingsService.cs, TravelRouteService.cs ✓',
      'api/src/Nexora.Infrastructure/Persistence/Migrations/20260727012639_AddTravelExemptFromParticipationLimit.cs ✓ (canlı DB\'ye elle uygulandı, __EFMigrationsHistory güncellendi)',
      'admin-panel/src/modules/travels/TravelForm.tsx, TravelSettingsTab.tsx, TravelsTab.tsx ✓',
      'citizen-portal/src/modules/travels/TravelDetailModal.tsx, TravelApplicationsTab.tsx ✓',
      'api/tests — 20 yeni unit test (RegistrationWindow, TravelParticipationLimitRules, MaxCompanions), toplam 190/190 yeşil',
    ],
  },
  {
    id: 'travel-admin-cancel-unlimited-busless-2026-07-26',
    category: 'Gezi (Travel) Modülü — Kayıt Tarihi Saat Dilimi Hatası (26.07.2026)',
    title: 'Admin iptal süresi bypass + Sınırsız katılım hiçbir işe yaramıyordu + Araç zorunluluğu kaldırıldı',
    description:
      'Kullanıcının bugünkü testte bulduğu 3 ayrı gerçek bug, üçü de düzeltildi: ' +
      '(1) "İptal süresi dolduğu için başvuru iptal edilemez" hatası — bu kontrol vatandaşın kendi iptal endpoint\'i için doğru, ama ADMIN\'in başvuru SİLME endpoint\'i (/api/v1/travel-applications/{id}, travels.delete yetkisi, tamamen ayrı ve zaten admin-only bir yol) yanlışlıkla AYNI deadline kontrolünü uyguluyordu. Artık admin silme işlemi süre sınırı olmadan çalışıyor — "admin yapıyorsa silebilir" talebi karşılandı. ' +
      '(2) "Birden fazla gezide sınırsız katılım hakkı" (ParticipationPeriod=\'unlimited\', DB\'de 142 gerçek sefer bu şekilde tanımlı) hiçbir işe yaramıyordu — 3 ayrı yerde kod sadece `limit <= 0` kontrolü yapıp \'unlimited\' seferleri bile "özelleştirilmemiş" sayıp global varsayılan limite (örn. haftada en fazla 3 gezi) tabi tutuyordu. Artık ParticipationPeriod==\'unlimited\' olan seferlerde katılım sınırı tamamen devre dışı. ' +
      '(3) "Araç zorunluluğu olmasın, kontenjanla katılım sağlansın" — sefer oluştururken en az bir otobüs seçilmesi ZORUNLU tutuluyordu (TravelFormRequestValidator), oysa backend zaten araçsız/kontenjan-bazlı seferi destekliyordu (koltuk ataması olmadan sadece Kontenjan sayısıyla). Validator kısıtı kaldırıldı, admin panelde Kontenjan alanı artık araç seçilmese de aktif. Ayrıca admin başvuru oluştururken gizli bir bug bulundu: araç seçilmediğinde bile "koltuk seçimi zorunlu" hatası fırlatılıyordu (capacityOnlyVehicle hesaplaması busId boşken yanlışlıkla false kalıyordu) — düzeltildi.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'api/src/Nexora.Infrastructure/Services/TravelApplicationService.cs ✓ — DeleteAsync deadline kontrolü kaldırıldı, EnsureParticipationLimitAsync + Create/UpdateAsync seat-required düzeltildi',
      'api/src/Nexora.Infrastructure/Services/ParticipantTravelService.cs ✓ — LimitReachedAsync + EnsureParticipationFrequencyAsync unlimited erken dönüş',
      'api/src/Nexora.Application/Features/Travels/Validators/TravelFormRequestValidator.cs ✓ — BusIds.NotEmpty() kaldırıldı',
      'admin-panel/src/modules/travels/TravelForm.tsx ✓ — Araçlar alanı opsiyonel, Kontenjan input\'u araçsızken de aktif',
    ],
  },
  {
    id: 'travel-registration-timezone-bug-2026-07-26',
    category: 'Gezi (Travel) Modülü — Kayıt Tarihi Saat Dilimi Hatası (26.07.2026)',
    title: 'Bugün başlayan kayıtlar "henüz açılmadı" hatası veriyordu — UTC/TR saat dilimi kayması',
    description:
      'Bulgu: Kullanıcı "Abant Gölü Yürüyüşü" seferine bugünün tarihini (27 Temmuz) Kayıt Başlangıcı olarak girdi, ama vatandaş portalından başvuru yapmaya çalışınca REGISTRATION_NOT_STARTED hatası aldı. ' +
      'Kök neden: RegistrationStartDate DB\'de doğru kayıtlıydı (2026-07-27 00:00) — hata karşılaştırma mantığındaydı. `today < RegistrationStartDate.Date` kontrolü `DateTime.UtcNow.Date` kullanıyordu; UTC, Türkiye\'den (UTC+3) 3 saat geride olduğu için gece yarısı ile 03:00 arası sistem hâlâ "dünkü" günde sanıp o gün başlayan kayıtları reddediyordu. Aynı hata sınıfı ParticipantTravelService (discover/reserve/appOpen kartı), TravelApplicationService (admin başvuru oluşturma) ve TravelService (geçmiş tarih kontrolü) içinde tekrarlanıyordu. ' +
      'Düzeltme: `TurkeyTime.TodayDate()` / `TurkeyTime.NowWallClock()` eklendi (Türkiye takvim günü/duvar-saati). Yeni `Nexora.Domain.Common.RegistrationWindow` yardımcı sınıfı kayıt penceresi açık/kapalı hesaplamasını tek noktaya topladı — saat girilmemiş (00:00) bitiş tarihleri geriye dönük uyumluluk için o günün SONUNA kadar açık sayılır, saat girilmişse tam o saatte kapanır. Ayrıca kullanıcı talebi üzerine admin panelde Kayıt Başlangıcı/Bitişi alanlarına saat seçimi eklendi (DatePicker showTime). ' +
      'Doğrulama: 7 yeni RegistrationWindow unit testi + mevcut 170 test toplam 177/177 yeşil, dotnet build 0 hata, gerçek "Abant Gölü Yürüyüşü" (GEZ-000690) kaydıyla izole repro (eski mantık REGISTRATION_NOT_STARTED=true üretiyordu, yeni mantık false/doğru üretiyor).',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'api/src/Nexora.Domain/Common/RegistrationWindow.cs ✓ (yeni)',
      'api/src/Nexora.Infrastructure/Common/TurkeyTime.cs ✓ — TodayDate()/NowWallClock() eklendi',
      'api/src/Nexora.Infrastructure/Services/ParticipantTravelService.cs ✓',
      'api/src/Nexora.Infrastructure/Services/TravelApplicationService.cs ✓',
      'api/src/Nexora.Infrastructure/Services/TravelService.cs ✓',
      'api/tests/Nexora.UnitTests/Domain/RegistrationWindowTests.cs ✓ (yeni, 7 test)',
      'admin-panel/src/modules/travels/TravelForm.tsx ✓ — Kayıt Başlangıcı/Bitişi saat seçimi',
    ],
  },
  {
    id: 'facility-age-gender-filtering-2026-07-26',
    category: 'Spor / Tesis Modülleri — Yaş-Cinsiyet Filtreleme (26.07.2026)',
    title: 'Vatandaş çocuk bağlantısı yoksa sadece kendi yaş grubunun gösterilmesi',
    description:
      'Talep: /hizmetler?m=sports sayfasında kişi üyeliğinde çocuk bağlantısı yoksa, spor/gezi/tüm modüllerde SADECE o kişinin kendi yaş grubuna uygun programların listelenmesi. ' +
      'İnceleme sonucu: Spor (FacilityProgramsTab / SportsPage), Etkinlik (DiscoverTab) ve genel Tesis modüllerinde bu filtreleme ZATEN mevcuttu — "Sadece yaşıma uygun" / "Bana uygun" toggle\'ı varsayılan AÇIK geliyor, çocuk seçilmezse backend `eligibleAge`/`eligibleGender` ile kişinin kendi yaş-cinsiyetine göre filtreliyor (bkz. ParticipantFacilityService.DiscoverAsync, ParticipantEventService.DiscoverAsync). ' +
      'EKSİK BULUNAN: Gezi (Travel) modülünde (TravelDiscoverTab.tsx) bu filtreleme HİÇ yoktu — reşit vatandaşlara yaş/cinsiyet uygunluğuna bakılmaksızın TÜM geziler listeleniyordu (sadece 18 yaş altı için backend tarafında zorunlu filtre vardı). Bugün TravelDiscoverTab.tsx\'e "Bana uygun" ve çocuk bazlı "X\'e uygun · Y yaş" chip\'leri eklendi, sports/events modülleriyle birebir aynı childMatchesX() mantığı uygulandı. Varsayılan davranış: çocuk yoksa sadece kullanıcının kendi yaş/cinsiyetine uygun geziler gösterilir; kullanıcı isterse "Tümünü Gör" ile filtreyi kaldırabilir.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'citizen-portal/src/modules/travels/TravelDiscoverTab.tsx ✓ — childMatchesTravel() + onlyEligibleForSelf state eklendi',
    ],
  },
  {
    id: 'facility-mobile-api-parity-2026-07-26',
    category: 'Spor / Tesis Modülleri — Yaş-Cinsiyet Filtreleme (26.07.2026)',
    title: 'Mobil uygulama ve Scalar (API dokümantasyonu) veri eşleşmesi — DOĞRULANDI',
    description:
      'Talep: Spor bölümünde citizen-portal\'a verilen data ile mobile verilecek API ve Scalar\'daki datanın aynı olması. ' +
      'Doğrulama: Nexora\'da ayrı bir "mobil API" yok — mobil uygulama, citizen-portal ile AYNI /api/v1/me/facilities/{module}/* ve /api/v1/me/travels/* endpoint\'lerini, aynı DTO\'ları (CitizenFacilityGroupDto, CitizenFacilityGroupDetailDto vb.) kullanıyor. Bu DTO\'lar tek bir C# record tanımından geldiği için Scalar (/scalar, Swagger benzeri arayüz) üzerinde görünen şema ile citizen-portal\'ın tükettiği JSON birebir aynı — ayrıca bir "mobile-specific" response şekillendirme katmanı yok. ' +
      '`/api/v1/mobile/app-config` (MobileConfigPublicEndpoints) ayrı bir amaca hizmet ediyor: bu, mobil uygulamanın "native ekranlar yerine WebView ile citizen-portal\'ı göster" davranışını admin panelinden açıp kapatmaya yarayan bir ayar — spor/tesis verisiyle ilgisi yok, karıştırılmamalı.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'Doğrulama amaçlı, kod değişikliği yok. İlgili dosyalar: api/src/Nexora.Api/Endpoints/Me/MeFacilityEndpoints.cs, api/src/Nexora.Application/Features/ParticipantFacilities/Dtos/CitizenFacilityDtos.cs',
    ],
  },
  {
    id: 'facility-list-facility-name-schedule-2026-07-26',
    category: 'Spor / Tesis Modülleri — Yaş-Cinsiyet Filtreleme (26.07.2026)',
    title: 'Spor salonu / tesis isimlerinin, program sayısının ve seans gün-saatlerinin listede gösterimi — DOĞRULANDI',
    description:
      'Talep: Spor salonlarında veya diğer tesislerde birden fazla program varsa tesis ismi, kaç program olduğu, listede tesis ismi + yaş grubu + seansın hangi gün/saatlerde olduğu gösterilsin. Mobilde detayda ise admin\'de hangi gün/saat seçilmişse SADECE o gösterilsin. ' +
      'Doğrulama: Bu davranış ZATEN mevcut ve doğru çalışıyor: ' +
      '(1) SportsPage.tsx ve FacilityProgramsTab.tsx grupları serviceFacilityName\'e göre grupluyor, her tesis başlığının altında o tesisin TÜM programları (branş bazlı alt gruplarla) listeleniyor; FacilityProgramsTab\'ta ayrıca "X program" sayacı ve tesis seçim sheet\'inde uygun program adedi gösteriliyor. ' +
      '(2) Her program kartında ageGroupLabel() ile yaş aralığı + cinsiyet, scheduleSummary ile gün/saat özeti gösteriliyor (BuildScheduleSummary backend\'de FacilityScheduleHelper.ParseSlots ile o GRUBA özel ScheduleJson\'dan üretiliyor — başka grupların günleri karışmıyor). ' +
      '(3) Detay modalında (FacilityDetailModal.tsx → GetDetailAsync) sessions listesi `FacilitySessions.GetByGroupAsync(group.Id)` ile SADECE o seçili grubun seanslarını çekiyor; admin panelinde o grup için tanımlanan gün/saatler dışında hiçbir şey görünmüyor. Bu nedenle "admin\'de hangisini seçmişsek sadece o gün ve saatleri gösterecek" davranışı zaten sağlanıyor, ek kod değişikliği gerekmedi.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'Doğrulama amaçlı, kod değişikliği yok. İlgili dosyalar: citizen-portal/src/modules/sports/SportsPage.tsx, citizen-portal/src/modules/facilities/FacilityProgramsTab.tsx, citizen-portal/src/modules/facilities/FacilityDetailModal.tsx, api/src/Nexora.Infrastructure/Services/ParticipantFacilityService.cs (BuildScheduleSummary, GetDetailAsync)',
    ],
  },
  {
    id: 'branches',
    category: 'Tesis Modülleri',
    title: 'Branş (Branches) Yönetimi',
    description:
      'Spor salonu, havuz, kamp gibi tesis modüllerine ait branşların listelenmesi, eklenmesi, düzenlenmesi ve silinmesi. Her tesis modülü için ayrı branş yönetimi ekranı gerekiyor.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET  /{module}/branches',
      'GET  /{module}/branches/options',
      'POST /{module}/branches',
      'PUT  /{module}/branches/{id}',
      'DEL  /{module}/branches/{id}',
    ],
    files: [
      'admin-panel/src/services/branches.service.ts  — YAZILACAK',
      'admin-panel/src/modules/sports/BranchesTab.tsx — YAZILACAK',
    ],
  },
  {
    id: 'instructors',
    category: 'Tesis Modülleri',
    title: 'Eğitmen (Instructors) Yönetimi',
    description:
      'Tesis modüllerine bağlı eğitmen/antrenör yönetimi. Eğitmen atama, listeleme, güncelleme.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET  /{module}/instructors',
      'GET  /{module}/instructors/options',
      'POST /{module}/instructors',
      'PUT  /{module}/instructors/{id}',
      'DEL  /{module}/instructors/{id}',
    ],
    files: [
      'admin-panel/src/services/instructors.service.ts — YAZILACAK',
      'admin-panel/src/modules/sports/InstructorsTab.tsx — YAZILACAK',
    ],
  },
  {
    id: 'devices',
    category: 'Tesis Modülleri',
    title: 'Cihaz (Devices) Yönetimi',
    description:
      'Tesis girişlerindeki QR kiosk ve turnike cihazlarının yönetimi. Cihaz kayıt, durum değiştirme, aktif/pasif.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET  /{module}/devices',
      'POST /{module}/devices',
      'PUT  /{module}/devices/{id}',
      'DEL  /{module}/devices/{id}',
      'PATCH /{module}/devices/{id}/toggle-status',
    ],
    files: [
      'admin-panel/src/services/devices.service.ts — YAZILACAK',
      'admin-panel/src/modules/sports/DevicesTab.tsx — YAZILACAK',
    ],
  },
  {
    id: 'registrations',
    category: 'Tesis Modülleri',
    title: 'Kayıt (Registrations) Yönetimi',
    description:
      'Tesis gruplarına katılımcı kaydı yönetimi. Kayıt onaylama, bekleme listesi, transfer, durum değiştirme.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET  /{module}/registrations',
      'POST /{module}/registrations',
      'PUT  /{module}/registrations/{id}',
      'PATCH /{module}/registrations/{id}/status',
      'DEL  /{module}/registrations/{id}',
    ],
    files: [
      'admin-panel/src/services/registrations.service.ts — YAZILACAK',
      'admin-panel/src/modules/sports/RegistrationsTab.tsx — YAZILACAK',
    ],
  },

  {
    id: 'loyalty-award',
    category: 'Sadakat Sistemi',
    title: 'Manuel Puan Verme (Award)',
    description: 'Admin tarafından katılımcılara manuel puan verilmesi. Açıklama ve puan miktarı ile. Backend artık AdminGrantPointsAsync ile tutar/gerekçe zorunlu kılıyor, audit log tutuyor (2026-07-29).',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: ['POST /loyalty/award'],
    files: [
      'admin-panel/src/modules/loyalty/AwardPointsDrawer.tsx — TAMAMLANDI',
    ],
  },
  {
    id: 'loyalty-balance',
    category: 'Sadakat Sistemi',
    title: 'Katılımcı Puan Bakiyesi',
    description: 'Katılımcı detay ekranında puan bakiyesi gösterimi.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: ['GET /loyalty/balance?participantId={id}'],
    files: [
      'admin-panel/src/modules/participants/ParticipantDetailModal.tsx — Sadakat sekmesi eklenecek',
    ],
  },
  {
    id: 'loyalty-earn-ways',
    category: 'Sadakat Sistemi',
    title: 'Puan Kazanma Yolları (Earn Ways)',
    description: 'Vatandaşın hangi eylemlerle puan kazanabileceğinin listesi ve tamamlanma durumu.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: ['GET /me/loyalty/earn-ways'],
  },
  {
    id: 'loyalty-streak',
    category: 'Sadakat Sistemi',
    title: 'Günlük Seri (Streak)',
    description: 'Katılımcının günlük check-in serisi, en uzun seri, haftalık takvim gösterimi.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: ['GET /me/loyalty/streak', 'POST /me/loyalty/check-in'],
  },
  {
    id: 'loyalty-catalog',
    category: 'Sadakat Sistemi',
    title: 'Ödül Kataloğu & Talep (Catalog + Redeem)',
    description: 'Vatandaşa sunulan ödül kataloğu görünümü ve ödül talep işlemi yönetimi.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: ['GET /me/loyalty/rewards/catalog', 'POST /me/loyalty/rewards/redeem'],
  },

  {
    id: 'events-audit',
    category: 'Etkinlik & Gezi',
    title: 'Etkinlik Audit / Kopyala / Geri Al',
    description: 'Etkinlik değişiklik geçmişi, kopyalama ve çöp kutusundan geri alma işlemleri.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET /events/{id}/audit',
      'POST /events/{id}/copy',
      'POST /events/{id}/restore',
      'GET /events/trash',
    ],
    files: [
      'admin-panel/src/modules/events/EventAuditTab.tsx — YAZILACAK',
      'admin-panel/src/modules/events/EventTrashPage.tsx — YAZILACAK',
    ],
  },
  {
    id: 'travels-extra',
    category: 'Etkinlik & Gezi',
    title: 'Gezi Koltuk / Manifest / Audit',
    description: 'Gezi otobüs koltuk planı, boarding manifestosu ve değişiklik geçmişi. (Yoklama roster\'ı 2026-09-30\'da tamamlandı: TravelAttendanceMarkModal.)',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET /travels/{id}/seating',
      'GET /travels/{id}/boarding/manifest',
      'GET /travels/{id}/audit',
      'POST /travels/{id}/copy',
      'POST /travels/{id}/restore',
      'GET /travels/trash',
    ],
    files: [
      'admin-panel/src/modules/travels/TravelSeatingTab.tsx — YAZILACAK',
      'admin-panel/src/modules/travels/TravelManifestTab.tsx — YAZILACAK',
    ],
  },

  {
    id: 'halls-features',
    category: 'Salonlar',
    title: 'Salon Özellik Kataloğu & Şablonlar',
    description: 'Salonlar için özellik grupları, özellik kataloğu ve özellik şablonları yönetimi.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET /halls/feature-catalog (admin)',
      'GET /public/halls/feature-catalog (citizen — YENİ eklendi)',
      'GET /halls/feature-groups',
      'POST /halls/feature-groups',
      'PUT /halls/feature-groups/{id}',
      'GET /halls/feature-templates',
      'GET /halls/features',
      'POST /halls/features',
      'PUT /halls/features/{id}',
      'GET /halls/summary',
    ],
    files: [
      'admin-panel/src/modules/halls/HallFeaturesTab.tsx — YAZILACAK',
    ],
  },

  {
    id: 'library-staff',
    category: 'Kütüphane',
    title: 'Kütüphane Personel & Kuralları',
    description: 'Kütüphane personel yönetimi, gecikmiş kitap listesi ve ödünç alma kuralları.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET /library-staff',
      'POST /library-staff',
      'GET /libraries/overdue-books (admin)',
      'GET /me/libraries/overdue-books (citizen — YENİ eklendi)',
      'GET /library-rules',
      'PUT /library-rules',
      'GET /libraries/kroki',
    ],
    files: [
      'admin-panel/src/modules/library/LibraryStaffTab.tsx — YAZILACAK',
      'admin-panel/src/modules/library/OverdueBooksTab.tsx — YAZILACAK',
      'citizen-portal: LibraryDetailModal — gecikmiş kitap uyarısı TAMAMLANDI ✓',
    ],
  },

  {
    id: 'citizen-menu',
    category: 'Menü & Navigasyon',
    title: 'Vatandaş Menü Yönetimi (citizen-menu)',
    description: 'Vatandaş portalındaki menü öğelerinin admin tarafından yönetilmesi. Zaten App Menü (public/app-menu) olarak Settings > Menü Yönetimi\'nde yapıldı. Bu endpoint eski/alternatif yol olabilir.',
    status: 'partial',
    backendDone: true,
    frontendDone: false,
    endpoints: [
      'GET /citizen-menu',
      'POST /citizen-menu',
      'PUT /citizen-menu/{id}',
    ],
    files: [
      'Araştır: citizen-menu ile public/app-menu farkı nedir?',
    ],
  },

  {
    id: 'participant-detail-modal',
    category: 'Katılımcılar',
    title: 'Katılımcı Detay Modal — Başvuru & Süreç Gösterimi',
    description:
      'Katılımcı detay modalında başvuruların hangi tesis/programda alındığı, sırada mı yoksa yedekte mi beklediği bilgileri tablo + icon olarak görünür hale getirildi. Hangi tesiste, hangi programda, sırada mı / başvuru alındı mı / yedekte mi bilgisi chip/badge ve icon ile gösteriliyor.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: [
      'GET /participants/{id} — detay alanları genişletildi',
      'GET /participants/{id}/applications — başvuru listesi',
    ],
    files: [
      'admin-panel/src/modules/participants/ParticipantDetailModal.tsx ✓',
      'admin-panel/src/modules/participants/participantColumns.tsx ✓',
    ],
  },
  {
    id: 'participant-security-fix',
    category: 'Katılımcılar',
    title: 'Katılımcı Endpoint Güvenlik Düzeltmesi',
    description:
      'ParticipantEndpoints.cs\'de sibling-asymmetry güvenlik açığı: Diğer katılımcıların verilerine izinsiz erişim imkânı vardı. Authorization kontrolü eksik endpoint\'lere eklendi.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: ['api/src/Nexora.Api/Endpoints/Participants/ParticipantEndpoints.cs — güvenlik güncellendi'],
  },

  {
    id: 'seda-multiclass',
    category: 'SEDA',
    title: 'SEDA Çoklu Sınıf Seçimi & Excel Export',
    description:
      'SEDA başvurular sekmesinde çoklu sınıf seçimi (MultiSelect bileşeni), tarih aralığı filtresi, okula göre filtreleme eklendi. Belirlenen tarih aralığındaki tüm kayıtlar Excel olarak indirilebiliyor.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: [
      'GET /seda/applications?classIds=&startDate=&endDate=&schoolId= — çoklu filtre',
      'GET /seda/applications/export — Excel export (belirli tarih aralığı)',
    ],
    files: [
      'admin-panel/src/modules/seda/SedaApplicationsTab.tsx ✓',
      'admin-panel/src/services/seda.service.ts ✓',
      'admin-panel/src/design-system/MultiSelect/MultiSelect.tsx ✓ (yeni bileşen)',
      'api/src/Nexora.Application/Features/Seda/Dtos/SedaApplicationDtos.cs ✓',
      'api/src/Nexora.Infrastructure/Persistence/Repositories/SedaApplicationRepository.cs ✓',
      'api/src/Nexora.Infrastructure/Services/SedaApplicationService.cs ✓',
      'api/src/Nexora.Api/Endpoints/Seda/SedaEndpoints.cs ✓',
    ],
  },
  {
    id: 'seda-excel-service',
    category: 'SEDA',
    title: 'Excel Servis Altyapısı (IExcelService)',
    description:
      'Genel Excel export servisi oluşturuldu. SEDA başvurularını Excel\'e aktarır; ilerleyen modüller de aynı servisi kullanabilir.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: [],
    files: [
      'api/src/Nexora.Application/Common/Interfaces/IExcelService.cs ✓',
      'api/src/Nexora.Infrastructure/Services/ExcelService.cs ✓',
    ],
  },

  {
    id: 'citizen-profile-photo',
    category: 'Vatandaş Portalı',
    title: 'Profil Fotoğrafı Yükleme (label+htmlFor fix)',
    description:
      'Profil fotoğrafı yükleme diyaloğu açılmıyordu. fileRef.current?.click() bazı tarayıcılarda engelleniyor. <button> yerine <label htmlFor="profile-photo-input"> kullanılarak düzeltildi. Ayrıca impersonating durumunda fotoğraf yükleme yanlışlıkla engellendi — İletişim/Şifre kısıtlanıyor fotoğraf değil.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'citizen-portal/src/modules/profile/ProfilePage.tsx ✓ — label+htmlFor pattern',
    ],
  },
  {
    id: 'citizen-sidebar-redesign',
    category: 'Vatandaş Portalı',
    title: 'Sidebar Kullanıcı Alanı Yeniden Tasarımı',
    description:
      'Sidebar kullanıcı bölümü yenilendi: TC numarası kaldırıldı yerine yaş yazıyor, isim normal font (bold değil), profil avatarına ✎ edit badge eklendi (/profil sayfasına link), hesap geçiş selectbox tasarımı güncellendi (geniş, border+background), kullanıcı bloğu ile nav arasına çizgi eklendi.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'citizen-portal/src/framework/layout/Sidebar.tsx ✓',
      'citizen-portal/src/framework/layout/MobileDrawer.tsx ✓',
    ],
  },
  {
    id: 'citizen-home-avatar',
    category: 'Vatandaş Portalı',
    title: 'Ana Sayfa Avatar Edit Linki',
    description:
      'Ana sayfadaki (YY) avatar artık /profil sayfasına link veriyor. ✎ edit badge eklendi böylece kullanıcı fotoğraf güncelleyebileceğini görüyor.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'citizen-portal/src/modules/home/HomePage.tsx ✓',
    ],
  },
  {
    id: 'citizen-menu-flat',
    category: 'Vatandaş Portalı',
    title: 'Hizmetler Menüsü Düz Liste (Accordion Kaldırıldı)',
    description:
      'Vatandaş portalı sol menüsündeki Hizmetler altı accordion/collapse yapısı kaldırıldı. Tüm alt menü öğeleri doğrudan düz liste olarak görünüyor, section başlığı sadece küçük label etiket.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'citizen-portal/src/framework/layout/Sidebar.tsx ✓ — DynamicSectionNav düz liste',
      'citizen-portal/src/framework/layout/MobileDrawer.tsx ✓ — DrawerSection düz liste',
    ],
  },

  {
    id: 'multiselect-component',
    category: 'Design System',
    title: 'MultiSelect Bileşeni',
    description:
      'Çoklu seçim dropdown bileşeni oluşturuldu. SEDA sınıf seçimi için kullanıldı, diğer modüllerde de kullanılabilir.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'admin-panel/src/design-system/MultiSelect/MultiSelect.tsx ✓',
      'admin-panel/src/design-system/MultiSelect/index.ts ✓',
      'admin-panel/src/design-system/index.ts ✓ — export eklendi',
    ],
  },
  {
    id: 'table-component-update',
    category: 'Design System',
    title: 'Table Bileşeni Güncelleme',
    description: 'Tablo bileşenine ekstra kolon/görünüm özellikleri eklendi.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    files: [
      'admin-panel/src/design-system/Table/Table.tsx ✓',
    ],
  },

  {
    id: 'education',
    category: 'Eğitim',
    title: 'Eğitim Geçmişi & Kurumlar',
    description: 'Katılımcı eğitim geçmişi yönetimi ve eğitim kurumları tanımlama. Seviyeye göre kurum filtreleme (ilkokul/ortaokul → Bakırköy; üniversite/meslek → ulusal).',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: [
      'GET/POST/PUT/DEL /education/histories (admin)',
      'GET/POST/PUT/DEL /me/education/histories (citizen)',
      'GET /education/institutions/options',
      'GET /me/education/institutions/options',
    ],
  },
  {
    id: 'app-menu',
    category: 'Menü & Navigasyon',
    title: 'Uygulama Menüsü (App Menu)',
    description: 'Vatandaş ve mobil portal menü yönetimi admin panelinden yapılıyor.',
    status: 'done',
    backendDone: true,
    frontendDone: true,
    endpoints: ['GET/POST/PUT/DEL /public/app-menu'],
  },
]

const STATUS_CONFIG = {
  done: { label: 'Tamamlandı', tone: 'success' as const, icon: CheckCircle2Icon, color: 'text-success' },
  partial: { label: 'Backend Hazır / Frontend Eksik', tone: 'warning' as const, icon: ClockIcon, color: 'text-warning' },
  pending: { label: 'Yapılacak', tone: 'neutral' as const, icon: CircleIcon, color: 'text-foreground-muted' },
}

const categories = [...new Set(NOTES.map((n) => n.category))]
const pendingCount = NOTES.filter((n) => n.status !== 'done').length
const doneCount = NOTES.filter((n) => n.status === 'done').length

export const DevNotesPage = () => {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={CodeIcon}
        title="Geliştirme Notları"
        subtitle={`${pendingCount} eksik alan · ${doneCount} tamamlanan`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-card border border-border bg-card shadow-card p-4">
            <p className="type-caption text-foreground-muted mb-1">Backend Hazır</p>
            <p className="text-2xl font-bold text-foreground-strong">{NOTES.filter((n) => n.backendDone).length}</p>
            <p className="type-caption text-foreground-muted">endpoint grubu</p>
          </div>
          <div className="rounded-card border border-border bg-card shadow-card p-4">
            <p className="type-caption text-foreground-muted mb-1">Frontend Eksik</p>
            <p className="text-2xl font-bold text-warning">{NOTES.filter((n) => !n.frontendDone).length}</p>
            <p className="type-caption text-foreground-muted">modül/servis yazılacak</p>
          </div>
          <div className="rounded-card border border-border bg-card shadow-card p-4">
            <p className="type-caption text-foreground-muted mb-1">Tamamlanan</p>
            <p className="text-2xl font-bold text-success">{doneCount}</p>
            <p className="type-caption text-foreground-muted">tam entegre</p>
          </div>
        </div>

        {categories.map((cat) => {
          const catNotes = NOTES.filter((n) => n.category === cat)
          return (
            <div key={cat}>
              <h2 className="type-section mb-3 text-foreground-strong">{cat}</h2>
              <div className="space-y-3">
                {catNotes.map((note) => {
                  const sc = STATUS_CONFIG[note.status]
                  const Icon = sc.icon
                  return (
                    <div
                      key={note.id}
                      className="rounded-card border border-border bg-card shadow-card overflow-hidden"
                    >
                      <div className="flex items-start gap-3 px-4 py-3 border-b border-border">
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${sc.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="type-body-strong">{note.title}</h3>
                            <Badge tone={sc.tone}>{sc.label}</Badge>
                            {note.backendDone && <Badge tone="info">Backend ✓</Badge>}
                            {!note.frontendDone && note.status !== 'done' && (
                              <Badge tone="warning">
                                <AlertTriangleIcon className="w-3 h-3 mr-1" />
                                Frontend Eksik
                              </Badge>
                            )}
                          </div>
                          <p className="type-caption text-foreground-muted mt-0.5">{note.description}</p>
                        </div>
                      </div>

                      {(note.endpoints || note.files) && (
                        <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {note.endpoints && (
                            <div>
                              <p className="type-caption font-semibold text-foreground-muted mb-1.5">Backend Endpoint'ler</p>
                              <ul className="space-y-1">
                                {note.endpoints.map((ep) => (
                                  <li key={ep} className="font-mono text-[11px] text-foreground-default bg-surface-1 rounded px-2 py-0.5">
                                    {ep}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {note.files && (
                            <div>
                              <p className="type-caption font-semibold text-foreground-muted mb-1.5">Yapılacak Dosyalar</p>
                              <ul className="space-y-1">
                                {note.files.map((f) => (
                                  <li key={f} className="font-mono text-[11px] text-warning bg-warning/5 rounded px-2 py-0.5 border border-warning/20">
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

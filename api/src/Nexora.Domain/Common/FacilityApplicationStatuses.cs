namespace Nexora.Domain.Common;

/// <summary>
/// Hata raporu (docs/hata.md #5, #7, #8 — Spor / Gençlik Kampı / İzcilik Kampı): sistem
/// "... günü başvuru yapıldığı için başvuru yapılamıyor" diyordu ama engelleyen kayıt
/// "Başvurularım" ekranında görünmüyordu. Kök neden tek bir hata değil, bir TUTARSIZLIKTI:
/// "aktif başvuru" tanımı mükerrer kontrolde, çakışma kontrolünde, keşfet ekranındaki
/// "başvurdum" rozetinde ve Başvurularım listesinde ayrı ayrı elle yazılmıştı
/// (kimi yerde <c>Status != "rejected"</c>, kimi yerde <c>+ != "expired"</c>, kimi yerde
/// ayrıca <c>!IsDeleted</c>). Bu yüzden bir kayıt "başvuruyu engelleyecek kadar aktif" ama
/// "listede gösterilecek kadar aktif değil" olabiliyordu.
///
/// Tanım artık burada, tek yerde. Engelleme ve listeleme aynı kuralı kullandığı için
/// ayrışamazlar: engelleyen bir kayıt varsa Başvurularım'da MUTLAKA görünür.
/// </summary>
public static class FacilityApplicationStatuses
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Waitlist = "waitlist";
    public const string Rejected = "rejected";
    /// <summary>Dönemi/hakkı dolan üyelik. Reddetme değildir, tekrar başvuruya izin verir.</summary>
    public const string Expired = "expired";
    /// <summary>
    /// Bulgu (2026-10-04, canlı QA denetimi — nihai prod-öncesi tur): vatandaşın KENDİ
    /// iptal ettiği başvuru önceden "Rejected" olarak kapatılıyor + soft-delete ediliyordu
    /// (Event/Travel'da daha önce düzeltilen "C6" bug'ının aynısı, Facility'ye hiç backport
    /// edilmemiş). Sonucu: iptal edilen başvuru "Başvurularım" listesinden TAMAMEN kayboluyor
    /// (geçmişte görünmüyor) ve anlamsal olarak "reddedildi" gibi yanlış bir statüye düşüyordu.
    /// Artık Event/Travel'daki "cancelled" deseniyle tutarlı: kayıt geçmişte görünür kalır.
    /// </summary>
    public const string Cancelled = "cancelled";

    /// <summary>
    /// Kaydın vatandaş için hâlâ "yaşayan" bir başvuru olup olmadığı: hem yeni başvuruyu
    /// engeller hem de Başvurularım listesinde görünür. İkisi aynı yüklem olmak zorunda.
    /// </summary>
    public static bool IsActive(string status)
        => status is not (Rejected or Expired or Cancelled);
}

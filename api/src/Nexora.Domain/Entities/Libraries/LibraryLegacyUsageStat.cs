using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

// Kullanıcı isteği (2026-10-05): "/Users/mac/Downloads/sultanga_genclik_20261005_032409.sql
// kütüphanelerde hangi kullanıcılar şimdiye kadar kaç defa kullanmış incele ve bunu sisteme
// istatistiklere ekle". Eski (2019-2026) MySQL tabanlı Millet Kıraathanesi sisteminin
// `milletkoturum` tablosundan (491.772 ham oturum kaydı, 17.572 benzersiz T.C.) TCKN bazında
// özetlenmiş, tek seferlik bir içe aktarım (one-time import) sonucudur. Bu tablo CANLI oturum
// akışının bir parçası DEĞİLDİR — yalnızca eski sistemin arşiv/tarihsel kullanım istatistiğini
// tutar, LibrarySession'ın yerini almaz. Katılımcı eşleştirmesi Tckn üzerinden canlıda yapılır
// (ParticipantId burada saklanmaz, çünkü katılımcı silinebilir/yeniden oluşturulabilir — isim
// güncel Participants kaydından her sorguda taze çekilir).
public class LibraryLegacyUsageStat : BaseEntity
{
    public string Tckn { get; private set; } = "";
    public int TotalVisits { get; private set; }
    public double TotalHours { get; private set; }
    public DateTime FirstVisitAt { get; private set; }
    public DateTime LastVisitAt { get; private set; }
    // Kaynak sistemdeki kütüphane/bölge adı (ör. "ŞEHİT HİKMET BAYSAL G.M. MİLLET KIRAATHANESİ") —
    // birden fazla bölgede kullanılmışsa en çok ziyaret edilen bölge adı tutulur, bilgi amaçlıdır.
    public string? PrimaryLocationName { get; private set; }
    public string ImportBatchId { get; private set; } = "";

    private LibraryLegacyUsageStat() { }

    public static LibraryLegacyUsageStat Create(
        string tckn, int totalVisits, double totalHours,
        DateTime firstVisitAt, DateTime lastVisitAt, string? primaryLocationName, string importBatchId)
        => new()
        {
            Tckn = tckn,
            TotalVisits = totalVisits,
            TotalHours = totalHours,
            FirstVisitAt = firstVisitAt,
            LastVisitAt = lastVisitAt,
            PrimaryLocationName = primaryLocationName,
            ImportBatchId = importBatchId,
        };
}

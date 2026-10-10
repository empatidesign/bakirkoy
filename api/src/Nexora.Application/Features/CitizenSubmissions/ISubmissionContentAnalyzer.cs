namespace Nexora.Application.Features.CitizenSubmissions;

/// <summary>
/// Kullanıcı isteği (2026-08-28): "konular yazıldığında içerik olarak bu konular analiz edilip
/// istek ilgili müdürlüğe iletilecek; gelen içerikte kişi ismi veya şikayet edilecek bir konu
/// varsa bu Ulakbel'e gidecek". Başvuru metni (başlık + açıklama) anahtar kelime sözlüğüyle
/// analiz edilip:
///  - en olası kategori (CategoryId) ve o kategorinin bağlı olduğu müdürlük (RoutedUnit),
///  - kararın güven skoru (0-1),
///  - eşleşen anahtar kelimeler (denetlenebilirlik),
///  - metinde kişiye yönelik referans olup olmadığı (kişi adı, "komşum", "esnaf" vb.)
/// çıkarılır. Kişi referansı içeren kayıtlar muhtara asla açık içerikle gösterilmez.
/// </summary>
public interface ISubmissionContentAnalyzer
{
    SubmissionAnalysisResult Analyze(string title, string description, string? fallbackCategoryId, string submissionType);

    // Kullanıcı isteği (2026-09-07): "birini şikayet etmişse veya şahıs isimleri varsa
    // bunları *** olarak muhtar görsün sadece genel metni görsün" — muhtarın gördüğü
    // başlık/açıklamada tespit edilen kişi adları *** ile değiştirilir, geri kalan genel
    // metin (konu/şikayet özeti) görünür kalır. Eskiden tüm içerik tamamen gizleniyordu
    // (ContainsPersonReference=true -> Title/Description=null); bu daha az bilgi kaybına
    // yol açan, kullanıcının talep ettiği ayrıntı düzeyidir.
    string MaskPersonNames(string text);
}

public record SubmissionAnalysisResult(
    string CategoryId,
    string RoutedUnit,
    double Confidence,
    IReadOnlyList<string> Keywords,
    bool ContainsPersonReference,
    string Summary);

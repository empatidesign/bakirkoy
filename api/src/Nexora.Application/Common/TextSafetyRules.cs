using System.Text.RegularExpressions;

namespace Nexora.Application.Common;

// 2026-08-04 kullanıcı bildirimi: gezi/etkinlik/grup vb. isim alanlarında HTML entity
// kaçışlarının (ör. "&#39;&#39;1 İnsan 2 Mucize&#39;&#39;") ham haliyle görünmesi ve
// çift tırnak/açı parantezi gibi HTML'i bozan karakterlerin isimlere karışması
// istenmiyor ("DR. FARUK ÖNDAĞ İLE &#39;&#39;1 İnsan 2 Mucize&#39;&#39;" örneği verildi —
// eski MySQL dump'ından (sultanga_genclik) aktarılacak ham veride bu artefakt var).
// Parantez "()" ve eğik çizgi "/" kullanımına açıkça izin veriliyor (gerçek veride
// yaygınlar, ör. "29 ARALIK PAZARTESİ · Masal Sınıfı - ... Etkinliği | 10:15 Seansı",
// "[SENARYO] ..."). Bu; XSS'ten çok veri/görüntü kalitesi kontrolüdür (defense-in-depth
// olarak da işlev görür — düz metin alanlarına markup kaçması engellenir).
public static class TextSafetyRules
{
    // &amp; &#39; &lt; &gt; &quot; &apos; &#x27; gibi tüm sayısal/isimli HTML entity kaçışlarını yakalar.
    private static readonly Regex HtmlEntityPattern = new(@"&#?[a-zA-Z0-9]+;", RegexOptions.Compiled);

    // Ham HTML/markup karakterleri: < > işaretleme başlatır, çift tırnak (") HTML
    // attribute'larını kırar/mojibake belirtisi olabilir (kullanıcı bildirimi: "é" gibi
    // kaçmış/mojibake karakterlerle birlikte görülen " işareti).
    private static readonly Regex UnsafeMarkupCharsPattern = new("[<>\"]", RegexOptions.Compiled);

    public static bool IsFreeOfHtmlArtifacts(string? value)
    {
        if (string.IsNullOrEmpty(value)) return true;
        return !HtmlEntityPattern.IsMatch(value) && !UnsafeMarkupCharsPattern.IsMatch(value);
    }

    public const string ErrorMessageSuffix = " özel karakter (&#39; gibi HTML kodu, \" veya < >) içeremez.";
}

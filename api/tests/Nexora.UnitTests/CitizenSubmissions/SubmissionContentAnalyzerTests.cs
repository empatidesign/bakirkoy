using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.CitizenSubmissions;

/// <summary>
/// Kullanıcı isteği (2026-08-28): "konular yazıldığında içerik olarak bu konular analiz edilip
/// istek ilgili müdürlüğe iletilecek" ve "gelen içerikte kişi ismi veya şikayet edilecek bir
/// konu varsa" o kayıt muhtara açık içerikle gösterilmemeli.
///
/// Bu testler analiz motorunun iki kritik davranışını kilitler:
///  1) Doğru kategori ve doğru müdürlük seçimi.
///  2) Kişi referansı tespiti — ve canlı testte yakalanan yanlış pozitifin (yer adları
///     "Cebeci Mahallesi" kişi adı sanılıyordu) geri gelmemesi.
/// </summary>
public class SubmissionContentAnalyzerTests
{
    private readonly SubmissionContentAnalyzer _analyzer = new();

    [Theory]
    [InlineData("Sokak lambası yanmıyor", "Üç gündür sokak lambaları yanmıyor, akşamları karanlık.", "lighting", "Fen İşleri Müdürlüğü")]
    [InlineData("Kaldırım çökmüş durumda", "Kaldırım taşları çökmüş, yaşlılar geçemiyor.", "sidewalk", "Fen İşleri Müdürlüğü")]
    [InlineData("Çöp toplanmıyor", "Konteynerler günlerdir boşaltılmadı, koku var.", "cleaning", "Temizlik İşleri Müdürlüğü")]
    [InlineData("Parkta oyun grubu kırık", "Çocuk parkındaki oyun grubu ve banklar kırılmış.", "park_garden", "Park ve Bahçeler Müdürlüğü")]
    [InlineData("Gürültü rahatsızlığı", "Her gece yüksek sesle müzik açılıyor, gürültüden rahatsızız.", "noise", "Çevre Koruma Müdürlüğü")]
    [InlineData("Sahipsiz köpekler", "Sokak hayvanları için besleme noktası talep ediyoruz.", "stray_animal", "Veteriner İşleri Müdürlüğü")]
    public void Analyze_DogruKategoriVeMudurlugeYonlendirir(
        string title, string description, string expectedCategory, string expectedUnit)
    {
        var result = _analyzer.Analyze(title, description, fallbackCategoryId: "other", submissionType: "request");

        Assert.Equal(expectedCategory, result.CategoryId);
        Assert.Equal(expectedUnit, result.RoutedUnit);
        Assert.True(result.Confidence > 0, "Anahtar kelime eşleştiğinde güven skoru sıfırdan büyük olmalı.");
        Assert.NotEmpty(result.Keywords);
    }

    /// <summary>
    /// Hata bulgusu (2026-09-02, E2E testi): anahtar kelimeler ALT DİZE olarak aranıyordu.
    /// "su" anahtar kelimesi "Başvurusu", "kusurlu", "masrafı" gibi ALAKASIZ kelimelerin
    /// içinde eşleşiyor ve kaydı "Alt Yapı (Su/Kanal)" sayıp yanlışlıkla İSKİ'ye
    /// yönlendiriyordu. Vatandaşın seçtiği kategori (yol) eziliyordu.
    ///
    /// Aynı sorun "ses" → "seslendi", "gider" → "giderek" gibi kısa kelimelerde de var.
    /// Eşleşme artık KELİME SINIRINA saygı duymalı.
    /// </summary>
    [Theory]
    [InlineData("E2E Muhtarlık Başvurusu 123", "Playwright tarafından oluşturulan e2e test başvurusu.", "road")]
    [InlineData("Yol çukuru", "Kaplama kusurlu, asfalt çökmüş durumda.", "road")]
    [InlineData("Yol bozuk", "Tamir masrafı yüksek olsa da asfalt yenilenmeli.", "road")]
    public void Analyze_KisaAnahtarKelimeyiKelimeIcindeEslestirmez(
        string title, string description, string expectedCategory)
    {
        var result = _analyzer.Analyze(title, description, fallbackCategoryId: "road", submissionType: "complaint");
        Assert.Equal(expectedCategory, result.CategoryId);
    }

    [Fact]
    public void Analyze_AnahtarKelimeYoksaVatandasinSectigiKategoriyiKorur()
    {
        var result = _analyzer.Analyze(
            "Bir konu hakkında",
            "Belirgin bir anahtar sözcük içermeyen serbest metin.",
            fallbackCategoryId: "building",
            submissionType: "suggestion");

        Assert.Equal("building", result.CategoryId);
        Assert.Equal(0, result.Confidence);
        Assert.Empty(result.Keywords);
    }

    [Theory]
    // Regresyon: yer/kurum adları kişi adı sanılmamalı (canlı testte tespit edildi).
    [InlineData("Kaldırım çökmüş durumda", "Cebeci Mahallesi 15. sokakta kaldırım taşları çökmüş.")]
    [InlineData("Yol bozuk", "Gazi Mahallesi ana caddesinde asfalt tamamen bozulmuş.")]
    [InlineData("Park bakımsız", "Yunus Emre Mahallesi çocuk parkı bakımsız durumda.")]
    public void Analyze_YerAdlariniKisiReferansiSaymaz(string title, string description)
    {
        var result = _analyzer.Analyze(title, description, "other", "complaint");
        Assert.False(result.ContainsPersonReference,
            "Mahalle/cadde gibi yer adları kişi referansı sayılmamalı, aksi halde içerik gereksiz yere gizlenir.");
    }

    [Theory]
    [InlineData("Gürültü şikayeti", "Üst kattaki komşum Ahmet Yıldırım her gece müzik açıyor.")]
    [InlineData("Esnaf şikayeti", "Alt kattaki esnaf kaldırımı işgal ediyor.")]
    [InlineData("Kişi şikayeti", "Apartman yöneticisi ortak alanı kendi deposu gibi kullanıyor.")]
    public void Analyze_KisiyeYonelikIfadeyiTespitEder(string title, string description)
    {
        var result = _analyzer.Analyze(title, description, "other", "complaint");
        Assert.True(result.ContainsPersonReference,
            "Kişiye yönelik ifade tespit edilmeli ki kayıt muhtara açık içerikle gösterilmesin.");
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-07): "birini şikayet etmişse veya şahıs isimleri varsa
    /// bunları *** olarak muhtar görsün sadece genel metni görsün adres kişisel bilgiler
    /// ad soyad bilgileri muhtar göremesin" — MaskPersonNames metnin GENEL KISMINI
    /// korurken tespit edilen kişi adı adaylarını *** ile değiştirmeli. Not: FullNamePattern
    /// regex'i "Ad Soyad"dan sonraki 3. kelimeyi de (varsa) aynı eşleşmeye dahil eder (yer adı
    /// eki mi diye bakabilmek için) — bu yüzden maskeleme bazen hemen sonraki kelimeyi de
    /// kapsar; bu, isim ifşasını önlemek için kabul edilebilir bir taşma (aşırı-maskeleme,
    /// yetersiz-maskelemeden çok daha güvenlidir).
    /// </summary>
    [Theory]
    [InlineData("Ahmet Yılmaz gürültü yapıyor", "*** yapıyor")]
    [InlineData("Sokak lambası yanmıyor", "Sokak lambası yanmıyor")]
    public void MaskPersonNames_kisi_adlarini_maskeler_genel_metni_korur(string input, string expected)
    {
        var masked = _analyzer.MaskPersonNames(input);
        Assert.Equal(expected, masked);
    }

    /// <summary>Maskelenen kişi adı ne olursa olsun sonucun asla ham "Ad Soyad" biçiminde
    /// gerçek ismi içermediğini doğrular (asıl güvenlik garantisi budur).</summary>
    [Theory]
    [InlineData("Ahmet Yılmaz sürekli gürültü yapıyor", "Ahmet Yılmaz")]
    [InlineData("Komşum Mehmet Kaya bahçemi işgal etti", "Mehmet Kaya")]
    public void MaskPersonNames_gercek_ismi_hicbir_sekilde_icermez(string input, string realName)
    {
        var masked = _analyzer.MaskPersonNames(input);
        Assert.DoesNotContain(realName, masked);
        Assert.Contains("***", masked);
    }

    /// <summary>Yer/kurum adları ("Cebeci Mahallesi", "Fen İşleri Müdürlüğü") kişi adı
    /// sanılıp maskelenmemeli — DetectPersonReference ile aynı eleme listesini kullanır.</summary>
    [Theory]
    [InlineData("Cebeci Mahallesi'nde yol bozuk")]
    [InlineData("Yunus Emre Mahallesi park istiyor")]
    [InlineData("Fen İşleri Müdürlüğü ilgilenmeli")]
    public void MaskPersonNames_yer_kurum_adlarini_maskelemez(string input)
    {
        var masked = _analyzer.MaskPersonNames(input);
        Assert.Equal(input, masked);
        Assert.DoesNotContain("***", masked);
    }

    [Fact]
    public void MaskPersonNames_bos_metinde_hata_vermez()
    {
        Assert.Equal("", _analyzer.MaskPersonNames(""));
        Assert.Null(_analyzer.MaskPersonNames(null!));
    }
}

/// <summary>
/// Kullanıcı isteği (2026-08-28): adres türü/kapsam seçimi ve kimlik gizliliği varsayılanları.
/// </summary>
public class CitizenSubmissionEntityTests
{
    private static CitizenSubmission NewSubmission() => CitizenSubmission.Create(
        "Ali Veli", "5550000000", "12345678901",
        "Gazi Mahallesi", "Gazi Mah. 1. Sk.",
        "lighting", "complaint", "high",
        "Başlık", "Açıklama");

    [Fact]
    public void Varsayilan_IkametgahVeMahalleKapsamidir()
    {
        var s = NewSubmission();
        Assert.Equal("residence", s.AddressType);
        Assert.Equal("neighborhood", s.Scope);
        Assert.True(s.IsAnonymousToMuhtar, "Vatandaş kimliği muhtara karşı varsayılan olarak gizli olmalı.");
    }

    [Theory]
    [InlineData("other", "district", "other", "district")]
    [InlineData("residence", "neighborhood", "residence", "neighborhood")]
    // Geçersiz değerler güvenli varsayılana düşer (istemci sahteciliğine karşı).
    [InlineData("hacked", "hacked", "residence", "neighborhood")]
    public void SetLocationContext_DegerleriNormalizeEder(
        string addressType, string scope, string expectedAddressType, string expectedScope)
    {
        var s = NewSubmission();
        s.SetLocationContext(addressType, scope);
        Assert.Equal(expectedAddressType, s.AddressType);
        Assert.Equal(expectedScope, s.Scope);
    }

    [Fact]
    public void MarkFirstResponse_YalnizcaIlkCagridaAyarlanir()
    {
        var s = NewSubmission();
        Assert.Null(s.FirstResponseAt);

        s.MarkFirstResponse();
        var first = s.FirstResponseAt;
        Assert.NotNull(first);

        s.MarkFirstResponse();
        Assert.Equal(first, s.FirstResponseAt);
    }

    [Fact]
    public void ApplyAnalysis_YonlendirilenBirimiVeAnahtarKelimeleriKaydeder()
    {
        var s = NewSubmission();
        s.ApplyAnalysis("Fen İşleri Müdürlüğü", 0.9, ["lamba", "aydinlatma"], containsPersonReference: true, categoryId: "lighting");

        Assert.Equal("Fen İşleri Müdürlüğü", s.RoutedUnit);
        Assert.Equal(0.9, s.AnalysisConfidence);
        Assert.Equal(2, s.AnalysisKeywords.Count);
        Assert.True(s.ContainsPersonReference);
        Assert.Equal("lighting", s.CategoryId);
    }
}

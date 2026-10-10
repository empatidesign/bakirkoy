using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

/// <summary>
/// Kullanıcı isteği (2026-09-02): mahalle birleştirme düzeltmesinin gerçekten çalıştığı
/// kanıtlanmalı ("mutasyon testi yap, iddiaları kanıtla").
///
/// Korunan hata: Mahalle Analizi ekranında aynı mahalle iki satıra bölünüyordu —
/// anket modülü ek atılmamış/farklı yazımlı kaydediyor, muhtarlık modülü "Mahallesi"
/// ekiyle kaydediyordu. Bu testler CanonicalName gövdesindeki herhangi bir mutasyonu
/// (ek atmayı kaldırmak, yazım eşlemesini silmek, büyük/küçük harf duyarsızlığını
/// bozmak) yakalar.
/// </summary>
public class BakirkoyNeighborhoodsTests
{
    [Theory]
    // "Mahallesi" eki atılmalı (bu satır silinirse ek-atma mutasyonu yakalanır).
    [InlineData("Cevizlik Mahallesi", "Cevizlik")]
    [InlineData("Zuhuratbaba Mahallesi", "Zuhuratbaba")]
    [InlineData("  Kartaltepe   Mahallesi  ", "Kartaltepe")]
    [InlineData("Cevizlik MAHALLESİ", "Cevizlik")]      // büyük/küçük harf duyarsız
    // Zaten kanonik olan değişmemeli (idempotent).
    [InlineData("Cevizlik", "Cevizlik")]
    [InlineData("Yeşilköy", "Yeşilköy")]
    public void CanonicalName_tek_forma_indirger(string input, string expected)
        => Assert.Equal(expected, BakirkoyNeighborhoods.CanonicalName(input));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void CanonicalName_bos_girdide_bos_doner(string? input)
        => Assert.Equal(string.Empty, BakirkoyNeighborhoods.CanonicalName(input));

    /// <summary>Asıl hata: iki modülün yazımı AYNI anahtara düşmeli.</summary>
    [Theory]
    [InlineData("Cevizlik", "Cevizlik Mahallesi")]
    [InlineData("Yeşilyurt", "Yeşilyurt Mahallesi")]
    [InlineData("Zuhuratbaba", "Zuhuratbaba Mahallesi")]
    public void Anket_ve_muhtarlik_yazimlari_ayni_anahtara_duser(string anket, string muhtarlik)
        => Assert.Equal(BakirkoyNeighborhoods.CanonicalName(muhtarlik),
                        BakirkoyNeighborhoods.CanonicalName(anket));

    /// <summary>CanonicalName çıktısı resmî mahalle listesiyle uyumlu olmalı.</summary>
    [Fact]
    public void Kanonik_adlar_resmi_listede_yer_alir()
    {
        foreach (var name in BakirkoyNeighborhoods.All)
        {
            Assert.Equal(name, BakirkoyNeighborhoods.CanonicalName(name));
            Assert.Equal(name, BakirkoyNeighborhoods.CanonicalName($"{name} Mahallesi"));
        }
    }

    /// <summary>Farklı mahalleler yanlışlıkla birleşmemeli (aşırı normalleştirme koruması).</summary>
    [Fact]
    public void Farkli_mahalleler_birlesmez()
    {
        var keys = BakirkoyNeighborhoods.All
            .Select(n => BakirkoyNeighborhoods.CanonicalName($"{n} Mahallesi"))
            .ToArray();
        Assert.Equal(keys.Length, keys.Distinct().Count());
    }

    /// <summary>Resmi liste tam olarak Bakırköy'ün 15 mahallesini içermeli.</summary>
    [Fact]
    public void Resmi_liste_15_mahalle_icerir()
        => Assert.Equal(15, BakirkoyNeighborhoods.All.Length);
}
